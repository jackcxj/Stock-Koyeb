import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the trading cockpit with the core monitoring panels', () => {
    render(<App />);

    expect(screen.getByText('A股实时监控驾驶舱')).toBeInTheDocument();
    expect(screen.getByText('大盘状态')).toBeInTheDocument();
    expect(screen.getByText('持仓风险')).toBeInTheDocument();
    expect(screen.getByText('提醒队列')).toBeInTheDocument();
    expect(screen.getByText('同花顺截图导入')).toBeInTheDocument();
    expect(screen.getByText('上传持仓截图')).toBeInTheDocument();
    expect(screen.getByText('全部A股指数')).toBeInTheDocument();
    expect(screen.getByText('采集时间')).toBeInTheDocument();
    expect(screen.getByText(/较昨日同时间/)).toBeInTheDocument();
    expect(screen.getByText('已收盘')).toBeInTheDocument();
    expect(screen.getByText('光迅科技')).toBeInTheDocument();
  });

  it('loads live market data from the backend when available', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(url).includes('/market/latest')
        ? {
          id: 'live-market',
          index_name: '上证指数',
          index_change_percent: 0.25,
          market_status: '盘中',
          indices: [],
          rising_count: 2400,
          falling_count: 2100,
          total_turnover: 100000000,
          source_status: 'ok',
          captured_at: '2026-06-11T10:00:00+08:00'
        }
        : { items: [] }
    })));

    render(<App />);

    await waitFor(() => expect(screen.getByText(/后台实时更新/)).toBeInTheDocument());
    expect(await screen.findByText('盘中')).toBeInTheDocument();
  });
});
