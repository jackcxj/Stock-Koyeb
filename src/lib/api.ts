import type { HoldingAnalysis, MarketSnapshot } from '../types';

const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

export async function fetchLatestMarket(): Promise<MarketSnapshot | null> {
  try {
    const response = await fetch(`${backendUrl}/market/latest`);
    if (!response.ok) return null;
    const payload = await response.json();
    return {
      id: payload.id ?? 'remote-market',
      indexName: payload.index_name,
      indexChangeAmount: payload.index_change_amount,
      indexChangePercent: payload.index_change_percent,
      marketStatus: payload.market_status,
      netInflow: payload.net_inflow,
      indices: (payload.indices ?? []).map((item: { code: string; name: string; latest: number; change_amount?: number; change_percent: number }) => ({
        code: item.code,
        name: item.name,
        latest: item.latest,
        changeAmount: item.change_amount,
        changePercent: item.change_percent
      })),
      risingCount: payload.rising_count,
      fallingCount: payload.falling_count,
      totalTurnover: payload.total_turnover,
      risingCountChange: payload.rising_count_change,
      fallingCountChange: payload.falling_count_change,
      turnoverChangePercent: payload.turnover_change_percent,
      sourceStatus: payload.source_status,
      capturedAt: payload.captured_at
    };
  } catch {
    return null;
  }
}

export async function fetchHoldingAnalysis(): Promise<HoldingAnalysis[] | null> {
  try {
    const response = await fetch(`${backendUrl}/analysis/holdings`);
    if (!response.ok) return null;
    const payload = await response.json();
    const items = payload.items ?? payload;
    return items.map((item: {
      symbol: string;
      name: string;
      action: HoldingAnalysis['action'];
      level: HoldingAnalysis['level'];
      current_price: number;
      pnl_percent: number;
      risks: string[];
      growth_points: string[];
      suggestion: string;
    }) => ({
      symbol: item.symbol,
      name: item.name,
      action: item.action,
      level: item.level,
      currentPrice: item.current_price,
      pnlPercent: item.pnl_percent,
      risks: item.risks,
      growthPoints: item.growth_points,
      suggestion: item.suggestion
    }));
  } catch {
    return null;
  }
}
