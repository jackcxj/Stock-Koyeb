import type { ParsedHolding } from '../types';
import { normalizeStockSymbol } from './stockRules';

const CODE_LINE = /([\u4e00-\u9fa5A-Za-z]{2,12})\s+((?:SH|SZ|BJ)?\s*\d{6})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i;
const KNOWN_SYMBOLS: Record<string, string> = {
  风华高科: 'SZ000636',
  光迅科技: 'SZ002281',
  洁美科技: 'SZ002859',
  中兴通讯: 'SZ000063',
  工业富联: 'SH601138',
  许继电气: 'SZ000400',
  通富微电: 'SZ002156',
  汇绿生态: 'SZ001267',
  豫能控股: 'SZ001896',
  名臣健康: 'SZ002919',
  长江电力: 'SH600900',
  凯美特气: 'SZ002549'
};

export function parseHoldingsFromOcrText(text: string): ParsedHolding[] {
  const normalized = normalizeOcrText(text);
  const tableRows = parseTonghuashunTable(normalized.replace(/\s+/g, ' '));
  if (tableRows.length > 0) return tableRows;

  return normalized
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/[|,，]+/g, ' '))
    .map((line) => line.match(CODE_LINE))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({
      name: match[1],
      symbol: normalizeStockSymbol(match[2]),
      quantity: Number(match[3]),
      costPrice: Number(match[4]),
      stopLossPrice: Number(match[5])
    }))
    .filter((holding) => holding.quantity > 0 && holding.costPrice > 0 && holding.stopLossPrice > 0);
}

export async function recognizeHoldingsImage(file: File): Promise<ParsedHolding[]> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('chi_sim+eng');
  try {
    const images = await createPreprocessedImages(file);
    const passes: ParsedHolding[][] = [];
    for (const image of images) {
      const result = await worker.recognize(image);
      passes.push(parseHoldingsFromOcrText(result.data.text));
    }
    return mergeHoldingCandidates(passes);
  } finally {
    await worker.terminate();
  }
}

export function mergeHoldingCandidates(passes: ParsedHolding[][]): ParsedHolding[] {
  const merged = new Map<string, ParsedHolding>();
  for (const pass of passes) {
    for (const holding of pass) {
      const current = merged.get(holding.symbol);
      if (!current || holdingConsistencyError(holding) < holdingConsistencyError(current)) {
        merged.set(holding.symbol, holding);
      }
    }
  }
  return [...merged.values()];
}

function parseTonghuashunTable(text: string): ParsedHolding[] {
  const hits = Object.keys(KNOWN_SYMBOLS)
    .flatMap((name) => findAllNameHits(text, name))
    .sort((a, b) => a.index - b.index);

  return hits
    .map((hit, index) => {
      const next = hits[index + 1]?.index ?? text.length;
      return parseKnownNameSegment(hit.name, text.slice(hit.index, next));
    })
    .filter((holding): holding is ParsedHolding => Boolean(holding));
}

function findAllNameHits(text: string, name: string): Array<{ name: string; index: number }> {
  const hits: Array<{ name: string; index: number }> = [];
  let from = 0;
  while (from < text.length) {
    const index = text.indexOf(name, from);
    if (index < 0) break;
    hits.push({ name, index });
    from = index + name.length;
  }
  return hits;
}

function parseKnownNameSegment(name: string, segment: string): ParsedHolding | null {
  const values = segment
    .replace(name, ' ')
    .match(/[-+]?\d+(?:,\d{3})*(?:\.\d+)?%?/g)
    ?.map((raw) => raw.replace(/,/g, '')) ?? [];

  if (values.length < 7) return null;

  const isTwoLineVisualOrder = values[4].includes('%');
  const marketValue = Number(values[isTwoLineVisualOrder ? 3 : 0]);
  const pnlAmount = Number(values[isTwoLineVisualOrder ? 0 : 1]);
  const pnlPercent = Number(values[isTwoLineVisualOrder ? 4 : 2].replace('%', ''));
  const quantity = Number(values[isTwoLineVisualOrder ? 1 : 3]);
  const availableQuantity = Number(values[isTwoLineVisualOrder ? 5 : 4]);
  const costPrice = Number(values[isTwoLineVisualOrder ? 2 : 5]);
  const currentPrice = Number(values[6]);

  if ([marketValue, quantity, availableQuantity, costPrice, currentPrice].some((value) => !Number.isFinite(value) || value <= 0)) {
    return null;
  }

  return {
    symbol: KNOWN_SYMBOLS[name],
    name,
    marketValue,
    pnlAmount,
    pnlPercent,
    quantity,
    availableQuantity,
    costPrice,
    currentPrice,
    stopLossPrice: round2(currentPrice * 0.945)
  };
}

function normalizeOcrText(text: string): string {
  let normalized = text
    .replace(/[−–—]/g, '-')
    .replace(/[，]/g, ',')
    .replace(/\s+\/\s+/g, '/')
    .trim();
  let previous = '';
  while (previous !== normalized) {
    previous = normalized;
    normalized = normalized.replace(/([\u4e00-\u9fa5])[ \t\u00a0]+(?=[\u4e00-\u9fa5])/g, '$1');
  }
  return normalized;
}

function holdingConsistencyError(holding: ParsedHolding): number {
  if (!Number.isFinite(holding.marketValue) || !Number.isFinite(holding.pnlAmount) || !Number.isFinite(holding.pnlPercent)) {
    return Number.POSITIVE_INFINITY;
  }
  const denominator = 100 + Number(holding.pnlPercent);
  if (denominator === 0) return Number.POSITIVE_INFINITY;
  const expectedPnl = Number(holding.marketValue) * Number(holding.pnlPercent) / denominator;
  return Math.abs(Number(holding.pnlAmount) - expectedPnl);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function createPreprocessedImages(file: File): Promise<Array<HTMLCanvasElement | File>> {
  if (typeof document === 'undefined') return [file];

  const bitmap = await createImageBitmap(file);
  const source = document.createElement('canvas');
  source.width = bitmap.width;
  source.height = bitmap.height;
  source.getContext('2d')?.drawImage(bitmap, 0, 0);

  return [createHoldingTableCrop(source, bitmap.width, bitmap.height), source, file];
}

function createHoldingTableCrop(source: HTMLCanvasElement, width: number, height: number): HTMLCanvasElement {
  const cropY = Math.floor(height * 0.33);
  const cropHeight = Math.floor(height * 0.56);
  const scale = 2;
  const target = document.createElement('canvas');
  target.width = width * scale;
  target.height = cropHeight * scale;
  const context = target.getContext('2d');
  if (!context) return source;

  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, cropY, width, cropHeight, 0, 0, target.width, target.height);

  const imageData = context.getImageData(0, 0, target.width, target.height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const value = toOcrBinaryValue(red, green, blue);
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
  return target;
}

export function toOcrBinaryValue(red: number, green: number, blue: number): 0 | 255 {
  const maximum = Math.max(red, green, blue);
  const minimum = Math.min(red, green, blue);
  const chroma = maximum - minimum;
  const luminance = red * 0.299 + green * 0.587 + blue * 0.114;
  const isText = maximum >= 90 && (luminance >= 80 || chroma >= 25);
  return isText ? 0 : 255;
}
