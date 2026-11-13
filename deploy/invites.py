import json
import re
import secrets
import sqlite3
import sys
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

ENTOURAGE_ROLES = {
    "bride-parents", "groom-parents", "sponsors", "honor", "best-man",
    "bridesmaids", "groomsmen", "flower-girls", "ring-bearers",
}


class InvitationStore:
    def __init__(self, path):
        self.path = path
        with closing(sqlite3.connect(path)) as db, db:
            db.execute("CREATE TABLE IF NOT EXISTS invitations (token TEXT PRIMARY KEY, name TEXT NOT NULL, seats INTEGER NOT NULL)")
            columns = {row[1] for row in db.execute("PRAGMA table_info(invitations)")}
            if "active" not in columns:
                db.execute("ALTER TABLE invitations ADD COLUMN active INTEGER NOT NULL DEFAULT 1")
            db.execute("CREATE TABLE IF NOT EXISTS entourage (id INTEGER PRIMARY KEY CHECK (id = 1), roster TEXT NOT NULL)")

    def read_entourage(self):
        with closing(sqlite3.connect(self.path)) as db:
            row = db.execute("SELECT roster FROM entourage WHERE id = 1").fetchone()
        return json.loads(row[0]) if row else {}

    def save_entourage(self, data):
        if data.keys() != ENTOURAGE_ROLES:
            raise ValueError("Include each entourage role.")
        roster = {}
        for role, names in data.items():
            if not isinstance(names, list) or len(names) > 40 or any(
                not isinstance(name, str) or not 1 <= len(name.strip()) <= 100
                for name in names
            ):
                raise ValueError("Use up to 40 names per role, with at most 100 characters per name.")
            roster[role] = [name.strip() for name in names]
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("INSERT OR REPLACE INTO entourage VALUES (1, ?)", (json.dumps(roster),))

    @staticmethod
    def validate_guest(name, seats):
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
            raise ValueError("Enter a guest or family name (1–100 characters).")
        if type(seats) is not int or not 1 <= seats <= 100:
            raise ValueError("Enter a whole number of seats from 1 to 100.")

    def create(self, name, seats):
        self.validate_guest(name, seats)
        token = secrets.token_urlsafe(24)
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("INSERT INTO invitations (token, name, seats) VALUES (?, ?, ?)", (token, name.strip(), seats))
        return token

    def list_invites(self):
        with closing(sqlite3.connect(self.path)) as db:
            rows = db.execute("SELECT token, name, seats, active FROM invitations ORDER BY rowid DESC").fetchall()
        return [{"token": token, "name": name, "seats": seats, "active": bool(active)}
                for token, name, seats, active in rows]

    def update_invite(self, token, name, seats, active):
        self.validate_guest(name, seats)
        if type(active) is not bool:
            raise ValueError("Choose whether the link is active.")
        with closing(sqlite3.connect(self.path)) as db, db:
            result = db.execute("UPDATE invitations SET name = ?, seats = ?, active = ? WHERE token = ?",
                                (name.strip(), seats, active, token))
            return result.rowcount == 1

    def delete_invite(self, token):
        with closing(sqlite3.connect(self.path)) as db, db:
            result = db.execute("DELETE FROM invitations WHERE token = ?", (token,))
            return result.rowcount == 1

    def find(self, token):
        with closing(sqlite3.connect(self.path)) as db:
            row = db.execute("SELECT name, seats FROM invitations WHERE token = ? AND active = 1", (token,)).fetchone()
        return {"name": row[0], "seats": row[1]} if row else None


class InvitationHandler(BaseHTTPRequestHandler):
    def log_message(self, *_):
        pass

    def respond(self, status, value):
        body = json.dumps(value).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/admin/api/invites":
            self.respond(200, self.server.store.list_invites())
            return
        if self.path == "/api/entourage":
            self.respond(200, self.server.store.read_entourage())
            return
        match = re.fullmatch(r"/api/invites/([A-Za-z0-9_-]{32})", self.path)
        invitation = self.server.store.find(match[1]) if match else None
        if invitation is None:
            self.respond(404, {"error": "Invitation link not found."})
            return
        self.respond(200, invitation)

    def do_DELETE(self):
        match = re.fullmatch(r"/admin/api/invites/([A-Za-z0-9_-]{32})", self.path)
        if not match:
            self.respond(404, {"error": "Not found."})
            return
        if self.headers.get("X-Invite-Action") != "delete":
            self.respond(400, {"error": "Invalid delete request."})
            return
        if not self.server.store.delete_invite(match[1]):
            self.respond(404, {"error": "Invitation link not found."})
            return
        self.respond(200, {"deleted": True})

    def do_POST(self):
        edit = re.fullmatch(r"/admin/api/invites/([A-Za-z0-9_-]{32})", self.path)
        if not edit and self.path not in ("/admin/api/invites", "/admin/api/entourage"):
            self.respond(404, {"error": "Not found."})
            return
        if self.headers.get_content_type() != "application/json":
            self.respond(415, {"error": "Send JSON for this request."})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            max_length = 256 * 1024 if self.path.endswith("/entourage") else 2048
            if not 0 < length <= max_length:
                raise ValueError("Invalid request size.")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Invalid request.")
            if self.path == "/admin/api/entourage":
                self.server.store.save_entourage(data)
                self.respond(200, {"saved": True})
                return
            if edit:
                if self.server.store.update_invite(edit[1], data.get("name"), data.get("seats"), data.get("active")):
                    self.respond(200, {"saved": True})
                else:
                    self.respond(404, {"error": "Invitation link not found."})
                return
            token = self.server.store.create(data.get("name"), data.get("seats"))
        except (ValueError, UnicodeError) as error:
            self.respond(400, {"error": str(error)})
            return
        self.respond(201, {"token": token})


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 4182), InvitationHandler) as server:
        server.store = InvitationStore(sys.argv[1])
        server.serve_forever()
