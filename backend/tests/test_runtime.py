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

    async def test_refresh_once_updates_latest_market_with_live_fetcher(self):
        async def fake_fetcher(_previous):
            return {
                "id": "live",
                "index_name": "上证指数",
                "index_change_percent": 0.1,
                "indices": [],
                "rising_count": 2000,
                "falling_count": 1800,
                "total_turnover": 100,
                "source_status": "ok",
                "captured_at": "2026-06-11T10:00:00+08:00",
            }

        async def fake_stock_fetcher(_symbols):
            return {
                "SZ002281": {
                    "symbol": "SZ002281",
                    "name": "光迅科技",
                    "price": 205.4,
                    "change_percent": 1.2,
                    "volume_ratio": 1.1,
                    "captured_at": "2026-06-11T10:00:00+08:00",
                }
            }

        runtime = PollRuntime(demo_mode=False, market_fetcher=fake_fetcher, stock_fetcher=fake_stock_fetcher)
        result = await runtime.refresh_once()

        self.assertEqual(result["id"], "live")
        self.assertEqual(runtime.latest_stocks["SZ002281"]["price"], 205.4)
        self.assertEqual(runtime.status()["last_source_status"], "ok")


if __name__ == "__main__":
    unittest.main()
