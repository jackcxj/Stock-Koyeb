import unittest

from app.market import compare_market_snapshot, demo_market_snapshot, demo_stock_snapshots


class MarketTests(unittest.TestCase):
    def test_demo_market_uses_latest_friday_close_snapshot(self):
        snapshot = demo_market_snapshot()

        self.assertEqual(snapshot["market_status"], "\u5df2\u6536\u76d8")
        self.assertEqual(snapshot["captured_at"], "2026-06-12T15:00:00+08:00")
        self.assertEqual(snapshot["index_name"], "\u4e0a\u8bc1\u6307\u6570")
        self.assertEqual(snapshot["index_change_percent"], 1.12)
        self.assertEqual(snapshot["rising_count"], 3923)
        self.assertEqual(snapshot["falling_count"], 1515)
        self.assertEqual(snapshot["total_turnover"], 32362.99 * 100000000)
        self.assertGreaterEqual(len(snapshot["indices"]), 3)
        self.assertIn("rising_count_change", snapshot)
        self.assertIn("turnover_change_percent", snapshot)

    def test_demo_stock_snapshots_include_uploaded_holdings(self):
        stocks = demo_stock_snapshots()

        self.assertEqual(stocks["SZ002281"]["name"], "\u5149\u8fc5\u79d1\u6280")
        self.assertEqual(stocks["SZ002281"]["price"], 204.97)
        self.assertEqual(stocks["SH601138"]["name"], "\u5de5\u4e1a\u5bcc\u8054")
        self.assertEqual(stocks["SH601138"]["price"], 70.13)

    def test_compare_market_snapshot_calculates_deltas(self):
        current = {"rising_count": 3600, "falling_count": 1300, "total_turnover": 880}
        previous = {"rising_count": 3300, "falling_count": 1500, "total_turnover": 800}

        compared = compare_market_snapshot(current, previous)

        self.assertEqual(compared["rising_count_change"], 300)
        self.assertEqual(compared["falling_count_change"], -200)
        self.assertEqual(compared["turnover_change_percent"], 10.0)


if __name__ == "__main__":
    unittest.main()
