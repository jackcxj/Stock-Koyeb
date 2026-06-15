from __future__ import annotations

import httpx

PUSHPLUS_API_URL = "https://www.pushplus.plus/send"
SERVER_CHAN_API_PREFIX = "https://sctapi.ftqq.com/"
WXPUSHER_API_URL = "https://wxpusher.zjiecode.com/api/send/message"


async def send_wechat_webhook(webhook_url: str, title: str, content: str) -> bool:
    if not webhook_url:
        return False

    target_url = _normalize_webhook_url(webhook_url)
    payload = _build_payload(webhook_url, title, content)
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.post(target_url, json=payload)
        return _is_successful_response(webhook_url, response)


def _build_payload(webhook_url: str, title: str, content: str) -> dict[str, str]:
    if _is_wxpusher(webhook_url):
        app_token, uid = _extract_wxpusher_credentials(webhook_url)
        return {
            "appToken": app_token,
            "content": f"{title}\n\n{content}",
            "summary": title[:100],
            "contentType": 1,
            "uids": [uid],
            "verifyPayType": 0,
        }
    if _is_pushplus(webhook_url):
        return {"token": _extract_pushplus_token(webhook_url), "title": title, "content": content, "template": "txt"}
    return {"title": title, "desp": content}


def _normalize_webhook_url(value: str) -> str:
    webhook_url = value.strip()
    if _is_wxpusher(webhook_url):
        return WXPUSHER_API_URL
    if _is_pushplus(webhook_url):
        return PUSHPLUS_API_URL
    if webhook_url.startswith("http://") or webhook_url.startswith("https://"):
        return webhook_url
    return f"{SERVER_CHAN_API_PREFIX}{webhook_url}.send"


def _is_pushplus(value: str) -> bool:
    compact = value.strip().lower()
    return "pushplus" in compact or (not compact.startswith(("http://", "https://", "sct", "wxpusher:")) and "/" not in compact)


def _is_wxpusher(value: str) -> bool:
    return value.strip().lower().startswith("wxpusher:")


def _extract_pushplus_token(value: str) -> str:
    compact = value.strip()
    if compact.lower().startswith("pushplus:"):
        return compact.split(":", 1)[1].strip()
    if "/" not in compact:
        return compact
    return compact.rstrip("/").split("/")[-1]


def _extract_wxpusher_credentials(value: str) -> tuple[str, str]:
    parts = value.strip().split(":")
    if len(parts) != 3 or not parts[1].strip() or not parts[2].strip():
        return "", ""
    return parts[1].strip(), parts[2].strip()


def _is_successful_response(webhook_url: str, response: httpx.Response) -> bool:
    if response.status_code >= 400:
        return False
    try:
        payload = response.json()
    except ValueError:
        return True
    code = payload.get("code")
    if _is_wxpusher(webhook_url):
        return code == 1000 and payload.get("success") is True and all(
            item.get("code") == 1000 for item in payload.get("data", [])
        )
    if _is_pushplus(webhook_url):
        return code == 200
    return code in (0, None)
