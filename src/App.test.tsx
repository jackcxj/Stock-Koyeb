import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import App from './App';

describe('App', () => {
  afterEach(() => {
    cleanup();
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

  it('writes confirmed screenshot holdings into the middle holding risk list', async () => {
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
          items: [{
            symbol: 'SZ002919',
            name: '名臣健康',
            action: 'hold',
            level: 'info',
            current_price: 19.76,
            pnl_percent: -5.39,
            quantity: 200,
            available_quantity: 200,
            market_value: 3952,
            pnl_amount: -232.48,
            cost_price: 20.885,
            stop_loss_price: 18.67,
            risks: ['旧后台数据'],
            growth_points: ['旧后台数据'],
            suggestion: '旧后台数据'
          }]
        }
    })));

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '识别文本' }));
    fireEvent.click(await screen.findAllByRole('button', { name: '确认写入' }).then((buttons) => buttons[7]));

    expect(await screen.findByText(/名臣健康 已写入持仓风险列表/)).toBeInTheDocument();
    expect(screen.getByText('成本/现价')).toBeInTheDocument();
    expect(screen.getByText('22.120/20.000')).toBeInTheDocument();
    expect(screen.getByText('-218.49 元')).toBeInTheDocument();
    expect(screen.getByText('2,000 元')).toBeInTheDocument();
  });
});
