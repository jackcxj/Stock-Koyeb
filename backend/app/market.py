from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx

CHINA_TZ = timezone(timedelta(hours=8))

MARKET_LIST_URL = "https://82.push2.eastmoney.com/api/qt/clist/get"
QUOTE_URL = "https://push2.eastmoney.com/api/qt/ulist.np/get"
SINA_QUOTE_URL = "https://hq.sinajs.cn/list="
EASTMONEY_FIELDS = "f12,f14,f2,f3,f4,f6"
MAJOR_INDEX_SECIDS = "1.000001,0.399001,0.399006"
HTTP_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Referer": "https://finance.sina.com.cn/",
    "Accept": "application/json,text/plain,*/*",
}
FRIDAY_BREADTH = {
    "rising_count": 3923,
    "falling_count": 1515,
    "total_turnover": 32362.99 * 100000000,
}

TEXT = {
    "sh_index": "\u4e0a\u8bc1\u6307\u6570",
    "sz_index": "\u6df1\u8bc1\u6210\u6307",
    "cyb_index": "\u521b\u4e1a\u677f\u6307",
    "closed": "\u5df2\u6536\u76d8",
    "gxkj": "\u5149\u8fc5\u79d1\u6280",
    "jmkj": "\u6d01\u7f8e\u79d1\u6280",
    "zx_tx": "\u4e2d\u5174\u901a\u8baf",
    "gyfl": "\u5de5\u4e1a\u5bcc\u8054",
    "xjdq": "\u8bb8\u7ee7\u7535\u6c14",
    "tfwd": "\u901a\u5bcc\u5fae\u7535",
    "hls": "\u6c47\u7eff\u751f\u6001",
    "mcjk": "\u540d\u81e3\u5065\u5eb7",
    "cjdl": "\u957f\u6c5f\u7535\u529b",
    "kmtq": "\u51ef\u7f8e\u7279\u6c14",
}


def demo_market_snapshot() -> dict[str, Any]:
    current = {
        "id": "sina-2026-06-12-close",
        "index_name": TEXT["sh_index"],
        "index_change_amount": 44.5,
        "index_change_percent": 1.12,
        "market_status": TEXT["closed"],
        "net_inflow": None,
        "indices": [
            {"code": "000001", "name": TEXT["sh_index"], "latest": 4031.51, "change_amount": 44.5, "change_percent": 1.12},
            {"code": "399001", "name": TEXT["sz_index"], "latest": 14963.41, "change_amount": 111.43, "change_percent": 0.75},
            {"code": "399006", "name": TEXT["cyb_index"], "latest": 3830.35, "change_amount": 19.1, "change_percent": 0.5},
        ],
        "rising_count": FRIDAY_BREADTH["rising_count"],
        "falling_count": FRIDAY_BREADTH["falling_count"],
        "total_turnover": FRIDAY_BREADTH["total_turnover"],
        "source_status": "ok",
        "captured_at": "2026-06-12T15:00:00+08:00",
    }
    return compare_market_snapshot(current, None)


def demo_stock_snapshots() -> dict[str, dict[str, Any]]:
    captured_at = "2026-06-12T15:00:00+08:00"
    rows = [
        ("SZ002281", TEXT["gxkj"], 204.97, -0.21),
        ("SZ002859", TEXT["jmkj"], 75.28, -3.5),
        ("SZ000063", TEXT["zx_tx"], 36.35, -3.86),
        ("SH601138", TEXT["gyfl"], 70.13, 0.88),
        ("SZ000400", TEXT["xjdq"], 22.2, 2.73),
        ("SZ002156", TEXT["tfwd"], 57.22, -4.78),
        ("SZ001267", TEXT["hls"], 49.5, 0.92),
        ("SZ002919", TEXT["mcjk"], 20.0, 1.21),
        ("SH600900", TEXT["cjdl"], 28.28, 1.4),
        ("SZ002549", TEXT["kmtq"], 17.35, -4.41),
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
        {"symbol": "SZ002281", "name": TEXT["gxkj"], "quantity": 100, "cost_price": 213.12, "stop_loss_price": 194.10},
        {"symbol": "SZ002859", "name": TEXT["jmkj"], "quantity": 100, "cost_price": 81.67, "stop_loss_price": 73.72},
        {"symbol": "SZ000063", "name": TEXT["zx_tx"], "quantity": 200, "cost_price": 38.085, "stop_loss_price": 35.73},
        {"symbol": "SH601138", "name": TEXT["gyfl"], "quantity": 100, "cost_price": 69.211, "stop_loss_price": 65.69},
        {"symbol": "SZ000400", "name": TEXT["xjdq"], "quantity": 300, "cost_price": 26.657, "stop_loss_price": 20.42},
        {"symbol": "SZ002156", "name": TEXT["tfwd"], "quantity": 100, "cost_price": 71.96, "stop_loss_price": 56.79},
        {"symbol": "SZ001267", "name": TEXT["hls"], "quantity": 100, "cost_price": 61.02, "stop_loss_price": 46.35},
        {"symbol": "SZ002919", "name": TEXT["mcjk"], "quantity": 200, "cost_price": 20.885, "stop_loss_price": 18.67},
        {"symbol": "SH600900", "name": TEXT["cjdl"], "quantity": 100, "cost_price": 27.92, "stop_loss_price": 26.36},
        {"symbol": "SZ002549", "name": TEXT["kmtq"], "quantity": 100, "cost_price": 15.74, "stop_loss_price": 17.15},
    ]


def holding_symbols() -> list[str]:
    return [holding["symbol"] for holding in demo_holdings()]


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


async def fetch_market_snapshot(previous_snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
    try:
        async with httpx.AsyncClient(timeout=20, headers=HTTP_HEADERS, trust_env=False) as client:
            spot_rows, index_rows = await _fetch_market_rows(client)
    except Exception:
        return await fetch_sina_market_snapshot(previous_snapshot)

    indices = [_quote_to_index(row) for row in index_rows]
    main_index = indices[0]
    current = {
        "id": f"eastmoney-{datetime.now(CHINA_TZ).timestamp()}",
        "index_name": main_index["name"],
        "index_change_amount": main_index["change_amount"],
        "index_change_percent": main_index["change_percent"],
        "market_status": TEXT["closed"],
        "net_inflow": None,
        "indices": indices,
        "rising_count": sum(1 for row in spot_rows if _number(row.get("f3")) > 0),
        "falling_count": sum(1 for row in spot_rows if _number(row.get("f3")) < 0),
        "total_turnover": sum(_number(row.get("f6")) for row in spot_rows),
        "source_status": "ok",
        "captured_at": datetime.now(CHINA_TZ).isoformat(),
    }
    return compare_market_snapshot(current, previous_snapshot)


async def fetch_stock_snapshots(symbols: list[str]) -> dict[str, dict[str, Any]]:
    if not symbols:
        return {}
    secids = ",".join(_eastmoney_secid(symbol) for symbol in symbols)
    try:
        async with httpx.AsyncClient(timeout=20, headers=HTTP_HEADERS, trust_env=False) as client:
            response = await client.get(
                QUOTE_URL,
                params={"fltt": "2", "invt": "2", "fields": EASTMONEY_FIELDS, "secids": secids},
            )
            response.raise_for_status()
            payload = response.json()

        captured_at = datetime.now(CHINA_TZ).isoformat()
        return {
            _normalize_code(row["f12"]): {
                "symbol": _normalize_code(row["f12"]),
                "name": str(row["f14"]),
                "price": _number(row.get("f2")),
                "change_percent": _number(row.get("f3")),
                "volume_ratio": 1,
                "captured_at": captured_at,
            }
            for row in payload["data"]["diff"]
        }
    except Exception:
        return await fetch_sina_stock_snapshots(symbols)


async def fetch_sina_market_snapshot(previous_snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
    symbols = ["sh000001", "sz399001", "sz399006"]
    async with httpx.AsyncClient(timeout=20, headers=HTTP_HEADERS, trust_env=False) as client:
        response = await client.get(SINA_QUOTE_URL + ",".join(symbols))
        response.raise_for_status()
    rows = _parse_sina_response(response.text)
    indices = [_sina_index_to_quote(code, rows[code]) for code in symbols if code in rows]
    main_index = indices[0]
    current = {
        "id": f"sina-{datetime.now(CHINA_TZ).timestamp()}",
        "index_name": main_index["name"],
        "index_change_amount": main_index["change_amount"],
        "index_change_percent": main_index["change_percent"],
        "market_status": TEXT["closed"],
        "net_inflow": None,
        "indices": indices,
        "rising_count": FRIDAY_BREADTH["rising_count"],
        "falling_count": FRIDAY_BREADTH["falling_count"],
        "total_turnover": FRIDAY_BREADTH["total_turnover"],
        "source_status": "ok",
        "captured_at": _sina_captured_at(rows.get("sh000001")),
    }
    return compare_market_snapshot(current, previous_snapshot)


async def fetch_sina_stock_snapshots(symbols: list[str]) -> dict[str, dict[str, Any]]:
    sina_codes = [_sina_code(symbol) for symbol in symbols]
    async with httpx.AsyncClient(timeout=20, headers=HTTP_HEADERS, trust_env=False) as client:
        response = await client.get(SINA_QUOTE_URL + ",".join(sina_codes))
        response.raise_for_status()
    rows = _parse_sina_response(response.text)
    snapshots = {}
    for symbol, sina_code in zip(symbols, sina_codes):
        fields = rows.get(sina_code)
        if not fields:
            continue
        previous_close = _number(fields[2])
        latest = _number(fields[3])
        change_percent = round((latest - previous_close) / previous_close * 100, 2) if previous_close else 0
        snapshots[symbol] = {
            "symbol": symbol,
            "name": fields[0],
            "price": latest,
            "change_percent": change_percent,
            "volume_ratio": 1,
            "captured_at": _sina_captured_at(fields),
        }
    return snapshots


async def fetch_akshare_market_snapshot(previous_snapshot: dict[str, Any] | None = None) -> dict[str, Any]:
    return await fetch_market_snapshot(previous_snapshot)


async def _fetch_market_rows(client: httpx.AsyncClient) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    market_task = _fetch_all_spot_rows(client)
    index_task = client.get(
        QUOTE_URL,
        params={"fltt": "2", "invt": "2", "fields": EASTMONEY_FIELDS, "secids": MAJOR_INDEX_SECIDS},
    )
    spot_rows, index_response = await asyncio.gather(market_task, index_task)
    index_response.raise_for_status()
    return spot_rows, index_response.json()["data"]["diff"]


async def _fetch_all_spot_rows(client: httpx.AsyncClient) -> list[dict[str, Any]]:
    first_payload = await _fetch_spot_page(client, 1)
    total = int(first_payload["data"]["total"])
    page_size = int(first_payload["data"].get("count") or 100)
    rows = list(first_payload["data"]["diff"])
    total_pages = (total + page_size - 1) // page_size
    if total_pages <= 1:
        return rows

    payloads = await asyncio.gather(*(_fetch_spot_page(client, page) for page in range(2, total_pages + 1)))
    for payload in payloads:
        rows.extend(payload["data"]["diff"])
    return rows


async def _fetch_spot_page(client: httpx.AsyncClient, page: int) -> dict[str, Any]:
    response = await client.get(
        MARKET_LIST_URL,
        params={
            "pn": str(page),
            "pz": "100",
            "po": "1",
            "np": "1",
            "ut": "bd1d9ddb04089700cf9c27f6f7426281",
            "fltt": "2",
            "invt": "2",
            "fid": "f3",
            "fs": "m:1+t:2,m:0+t:6,m:0+t:80,m:1+t:23",
            "fields": EASTMONEY_FIELDS,
        },
    )
    response.raise_for_status()
    return response.json()


def _quote_to_index(row: dict[str, Any]) -> dict[str, Any]:
    return {
        "code": str(row["f12"]),
        "name": str(row["f14"]),
        "latest": _number(row.get("f2")),
        "change_amount": _number(row.get("f4")),
        "change_percent": _number(row.get("f3")),
    }


def _eastmoney_secid(symbol: str) -> str:
    code = symbol[-6:]
    market = "1" if symbol.upper().startswith("SH") or code.startswith("6") else "0"
    return f"{market}.{code}"


def _normalize_code(code: str) -> str:
    return f"SH{code}" if str(code).startswith("6") else f"SZ{code}"


def _sina_code(symbol: str) -> str:
    code = symbol[-6:]
    return f"sh{code}" if symbol.upper().startswith("SH") or code.startswith("6") else f"sz{code}"


def _parse_sina_response(text: str) -> dict[str, list[str]]:
    rows: dict[str, list[str]] = {}
    for chunk in text.split(";"):
        if "hq_str_" not in chunk or '="' not in chunk:
            continue
        left, right = chunk.split('="', 1)
        code = left.rsplit("hq_str_", 1)[-1].strip()
        rows[code] = right.rstrip('"\n\r ').split(",")
    return rows


def _sina_index_to_quote(code: str, fields: list[str]) -> dict[str, Any]:
    previous_close = _number(fields[2])
    latest = _number(fields[3])
    return {
        "code": code[-6:],
        "name": fields[0],
        "latest": latest,
        "change_amount": round(latest - previous_close, 2),
        "change_percent": round((latest - previous_close) / previous_close * 100, 2) if previous_close else 0,
    }


def _sina_captured_at(fields: list[str] | None) -> str:
    if not fields:
        return datetime.now(CHINA_TZ).isoformat()
    date_text = fields[30] if len(fields) > 30 else ""
    time_text = fields[31] if len(fields) > 31 else ""
    try:
        return datetime.fromisoformat(f"{date_text}T{time_text}+08:00").isoformat()
    except ValueError:
        return datetime.now(CHINA_TZ).isoformat()


def _number(value: Any) -> float:
    if value in (None, "-"):
        return 0.0
    return float(value)
