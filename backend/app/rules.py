from __future__ import annotations

from datetime import datetime
from typing import Any


def normalize_stock_symbol(value: str) -> str:
    compact = "".join(str(value).upper().split())
    digits = "".join(ch for ch in compact if ch.isdigit())
    code = digits[:6]
    if len(code) != 6:
        return compact
    if compact.startswith(("SH", "SZ", "BJ")):
        return f"{compact[:2]}{code}"
    if code.startswith("6"):
        return f"SH{code}"
    if code.startswith(("8", "4")):
        return f"BJ{code}"
    return f"SZ{code}"


def classify_market_trend(snapshot: dict[str, Any]) -> str:
    rising = int(snapshot.get("rising_count", 0))
    falling = int(snapshot.get("falling_count", 0))
    total = max(rising + falling, 1)
    rising_ratio = rising / total
    change = float(snapshot.get("index_change_percent", 0))
    if change >= 0.8 and rising_ratio >= 0.62:
        return "bullish"
    if change <= -0.8 and rising_ratio <= 0.38:
        return "bearish"
    return "neutral"


def analyze_holding(holding: dict[str, Any], stock: dict[str, Any], market: dict[str, Any]) -> dict[str, Any]:
    trend = classify_market_trend(market)
    cost = max(float(holding.get("cost_price", 0)), 0.01)
    price = float(stock.get("price", 0))
    stop_loss = float(holding.get("stop_loss_price", 0))
    change_percent = float(stock.get("change_percent", 0))
    volume_ratio = float(stock.get("volume_ratio", 1))
    pnl_percent = (price - cost) / cost * 100
    risks: list[str] = []
    growth_points: list[str] = []
    action = "hold"
    level = "info"

    if price <= stop_loss:
        risks.append(f"现价 {price:.2f} 已跌破止损线 {stop_loss:.2f}")
        action = "stop_loss"
        level = "critical"

    if pnl_percent <= -5:
        risks.append(f"相对成本回撤 {abs(pnl_percent):.1f}%")
        if action != "stop_loss":
            action = "reduce"
            level = "warning"

    if trend == "bearish" and change_percent < -1:
        risks.append("大盘走弱且个股同步下跌")
        if action == "hold":
            action = "reduce"
            level = "warning"

    if trend == "bullish" and change_percent >= 1.5 and volume_ratio >= 1.5:
        growth_points.append(f"大盘转强，个股上涨 {change_percent:.1f}% 且放量 {volume_ratio:.1f} 倍")
        if action == "hold":
            action = "buy_watch"

    if price > cost and change_percent > 0:
        growth_points.append(f"现价高于成本，浮盈 {pnl_percent:.1f}%")

    if not risks:
        risks.append("未触发硬性止损风险" if trend != "bearish" else "市场偏弱，保持仓位纪律")
    if not growth_points:
        growth_points.append("市场环境改善，等待个股确认" if trend == "bullish" else "暂未出现放量增长信号")

    return {
        "symbol": normalize_stock_symbol(str(holding.get("symbol", stock.get("symbol", "")))),
        "name": holding.get("name") or stock.get("name") or "",
        "action": action,
        "level": level,
        "current_price": price,
        "pnl_percent": pnl_percent,
        "risks": risks,
        "growth_points": growth_points,
        "suggestion": _suggestion(action),
    }


def should_suppress_alert(last_alert_at: datetime, now: datetime, cooldown_minutes: int) -> bool:
    return (now - last_alert_at).total_seconds() < cooldown_minutes * 60


def _suggestion(action: str) -> str:
    return {
        "buy_watch": "只作为关注信号，等待你在同花顺里人工确认，不自动下单。",
        "hold": "继续观察，重点看是否跌破止损线或放量转强。",
        "reduce": "检查仓位和成本，考虑分批降低风险敞口。",
        "stop_loss": "已触发止损条件，请优先在同花顺里人工复核并处理。",
    }.get(action, "继续观察。")
