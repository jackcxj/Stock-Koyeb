import unittest
from datetime import datetime, timedelta, timezone

from app.runtime import PollRuntime, is_a_share_trading_session, next_poll_delay_seconds, should_poll_now


class RuntimeTests(unittest.IsolatedAsyncioTestCase):
    def test_detects_a_share_trading_session(self):
        china = timezone(timedelta(hours=8))

        self.assertTrue(is_a_share_trading_session(datetime(2026, 6, 11, 10, 0, tzinfo=china)))
        self.assertTrue(is_a_share_trading_session(datetime(2026, 6, 11, 14, 30, tzinfo=china)))
        self.assertFalse(is_a_share_trading_session(datetime(2026, 6, 11, 12, 0, tzinfo=china)))
        self.assertFalse(is_a_share_trading_session(datetime(2026, 6, 13, 10, 0, tzinfo=china)))

    def test_does_not_poll_outside_trading_session(self):
        china = timezone(timedelta(hours=8))

        self.assertEqual(next_poll_delay_seconds(datetime(2026, 6, 11, 10, 0, tzinfo=china), 60), 60)
        self.assertFalse(should_poll_now(datetime(2026, 6, 11, 23, 0, tzinfo=china)))
        self.assertGreaterEqual(next_poll_delay_seconds(datetime(2026, 6, 11, 23, 0, tzinfo=china), 60), 3600)

    async def test_refresh_once_updates_latest_market_and_holding_stocks(self):
        async def fake_fetcher(_previous):
            return {
                "id": "live",
                "index_name": "\u4e0a\u8bc1\u6307\u6570",
                "index_change_percent": 0.1,
                "indices": [],
                "rising_count": 2000,
                "falling_count": 1800,
                "total_turnover": 100,
                "source_status": "ok",
                "captured_at": "2026-06-11T10:00:00+08:00",
            }

        async def fake_stock_fetcher(symbols):
            return {
                symbol: {
                    "symbol": symbol,
                    "name": "\u6d4b\u8bd5\u80a1\u7968",
                    "price": 12.3,
                    "change_percent": 1.2,
                    "volume_ratio": 1,
                    "captured_at": "2026-06-11T10:00:00+08:00",
                }
                for symbol in symbols
            }

        runtime = PollRuntime(demo_mode=False, market_fetcher=fake_fetcher, stock_fetcher=fake_stock_fetcher)
        result = await runtime.refresh_once()

        self.assertEqual(result["id"], "live")
        self.assertEqual(runtime.status()["last_source_status"], "ok")
        self.assertEqual(runtime.latest_stocks["SZ002281"]["price"], 12.3)


if __name__ == "__main__":
    unittest.main()
