import type { Action, AlertLevel, Holding, HoldingAnalysis, MarketSnapshot, StockSnapshot, Trend } from '../types';

export function normalizeStockSymbol(input: string): string {
  const value = input.replace(/\s+/g, '').toUpperCase();
  const match = value.match(/(?:SH|SZ|BJ)?(\d{6})/);
  if (!match) return value;

  const code = match[1];
  if (value.startsWith('SH') || value.startsWith('SZ') || value.startsWith('BJ')) {
    return `${value.slice(0, 2)}${code}`;
  }
  if (code.startsWith('6')) return `SH${code}`;
  if (code.startsWith('8') || code.startsWith('4')) return `BJ${code}`;
  return `SZ${code}`;
}

export function classifyMarketTrend(snapshot: Pick<MarketSnapshot, 'indexChangePercent' | 'risingCount' | 'fallingCount'>): Trend {
  const total = Math.max(snapshot.risingCount + snapshot.fallingCount, 1);
  const risingRatio = snapshot.risingCount / total;

  if (snapshot.indexChangePercent >= 0.8 && risingRatio >= 0.62) return 'bullish';
  if (snapshot.indexChangePercent <= -0.8 && risingRatio <= 0.38) return 'bearish';
  return 'neutral';
}

export function analyzeHolding(holding: Holding, stock: StockSnapshot, market: MarketSnapshot): HoldingAnalysis {
  const trend = classifyMarketTrend(market);
  const calculatedPnlPercent = ((stock.price - holding.costPrice) / Math.max(holding.costPrice, 0.01)) * 100;
  const pnlPercent = Number.isFinite(holding.pnlPercent) ? Number(holding.pnlPercent) : calculatedPnlPercent;
  const marketValue = Number.isFinite(holding.marketValue) ? Number(holding.marketValue) : stock.price * holding.quantity;
  const pnlAmount = Number.isFinite(holding.pnlAmount) ? Number(holding.pnlAmount) : (stock.price - holding.costPrice) * holding.quantity;
  const risks: string[] = [];
  const growthPoints: string[] = [];
  let action: Action = 'hold';
  let level: AlertLevel = 'info';

  if (stock.price <= holding.stopLossPrice) {
    risks.push(`现价 ${stock.price.toFixed(2)} 已跌破止损线 ${holding.stopLossPrice.toFixed(2)}`);
    action = 'stop_loss';
    level = 'critical';
  }

  if (pnlPercent <= -5) {
    risks.push(`相对成本回撤 ${Math.abs(pnlPercent).toFixed(1)}%`);
    if (action !== 'stop_loss') {
      action = 'reduce';
      level = 'warning';
    }
  }

  if (trend === 'bearish' && stock.changePercent < -1) {
    risks.push('大盘走弱且个股同步下跌');
    if (action === 'hold') {
      action = 'reduce';
      level = 'warning';
    }
  }

  if (trend === 'bullish' && stock.changePercent >= 1.5 && stock.volumeRatio >= 1.5) {
    growthPoints.push(`大盘转强，个股上涨 ${stock.changePercent.toFixed(1)}% 且放量 ${stock.volumeRatio.toFixed(1)} 倍`);
    if (action === 'hold') {
      action = 'buy_watch';
      level = 'info';
    }
  }

  if (stock.price > holding.costPrice && stock.changePercent > 0) {
    growthPoints.push(`现价高于成本，浮盈 ${pnlPercent.toFixed(1)}%`);
  }

  if (risks.length === 0) {
    risks.push(trend === 'bearish' ? '市场偏弱，保持仓位纪律' : '未触发硬性止损风险');
  }
  if (growthPoints.length === 0) {
    growthPoints.push(trend === 'bullish' ? '市场环境改善，等待个股确认' : '暂未出现放量增长信号');
  }

  return {
    symbol: holding.symbol,
    name: holding.name,
    action,
    level,
    currentPrice: stock.price,
    changePercent: stock.changePercent,
    pnlPercent,
    quantity: holding.quantity,
    availableQuantity: holding.availableQuantity,
    marketValue,
    pnlAmount,
    costPrice: holding.costPrice,
    stopLossPrice: holding.stopLossPrice,
    risks,
    growthPoints,
    suggestion: buildSuggestion(action)
  };
}

export function shouldSuppressAlert(lastAlertAt: Date, now: Date, cooldownMinutes: number): boolean {
  return now.getTime() - lastAlertAt.getTime() < cooldownMinutes * 60 * 1000;
}

export function actionLabel(action: Action): string {
  const labels: Record<Action, string> = {
    buy_watch: '买入关注',
    hold: '持有观察',
    reduce: '减仓预警',
    stop_loss: '止损提醒'
  };
  return labels[action];
}

function buildSuggestion(action: Action): string {
  const suggestions: Record<Action, string> = {
    buy_watch: '只作为关注信号，等待你在同花顺里人工确认，不自动下单。',
    hold: '继续观察，重点看是否跌破止损线或放量转强。',
    reduce: '检查仓位和成本，考虑分批降低风险敞口。',
    stop_loss: '已触发止损条件，请优先在同花顺里人工复核并处理。'
  };
  return suggestions[action];
}
