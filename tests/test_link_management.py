import sqlite3
import tempfile
import unittest
from contextlib import closing
from pathlib import Path

from deploy.invites import InvitationStore


class LinkManagementTests(unittest.TestCase):
    def test_existing_link_can_be_updated_disabled_and_reactivated(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "invites.sqlite"
            token = "A" * 32
            with closing(sqlite3.connect(path)) as db, db:
                db.execute("CREATE TABLE invitations (token TEXT PRIMARY KEY, name TEXT, seats INTEGER)")
                db.execute("INSERT INTO invitations VALUES (?, ?, ?)", (token, "Original Family", 2))
            store = InvitationStore(path)
            self.assertEqual(store.list_invites(), [
                {"token": token, "name": "Original Family", "seats": 2, "active": True},
            ])
            self.assertTrue(store.update_invite(token, "Updated Family", 3, True))
            self.assertEqual(store.find(token), {"name": "Updated Family", "seats": 3})
            with self.assertRaises(ValueError):
                store.update_invite(token, "Updated Family", 0, True)
            self.assertTrue(store.update_invite(token, "Updated Family", 3, False))
            self.assertIsNone(store.find(token))
            self.assertFalse(store.list_invites()[0]["active"])
            self.assertTrue(store.update_invite(token, "Updated Family", 3, True))
            self.assertEqual(InvitationStore(path).find(token)["seats"], 3)
            self.assertFalse(store.update_invite("B" * 32, "Unknown", 1, True))
