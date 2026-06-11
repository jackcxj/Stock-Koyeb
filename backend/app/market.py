from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any


CHINA_TZ = timezone(timedelta(hours=8))
MAJOR_INDEX_NAMES = ("上证指数", "深证成指", "创业板指", "科创50", "北证50", "沪深300", "中证500", "中证1000")


def demo_market_snapshot() -> dict[str, Any]:
    current = {
        "id": "ths-2026-06-11-close",
        "index_name": "上证指数",
        "index_change_amount": -6.22,
        "index_change_percent": -0.16,
        "market_status": "已收盘",
        "net_inflow": -57506000000,
        "indices": [
            {"code": "000001", "name": "上证指数", "latest": 3987.01, "change_amount": -6.22, "change_percent": -0.16},
            {"code": "399001", "name": "深证成指", "latest": 14851.98, "change_amount": -102.12, "change_percent": -0.68},
            {"code": "399006", "name": "创业板指", "latest": 3811.25, "change_amount": -43.54, "change_percent": -1.13},
        ],
        "rising_count": 1370,
        "falling_count": 4069,
        "total_turnover": 2574900000000,
        "source_status": "ok",
        "captured_at": "2026-06-11T15:00:00+08:00",
    }
    previous = {"rising_count": 1292, "falling_count": 4119, "total_turnover": 2644100000000}
    return compare_market_snapshot(current, previous)


def demo_stock_snapshots() -> dict[str, dict[str, Any]]:
    captured_at = "2026-06-11T15:00:00+08:00"
    rows = [
        ("SZ002281", "光迅科技", 205.4, -3.62),
        ("SZ002859", "洁美科技", 78.01, -4.48),
        ("SZ000063", "中兴通讯", 37.81, -0.72),
        ("SH601138", "工业富联", 69.52, 0.45),
        ("SZ000400", "许继电气", 21.61, -18.93),
        ("SZ002156", "通富微电", 60.09, -16.5),
        ("SZ001267", "汇绿生态", 49.05, -19.62),
        ("SZ002919", "名臣健康", 19.76, -5.39),
        ("SH600900", "长江电力", 27.89, -0.11),
        ("SZ002549", "凯美特气", 18.15, 15.31),
    ]
    return {
        symbol: {
            "symbol": symbol,
            "name": name,
            "price": price,
            "change_percent": change_percent,
            "volume_ratio": 1,
            "captured_at": captured_at,
        }
        for symbol, name, price, change_percent in rows
    }


def demo_holdings() -> list[dict[str, Any]]:
    return [
        {"symbol": "SZ002281", "name": "光迅科技", "quantity": 100, "cost_price": 213.12, "stop_loss_price": 194.1},
        {"symbol": "SZ002859", "name": "洁美科技", "quantity": 100, "cost_price": 81.67, "stop_loss_price": 73.72},
        {"symbol": "SZ000063", "name": "中兴通讯", "quantity": 200, "cost_price": 38.085, "stop_loss_price": 35.73},
        {"symbol": "SH601138", "name": "工业富联", "quantity": 100, "cost_price": 69.211, "stop_loss_price": 65.69},
        {"symbol": "SZ000400", "name": "许继电气", "quantity": 300, "cost_price": 26.657, "stop_loss_price": 20.42},
        {"symbol": "SZ002156", "name": "通富微电", "quantity": 100, "cost_price": 71.96, "stop_loss_price": 56.79},
        {"symbol": "SZ001267", "name": "汇绿生态", "quantity": 100, "cost_price": 61.02, "stop_loss_price": 46.35},
        {"symbol": "SZ002919", "name": "名臣健康", "quantity": 200, "cost_price": 20.885, "stop_loss_price": 18.67},
        {"symbol": "SH600900", "name": "长江电力", "quantity": 100, "cost_price": 27.92, "stop_loss_price": 26.36},
        {"symbol": "SZ002549", "name": "凯美特气", "quantity": 100, "cost_price": 15.74, "stop_loss_price": 17.15},
    ]


def compare_market_snapshot(current: dict[str, Any], previous: dict[str, Any] | None) -> dict[str, Any]:
    compared = dict(current)
    if not previous:
        compared["rising_count_change"] = None
        compared["falling_count_change"] = None
        compared["turnover_change_percent"] = None
        return compared

    current_turnover = float(current.get("total_turnover", 0) or 0)
    previous_turnover = float(previous.get("total_turnover", 0) or 0)
    compared["rising_count_change"] = int(current.get("rising_count", 0)) - int(previous.get("rising_count", 0))
    compared["falling_count_change"] = int(current.get("falling_count", 0)) - int(previous.get("falling_count", 0))
    compared["turnover_change_percent"] = (
        round((current_turnover - previous_turnover) / previous_turnover * 100, 1)
        if previous_turnover > 0
        else None
    )
    return compared


async def fetch_akshare_market_snapshot(previous_snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
    import akshare as ak

    spot = ak.stock_zh_a_spot_em()
    rising_count = int((spot["涨跌幅"] > 0).sum())
    falling_count = int((spot["涨跌幅"] < 0).sum())
    total_turnover = float(spot["成交额"].fillna(0).sum())

    index_spot = ak.stock_zh_index_spot_em()
    indices = _extract_major_indices(index_spot)
    main_index = next((item for item in indices if item["name"] == "上证指数"), indices[0])
    current = {
        "id": f"market-{datetime.now(CHINA_TZ).timestamp()}",
        "index_name": main_index["name"],
        "index_change_amount": main_index.get("change_amount"),
        "index_change_percent": main_index["change_percent"],
        "market_status": "盘中",
        "indices": indices,
        "rising_count": rising_count,
        "falling_count": falling_count,
        "total_turnover": total_turnover,
        "source_status": "ok",
        "captured_at": datetime.now(CHINA_TZ).isoformat(),
    }
    return compare_market_snapshot(current, previous_snapshot)


def _extract_major_indices(index_spot: Any) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for name in MAJOR_INDEX_NAMES:
        matched = index_spot[index_spot["名称"].astype(str).str.contains(name, na=False)]
        if len(matched) == 0:
            continue
        row = matched.iloc[0]
        rows.append(
            {
                "code": str(row.get("代码", "")),
                "name": str(row["名称"]),
                "latest": float(row["最新价"]),
                "change_amount": float(row.get("涨跌额", 0)),
                "change_percent": float(row["涨跌幅"]),
            }
        )
    return rows or [
        {
            "code": str(index_spot.iloc[0].get("代码", "")),
            "name": str(index_spot.iloc[0]["名称"]),
            "latest": float(index_spot.iloc[0]["最新价"]),
            "change_amount": float(index_spot.iloc[0].get("涨跌额", 0)),
            "change_percent": float(index_spot.iloc[0]["涨跌幅"]),
        }
    ]
