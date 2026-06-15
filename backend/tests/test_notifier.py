import unittest

import httpx

from app.notifier import _build_payload, _is_successful_response, _normalize_webhook_url


class NotifierTests(unittest.TestCase):
    def test_normalizes_server_chan_sendkey(self):
        self.assertEqual(
            _normalize_webhook_url("SCT123456abcdef"),
            "https://sctapi.ftqq.com/SCT123456abcdef.send",
        )
        self.assertEqual(_build_payload("SCT123456abcdef", "标题", "内容"), {"title": "标题", "desp": "内容"})

    def test_normalizes_pushplus_token(self):
        self.assertEqual(_normalize_webhook_url("pushplus-token-123"), "https://www.pushplus.plus/send")
        self.assertEqual(
            _build_payload("pushplus-token-123", "标题", "内容"),
            {"token": "pushplus-token-123", "title": "标题", "content": "内容", "template": "txt"},
        )

    def test_accepts_pushplus_prefixed_token_and_legacy_url(self):
        self.assertEqual(_normalize_webhook_url("pushplus:abc123"), "https://www.pushplus.plus/send")
        self.assertEqual(_build_payload("pushplus:abc123", "标题", "内容")["token"], "abc123")
        self.assertEqual(_normalize_webhook_url("https://www.pushplus.plus/send/abc123"), "https://www.pushplus.plus/send")
        self.assertEqual(_build_payload("https://www.pushplus.plus/send/abc123", "标题", "内容")["token"], "abc123")

    def test_checks_provider_response_codes(self):
        self.assertTrue(_is_successful_response("pushplus:abc123", httpx.Response(200, json={"code": 200})))
        self.assertFalse(_is_successful_response("pushplus:bad", httpx.Response(200, json={"code": 903})))
        self.assertTrue(_is_successful_response("SCT123456abcdef", httpx.Response(200, json={"code": 0})))
        self.assertFalse(_is_successful_response("SCT123456abcdef", httpx.Response(200, json={"code": 40001})))


if __name__ == "__main__":
    unittest.main()
