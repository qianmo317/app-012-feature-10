import type { ScoreBreakdown, WeighResult } from './types';

export function scoreRound(result: WeighResult, tolerance: number, combo: number, timeUsed: number, timeLimit: number | null): ScoreBreakdown {
  const absDelta = Math.abs(result.deltaG);

  // 偏出允许范围（warning / fail）：整味重抓，本次不计分
  if (absDelta > tolerance) {
    return { base: 0, precisionBonus: 0, comboBonus: 0, timePenalty: 0, total: 0 };
  }

  const base = 100;

  let precisionBonus = 0;
  if (absDelta <= tolerance * 0.3) {
    precisionBonus = 50;
  } else if (absDelta <= tolerance * 0.6) {
    precisionBonus = 30;
  } else {
    precisionBonus = 10;
  }

  const comboBonus = Math.min(50, combo * 10);

  let timePenalty = 0;
  if (timeLimit && timeLimit > 0) {
    const ratio = timeUsed / timeLimit;
    if (ratio > 0.8) timePenalty = -20;
    else if (ratio > 0.6) timePenalty = -10;
  }

  const total = Math.max(0, base + precisionBonus + comboBonus + timePenalty);

  return { base, precisionBonus, comboBonus, timePenalty, total };
}

export function calculateSatisfactionChange(results: WeighResult[], tolerance: number): number {
  let change = 0;
  for (const r of results) {
    const status = Math.abs(r.deltaG) <= tolerance ? 'ok' : Math.abs(r.deltaG) <= tolerance * 2 ? 'warn' : 'fail';
    if (status === 'ok') change += 5;
    else if (status === 'warn') change -= 5;
    else change -= 15;
  }
  return change;
}
