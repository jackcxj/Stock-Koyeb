from __future__ import annotations

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .market import demo_holdings
from .notifier import send_wechat_webhook
from .rules import analyze_holding
from .runtime import PollRuntime, run_poll_loop

app = FastAPI(title="A Share Watchtower API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

settings = get_settings()
runtime = PollRuntime(demo_mode=settings.demo_mode)


@app.on_event("startup")
async def start_polling() -> None:
    current_settings = get_settings()
    if not current_settings.demo_mode:
        asyncio.create_task(refresh_on_startup())
    if current_settings.enable_auto_poll:
        asyncio.create_task(run_poll_loop(runtime, get_settings().poll_interval_seconds))


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/poll/run-once")
async def poll_run_once() -> dict[str, object]:
    market = await runtime.refresh_once()
    return {"market": market, "source_status": market["source_status"]}


@app.get("/market/latest")
def market_latest() -> dict[str, object]:
    return runtime.latest_market


@app.get("/poll/status")
def poll_status() -> dict[str, object]:
    return runtime.status()


@app.get("/analysis/holdings")
def analysis_holdings() -> dict[str, object]:
    items = []
    for holding in demo_holdings():
        stock = runtime.latest_stocks.get(holding["symbol"])
        if stock:
            items.append(enrich_holding_analysis(holding, stock, analyze_holding(holding, stock, runtime.latest_market)))
    return {"items": items}


@app.post("/alerts/test")
async def alerts_test() -> dict[str, object]:
    settings = get_settings()
    delivered = await send_wechat_webhook(settings.wechat_webhook_url, "A股监控测试提醒", "这是一条测试消息。")
    return {"ok": True, "wechat_delivered": delivered}


async def refresh_on_startup() -> None:
    try:
        await runtime.refresh_once()
    except Exception:
        pass


def enrich_holding_analysis(holding: dict[str, object], stock: dict[str, object], analysis: dict[str, object]) -> dict[str, object]:
    quantity = int(holding.get("quantity", 0) or 0)
    cost_price = float(holding.get("cost_price", 0) or 0)
    current_price = float(stock.get("price", analysis.get("current_price", 0)) or 0)
    market_value = current_price * quantity if quantity else None
    pnl_amount = (current_price - cost_price) * quantity if quantity else None
    return {
        **analysis,
        "quantity": quantity,
        "available_quantity": int(holding.get("available_quantity", quantity) or quantity),
        "market_value": market_value,
        "pnl_amount": pnl_amount,
        "cost_price": cost_price,
        "stop_loss_price": float(holding.get("stop_loss_price", 0) or 0),
    }
