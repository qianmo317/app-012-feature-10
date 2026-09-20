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

export type WeightTier = 'perfect' | 'good' | 'warning' | 'fail';

export interface WeighResult {
  herb: string;
  target: number;
  actual: number;
  ok: boolean;
  deltaG: number;
  tier: WeightTier;
}

/** 单次上秤记录：包括最终收下的一次和每一次重抓尝试 */
export interface WeighAttempt {
  attempt: number;
  target: number;
  actual: number;
  deltaG: number;
  tier: WeightTier;
  accepted: boolean;
  breakdown?: ScoreBreakdown;
}

/** 一味药在本关内的完整称重档案 */
export interface HerbWeighRecord {
  herb: string;
  target: number;
  attempts: WeighAttempt[];
}

/** 结算屏每一味药一行：收下的那次（带得分构成）+ 此前的重抓尝试 */
export interface ResultRow {
  herb: string;
  target: number;
  accepted: WeighAttempt;
  rejected: WeighAttempt[];
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
