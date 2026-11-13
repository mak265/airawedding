import tempfile
import unittest
from pathlib import Path

from deploy.invites import InvitationStore


class InvitationTests(unittest.TestCase):
    def test_invitation_persists_with_opaque_token(self):
        with tempfile.TemporaryDirectory() as directory:
            database = Path(directory) / "invites.sqlite"
            token = InvitationStore(database).create("  Aquino Family  ", 3)
            self.assertRegex(token, r"^[\w-]{32}$")
            self.assertEqual(
                InvitationStore(database).find(token), {"name": "Aquino Family", "seats": 3}
            )
            self.assertIsNone(InvitationStore(database).find("unknown"))

    def test_rejects_invalid_name_and_seats(self):
        with tempfile.TemporaryDirectory() as directory:
            store = InvitationStore(Path(directory) / "invites.sqlite")
            for name, seats in [("", 2), ("Guest", 0), ("Guest", 101), ("Guest", True), ("Guest", 1.5)]:
                with self.subTest(name=name, seats=seats), self.assertRaises(ValueError):
                    store.create(name, seats)
