import type { WeighResult, WeightTier } from './types';

export function judgeWeight(actual: number, target: number, tolerance: number): WeighResult {
  const deltaG = actual - target;
  const absDelta = Math.abs(deltaG);
  const tier = getTier(absDelta, tolerance);
  const ok = absDelta <= tolerance;
  return { herb: '', target, actual, ok, deltaG, tier };
}

/**
 * 四档判定（tolerance = 处方允许误差）：
 * - perfect 称得准：|差| ≤ 0.3 倍误差，给准信
 * - good    压线：0.3~1 倍误差之间，收下但提示再校一校
 * - warning 偏出：1~2 倍误差，整味重抓
 * - fail    差太远：超过 2 倍误差，整味重抓
 */
export function getTier(absDelta: number, tolerance: number): WeightTier {
  if (absDelta <= tolerance * 0.3) return 'perfect';
  if (absDelta <= tolerance) return 'good';
  if (absDelta <= tolerance * 2) return 'warning';
  return 'fail';
}

export function getWeightStatus(result: WeighResult, tolerance: number): WeightTier {
  return getTier(Math.abs(result.deltaG), tolerance);
}

/** 该档位是否收下（在允许范围内） */
export function isTierAccepted(tier: WeightTier): boolean {
  return tier === 'perfect' || tier === 'good';
}

export const TIER_TEXT: Record<WeightTier, string> = {
  perfect: '准',
  good: '压线',
  warning: '偏出',
  fail: '重抓',
};

export const TIER_COLOR: Record<WeightTier, string> = {
  perfect: '#228b22',
  good: '#c8860a',
  warning: '#d2691e',
  fail: '#dc143c',
};

/** 确认称重后给玩家的完整反馈文案 */
export const TIER_FEEDBACK: Record<WeightTier, string> = {
  perfect: '称得准！',
  good: '压线通过，建议再校一校',
  warning: '偏出允许范围，这味重抓',
  fail: '差得太远，整味重抓',
};

export function formatDelta(deltaG: number): string {
  return `${deltaG > 0 ? '+' : ''}${deltaG.toFixed(1)}g`;
}

export function calculatePointerPosition(loadGrams: number, zeroOffset: number, fullScale: number): number {
  return Math.max(0, Math.min(1, (loadGrams - zeroOffset) / fullScale));
}

export function discreteWeight(delta: number, currentWeight: number): number {
  const step = delta > 0 ? getWeightStep(currentWeight) : -getWeightStep(currentWeight);
  return Math.max(0, parseFloat((currentWeight + step).toFixed(1)));
}

function getWeightStep(weight: number): number {
  if (weight >= 50) return 10;
  if (weight >= 20) return 5;
  if (weight >= 10) return 2;
  return 1;
}

export function fineTuneWeight(currentWeight: number, direction: number): number {
  return Math.max(0, parseFloat((currentWeight + direction * 0.5).toFixed(1)));
}
