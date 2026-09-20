import { describe, it, expect } from 'vitest';
import { judgeWeight, getWeightStatus, getTier, isTierAccepted, TIER_TEXT, TIER_FEEDBACK, formatDelta, calculatePointerPosition, fineTuneWeight } from '../src/weighing';

describe('judgeWeight', () => {
  it('should pass when exact match', () => {
    const result = judgeWeight(10, 10, 1);
    expect(result.ok).toBe(true);
    expect(result.deltaG).toBe(0);
  });

  it('should pass within tolerance', () => {
    const result = judgeWeight(10.5, 10, 1);
    expect(result.ok).toBe(true);
    expect(result.deltaG).toBe(0.5);
  });

  it('should fail when exceeding tolerance', () => {
    const result = judgeWeight(12, 10, 1);
    expect(result.ok).toBe(false);
    expect(result.deltaG).toBe(2);
  });

  it('should handle negative delta', () => {
    const result = judgeWeight(9.5, 10, 1);
    expect(result.ok).toBe(true);
    expect(result.deltaG).toBe(-0.5);
  });

  it('should set herb and target fields', () => {
    const result = judgeWeight(10, 15, 0.5);
    expect(result.target).toBe(15);
    expect(result.actual).toBe(10);
    expect(result.herb).toBe('');
  });
});

describe('getWeightStatus', () => {
  it('should return perfect for very small delta', () => {
    const result = judgeWeight(10, 10, 1);
    expect(getWeightStatus(result, 1)).toBe('perfect');
  });

  it('should return good for within tolerance', () => {
    const result = judgeWeight(10.6, 10, 1);
    expect(getWeightStatus(result, 1)).toBe('good');
  });

  it('should return warning for within 2x tolerance', () => {
    const result = judgeWeight(10.7, 10, 0.5);
    expect(getWeightStatus(result, 0.5)).toBe('warning');
  });

  it('should return fail for exceeding 2x tolerance', () => {
    const result = judgeWeight(13, 10, 1);
    expect(getWeightStatus(result, 1)).toBe('fail');
  });

  it('judgeWeight should carry the tier directly', () => {
    expect(judgeWeight(10, 10, 1).tier).toBe('perfect');
    expect(judgeWeight(10.5, 10, 1).tier).toBe('good');
    expect(judgeWeight(10.7, 10, 0.5).tier).toBe('warning');
    expect(judgeWeight(13, 10, 1).tier).toBe('fail');
  });
});

describe('四档界面出口', () => {
  it('getTier 边界：0.3/1/2 倍 tolerance', () => {
    expect(getTier(0.3, 1)).toBe('perfect');
    expect(getTier(0.31, 1)).toBe('good');
    expect(getTier(1.0, 1)).toBe('good');
    expect(getTier(1.01, 1)).toBe('warning');
    expect(getTier(2.0, 1)).toBe('warning');
    expect(getTier(2.01, 1)).toBe('fail');
  });

  it('isTierAccepted 只有 perfect/good 收下', () => {
    expect(isTierAccepted('perfect')).toBe(true);
    expect(isTierAccepted('good')).toBe(true);
    expect(isTierAccepted('warning')).toBe(false);
    expect(isTierAccepted('fail')).toBe(false);
  });

  it('四档都有面向玩家的文案且两两不同', () => {
    const labels = [TIER_TEXT.perfect, TIER_TEXT.good, TIER_TEXT.warning, TIER_TEXT.fail];
    expect(new Set(labels).size).toBe(4);
    expect(TIER_FEEDBACK.good).toContain('校');
    expect(TIER_FEEDBACK.warning).toContain('重抓');
  });

  it('formatDelta 带正负号', () => {
    expect(formatDelta(1.5)).toBe('+1.5g');
    expect(formatDelta(-2)).toBe('-2.0g');
    expect(formatDelta(0)).toBe('0.0g');
  });
});

describe('calculatePointerPosition', () => {
  it('should return 0 at zero offset', () => {
    expect(calculatePointerPosition(0, 0, 50)).toBe(0);
  });

  it('should return 1 at full scale', () => {
    expect(calculatePointerPosition(50, 0, 50)).toBe(1);
  });

  it('should return 0.5 at half scale', () => {
    expect(calculatePointerPosition(25, 0, 50)).toBe(0.5);
  });

  it('should clamp below 0', () => {
    expect(calculatePointerPosition(-5, 0, 50)).toBe(0);
  });

  it('should clamp above 1', () => {
    expect(calculatePointerPosition(100, 0, 50)).toBe(1);
  });

  it('should account for zero offset', () => {
    expect(calculatePointerPosition(15, 5, 50)).toBe(0.2);
  });
});

describe('fineTuneWeight', () => {
  it('should increase weight by 0.5', () => {
    expect(fineTuneWeight(10, 1)).toBe(10.5);
  });

  it('should decrease weight by 0.5', () => {
    expect(fineTuneWeight(10, -1)).toBe(9.5);
  });

  it('should not go below 0', () => {
    expect(fineTuneWeight(0.2, -1)).toBe(0);
  });
});
