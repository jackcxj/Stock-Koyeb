import type { AlertItem, Holding, MarketSnapshot, StockSnapshot } from '../types';

export const demoMarket: MarketSnapshot = {
  id: 'sina-2026-06-12-close',
  indexName: '上证指数',
  indexChangeAmount: 44.5,
  indexChangePercent: 1.12,
  marketStatus: '已收盘',
  netInflow: undefined,
  indices: [
    { code: '000001', name: '上证指数', latest: 4031.51, changeAmount: 44.5, changePercent: 1.12 },
    { code: '399001', name: '深证成指', latest: 14963.41, changeAmount: 111.43, changePercent: 0.75 },
    { code: '399006', name: '创业板指', latest: 3830.35, changeAmount: 19.1, changePercent: 0.5 }
  ],
  risingCount: 3923,
  fallingCount: 1515,
  totalTurnover: 32362.99 * 100000000,
  risingCountChange: 0,
  fallingCountChange: 0,
  turnoverChangePercent: 0,
  sourceStatus: 'ok',
  capturedAt: '2026-06-12T15:30:39+08:00'
};

export const demoHoldings: Holding[] = [
  makeHolding('h-002281', 'SZ002281', '光迅科技', 100, 100, 20497, -830.75, -3.82, 213.12, 204.97),
  makeHolding('h-002859', 'SZ002859', '洁美科技', 100, 100, 7528, -648.26, -7.82, 81.67, 75.28),
  makeHolding('h-000063', 'SZ000063', '中兴通讯', 200, 200, 7270, -356.14, -4.56, 38.085, 36.35),
  makeHolding('h-601138', 'SH601138', '工业富联', 100, 100, 7013, 82.85, 1.33, 69.211, 70.13),
  makeHolding('h-000400', 'SZ000400', '许继电气', 300, 300, 6660, -1345.83, -16.72, 26.657, 22.2),
  makeHolding('h-002156', 'SZ002156', '通富微电', 100, 100, 5722, -1482.36, -20.48, 71.96, 57.22),
  makeHolding('h-001267', 'SZ001267', '汇绿生态', 100, 100, 4950, -1159.98, -18.88, 61.02, 49.5),
  makeHolding('h-002919', 'SZ002919', '名臣健康', 100, 100, 2000, -218.49, -9.58, 22.12, 20),
  makeHolding('h-600900', 'SH600900', '长江电力', 100, 100, 2828, 36, 1.29, 27.92, 28.28),
  makeHolding('h-002549', 'SZ002549', '凯美特气', 100, 100, 1735, 161, 10.23, 15.74, 17.35)
];

export const demoStocks: Record<string, StockSnapshot> = Object.fromEntries(
  demoHoldings.map((holding) => [
    holding.symbol,
    {
      symbol: holding.symbol,
      name: holding.name,
      price: holding.currentPrice ?? holding.costPrice,
      changePercent: holding.pnlPercent ?? 0,
      volumeRatio: 1,
      capturedAt: demoMarket.capturedAt
    }
  ])
);

export const demoAlerts: AlertItem[] = [
  {
    id: 'a-1',
    symbol: 'SZ002156',
    level: 'warning',
    action: 'reduce',
    reason: '通富微电、汇绿生态、许继电气相对成本回撤较深，请优先复核仓位和止损纪律。',
    createdAt: demoMarket.capturedAt,
    deliveredChannels: ['页面', '浏览器']
  }
];

function makeHolding(
  id: string,
  symbol: string,
  name: string,
  quantity: number,
  availableQuantity: number,
  marketValue: number,
  pnlAmount: number,
  pnlPercent: number,
  costPrice: number,
  currentPrice: number
): Holding {
  return {
    id,
    symbol,
    name,
    quantity,
    availableQuantity,
    marketValue,
    pnlAmount,
    pnlPercent,
    costPrice,
    currentPrice,
    stopLossPrice: Math.round(currentPrice * 94.5) / 100,
    watchReason: '同花顺持仓截图导入',
    isActive: true
  };
}
