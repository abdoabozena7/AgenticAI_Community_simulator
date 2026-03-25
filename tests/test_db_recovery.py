from __future__ import annotations

import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from app.core import db as db_core  # noqa: E402


class DbRecoveryTests(unittest.IsolatedAsyncioTestCase):
    async def test_execute_does_not_latch_stub_mode_on_transient_connection_failure(self) -> None:
        original_stub = db_core._STUB_DB
        try:
            db_core._STUB_DB = False
            with patch("app.core.db._run_query", side_effect=Exception("Can't connect to MySQL server on '127.0.0.1:3306'")):
                rows = await db_core.execute("SELECT 1", fetch=True)
            self.assertEqual(rows, [])
            self.assertFalse(db_core._STUB_DB)
        finally:
            db_core._STUB_DB = original_stub

    async def test_execute_keeps_stub_mode_for_missing_driver(self) -> None:
        original_stub = db_core._STUB_DB
        try:
            db_core._STUB_DB = True
            rows = await db_core.execute("SELECT 1", fetch=True)
            self.assertIsNone(rows)
            self.assertTrue(db_core._STUB_DB)
        finally:
            db_core._STUB_DB = original_stub


if __name__ == "__main__":
    unittest.main()
