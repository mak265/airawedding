import json
import re
import secrets
import sqlite3
import sys
from contextlib import closing
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


class InvitationStore:
    def __init__(self, path):
        self.path = path
        with closing(sqlite3.connect(path)) as db, db:
            db.execute("CREATE TABLE IF NOT EXISTS invitations (token TEXT PRIMARY KEY, name TEXT NOT NULL, seats INTEGER NOT NULL)")

    def create(self, name, seats):
        if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
            raise ValueError("Enter a guest or family name (1–100 characters).")
        if type(seats) is not int or not 1 <= seats <= 100:
            raise ValueError("Enter a whole number of seats from 1 to 100.")
        token = secrets.token_urlsafe(24)
        with closing(sqlite3.connect(self.path)) as db, db:
            db.execute("INSERT INTO invitations VALUES (?, ?, ?)", (token, name.strip(), seats))
        return token

    def find(self, token):
        with closing(sqlite3.connect(self.path)) as db:
            row = db.execute("SELECT name, seats FROM invitations WHERE token = ?", (token,)).fetchone()
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
        match = re.fullmatch(r"/api/invites/([A-Za-z0-9_-]{32})", self.path)
        invitation = self.server.store.find(match[1]) if match else None
        if invitation is None:
            self.respond(404, {"error": "Invitation link not found."})
            return
        self.respond(200, invitation)

    def do_POST(self):
        if self.path != "/admin/api/invites":
            self.respond(404, {"error": "Not found."})
            return
        if self.headers.get_content_type() != "application/json":
            self.respond(415, {"error": "Send JSON to create an invitation."})
            return
        try:
            length = int(self.headers.get("Content-Length", 0))
            if not 0 < length <= 2048:
                raise ValueError("Invalid request size.")
            data = json.loads(self.rfile.read(length))
            if not isinstance(data, dict):
                raise ValueError("Invalid invitation.")
            token = self.server.store.create(data.get("name"), data.get("seats"))
        except (ValueError, UnicodeError) as error:
            self.respond(400, {"error": str(error)})
            return
        self.respond(201, {"token": token})


if __name__ == "__main__":
    with ThreadingHTTPServer(("127.0.0.1", 4182), InvitationHandler) as server:
        server.store = InvitationStore(sys.argv[1])
        server.serve_forever()
