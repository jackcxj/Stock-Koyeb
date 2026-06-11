import unittest
from datetime import datetime, timedelta, timezone

from app.rules import analyze_holding, classify_market_trend, normalize_stock_symbol, should_suppress_alert


class RuleTests(unittest.TestCase):
    def test_normalizes_symbols(self):
        self.assertEqual(normalize_stock_symbol("600519"), "SH600519")
        self.assertEqual(normalize_stock_symbol("000001"), "SZ000001")
        self.assertEqual(normalize_stock_symbol("bj 430047"), "BJ430047")

    def test_classifies_market_breadth(self):
        self.assertEqual(classify_market_trend({"index_change_percent": 1.2, "rising_count": 3900, "falling_count": 1000}), "bullish")
        self.assertEqual(classify_market_trend({"index_change_percent": -1.0, "rising_count": 900, "falling_count": 4200}), "bearish")
        self.assertEqual(classify_market_trend({"index_change_percent": 0.3, "rising_count": 2300, "falling_count": 2200}), "neutral")

    def test_stop_loss_break_generates_critical_action(self):
        result = analyze_holding(
            {"symbol": "600519", "name": "贵州茅台", "quantity": 100, "cost_price": 1400, "stop_loss_price": 1320},
            {"symbol": "600519", "name": "贵州茅台", "price": 1310, "change_percent": -2.2, "volume_ratio": 1.3},
            {"index_change_percent": -1.0, "rising_count": 900, "falling_count": 4200},
        )

        self.assertEqual(result["action"], "stop_loss")
        self.assertEqual(result["level"], "critical")
        self.assertIn("止损线", " ".join(result["risks"]))

    def test_cooldown_suppresses_duplicates(self):
        now = datetime(2026, 6, 11, 10, 30, tzinfo=timezone(timedelta(hours=8)))
        last = datetime(2026, 6, 11, 10, 5, tzinfo=timezone(timedelta(hours=8)))

        self.assertTrue(should_suppress_alert(last, now, 45))
        self.assertFalse(should_suppress_alert(last, now, 10))


if __name__ == "__main__":
    unittest.main()
