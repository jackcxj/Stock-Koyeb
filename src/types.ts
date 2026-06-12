export type Trend = 'bullish' | 'neutral' | 'bearish';
export type AlertLevel = 'info' | 'warning' | 'critical';
export type Action = 'buy_watch' | 'hold' | 'reduce' | 'stop_loss';

export interface MarketSnapshot {
  id: string;
  indexName: string;
  indexChangePercent: number;
  indexChangeAmount?: number;
  marketStatus?: string;
  netInflow?: number;
  indices: MarketIndex[];
  risingCount: number;
  fallingCount: number;
  totalTurnover: number;
  risingCountChange?: number;
  fallingCountChange?: number;
  turnoverChangePercent?: number;
  sourceStatus: 'ok' | 'stale' | 'error';
  capturedAt: string;
}

export interface MarketIndex {
  code: string;
  name: string;
  latest: number;
  changeAmount?: number;
  changePercent: number;
}

export interface StockSnapshot {
  symbol: string;
  name: string;
  price: number;
  changePercent: number;
  volumeRatio: number;
  capturedAt: string;
}

export interface Holding {
  id: string;
  symbol: string;
  name: string;
  quantity: number;
  availableQuantity?: number;
  marketValue?: number;
  pnlAmount?: number;
  pnlPercent?: number;
  currentPrice?: number;
  costPrice: number;
  stopLossPrice: number;
  watchReason: string;
  isActive: boolean;
}

export interface HoldingAnalysis {
  symbol: string;
  name: string;
  action: Action;
  level: AlertLevel;
  currentPrice: number;
  pnlPercent: number;
  quantity?: number;
  availableQuantity?: number;
  marketValue?: number;
  pnlAmount?: number;
  costPrice?: number;
  stopLossPrice?: number;
  risks: string[];
  growthPoints: string[];
  suggestion: string;
}

export interface ParsedHolding {
  symbol: string;
  name: string;
  quantity: number;
  availableQuantity?: number;
  marketValue?: number;
  pnlAmount?: number;
  pnlPercent?: number;
  currentPrice?: number;
  costPrice: number;
  stopLossPrice: number;
}

export interface AlertItem {
  id: string;
  symbol?: string;
  level: AlertLevel;
  action: Action;
  reason: string;
  createdAt: string;
  deliveredChannels: string[];
}
