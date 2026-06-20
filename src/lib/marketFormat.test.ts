import { describe, expect, it } from 'vitest';
import { formatChinaDateTime, formatSignedCount, formatSignedPercent, isAShareTradingSession } from './marketFormat';

describe('marketFormat', () => {
  it('formats captured time in China locale style', () => {
    expect(formatChinaDateTime('2026-06-11T10:30:00+08:00')).toContain('2026');
    expect(formatChinaDateTime('2026-06-11T10:30:00+08:00')).toContain('10:30');
  });

  it('formats comparison numbers with explicit signs', () => {
    expect(formatSignedCount(230)).toBe('+230');
    expect(formatSignedCount(-18)).toBe('-18');
    expect(formatSignedPercent(6.25)).toBe('+6.3%');
  });

  it('detects mainland A-share trading sessions in China time', () => {
    expect(isAShareTradingSession(new Date('2026-06-18T10:00:00+08:00'))).toBe(true);
    expect(isAShareTradingSession(new Date('2026-06-18T12:00:00+08:00'))).toBe(false);
    expect(isAShareTradingSession(new Date('2026-06-18T15:01:00+08:00'))).toBe(false);
    expect(isAShareTradingSession(new Date('2026-06-21T03:36:40+08:00'))).toBe(false);
  });
});
