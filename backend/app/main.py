from __future__ import annotations

import asyncio

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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


class AlertTestRequest(BaseModel):
    webhook_url: str | None = None


class AlertSendRequest(BaseModel):
    webhook_url: str
    title: str
    content: str


class HoldingInput(BaseModel):
    symbol: str
    name: str
    quantity: int
    available_quantity: int | None = None
    market_value: float | None = None
    pnl_amount: float | None = None
    pnl_percent: float | None = None
    current_price: float | None = None
    cost_price: float
    stop_loss_price: float


class HoldingAnalysisRequest(BaseModel):
    holdings: list[HoldingInput]


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


@app.post("/analysis/holdings")
async def analysis_custom_holdings(payload: HoldingAnalysisRequest) -> dict[str, object]:
    holdings = [holding.model_dump(exclude_none=True) for holding in payload.holdings]
    symbols = [str(holding["symbol"]) for holding in holdings]
    if symbols:
        next_stocks = await runtime.stock_fetcher(symbols)
        if next_stocks:
            runtime.latest_stocks = {**runtime.latest_stocks, **next_stocks}

    items = []
    for holding in holdings:
        stock = runtime.latest_stocks.get(str(holding["symbol"]))
        if stock:
            items.append(enrich_holding_analysis(holding, stock, analyze_holding(holding, stock, runtime.latest_market)))
    return {"items": items}


@app.post("/alerts/test")
async def alerts_test(payload: AlertTestRequest | None = None) -> dict[str, object]:
    settings = get_settings()
    webhook_url = (payload.webhook_url if payload else None) or settings.wechat_webhook_url
    result = await send_wechat_webhook(
        webhook_url,
        "\u0041\u80a1\u76d1\u63a7\u6d4b\u8bd5\u63d0\u9192",
        "\u8fd9\u662f\u4e00\u6761\u6d4b\u8bd5\u6d88\u606f\u3002",
    )
    return {
        "ok": True,
        "wechat_delivered": result.delivered,
        "configured": result.configured,
        "provider": result.provider,
        "message": result.message,
        "provider_code": result.provider_code,
    }


@app.post("/alerts/send")
async def alerts_send(payload: AlertSendRequest) -> dict[str, object]:
    result = await send_wechat_webhook(payload.webhook_url, payload.title, payload.content)
    return {
        "ok": True,
        "wechat_delivered": result.delivered,
        "configured": result.configured,
        "provider": result.provider,
        "message": result.message,
        "provider_code": result.provider_code,
    }


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
        "change_percent": float(stock.get("change_percent", analysis.get("change_percent", 0)) or 0),
        "cost_price": cost_price,
        "stop_loss_price": float(holding.get("stop_loss_price", 0) or 0),
    }
