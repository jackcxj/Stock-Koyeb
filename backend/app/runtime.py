from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from datetime import datetime, time, timedelta, timezone
from typing import Any

from .market import demo_holdings, demo_market_snapshot, demo_stock_snapshots, fetch_akshare_market_snapshot, fetch_stock_snapshots

CHINA_TZ = timezone(timedelta(hours=8))
MarketFetcher = Callable[[dict[str, Any] | None], Awaitable[dict[str, Any]]]
StockFetcher = Callable[[list[str]], Awaitable[dict[str, dict[str, Any]]]]


def is_a_share_trading_session(now: datetime | None = None) -> bool:
    current = (now or datetime.now(CHINA_TZ)).astimezone(CHINA_TZ)
    if current.weekday() >= 5:
        return False
    current_time = current.time()
    return time(9, 30) <= current_time <= time(11, 30) or time(13, 0) <= current_time <= time(15, 0)


def should_poll_now(now: datetime | None = None) -> bool:
    return is_a_share_trading_session(now)


def next_poll_delay_seconds(now: datetime | None, base_interval_seconds: int) -> int:
    current = (now or datetime.now(CHINA_TZ)).astimezone(CHINA_TZ)
    if is_a_share_trading_session(current):
        return max(base_interval_seconds, 15)
    return max(int((_next_trading_session_start(current) - current).total_seconds()), 3600)


class PollRuntime:
    def __init__(
        self,
        *,
        demo_mode: bool,
        market_fetcher: MarketFetcher = fetch_akshare_market_snapshot,
        stock_fetcher: StockFetcher = fetch_stock_snapshots,
    ) -> None:
        self.demo_mode = demo_mode
        self.market_fetcher = market_fetcher
        self.stock_fetcher = stock_fetcher
        self.latest_market = _initial_market_snapshot(demo_mode)
        self.latest_stocks = demo_stock_snapshots()
        self.last_refresh_at: str | None = None
        self.last_error: str | None = None
        self.refresh_count = 0

    async def refresh_once(self) -> dict[str, Any]:
        try:
            if self.demo_mode:
                self.latest_market = demo_market_snapshot()
                self.latest_stocks = demo_stock_snapshots()
            else:
                self.latest_market = await self.market_fetcher(self.latest_market)
                next_stocks = await self.stock_fetcher([holding["symbol"] for holding in demo_holdings()])
                if next_stocks:
                    self.latest_stocks = {**self.latest_stocks, **next_stocks}
            self.refresh_count += 1
            self.last_error = None
            self.last_refresh_at = datetime.now(CHINA_TZ).isoformat()
            return self.latest_market
        except Exception as error:
            self.last_error = str(error)
            self.latest_market = {**self.latest_market, "source_status": "stale"}
            raise

    def status(self) -> dict[str, Any]:
        return {
            "demo_mode": self.demo_mode,
            "auto_polling": True,
            "refresh_count": self.refresh_count,
            "last_refresh_at": self.last_refresh_at,
            "last_error": self.last_error,
            "last_source_status": self.latest_market.get("source_status"),
            "trading_session": is_a_share_trading_session(),
        }


async def run_poll_loop(runtime: PollRuntime, base_interval_seconds: int) -> None:
    while True:
        if should_poll_now():
            try:
                await runtime.refresh_once()
            except Exception:
                pass
        await asyncio.sleep(next_poll_delay_seconds(None, base_interval_seconds))


def _next_trading_session_start(now: datetime) -> datetime:
    current = now.astimezone(CHINA_TZ)
    morning = datetime.combine(current.date(), time(9, 30), tzinfo=CHINA_TZ)
    afternoon = datetime.combine(current.date(), time(13, 0), tzinfo=CHINA_TZ)
    if current.weekday() < 5:
        if current < morning:
            return morning
        if time(11, 30) < current.time() < time(13, 0):
            return afternoon

    days = 1
    while True:
        candidate = current + timedelta(days=days)
        if candidate.weekday() < 5:
            return datetime.combine(candidate.date(), time(9, 30), tzinfo=CHINA_TZ)
        days += 1


def _initial_market_snapshot(demo_mode: bool) -> dict[str, Any]:
    snapshot = demo_market_snapshot()
    if demo_mode:
        return snapshot
    return {
        **snapshot,
        "source_status": "stale",
        "market_status": "\u7b49\u5f85\u9996\u6b21\u91c7\u96c6",
    }
