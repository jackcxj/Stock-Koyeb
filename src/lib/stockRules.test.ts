import { describe, expect, it } from 'vitest';
import {
  analyzeHolding,
  classifyMarketTrend,
  normalizeStockSymbol,
  shouldSuppressAlert
} from './stockRules';
import type { Holding, MarketSnapshot, StockSnapshot } from '../types';

const bullishMarket: MarketSnapshot = {
  id: 'm-1',
  indexName: '沪深300',
  indexChangePercent: 1.1,
  indices: [],
  risingCount: 3900,
  fallingCount: 1000,
  totalTurnover: 840000000000,
  sourceStatus: 'ok',
  capturedAt: '2026-06-11T10:00:00+08:00'
};

const weakMarket: MarketSnapshot = {
  ...bullishMarket,
  id: 'm-2',
  indexChangePercent: -1.0,
  risingCount: 900,
  fallingCount: 4100
};

const holding: Holding = {
  id: 'h-1',
  symbol: '600519',
  name: '贵州茅台',
  quantity: 100,
  costPrice: 1400,
  stopLossPrice: 1320,
  watchReason: '白酒龙头',
  isActive: true
};

it('normalizes A-share symbols to exchange-qualified values', () => {
  expect(normalizeStockSymbol('600519')).toBe('SH600519');
  expect(normalizeStockSymbol('000001')).toBe('SZ000001');
  expect(normalizeStockSymbol('bj 430047')).toBe('BJ430047');
});

it('classifies a market as bullish only when index and breadth are strong', () => {
  expect(classifyMarketTrend(bullishMarket)).toBe('bullish');
  expect(classifyMarketTrend(weakMarket)).toBe('bearish');
  expect(classifyMarketTrend({ ...bullishMarket, risingCount: 2300, fallingCount: 2200 })).toBe('neutral');
});

it('raises a stop-loss action when price breaks the configured stop line in weak market', () => {
  const stock: StockSnapshot = {
    symbol: '600519',
    name: '贵州茅台',
    price: 1310,
    changePercent: -2.2,
    volumeRatio: 1.3,
    capturedAt: bullishMarket.capturedAt
  };

  const result = analyzeHolding(holding, stock, weakMarket);

  expect(result.action).toBe('stop_loss');
  expect(result.level).toBe('critical');
  expect(result.risks.join(' ')).toContain('止损线');
});

it('marks a position as growth watch when stock rises with volume in a bullish market', () => {
  const stock: StockSnapshot = {
    symbol: '600519',
    name: '贵州茅台',
    price: 1450,
    changePercent: 2.4,
    volumeRatio: 1.8,
    capturedAt: bullishMarket.capturedAt
  };

  const result = analyzeHolding(holding, stock, bullishMarket);

  expect(result.action).toBe('buy_watch');
  expect(result.level).toBe('info');
  expect(result.growthPoints.join(' ')).toContain('放量');
});

it('suppresses duplicate alerts inside the cooldown window', () => {
  const now = new Date('2026-06-11T10:30:00+08:00');
  const last = new Date('2026-06-11T10:05:00+08:00');

  expect(shouldSuppressAlert(last, now, 45)).toBe(true);
  expect(shouldSuppressAlert(last, now, 10)).toBe(false);
});
