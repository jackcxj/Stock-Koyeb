from __future__ import annotations

import httpx


async def send_wechat_webhook(webhook_url: str, title: str, content: str) -> bool:
    if not webhook_url:
        return False

    payload = _build_payload(webhook_url, title, content)
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.post(webhook_url, json=payload)
        return response.status_code < 400


def _build_payload(webhook_url: str, title: str, content: str) -> dict[str, str]:
    if "pushplus" in webhook_url.lower():
        return {"title": title, "content": content, "template": "txt"}
    return {"title": title, "desp": content}
