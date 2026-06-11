import type { ParsedHolding } from '../types';
import { normalizeStockSymbol } from './stockRules';

const CODE_LINE = /([\u4e00-\u9fa5A-Za-z]{2,12})\s+((?:SH|SZ|BJ)?\s*\d{6})\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)/i;
const KNOWN_SYMBOLS: Record<string, string> = {
  光迅科技: 'SZ002281',
  洁美科技: 'SZ002859',
  中兴通讯: 'SZ000063',
  工业富联: 'SH601138',
  许继电气: 'SZ000400',
  通富微电: 'SZ002156',
  汇绿生态: 'SZ001267',
  名臣健康: 'SZ002919',
  长江电力: 'SH600900',
  凯美特气: 'SZ002549'
};

export function parseHoldingsFromOcrText(text: string): ParsedHolding[] {
  const normalized = normalizeOcrText(text);
  const tableRows = parseTonghuashunTable(normalized.replace(/\s+/g, ' '));
  if (tableRows.length > 0) {
    return tableRows;
  }

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
  const image = await createPreprocessedImage(file);
  const worker = await createWorker('chi_sim+eng');
  try {
    const processed = await worker.recognize(image);
    let parsed = parseHoldingsFromOcrText(processed.data.text);
    if (parsed.length === 0) {
      const original = await worker.recognize(file);
      parsed = parseHoldingsFromOcrText(original.data.text);
    }
    return parsed;
  } finally {
    await worker.terminate();
  }
}

function parseTonghuashunTable(text: string): ParsedHolding[] {
  const names = Object.keys(KNOWN_SYMBOLS);
  const hits = names
    .map((name) => ({ name, index: text.indexOf(name) }))
    .filter((hit) => hit.index >= 0)
    .sort((a, b) => a.index - b.index);

  return hits
    .map((hit, index) => {
      const next = hits[index + 1]?.index ?? text.length;
      return parseKnownNameSegment(hit.name, text.slice(hit.index, next));
    })
    .filter((holding): holding is ParsedHolding => Boolean(holding));
}

function parseKnownNameSegment(name: string, segment: string): ParsedHolding | null {
  const values = segment
    .replace(name, ' ')
    .match(/[-+]?\d+(?:,\d{3})*(?:\.\d+)?%?/g)
    ?.map((raw) => raw.replace(/,/g, '')) ?? [];

  if (values.length < 7) {
    return null;
  }

  const marketValue = Number(values[0]);
  const pnlAmount = Number(values[1]);
  const pnlPercent = Number(values[2].replace('%', ''));
  const quantity = Number(values[3]);
  const availableQuantity = Number(values[4]);
  const costPrice = Number(values[5]);
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
  return text
    .replace(/[−–—]/g, '-')
    .replace(/[，]/g, ',')
    .trim();
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

async function createPreprocessedImage(file: File): Promise<HTMLCanvasElement | File> {
  if (typeof document === 'undefined') {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const source = document.createElement('canvas');
  source.width = bitmap.width;
  source.height = bitmap.height;
  const sourceContext = source.getContext('2d');
  if (!sourceContext) return file;
  sourceContext.drawImage(bitmap, 0, 0);

  const cropY = Math.floor(bitmap.height * 0.17);
  const cropHeight = Math.floor(bitmap.height * 0.66);
  const scale = 2;
  const target = document.createElement('canvas');
  target.width = bitmap.width * scale;
  target.height = cropHeight * scale;
  const context = target.getContext('2d');
  if (!context) return file;
  context.imageSmoothingEnabled = false;
  context.drawImage(source, 0, cropY, bitmap.width, cropHeight, 0, 0, target.width, target.height);

  const imageData = context.getImageData(0, 0, target.width, target.height);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    const max = Math.max(red, green, blue);
    const min = Math.min(red, green, blue);
    const looksLikeText = max > 88 && max - min > 18;
    const value = looksLikeText ? 0 : 255;
    pixels[index] = value;
    pixels[index + 1] = value;
    pixels[index + 2] = value;
  }
  context.putImageData(imageData, 0, 0);
  return target;
}
