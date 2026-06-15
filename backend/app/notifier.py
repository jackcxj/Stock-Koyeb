from __future__ import annotations

import httpx

PUSHPLUS_API_URL = "https://www.pushplus.plus/send"
SERVER_CHAN_API_PREFIX = "https://sctapi.ftqq.com/"


async def send_wechat_webhook(webhook_url: str, title: str, content: str) -> bool:
    if not webhook_url:
        return False

    target_url = _normalize_webhook_url(webhook_url)
    payload = _build_payload(webhook_url, title, content)
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.post(target_url, json=payload)
        return response.status_code < 400


def _build_payload(webhook_url: str, title: str, content: str) -> dict[str, str]:
    if _is_pushplus(webhook_url):
        return {"token": _extract_pushplus_token(webhook_url), "title": title, "content": content, "template": "txt"}
    return {"title": title, "desp": content}


def _normalize_webhook_url(value: str) -> str:
    webhook_url = value.strip()
    if _is_pushplus(webhook_url):
        return PUSHPLUS_API_URL
    if webhook_url.startswith("http://") or webhook_url.startswith("https://"):
        return webhook_url
    return f"{SERVER_CHAN_API_PREFIX}{webhook_url}.send"


def _is_pushplus(value: str) -> bool:
    compact = value.strip().lower()
    return "pushplus" in compact or (not compact.startswith(("http://", "https://", "sct")) and "/" not in compact)


def _extract_pushplus_token(value: str) -> str:
    compact = value.strip()
    if compact.lower().startswith("pushplus:"):
        return compact.split(":", 1)[1].strip()
    if "/" not in compact:
        return compact
    return compact.rstrip("/").split("/")[-1]
