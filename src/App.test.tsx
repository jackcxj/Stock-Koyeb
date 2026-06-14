import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  afterEach(() => {
    cleanup();
    window.localStorage.clear();
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

  it('automatically syncs screenshot holdings, removes absent stocks, and records pnl', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(url).includes('/market/latest')
        ? {
          id: 'live-market',
          index_name: '上证指数',
          index_change_percent: 1.12,
          market_status: '已收盘',
          indices: [],
          rising_count: 3923,
          falling_count: 1515,
          total_turnover: 3236299000000,
          source_status: 'ok',
          captured_at: '2026-06-12T15:30:39+08:00'
        }
        : {
          items: [
            {
              symbol: 'SH600900',
              name: '长江电力',
              action: 'hold',
              level: 'info',
              current_price: 28.28,
              pnl_percent: 1.29,
              quantity: 100,
              available_quantity: 100,
              market_value: 2828,
              pnl_amount: 36,
              cost_price: 27.92,
              stop_loss_price: 26.36,
              risks: ['后台旧股票'],
              growth_points: ['后台旧股票'],
              suggestion: '后台旧股票'
            }
          ]
        }
    })));

    render(<App />);
    await screen.findByText('长江电力');
    fireEvent.click(screen.getByRole('button', { name: '识别并同步' }));

    expect(await screen.findByText(/已自动同步 8 只持仓/)).toBeInTheDocument();
    expect(screen.queryByText('长江电力')).not.toBeInTheDocument();

    const holdingsPanel = screen.getByText('持仓风险').closest('article');
    expect(holdingsPanel).not.toBeNull();
    expect(within(holdingsPanel as HTMLElement).getByText('名臣健康')).toBeInTheDocument();
    expect(within(holdingsPanel as HTMLElement).getByText('22.120/20.000')).toBeInTheDocument();
    expect(within(holdingsPanel as HTMLElement).getByText('-218.49 元')).toBeInTheDocument();
    expect(within(holdingsPanel as HTMLElement).getByText('2,000 元')).toBeInTheDocument();

    const history = screen.getByLabelText('盈亏记录');
    expect(within(history).getByText(/8 只/)).toBeInTheDocument();
    expect(within(history).getByText('-5,958.96 元')).toBeInTheDocument();
    expect(within(history).getByText(/总市值 61,640 元/)).toBeInTheDocument();
  });
});
