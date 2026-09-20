export type DecoctType = 'normal' | 'first' | 'last';

export interface PrescriptionItem {
  herb: string;
  grams: number;
  decoct: DecoctType;
}

export interface Prescription {
  id: string;
  items: PrescriptionItem[];
}

export type WeighStatus = 'perfect' | 'good' | 'warning' | 'fail';

export interface WeighResult {
  herb: string;
  target: number;
  actual: number;
  ok: boolean;
  deltaG: number;
  status: WeighStatus;
}

/** 一次确认称重的记录（含重抓），attempt 为该药的第几回 */
export interface WeighAttempt extends WeighResult {
  attempt: number;
}

/** 确认称重后的即时反馈：四档结果 + 重抓次第信息 */
export interface WeighFeedback {
  herb: string;
  status: WeighStatus;
  target: number;
  actual: number;
  deltaG: number;
  attempt: number;
  prevDelta: number | null;
}

export interface GameState {
  level: number;
  score: number;
  combo: number;
  queue: number;
  satisfaction: number;
  expired: boolean;
}

export interface LevelConfig {
  level: number;
  herbCount: number;
  tolerance: number;
  timeLimit: number | null;
  hasSimilarHerbs: boolean;
  requireTare: boolean;
  requireOrganize: boolean;
  enableDecoctSplit: boolean;
}

export interface ScoreBreakdown {
  base: number;
  precisionBonus: number;
  comboBonus: number;
  timePenalty: number;
  total: number;
}

export type GamePhase = 'menu' | 'playing' | 'weighing' | 'review' | 'result' | 'gameover';

export interface HerbMeta {
  name: string;
  color: string;
  similar?: string[];
}
