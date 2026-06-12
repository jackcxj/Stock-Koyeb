import { Bell, Cloud, FileImage, Gauge, ShieldAlert, TrendingUp, Upload } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Holding, HoldingAnalysis, MarketSnapshot, ParsedHolding } from './types';
import { demoAlerts, demoHoldings, demoMarket, demoStocks } from './lib/demoData';
import { fetchHoldingAnalysis, fetchLatestMarket } from './lib/api';
import { formatChinaDateTime, formatSignedCount, formatSignedPercent } from './lib/marketFormat';
import { actionLabel, analyzeHolding, classifyMarketTrend } from './lib/stockRules';
import { parseHoldingsFromOcrText, recognizeHoldingsImage } from './lib/ocr';

export default function App() {
  const [holdings, setHoldings] = useState<Holding[]>(demoHoldings);
  const [ocrText, setOcrText] = useState(
    '光迅科技 20,540.00 -787.77 -3.620% 100 100 213.120 205.400\n洁美科技 7,801.00 -375.40 -4.480% 100 100 81.670 78.010'
  );
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
      if (nextAnalyses) {
        setRemoteAnalyses(nextAnalyses);
      }
    }

    void refreshFromBackend();
    const timer = window.setInterval(() => void refreshFromBackend(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const marketTrend = classifyMarketTrend(market);
  const analyses = useMemo(
    () => remoteAnalyses ?? holdings.map((holding) => analyzeHolding(holding, demoStocks[holding.symbol] ?? stockFromHolding(holding, market), market)),
    [holdings, market, remoteAnalyses]
  );

  function addParsedHoldings() {
    const next = parseHoldingsFromOcrText(ocrText);
    setParsed(next);
    setOcrStatus(next.length > 0 ? `识别到 ${next.length} 条持仓，请逐条确认。` : '没有识别到持仓，请检查文本或上传更清晰截图。');
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;
    setOcrStatus(`正在识别 ${file.name} ...`);
    try {
      const next = await recognizeHoldingsImage(file);
      setParsed(next);
      setOcrStatus(next.length > 0 ? `识别到 ${next.length} 条持仓，请逐条确认。` : '未识别到可确认持仓，请换一张更清晰的截图。');
    } catch (error) {
      setOcrStatus(error instanceof Error ? `OCR 失败：${error.message}` : 'OCR 失败，请稍后重试。');
    }
  }

  function confirmParsedHolding(item: ParsedHolding) {
    setHoldings((current) => [
      ...current.filter((holding) => holding.symbol !== item.symbol),
      {
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
      }
    ]);
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
          <p className="eyebrow">Netlify + Supabase + Koyeb MVP</p>
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
            <div><dt>成交额</dt><dd>{(market.totalTurnover / 100000000).toFixed(0)} 亿</dd></div>
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
            {analyses.map((analysis) => {
              const holding = holdingFromAnalysis(analysis) ?? holdings.find((item) => item.symbol === analysis.symbol);
              return (
                <div className={`holdingRow ${analysis.level}`} key={analysis.symbol}>
                  <div>
                    <strong>{analysis.name}</strong>
                    <span>{analysis.symbol} · {actionLabel(analysis.action)}</span>
                  </div>
                  <div className="numberBlock">
                    <strong>{analysis.currentPrice.toFixed(3)}</strong>
                    <span>{analysis.pnlPercent.toFixed(2)}%</span>
                  </div>
                  <dl className="positionMetrics">
                    <div><dt>市值</dt><dd>{formatMoney(holding?.marketValue)}</dd></div>
                    <div><dt>盈亏</dt><dd>{formatMoney(holding?.pnlAmount)}</dd></div>
                    <div><dt>持仓/可用</dt><dd>{formatShares(holding)}</dd></div>
                    <div><dt>成本/现价</dt><dd>{formatCostPrice(holding)}</dd></div>
                  </dl>
                  <p>{analysis.risks[0]}</p>
                  <p>{analysis.growthPoints[0]}</p>
                </div>
              );
            })}
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
                <span>{item.name} {item.symbol} · 市值 {formatMoney(item.marketValue)} · 盈亏 {formatMoney(item.pnlAmount)} · {item.quantity} 股 · 成本/现价 {item.costPrice}/{item.currentPrice}</span>
                <button type="button" onClick={() => confirmParsedHolding(item)}>确认写入</button>
              </div>
            ))}
          </div>
        </article>
      </section>
    </main>
  );
}

function trendLabel(trend: string): string {
  if (trend === 'bullish') return '偏强';
  if (trend === 'bearish') return '偏弱';
  return '震荡';
}

function formatMoney(value?: number): string {
  return Number.isFinite(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '--';
}

function formatYi(value?: number): string {
  return Number.isFinite(value) ? `${(Number(value) / 100000000).toFixed(2)} 亿` : '--';
}

function formatSignedNumber(value?: number): string {
  if (!Number.isFinite(value)) return '';
  return `${Number(value) >= 0 ? '+' : ''}${Number(value).toFixed(2)}`;
}

function formatShares(holding?: Holding): string {
  if (!holding) return '--';
  return `${holding.quantity}/${holding.availableQuantity ?? holding.quantity}`;
}

function formatCostPrice(holding?: Holding): string {
  if (!holding) return '--';
  return `${holding.costPrice.toFixed(3)}/${(holding.currentPrice ?? holding.costPrice).toFixed(3)}`;
}

function holdingFromAnalysis(analysis: HoldingAnalysis): Holding | undefined {
  if (!Number.isFinite(analysis.quantity) || !Number.isFinite(analysis.costPrice)) return undefined;
  return {
    id: `remote-${analysis.symbol}`,
    symbol: analysis.symbol,
    name: analysis.name,
    quantity: Number(analysis.quantity),
    availableQuantity: Number.isFinite(analysis.availableQuantity) ? Number(analysis.availableQuantity) : Number(analysis.quantity),
    marketValue: analysis.marketValue,
    pnlAmount: analysis.pnlAmount,
    pnlPercent: analysis.pnlPercent,
    currentPrice: analysis.currentPrice,
    costPrice: Number(analysis.costPrice),
    stopLossPrice: Number.isFinite(analysis.stopLossPrice) ? Number(analysis.stopLossPrice) : analysis.currentPrice,
    watchReason: '后台同步持仓',
    isActive: true
  };
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
