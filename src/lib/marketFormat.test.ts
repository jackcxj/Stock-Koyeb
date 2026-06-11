import { describe, expect, it } from 'vitest';
import { formatChinaDateTime, formatSignedCount, formatSignedPercent } from './marketFormat';

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
});
