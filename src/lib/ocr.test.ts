import { describe, expect, it } from 'vitest';
import { parseHoldingsFromOcrText } from './ocr';

describe('parseHoldingsFromOcrText', () => {
  it('extracts manually confirmable holdings from Tonghuashun-style OCR text', () => {
    const text = `
持仓
贵州茅台 600519 100 1400.50 1320.00 盈亏
平安银行 000001 1200 11.35 10.80
`;

    expect(parseHoldingsFromOcrText(text)).toEqual([
      {
        symbol: 'SH600519',
        name: '贵州茅台',
        quantity: 100,
        costPrice: 1400.5,
        stopLossPrice: 1320
      },
      {
        symbol: 'SZ000001',
        name: '平安银行',
        quantity: 1200,
        costPrice: 11.35,
        stopLossPrice: 10.8
      }
    ]);
  });

  it('ignores low-confidence lines that do not contain a stock code and prices', () => {
    expect(parseHoldingsFromOcrText('资产 持仓 可用 今日盈亏')).toEqual([]);
  });

  it('extracts Tonghuashun holding table rows without visible stock codes', () => {
    const text = `
光迅科技 20,540.00 -787.77 -3.620% 100 100 213.120 205.400
洁美科技 7,801.00 -375.40 -4.480% 100 100 81.670 78.010
中兴通讯 7,562.00 -64.28 -0.720% 200 200 38.085 37.810
工业富联 6,952.00 21.88 0.450% 100 100 69.211 69.520
`;

    expect(parseHoldingsFromOcrText(text)).toEqual([
      {
        symbol: 'SZ002281',
        name: '光迅科技',
        marketValue: 20540,
        pnlAmount: -787.77,
        pnlPercent: -3.62,
        quantity: 100,
        availableQuantity: 100,
        costPrice: 213.12,
        currentPrice: 205.4,
        stopLossPrice: 194.1
      },
      {
        symbol: 'SZ002859',
        name: '洁美科技',
        marketValue: 7801,
        pnlAmount: -375.4,
        pnlPercent: -4.48,
        quantity: 100,
        availableQuantity: 100,
        costPrice: 81.67,
        currentPrice: 78.01,
        stopLossPrice: 73.72
      },
      {
        symbol: 'SZ000063',
        name: '中兴通讯',
        marketValue: 7562,
        pnlAmount: -64.28,
        pnlPercent: -0.72,
        quantity: 200,
        availableQuantity: 200,
        costPrice: 38.085,
        currentPrice: 37.81,
        stopLossPrice: 35.73
      },
      {
        symbol: 'SH601138',
        name: '工业富联',
        marketValue: 6952,
        pnlAmount: 21.88,
        pnlPercent: 0.45,
        quantity: 100,
        availableQuantity: 100,
        costPrice: 69.211,
        currentPrice: 69.52,
        stopLossPrice: 65.7
      }
    ]);
  });
});
