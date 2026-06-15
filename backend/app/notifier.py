from __future__ import annotations

from dataclasses import dataclass

import httpx

PUSHPLUS_API_URL = "https://www.pushplus.plus/send"
SERVER_CHAN_API_PREFIX = "https://sctapi.ftqq.com/"
WXPUSHER_API_URL = "https://wxpusher.zjiecode.com/api/send/message"
WXPUSHER_SIMPLE_API_URL = "https://wxpusher.zjiecode.com/api/send/message/simple-push"


@dataclass(frozen=True)
class WechatSendResult:
    delivered: bool
    configured: bool
    provider: str
    message: str
    provider_code: int | str | None = None


async def send_wechat_webhook(webhook_url: str, title: str, content: str) -> WechatSendResult:
    if not webhook_url:
        return WechatSendResult(
            delivered=False,
            configured=False,
            provider="none",
            message="未配置微信推送地址。",
        )

    target_url = _normalize_webhook_url(webhook_url)
    payload = _build_payload(webhook_url, title, content)
    async with httpx.AsyncClient(timeout=8) as client:
        response = await client.post(target_url, json=payload)
        return _build_send_result(webhook_url, response)


def _build_payload(webhook_url: str, title: str, content: str) -> dict[str, str]:
    if _is_wxpusher_spt(webhook_url):
        return {
            "spt": _extract_wxpusher_spt(webhook_url),
            "content": f"{title}\n\n{content}",
            "summary": title[:100],
            "contentType": 1,
        }
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
    if _is_wxpusher_spt(webhook_url):
        return WXPUSHER_SIMPLE_API_URL
    if _is_wxpusher(webhook_url):
        return WXPUSHER_API_URL
    if _is_pushplus(webhook_url):
        return PUSHPLUS_API_URL
    if webhook_url.startswith("http://") or webhook_url.startswith("https://"):
        return webhook_url
    return f"{SERVER_CHAN_API_PREFIX}{webhook_url}.send"


def _is_pushplus(value: str) -> bool:
    compact = value.strip().lower()
    return "pushplus" in compact or (not compact.startswith(("http://", "https://", "sct", "spt_", "wxpusher:", "wxpusher-spt:")) and "/" not in compact)


def _is_wxpusher(value: str) -> bool:
    return value.strip().lower().startswith("wxpusher:")


def _is_wxpusher_spt(value: str) -> bool:
    compact = value.strip().lower()
    return compact.startswith("spt_") or compact.startswith("wxpusher-spt:")


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


def _extract_wxpusher_spt(value: str) -> str:
    compact = value.strip()
    if compact.lower().startswith("wxpusher-spt:"):
        return compact.split(":", 1)[1].strip()
    return compact


def _is_successful_response(webhook_url: str, response: httpx.Response) -> bool:
    if response.status_code >= 400:
        return False
    try:
        payload = response.json()
    except ValueError:
        return True
    code = payload.get("code")
    if _is_wxpusher(webhook_url) or _is_wxpusher_spt(webhook_url):
        data_items = payload.get("data") or []
        return code == 1000 and payload.get("success") is True and all(
            item.get("code") == 1000 for item in data_items
        )
    if _is_pushplus(webhook_url):
        return code == 200
    return code in (0, None)


def _build_send_result(webhook_url: str, response: httpx.Response) -> WechatSendResult:
    provider = _provider_name(webhook_url)
    delivered = _is_successful_response(webhook_url, response)
    provider_code: int | str | None = response.status_code
    message = "推送服务已接收请求。" if delivered else f"推送服务返回 HTTP {response.status_code}。"

    try:
        payload = response.json()
    except ValueError:
        return WechatSendResult(delivered, True, provider, message, provider_code)

    provider_code = payload.get("code", response.status_code)
    provider_message = payload.get("msg") or payload.get("message") or payload.get("info")
    if provider_message:
        message = str(provider_message)

    if _is_wxpusher(webhook_url) or _is_wxpusher_spt(webhook_url):
        data_items = payload.get("data") or []
        failed_items = [item for item in data_items if item.get("code") != 1000]
        if failed_items:
            first_failure = failed_items[0]
            message = str(first_failure.get("status") or first_failure.get("msg") or message)
            provider_code = first_failure.get("code", provider_code)
        elif delivered:
            message = "WxPusher 已创建发送任务；若微信没收到，请确认当前微信已关注该应用并完成通道激活。"

    return WechatSendResult(delivered, True, provider, message, provider_code)


def _provider_name(webhook_url: str) -> str:
    if _is_wxpusher(webhook_url) or _is_wxpusher_spt(webhook_url):
        return "WxPusher"
    if _is_pushplus(webhook_url):
        return "PushPlus"
    return "ServerChan"
