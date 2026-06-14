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

  it('extracts the newer Tonghuashun account holding summary rows', () => {
    const text = `
光迅科技
20,497.00 -830.75 -3.820% 100 100 213.120 204.970
洁美科技
7,528.00 -648.26 -7.820% 100 100 81.670 75.280
中兴通讯 7,270.00 -356.14 -4.560% 200 200 38.085 36.350
工业富联 7,013.00 82.85 1.330% 100 100 69.211 70.130
许继电气 6,660.00 -1,345.83 -16.720% 300 300 26.657 22.200
通富微电 5,722.00 -1,482.36 -20.480% 100 100 71.960 57.220
汇绿生态 4,950.00 -1,159.98 -18.880% 100 100 61.020 49.500
名臣健康 2,000.00 -218.49 -9.580% 100 100 22.120 20.000
`;

    expect(parseHoldingsFromOcrText(text)).toEqual([
      expect.objectContaining({ symbol: 'SZ002281', name: '光迅科技', marketValue: 20497, pnlAmount: -830.75, pnlPercent: -3.82, quantity: 100, availableQuantity: 100, costPrice: 213.12, currentPrice: 204.97 }),
      expect.objectContaining({ symbol: 'SZ002859', name: '洁美科技', marketValue: 7528, pnlAmount: -648.26, pnlPercent: -7.82, quantity: 100, availableQuantity: 100, costPrice: 81.67, currentPrice: 75.28 }),
      expect.objectContaining({ symbol: 'SZ000063', name: '中兴通讯', marketValue: 7270, pnlAmount: -356.14, pnlPercent: -4.56, quantity: 200, availableQuantity: 200, costPrice: 38.085, currentPrice: 36.35 }),
      expect.objectContaining({ symbol: 'SH601138', name: '工业富联', marketValue: 7013, pnlAmount: 82.85, pnlPercent: 1.33, quantity: 100, availableQuantity: 100, costPrice: 69.211, currentPrice: 70.13 }),
      expect.objectContaining({ symbol: 'SZ000400', name: '许继电气', marketValue: 6660, pnlAmount: -1345.83, pnlPercent: -16.72, quantity: 300, availableQuantity: 300, costPrice: 26.657, currentPrice: 22.2 }),
      expect.objectContaining({ symbol: 'SZ002156', name: '通富微电', marketValue: 5722, pnlAmount: -1482.36, pnlPercent: -20.48, quantity: 100, availableQuantity: 100, costPrice: 71.96, currentPrice: 57.22 }),
      expect.objectContaining({ symbol: 'SZ001267', name: '汇绿生态', marketValue: 4950, pnlAmount: -1159.98, pnlPercent: -18.88, quantity: 100, availableQuantity: 100, costPrice: 61.02, currentPrice: 49.5 }),
      expect.objectContaining({ symbol: 'SZ002919', name: '名臣健康', marketValue: 2000, pnlAmount: -218.49, pnlPercent: -9.58, quantity: 100, availableQuantity: 100, costPrice: 22.12, currentPrice: 20 })
    ]);
  });
});
