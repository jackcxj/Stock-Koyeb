import { describe, expect, it, vi } from 'vitest';
import { fetchHoldingAnalysis, fetchLatestMarket, sendWechatAlert, sendWechatTestAlert } from './api';

describe('api', () => {
  it('maps backend market payload into frontend shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        id: 'live',
        index_name: '上证指数',
        index_change_amount: -6.22,
        index_change_percent: -0.16,
        market_status: '已收盘',
        net_inflow: -57506000000,
        indices: [{ code: '000001', name: '上证指数', latest: 3987.01, change_amount: -6.22, change_percent: -0.16 }],
        rising_count: 1370,
        falling_count: 4069,
        total_turnover: 2574900000000,
        rising_count_change: 78,
        falling_count_change: -50,
        turnover_change_percent: -2.6,
        source_status: 'ok',
        captured_at: '2026-06-11T15:00:00+08:00'
      })
    })));

    const market = await fetchLatestMarket();

    expect(market?.marketStatus).toBe('已收盘');
    expect(market?.indices[0].changeAmount).toBe(-6.22);
  });

  it('maps backend holding analysis payload into frontend shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({
        items: [{
          symbol: 'SZ002281',
          name: '光迅科技',
          action: 'reduce',
          level: 'warning',
          current_price: 205.4,
          pnl_percent: -3.62,
          risks: ['大盘偏弱'],
          growth_points: ['等待企稳'],
          suggestion: '降低风险'
        }]
      })
    })));

    const analyses = await fetchHoldingAnalysis();

    expect(analyses?.[0].currentPrice).toBe(205.4);
    expect(analyses?.[0].growthPoints[0]).toBe('等待企稳');
  });
  it('sends a custom webhook URL when testing WeChat alerts', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ wechat_delivered: true, configured: true })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWechatTestAlert('https://sctapi.ftqq.com/example.send');

    expect(result).toEqual({ delivered: true, configured: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/alerts/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ webhook_url: 'https://sctapi.ftqq.com/example.send' })
      })
    );
  });

  it('sends generated alert content to WeChat', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ wechat_delivered: true, configured: true })
    }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await sendWechatAlert('https://www.pushplus.plus/send/example', '止损提醒', '光迅科技跌破止损线');

    expect(result).toEqual({ delivered: true, configured: true });
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/alerts/send'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          webhook_url: 'https://www.pushplus.plus/send/example',
          title: '止损提醒',
          content: '光迅科技跌破止损线'
        })
      })
    );
  });
});
