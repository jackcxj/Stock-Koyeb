import type { AlertItem, Holding, MarketSnapshot, StockSnapshot } from '../types';

export const demoMarket: MarketSnapshot = {
  id: 'ths-2026-06-11-close',
  indexName: '上证指数',
  indexChangeAmount: -6.22,
  indexChangePercent: -0.16,
  marketStatus: '已收盘',
  netInflow: -57506000000,
  indices: [
    { code: '000001', name: '上证指数', latest: 3987.01, changeAmount: -6.22, changePercent: -0.16 },
    { code: '399001', name: '深证成指', latest: 14851.98, changeAmount: -102.12, changePercent: -0.68 },
    { code: '399006', name: '创业板指', latest: 3811.25, changeAmount: -43.54, changePercent: -1.13 }
  ],
  risingCount: 1370,
  fallingCount: 4069,
  totalTurnover: 2574900000000,
  risingCountChange: 0,
  fallingCountChange: 0,
  turnoverChangePercent: -2.62,
  sourceStatus: 'ok',
  capturedAt: '2026-06-11T15:00:00+08:00'
};

export const demoHoldings: Holding[] = [
  makeHolding('h-002281', 'SZ002281', '光迅科技', 100, 100, 20540, -787.77, -3.62, 213.12, 205.4),
  makeHolding('h-002859', 'SZ002859', '洁美科技', 100, 100, 7801, -375.4, -4.48, 81.67, 78.01),
  makeHolding('h-000063', 'SZ000063', '中兴通讯', 200, 200, 7562, -64.28, -0.72, 38.085, 37.81),
  makeHolding('h-601138', 'SH601138', '工业富联', 100, 100, 6952, 21.88, 0.45, 69.211, 69.52),
  makeHolding('h-000400', 'SZ000400', '许继电气', 300, 300, 6483, -1522.74, -18.93, 26.657, 21.61),
  makeHolding('h-002156', 'SZ002156', '通富微电', 100, 100, 6009, -1195.5, -16.5, 71.96, 60.09),
  makeHolding('h-001267', 'SZ001267', '汇绿生态', 100, 100, 4905, -1204.95, -19.62, 61.02, 49.05),
  makeHolding('h-002919', 'SZ002919', '名臣健康', 200, 200, 3952, -232.48, -5.39, 20.885, 19.76),
  makeHolding('h-600900', 'SH600900', '长江电力', 100, 100, 2789, -9.95, -0.11, 27.92, 27.89),
  makeHolding('h-002549', 'SZ002549', '凯美特气', 100, 100, 1815, 234.59, 15.31, 15.74, 18.15)
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
    symbol: 'SZ000400',
    level: 'critical',
    action: 'stop_loss',
    reason: '许继电气、通富微电、汇绿生态回撤较深，请优先复核止损纪律。',
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
