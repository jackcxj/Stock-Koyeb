import { Bell, Cloud, FileImage, Gauge, ShieldAlert, TrendingUp, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Holding, HoldingAnalysis, MarketSnapshot, ParsedHolding } from './types';
import { demoAlerts, demoHoldings, demoMarket, demoStocks } from './lib/demoData';
import { fetchHoldingAnalysis, fetchLatestMarket } from './lib/api';
import { formatChinaDateTime, formatSignedPercent } from './lib/marketFormat';
import { actionLabel, analyzeHolding, classifyMarketTrend } from './lib/stockRules';
import { parseHoldingsFromOcrText, recognizeHoldingsImage } from './lib/ocr';

const SAMPLE_OCR_TEXT = `光迅科技 20,497.00 -830.75 -3.820% 100 100 213.120 204.970
洁美科技 7,528.00 -648.26 -7.820% 100 100 81.670 75.280
中兴通讯 7,270.00 -356.14 -4.560% 200 200 38.085 36.350
工业富联 7,013.00 82.85 1.330% 100 100 69.211 70.130
许继电气 6,660.00 -1,345.83 -16.720% 300 300 26.657 22.200
通富微电 5,722.00 -1,482.36 -20.480% 100 100 71.960 57.220
汇绿生态 4,950.00 -1,159.98 -18.880% 100 100 61.020 49.500
名臣健康 2,000.00 -218.49 -9.580% 100 100 22.120 20.000`;

export default function App() {
  const [holdings, setHoldings] = useState<Holding[]>(demoHoldings);
  const [localOverrideSymbols, setLocalOverrideSymbols] = useState<Set<string>>(new Set());
  const [ocrText, setOcrText] = useState(SAMPLE_OCR_TEXT);
  const [parsed, setParsed] = useState<ParsedHolding[]>([]);
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('可上传同花顺持仓截图，系统会按市值、盈亏、持仓/可用、成本/现价解析，结果需人工确认。');
  const [market, setMarket] = useState<MarketSnapshot>(demoMarket);
  const [remoteAnalyses, setRemoteAnalyses] = useState<HoldingAnalysis[] | null>(null);
  const [dataSourceLabel, setDataSourceLabel] = useState('后台连接中');

  useEffect(() => {
    let cancelled = false;

    async function refreshFromBackend() {
      const [nextMarket, nextAnalyses] = await Promise.all([fetchLatestMarket(), fetchHoldingAnalysis()]);
      if (cancelled) return;
      if (nextMarket) {
        setMarket(nextMarket);
        setDataSourceLabel(
          nextMarket.sourceStatus === 'ok'
            ? `后台实时更新 · ${formatChinaDateTime(nextMarket.capturedAt)}`
            : `后台旧快照 · ${formatChinaDateTime(nextMarket.capturedAt)}`
        );
      } else {
        setDataSourceLabel('后台连接失败，显示本地演示数据');
      }
      if (nextAnalyses) setRemoteAnalyses(nextAnalyses);
    }

    void refreshFromBackend();
    const timer = window.setInterval(() => void refreshFromBackend(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const marketTrend = classifyMarketTrend(market);
  const localAnalyses = useMemo(
    () => holdings.map((holding) => analyzeHolding(holding, demoStocks[holding.symbol] ?? stockFromHolding(holding, market), market)),
    [holdings, market]
  );
  const analyses = useMemo(
    () => mergeAnalyses(remoteAnalyses, localAnalyses, localOverrideSymbols),
    [remoteAnalyses, localAnalyses, localOverrideSymbols]
  );

  function addParsedHoldings() {
    const next = parseHoldingsFromOcrText(ocrText);
    setParsed(next);
    setOcrStatus(next.length > 0 ? `识别到 ${next.length} 条持仓，请逐条确认写入。` : '没有识别到持仓，请检查文本或上传更清晰截图。');
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;
    setOcrStatus(`正在识别 ${file.name} ...`);
    try {
      const next = await recognizeHoldingsImage(file);
      setParsed(next);
      setOcrStatus(next.length > 0 ? `识别到 ${next.length} 条持仓，请逐条确认写入。` : '未识别到可确认持仓，建议裁剪到持仓股表格区域后重试。');
    } catch (error) {
      setOcrStatus(error instanceof Error ? `OCR 失败：${error.message}` : 'OCR 失败，请稍后重试。');
    }
  }

  function confirmParsedHolding(item: ParsedHolding) {
    const nextHolding = holdingFromParsed(item);
    setHoldings((current) => [
      ...current.filter((holding) => holding.symbol !== item.symbol),
      nextHolding
    ]);
    setLocalOverrideSymbols((current) => new Set([...current, item.symbol]));
    setOcrStatus(`${item.name} 已写入持仓风险列表，市值、盈亏、现价已按截图更新。`);
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationEnabled(permission === 'granted');
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Netlify + Supabase + Render MVP</p>
          <h1>A股实时监控驾驶舱</h1>
        </div>
        <button className="iconButton" type="button" onClick={requestNotificationPermission} title="开启浏览器提醒">
          <Bell size={18} />
          {notificationEnabled ? '提醒已开启' : '开启提醒'}
        </button>
      </header>

      <section className="grid">
        <article className="panel market">
          <div className="panelTitle">
            <Gauge size={20} />
            <h2>大盘状态</h2>
          </div>
          <div className={`trend ${marketTrend}`}>
            <span>{market.marketStatus ?? trendLabel(marketTrend)}</span>
            <strong>{formatSignedPercent(market.indexChangePercent)}</strong>
          </div>
          <dl className="stats">
            <div><dt>指数</dt><dd>{market.indexName}</dd></div>
            <div><dt>采集时间</dt><dd>{formatChinaDateTime(market.capturedAt)}</dd></div>
            <div><dt>上涨家数</dt><dd>{market.risingCount}</dd></div>
            <div><dt>下跌家数</dt><dd>{market.fallingCount}</dd></div>
            <div><dt>成交额</dt><dd>{formatYi(market.totalTurnover)}</dd></div>
            <div><dt>资金净流入</dt><dd>{formatYi(market.netInflow)}</dd></div>
          </dl>
          <div className="compareStrip">
            <span>较昨日同时间 / 较上一日</span>
            <strong>涨跌家数 {market.risingCount}:{market.fallingCount}</strong>
            <strong>成交额 {formatSignedPercent(market.turnoverChangePercent)}</strong>
            <strong>下跌家数占比 {((market.fallingCount / Math.max(market.risingCount + market.fallingCount, 1)) * 100).toFixed(1)}%</strong>
          </div>
          <section className="indexBoard" aria-label="全部A股指数">
            <h3>全部A股指数</h3>
            <div className="indexGrid">
              {market.indices.map((item) => (
                <div className={`indexTile ${item.changePercent >= 0 ? 'up' : 'down'}`} key={item.code}>
                  <span>{item.name}</span>
                  <strong>{item.latest.toFixed(2)}</strong>
                  <em>{formatSignedNumber(item.changeAmount)} {formatSignedPercent(item.changePercent)}</em>
                </div>
              ))}
            </div>
          </section>
          <p className="statusLine"><Cloud size={16} /> 数据源：{dataSourceLabel}</p>
        </article>

        <article className="panel holdings">
          <div className="panelTitle">
            <TrendingUp size={20} />
            <h2>持仓风险</h2>
          </div>
          <div className="holdingList">
            {analyses.map((analysis) => (
              <div className={`holdingRow ${analysis.level}`} key={analysis.symbol}>
                <div>
                  <strong>{analysis.name}</strong>
                  <span>{analysis.symbol} · {actionLabel(analysis.action)}</span>
                </div>
                <div className="numberBlock">
                  <strong>{actionLabel(analysis.action)}</strong>
                  <span>{formatSignedPercent(analysis.pnlPercent)}</span>
                </div>
                <dl className="positionMetrics">
                  <div><dt>市值</dt><dd>{formatMoneyWithUnit(analysis.marketValue)}</dd></div>
                  <div><dt>盈亏</dt><dd className={signedClass(analysis.pnlAmount)}>{formatMoneyWithUnit(analysis.pnlAmount)}</dd></div>
                  <div><dt>持仓/可用</dt><dd>{formatShares(analysis)}</dd></div>
                  <div><dt>成本/现价</dt><dd>{formatCostPrice(analysis)}</dd></div>
                </dl>
                <p>{analysis.risks[0]}</p>
                <p>{analysis.growthPoints[0]}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel alerts">
          <div className="panelTitle">
            <ShieldAlert size={20} />
            <h2>提醒队列</h2>
          </div>
          {[...demoAlerts, ...analyses.filter((item) => item.action !== 'hold').map((item) => ({
            id: `analysis-${item.symbol}`,
            symbol: item.symbol,
            level: item.level,
            action: item.action,
            reason: item.suggestion,
            createdAt: new Date().toISOString(),
            deliveredChannels: ['页面']
          }))].map((alert) => (
            <div className={`alertItem ${alert.level}`} key={alert.id}>
              <span>{actionLabel(alert.action)} {alert.symbol}</span>
              <p>{alert.reason}</p>
            </div>
          ))}
        </article>

        <article className="panel ocr">
          <div className="panelTitle">
            <FileImage size={20} />
            <h2>同花顺截图导入</h2>
          </div>
          <label className="uploadBox">
            <Upload size={18} />
            <span>上传持仓截图</span>
            <input
              accept="image/*"
              type="file"
              onChange={(event) => void handleImageUpload(event.currentTarget.files?.[0])}
            />
          </label>
          <p className="ocrStatus">{ocrStatus}</p>
          <textarea value={ocrText} onChange={(event) => setOcrText(event.target.value)} aria-label="OCR text" />
          <div className="actions">
            <button type="button" onClick={addParsedHoldings}>识别文本</button>
          </div>
          <div className="parsedList">
            {parsed.map((item) => (
              <div className="parsedItem" key={item.symbol}>
                <span>{item.name} {item.symbol} · 市值 {formatMoneyWithUnit(item.marketValue)} · 盈亏 {formatMoneyWithUnit(item.pnlAmount)} · {item.quantity} 股 · 成本/现价 {formatFixed(item.costPrice)}/{formatFixed(item.currentPrice)}</span>
                <button type="button" onClick={() => confirmParsedHolding(item)}>确认写入</button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function mergeAnalyses(remote: HoldingAnalysis[] | null, local: HoldingAnalysis[], overrideSymbols: Set<string>): HoldingAnalysis[] {
  if (!remote) return local;
  const localBySymbol = new Map(local.map((item) => [item.symbol, item]));
  const merged = remote.map((item) => overrideSymbols.has(item.symbol) ? localBySymbol.get(item.symbol) ?? item : item);
  for (const symbol of overrideSymbols) {
    if (!merged.some((item) => item.symbol === symbol)) {
      const localItem = localBySymbol.get(symbol);
      if (localItem) merged.push(localItem);
    }
  }
  return merged;
}

function holdingFromParsed(item: ParsedHolding): Holding {
  return {
    id: `h-${item.symbol}`,
    symbol: item.symbol,
    name: item.name,
    quantity: item.quantity,
    availableQuantity: item.availableQuantity,
    marketValue: item.marketValue,
    pnlAmount: item.pnlAmount,
    pnlPercent: item.pnlPercent,
    currentPrice: item.currentPrice,
    costPrice: item.costPrice,
    stopLossPrice: item.stopLossPrice,
    watchReason: '同花顺截图导入，已人工确认',
    isActive: true
  };
}

function trendLabel(trend: string): string {
  if (trend === 'bullish') return '偏强';
  if (trend === 'bearish') return '偏弱';
  return '震荡';
}

function formatMoneyWithUnit(value?: number): string {
  return Number.isFinite(value) ? `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })} 元` : '--';
}

function formatYi(value?: number): string {
  return Number.isFinite(value) ? `${(Number(value) / 100000000).toFixed(2)} 亿` : '--';
}

function formatSignedNumber(value?: number): string {
  if (!Number.isFinite(value)) return '';
  return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}`;
}

function formatShares(analysis: HoldingAnalysis): string {
  const quantity = Number.isFinite(analysis.quantity) ? Number(analysis.quantity) : 0;
  const available = Number.isFinite(analysis.availableQuantity) ? Number(analysis.availableQuantity) : quantity;
  return quantity > 0 ? `${quantity}/${available}` : '--';
}

function formatCostPrice(analysis: HoldingAnalysis): string {
  if (!Number.isFinite(analysis.costPrice) || !Number.isFinite(analysis.currentPrice)) return '--';
  return `${formatFixed(analysis.costPrice)}/${formatFixed(analysis.currentPrice)}`;
}

function formatFixed(value?: number): string {
  return Number.isFinite(value) ? Number(value).toFixed(3) : '--';
}

function signedClass(value?: number): string {
  if (!Number.isFinite(value)) return '';
  return Number(value) >= 0 ? 'positive' : 'negative';
}

function stockFromHolding(holding: Holding, market: MarketSnapshot) {
  return {
    symbol: holding.symbol,
    name: holding.name,
    price: holding.currentPrice ?? holding.costPrice,
    changePercent: holding.pnlPercent ?? 0,
    volumeRatio: 1,
    capturedAt: market.capturedAt
  };
}
