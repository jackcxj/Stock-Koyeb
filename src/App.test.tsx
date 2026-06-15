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
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => {
        if (String(url).includes('/market/latest')) {
          return {
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
          };
        }
        if (init?.method === 'POST') {
          return {
            items: [
              {
                symbol: 'SZ002919',
                name: '名臣健康',
                action: 'reduce',
                level: 'warning',
                current_price: 19.5,
                change_percent: 2.3,
                pnl_percent: -11.84,
                quantity: 100,
                available_quantity: 100,
                market_value: 1950,
                pnl_amount: -262,
                cost_price: 22.12,
                stop_loss_price: 18.9,
                risks: ['实时回撤'],
                growth_points: ['等待企稳'],
                suggestion: '检查仓位'
              }
            ]
          };
        }
        return {
          items: [
            {
              symbol: 'SH600900',
              name: '长江电力',
              action: 'hold',
              level: 'info',
              current_price: 28.28,
              change_percent: 1.4,
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
        };
      }
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    await screen.findByText('长江电力');
    fireEvent.click(screen.getByRole('button', { name: '识别并同步' }));

    expect(await screen.findByText(/已自动同步 8 只持仓/)).toBeInTheDocument();
    expect(screen.queryByText('长江电力')).not.toBeInTheDocument();

    const holdingsPanel = screen.getByText('持仓风险').closest('article');
    expect(holdingsPanel).not.toBeNull();
    expect(within(holdingsPanel as HTMLElement).getByText('名臣健康')).toBeInTheDocument();
    expect(await within(holdingsPanel as HTMLElement).findByText('22.120/19.500')).toBeInTheDocument();
    expect(within(holdingsPanel as HTMLElement).getByText('+2.3%')).toBeInTheDocument();
    expect(within(holdingsPanel as HTMLElement).getByText('-262 元')).toBeInTheDocument();
    expect(within(holdingsPanel as HTMLElement).getByText('1,950 元')).toBeInTheDocument();
    expect(await within(holdingsPanel as HTMLElement).findByText(/持仓行情实时更新/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/analysis/holdings'),
      expect.objectContaining({ method: 'POST' })
    );

    const history = screen.getByLabelText('盈亏记录');
    expect(within(history).getByText(/8 只/)).toBeInTheDocument();
    expect(within(history).getByText('-5,958.96 元')).toBeInTheDocument();
    expect(within(history).getByText(/总市值 61,640 元/)).toBeInTheDocument();
  });

  it('keeps synced screenshot holdings after a page refresh and refreshes their live prices', async () => {
    window.localStorage.setItem('a-share-watchtower:holdings', JSON.stringify([{
      id: 'h-SZ002281',
      symbol: 'SZ002281',
      name: '光迅科技',
      quantity: 100,
      availableQuantity: 100,
      marketValue: 20497,
      pnlAmount: -830.75,
      pnlPercent: -3.82,
      currentPrice: 204.97,
      costPrice: 213.12,
      stopLossPrice: 194.1,
      watchReason: '同花顺截图自动同步',
      isActive: true
    }]));
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => ({
      ok: true,
      json: async () => {
        if (String(url).includes('/market/latest')) {
          return {
            id: 'live-market',
            index_name: '上证指数',
            index_change_percent: 1.12,
            market_status: '盘中',
            indices: [],
            rising_count: 3923,
            falling_count: 1515,
            total_turnover: 3236299000000,
            source_status: 'ok',
            captured_at: '2026-06-15T10:20:00+08:00'
          };
        }
        if (init?.method === 'POST') {
          return {
            items: [{
              symbol: 'SZ002281',
              name: '光迅科技',
              action: 'hold',
              level: 'info',
              current_price: 221.28,
              change_percent: 4.1,
              pnl_percent: 3.83,
              quantity: 100,
              available_quantity: 100,
              market_value: 22128,
              pnl_amount: 816,
              cost_price: 213.12,
              stop_loss_price: 194.1,
              risks: ['未触发硬性止损风险'],
              growth_points: ['现价高于成本'],
              suggestion: '继续观察'
            }]
          };
        }
        return { items: [] };
      }
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);

    const holdingsPanel = screen.getByText('持仓风险').closest('article');
    expect(holdingsPanel).not.toBeNull();
    expect(await within(holdingsPanel as HTMLElement).findByText('213.120/221.280')).toBeInTheDocument();
    expect(within(holdingsPanel as HTMLElement).getByText('+4.1%')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/analysis/holdings'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"symbol":"SZ002281"')
      })
    );
  });

  it('connects the top reminder button to a WeChat webhook test', async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => ({
      ok: true,
      json: async () => {
        const requestUrl = String(url);
        if (requestUrl.includes('/alerts/test')) {
          return {
            wechat_delivered: true,
            configured: true,
            provider: 'WxPusher',
            message: 'WxPusher 已创建发送任务；若微信没收到，请确认当前微信已关注该应用并完成通道激活。'
          };
        }
        if (requestUrl.includes('/market/latest')) {
          return {
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
          };
        }
        return { items: [] };
      }
    }));
    vi.stubGlobal('fetch', fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '开启提醒' }));
    fireEvent.change(screen.getByPlaceholderText('SPT_xxx / wxpusher:AT_xxx:UID_xxx / Server 酱 SendKey'), {
      target: { value: 'SPT_example' }
    });
    fireEvent.click(screen.getByRole('button', { name: '发送微信测试' }));

    expect(await screen.findByText(/微信测试已提交：WxPusher 已创建发送任务/)).toBeInTheDocument();
    expect(window.localStorage.getItem('a-share-watchtower:wechat-webhook')).toBe('SPT_example');
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/alerts/test'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ webhook_url: 'SPT_example' })
      })
    );
  });
});
