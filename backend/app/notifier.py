from __future__ import annotations

import httpx


async def send_wechat_webhook(webhook_url: str, title: str, content: str) -> bool:
    if not webhook_url:
        return False

    payload = {"title": title, "desp": content}
    async with httpx.AsyncClient(timeout=8) as client:
      response = await client.post(webhook_url, json=payload)
      return response.status_code < 400
