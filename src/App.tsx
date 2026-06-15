import { Bell, Cloud, FileImage, Gauge, ShieldAlert, TrendingUp, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Holding, HoldingAnalysis, MarketSnapshot, ParsedHolding } from './types';
import { demoAlerts, demoHoldings, demoMarket, demoStocks } from './lib/demoData';
import { fetchHoldingAnalysis, fetchLatestMarket, sendWechatAlert, sendWechatTestAlert } from './lib/api';
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

const SYNC_RECORDS_KEY = 'a-share-watchtower:pnl-records';
const HOLDINGS_KEY = 'a-share-watchtower:holdings';
const WECHAT_WEBHOOK_KEY = 'a-share-watchtower:wechat-webhook';
const WECHAT_SENT_ALERTS_KEY = 'a-share-watchtower:wechat-sent-alerts';

interface SyncRecord {
  id: string;
  createdAt: string;
  count: number;
  totalMarketValue: number;
  totalPnlAmount: number;
}

export default function App() {
  const [holdings, setHoldings] = useState<Holding[]>(() => loadSavedHoldings() ?? demoHoldings);
  const [screenshotSynced, setScreenshotSynced] = useState(() => Boolean(loadSavedHoldings()));
  const [ocrText, setOcrText] = useState(SAMPLE_OCR_TEXT);
  const [parsed, setParsed] = useState<ParsedHolding[]>([]);
  const [syncRecords, setSyncRecords] = useState<SyncRecord[]>(() => loadSyncRecords());
  const [notificationEnabled, setNotificationEnabled] = useState(false);
  const [reminderPanelOpen, setReminderPanelOpen] = useState(false);
  const [wechatWebhookUrl, setWechatWebhookUrl] = useState(() => loadWechatWebhook());
  const [wechatStatus, setWechatStatus] = useState(() => loadWechatWebhook() ? '微信提醒已保存，可发送测试确认。' : '微信提醒未配置。');
  const [wechatTesting, setWechatTesting] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('可上传同花顺持仓截图，识别后会自动替换中间持仓列表，并记录本次盈亏结果。');
  const [market, setMarket] = useState<MarketSnapshot>(demoMarket);
  const [remoteAnalyses, setRemoteAnalyses] = useState<HoldingAnalysis[] | null>(null);
  const [dataSourceLabel, setDataSourceLabel] = useState('后台连接中');
  const [holdingSourceLabel, setHoldingSourceLabel] = useState('持仓行情等待同步');

  const refreshHoldingAnalysis = useCallback(async (nextHoldings: Holding[]) => {
    setHoldingSourceLabel('持仓行情同步中...');
    const nextAnalyses = await fetchHoldingAnalysis(nextHoldings);
    if (nextAnalyses?.length) {
      setRemoteAnalyses(nextAnalyses);
      setHoldingSourceLabel(`持仓行情实时更新 · ${formatChinaDateTime(new Date().toISOString())}`);
      return true;
    }
    setHoldingSourceLabel('持仓行情同步失败，暂用截图价格');
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function refreshFromBackend() {
      const [nextMarket, nextAnalyses] = await Promise.all([
        fetchLatestMarket(),
        fetchHoldingAnalysis(screenshotSynced ? holdings : undefined)
      ]);
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
        setHoldingSourceLabel(`持仓行情实时更新 · ${formatChinaDateTime(new Date().toISOString())}`);
      }
    }

    void refreshFromBackend();
    const timer = window.setInterval(() => void refreshFromBackend(), 30000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [holdings, screenshotSynced]);

  const marketTrend = classifyMarketTrend(market);
  const localAnalyses = useMemo(
    () => holdings.map((holding) => analyzeHolding(holding, demoStocks[holding.symbol] ?? stockFromHolding(holding, market), market)),
    [holdings, market]
  );
  const analyses = useMemo(
    () => screenshotSynced ? mergeLocalAnalyses(remoteAnalyses, localAnalyses) : mergeAnalyses(remoteAnalyses, localAnalyses),
    [remoteAnalyses, localAnalyses, screenshotSynced]
  );
  const generatedAlerts = useMemo(() => analyses.filter((item) => item.action !== 'hold').map((item) => ({
    id: `analysis-${item.symbol}`,
    symbol: item.symbol,
    level: item.level,
    action: item.action,
    reason: item.suggestion,
    createdAt: new Date().toISOString(),
    deliveredChannels: ['页面']
  })), [analyses]);

  useEffect(() => {
    const webhookUrl = wechatWebhookUrl.trim();
    if (!webhookUrl || generatedAlerts.length === 0) return;

    let cancelled = false;
    const sentKeys = loadWechatSentAlertKeys();
    async function deliverAlerts() {
      for (const alert of generatedAlerts) {
        const alertKey = `${new Date().toISOString().slice(0, 10)}:${alert.symbol}:${alert.action}:${alert.level}`;
        if (sentKeys.has(alertKey)) continue;
        const result = await sendWechatAlert(
          webhookUrl,
          `A股${actionLabel(alert.action)}：${alert.symbol}`,
          `${alert.reason}\n\n来源：A股实时监控驾驶舱`
        );
        if (cancelled) return;
        if (result?.delivered) {
          sentKeys.add(alertKey);
          saveWechatSentAlertKeys(sentKeys);
          setWechatStatus(result.message ? `微信提醒已提交：${alert.symbol} · ${result.message}` : `微信提醒已提交：${alert.symbol}`);
        }
      }
    }

    void deliverAlerts();
    return () => {
      cancelled = true;
    };
  }, [generatedAlerts, wechatWebhookUrl]);

  function addParsedHoldings() {
    const next = parseHoldingsFromOcrText(ocrText);
    applyParsedHoldings(next, '文本');
  }

  async function handleImageUpload(file: File | undefined) {
    if (!file) return;
    setOcrStatus(`正在识别 ${file.name} ...`);
    try {
      const next = await recognizeHoldingsImage(file);
      applyParsedHoldings(next, '截图');
    } catch (error) {
      setOcrStatus(error instanceof Error ? `OCR 失败：${error.message}` : 'OCR 失败，请稍后重试。');
    }
  }

  function applyParsedHoldings(items: ParsedHolding[], source: string) {
    setParsed(items);
    if (items.length === 0) {
      setOcrStatus(`未从${source}识别到可同步持仓，建议裁剪到持仓股表格区域后重试。`);
      return;
    }

    const nextHoldings = items.map(holdingFromParsed);
    setHoldings(nextHoldings);
    setScreenshotSynced(true);
    saveHoldings(nextHoldings);
    void refreshHoldingAnalysis(nextHoldings);

    const record = createSyncRecord(nextHoldings);
    setSyncRecords((current) => {
      const nextRecords = [record, ...current].slice(0, 12);
      saveSyncRecords(nextRecords);
      return nextRecords;
    });
    setOcrStatus(`已自动同步 ${items.length} 只持仓；截图外股票已从中间持仓列表移除，并开始刷新实时行情。`);
  }

  async function requestNotificationPermission() {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setNotificationEnabled(permission === 'granted');
  }

  function saveWechatWebhook() {
    const nextUrl = wechatWebhookUrl.trim();
    saveWechatWebhookUrl(nextUrl);
    setWechatWebhookUrl(nextUrl);
    setWechatStatus(nextUrl ? '微信提醒地址已保存。' : '微信提醒已清空。');
  }

  async function testWechatWebhook() {
    const nextUrl = wechatWebhookUrl.trim();
    if (!nextUrl) {
      setWechatStatus('请先填写 WxPusher SPT、Server 酱或 PushPlus 的推送配置。');
      return;
    }

    saveWechatWebhookUrl(nextUrl);
    setWechatWebhookUrl(nextUrl);
    setWechatTesting(true);
    setWechatStatus('正在发送微信测试提醒...');
    const result = await sendWechatTestAlert(nextUrl);
    setWechatTesting(false);
    if (result?.delivered) {
      setWechatStatus(result.message ? `微信测试已提交：${result.message}` : '微信测试已提交，请在微信里确认。');
    } else if (result?.configured === false) {
      setWechatStatus('后端没有拿到 webhook，请重新保存后再试。');
    } else {
      setWechatStatus(result?.message ? `微信测试失败：${result.message}` : '微信测试发送失败，请检查 webhook 地址或推送服务状态。');
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Netlify + Supabase + Render MVP</p>
          <h1>A股实时监控驾驶舱</h1>
        </div>
        <div className="reminderMenu">
          <button
            className="iconButton"
            type="button"
            onClick={() => setReminderPanelOpen((open) => !open)}
            title="开启提醒设置"
          >
            <Bell size={18} />
            {notificationEnabled || Boolean(wechatWebhookUrl) ? '提醒已配置' : '开启提醒'}
          </button>
          {reminderPanelOpen ? (
            <section className="reminderPanel" aria-label="提醒设置">
              <div>
                <strong>提醒设置</strong>
                <span>浏览器通知 + 微信 webhook</span>
              </div>
              <button className="secondaryButton" type="button" onClick={requestNotificationPermission}>
                {notificationEnabled ? '浏览器提醒已开启' : '开启浏览器提醒'}
              </button>
              <label>
                <span>微信推送配置</span>
                <input
                  value={wechatWebhookUrl}
                  onChange={(event) => setWechatWebhookUrl(event.target.value)}
                  placeholder="SPT_xxx / wxpusher:AT_xxx:UID_xxx / Server 酱 SendKey"
                />
              </label>
              <div className="reminderActions">
                <button className="secondaryButton" type="button" onClick={saveWechatWebhook}>保存微信提醒</button>
                <button className="iconButton" type="button" onClick={() => void testWechatWebhook()} disabled={wechatTesting}>
                  {wechatTesting ? '发送中...' : '发送微信测试'}
                </button>
              </div>
              <p>{wechatStatus}</p>
            </section>
          ) : null}
        </div>
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
                  <div><dt>今日涨跌</dt><dd className={signedClass(analysis.changePercent)}>{formatSignedPercent(analysis.changePercent)}</dd></div>
                  <div><dt>持仓/可用</dt><dd>{formatShares(analysis)}</dd></div>
                  <div><dt>成本/现价</dt><dd>{formatCostPrice(analysis)}</dd></div>
                </dl>
                <p>{analysis.risks[0]}</p>
                <p>{analysis.growthPoints[0]}</p>
              </div>
            ))}
          </div>
          <p className="statusLine"><Cloud size={16} /> 数据源：{holdingSourceLabel}</p>
        </article>

        <article className="panel alerts">
          <div className="panelTitle">
            <ShieldAlert size={20} />
            <h2>提醒队列</h2>
          </div>
          {[...demoAlerts, ...generatedAlerts].map((alert) => (
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
            <button type="button" onClick={addParsedHoldings}>识别并同步</button>
          </div>
          <div className="parsedList">
            {parsed.map((item) => (
              <div className="parsedItem" key={item.symbol}>
                <span>{item.name} {item.symbol} · 市值 {formatMoneyWithUnit(item.marketValue)} · 盈亏 {formatMoneyWithUnit(item.pnlAmount)} · {item.quantity} 股 · 成本/现价 {formatFixed(item.costPrice)}/{formatFixed(item.currentPrice)}</span>
              </div>
            ))}
          </div>
          <section className="syncHistory" aria-label="盈亏记录">
            <h3>盈亏记录</h3>
            {syncRecords.length === 0 ? (
              <p>暂无同步记录</p>
            ) : syncRecords.map((record) => (
              <div className="syncRecord" key={record.id}>
                <span>{formatChinaDateTime(record.createdAt)} · {record.count} 只</span>
                <strong className={signedClass(record.totalPnlAmount)}>{formatMoneyWithUnit(record.totalPnlAmount)}</strong>
                <em>总市值 {formatMoneyWithUnit(record.totalMarketValue)}</em>
              </div>
            ))}
          </section>
        </article>
      </section>
    </main>
  );
}

function mergeAnalyses(remote: HoldingAnalysis[] | null, local: HoldingAnalysis[]): HoldingAnalysis[] {
  if (!remote) return local;
  const localBySymbol = new Map(local.map((item) => [item.symbol, item]));
  return remote.map((item) => localBySymbol.get(item.symbol) ?? item);
}

function mergeLocalAnalyses(remote: HoldingAnalysis[] | null, local: HoldingAnalysis[]): HoldingAnalysis[] {
  if (!remote) return local;
  const remoteBySymbol = new Map(remote.map((item) => [item.symbol, item]));
  return local.map((item) => remoteBySymbol.get(item.symbol) ?? item);
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
    watchReason: '同花顺截图自动同步',
    isActive: true
  };
}

function createSyncRecord(holdings: Holding[]): SyncRecord {
  return {
    id: `sync-${Date.now()}`,
    createdAt: new Date().toISOString(),
    count: holdings.length,
    totalMarketValue: holdings.reduce((sum, item) => sum + Number(item.marketValue ?? 0), 0),
    totalPnlAmount: holdings.reduce((sum, item) => sum + Number(item.pnlAmount ?? 0), 0)
  };
}

function loadSyncRecords(): SyncRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(SYNC_RECORDS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSyncRecords(records: SyncRecord[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(SYNC_RECORDS_KEY, JSON.stringify(records));
}

function loadSavedHoldings(): Holding[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(HOLDINGS_KEY);
    if (!raw) return null;
    const holdings = JSON.parse(raw);
    return Array.isArray(holdings) && holdings.length > 0 ? holdings : null;
  } catch {
    return null;
  }
}

function saveHoldings(holdings: Holding[]) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(HOLDINGS_KEY, JSON.stringify(holdings));
}

function loadWechatWebhook(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(WECHAT_WEBHOOK_KEY) ?? '';
}

function saveWechatWebhookUrl(webhookUrl: string) {
  if (typeof window === 'undefined') return;
  if (webhookUrl) {
    window.localStorage.setItem(WECHAT_WEBHOOK_KEY, webhookUrl);
  } else {
    window.localStorage.removeItem(WECHAT_WEBHOOK_KEY);
  }
}

function loadWechatSentAlertKeys(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = window.localStorage.getItem(WECHAT_SENT_ALERTS_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveWechatSentAlertKeys(keys: Set<string>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(WECHAT_SENT_ALERTS_KEY, JSON.stringify([...keys].slice(-120)));
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
