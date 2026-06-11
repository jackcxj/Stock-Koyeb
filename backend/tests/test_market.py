import unittest

from app.market import compare_market_snapshot, demo_market_snapshot


class MarketTests(unittest.TestCase):
    def test_demo_market_includes_indices_and_previous_day_comparison(self):
        snapshot = demo_market_snapshot()

        self.assertEqual(snapshot["market_status"], "已收盘")
        self.assertGreaterEqual(len(snapshot["indices"]), 3)
        self.assertEqual(snapshot["rising_count"], 1370)
        self.assertEqual(snapshot["falling_count"], 4069)
        self.assertIn("rising_count_change", snapshot)
        self.assertIn("turnover_change_percent", snapshot)

    def test_compare_market_snapshot_calculates_deltas(self):
        current = {"rising_count": 3600, "falling_count": 1300, "total_turnover": 880}
        previous = {"rising_count": 3300, "falling_count": 1500, "total_turnover": 800}

        compared = compare_market_snapshot(current, previous)

        self.assertEqual(compared["rising_count_change"], 300)
        self.assertEqual(compared["falling_count_change"], -200)
        self.assertEqual(compared["turnover_change_percent"], 10.0)


if __name__ == "__main__":
    unittest.main()
