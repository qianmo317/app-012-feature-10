import type { GameState, GamePhase, Prescription, WeighResult, LevelConfig, WeightTier, HerbWeighRecord, WeighAttempt, ScoreBreakdown } from '../types';
import { getLevelConfig } from '../levels';
import { generatePrescription, generateReviewQuestion } from '../prescription';
import { judgeWeight, isTierAccepted } from '../weighing';
import { scoreRound } from '../scoring';
import { getRandomHerbs } from '../herbs';
import type { HerbMeta } from '../types';

export interface ConfirmFeedback {
  herb: string;
  tier: WeightTier;
  actual: number;
  target: number;
  deltaG: number;
  attempt: number;
  prevDeltaG: number | null;
  accepted: boolean;
  breakdown: ScoreBreakdown | null;
}

export class GameManager {
  state: GameState = {
    level: 1,
    score: 0,
    combo: 0,
    queue: 3,
    satisfaction: 100,
    expired: false,
  };

  phase: GamePhase = 'menu';
  endless = false;
  prescription: Prescription | null = null;
  herbs: HerbMeta[] = [];
  currentWeight = 0;
  zeroOffset = 0;
  targetGrams = 0;
  currentHerb: string | null = null;
  weighed = new Set<string>();
  results: WeighResult[] = [];
  /** 按药名保存本关每一次上秤（含重抓尝试），key 为药名 */
  records = new Map<string, HerbWeighRecord>();
  packages: Array<{ herb: string; grams: number; decoct: string }> = [];
  reviewQuestion: ReturnType<typeof generateReviewQuestion> = null;
  reviewSelected: number | null = null;
  reviewResult: boolean | null = null;
  levelConfig: LevelConfig = getLevelConfig(1);
  /** 结算屏是否展开每味药的重抓明细 */
  resultDetailOpen = false;
  /** 最近一次确认的反馈（称得准/压线/重抓），供界面展示 */
  lastConfirm: ConfirmFeedback | null = null;
  /** 收下一味药后的短暂提示时间戳（ms） */
  acceptedToastAt = 0;

  timeLeft: number | null = null;
  timeUsed = 0;
  lastTick = 0;

  drawerOpen = new Set<string>();
  draggingHerb: string | null = null;
  dragX = 0;
  dragY = 0;
  onScale = false;
  flashingDrawer: string | null = null;
  flashTime = 0;

  startLevel(level: number, endless = false): void {
    this.endless = endless;
    this.state.level = level;
    this.state.expired = false;
    this.levelConfig = getLevelConfig(level);
    this.prescription = generatePrescription(this.levelConfig);
    this.herbs = getRandomHerbs(this.levelConfig.herbCount + (this.levelConfig.hasSimilarHerbs ? 2 : 0), this.levelConfig.hasSimilarHerbs);
    this.currentWeight = 0;
    this.zeroOffset = 0;
    this.targetGrams = 0;
    this.currentHerb = null;
    this.weighed = new Set();
    this.results = [];
    this.records = new Map();
    this.packages = [];
    this.reviewQuestion = null;
    this.reviewSelected = null;
    this.reviewResult = null;
    this.resultDetailOpen = false;
    this.lastConfirm = null;
    this.acceptedToastAt = 0;
    this.timeLeft = this.levelConfig.timeLimit;
    this.timeUsed = 0;
    this.lastTick = performance.now();
    this.drawerOpen = new Set();
    this.draggingHerb = null;
    this.phase = 'playing';
  }

  tick(now: number): void {
    if (this.phase !== 'playing' && this.phase !== 'weighing') return;
    const dt = (now - this.lastTick) / 1000;
    this.lastTick = now;
    this.timeUsed += dt;

    if (this.timeLeft !== null) {
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.handleTimeout();
      }
    }

    if (this.flashTime > 0) {
      this.flashTime -= dt;
      if (this.flashTime <= 0) this.flashingDrawer = null;
    }
  }

  selectDrawer(herb: string): boolean {
    if (!this.prescription) return false;
    const needed = this.prescription.items.find(i => i.herb === herb && !this.weighed.has(i.herb));
    if (!needed) {
      this.flashingDrawer = herb;
      this.flashTime = 0.5;
      return false;
    }
    this.beginWeighing(herb, needed.grams);
    return true;
  }

  /** 重抓时不重新选抽屉，直接在同一味药上再上一次秤 */
  private beginWeighing(herb: string, grams: number): void {
    this.drawerOpen.add(herb);
    this.currentHerb = herb;
    this.targetGrams = grams;
    this.currentWeight = 0;
    this.zeroOffset = 0;
    this.phase = 'weighing';
  }

  setWeight(w: number): void {
    this.currentWeight = Math.max(0, w);
  }

  addWeight(delta: number): void {
    this.currentWeight = Math.max(0, parseFloat((this.currentWeight + delta).toFixed(1)));
  }

  tare(): void {
    this.zeroOffset = this.currentWeight;
  }

  /** 当前正在称的药这是第几回上秤（从 1 开始） */
  currentAttemptNo(): number {
    if (!this.currentHerb) return 1;
    return (this.records.get(this.currentHerb)?.attempts.length ?? 0) + 1;
  }

  /** 正在称的这味药上一回的尝试记录（用于重抓提示） */
  currentPrevAttempt(): WeighAttempt | null {
    if (!this.currentHerb) return null;
    const attempts = this.records.get(this.currentHerb)?.attempts ?? [];
    return attempts.length > 0 ? attempts[attempts.length - 1] : null;
  }

  confirmWeight(): ConfirmFeedback | null {
    if (!this.currentHerb || !this.prescription) return null;
    const herb = this.currentHerb;
    const target = this.targetGrams;
    const result = judgeWeight(this.currentWeight, target, this.levelConfig.tolerance);
    result.herb = herb;

    const record = this.records.get(herb) ?? { herb, target, attempts: [] };
    const attemptNo = record.attempts.length + 1;
    const prevAttempt = record.attempts.length > 0 ? record.attempts[record.attempts.length - 1] : null;
    const accepted = isTierAccepted(result.tier);

    let breakdown: ScoreBreakdown | null = null;
    if (accepted) {
      breakdown = scoreRound(result, this.levelConfig.tolerance, this.state.combo, this.timeUsed, this.levelConfig.timeLimit);
      this.state.combo++;
      this.state.score += breakdown.total;
      this.results.push(result);
      this.weighed.add(herb);
      const item = this.prescription.items.find(i => i.herb === herb);
      if (item) {
        this.packages.push({ herb: item.herb, grams: this.currentWeight, decoct: item.decoct });
      }
    } else {
      // 偏出范围：连击中断，不计分，这味药整味重抓
      this.state.combo = 0;
    }

    record.attempts.push({
      attempt: attemptNo,
      target,
      actual: result.actual,
      deltaG: result.deltaG,
      tier: result.tier,
      accepted,
      breakdown: breakdown ?? undefined,
    });
    this.records.set(herb, record);

    const feedback: ConfirmFeedback = {
      herb,
      tier: result.tier,
      actual: result.actual,
      target,
      deltaG: result.deltaG,
      attempt: attemptNo,
      prevDeltaG: prevAttempt ? prevAttempt.deltaG : null,
      accepted,
      breakdown,
    };
    this.lastConfirm = feedback;

    if (accepted) {
      this.acceptedToastAt = performance.now();
      this.drawerOpen.delete(herb);
      this.currentHerb = null;
      this.currentWeight = 0;
      this.zeroOffset = 0;

      if (this.weighed.size >= this.prescription.items.length) {
        this.startReview();
      } else {
        this.phase = 'playing';
      }
    } else {
      // 留在秤上重抓：清零，保留抽屉开启与同一味药
      this.currentWeight = 0;
      this.zeroOffset = 0;
    }

    return feedback;
  }

  startReview(): void {
    if (!this.prescription) return;
    this.reviewQuestion = generateReviewQuestion(this.prescription);
    this.reviewSelected = null;
    this.reviewResult = null;
    this.phase = 'review';
  }

  answerReview(answer: number): boolean {
    if (!this.reviewQuestion || this.reviewSelected !== null) return false;
    this.reviewSelected = answer;
    const correct = answer === this.reviewQuestion.correct;
    this.reviewResult = correct;
    if (!correct) {
      this.state.satisfaction -= 10;
      this.state.combo = 0;
    } else {
      this.state.satisfaction = Math.min(100, this.state.satisfaction + 5);
    }
    setTimeout(() => this.finishLevel(), 1500);
    return correct;
  }

  finishLevel(): void {
    const passed = this.results.length === (this.prescription?.items.length ?? 0) && this.state.satisfaction > 0;
    if (passed) {
      this.state.queue = Math.min(10, this.state.queue + 1);
    } else {
      this.state.queue--;
      this.state.satisfaction = Math.max(0, this.state.satisfaction - 20);
    }

    if (this.state.queue <= 0 || this.state.satisfaction <= 0) {
      this.phase = 'gameover';
    } else {
      this.phase = 'result';
    }
  }

  toggleResultDetail(): void {
    this.resultDetailOpen = !this.resultDetailOpen;
  }

  nextLevel(): void {
    this.startLevel(this.state.level + 1, this.endless);
  }

  retryLevel(): void {
    this.startLevel(this.state.level, this.endless);
  }

  handleTimeout(): void {
    this.state.queue--;
    this.state.satisfaction -= 15;
    this.state.combo = 0;
    if (this.state.queue <= 0 || this.state.satisfaction <= 0) {
      this.phase = 'gameover';
    } else {
      this.startLevel(this.state.level, this.endless);
    }
  }

  getTimeLeft(): number | null {
    return this.timeLeft;
  }

  isDrawerOpen(herb: string): boolean {
    return this.drawerOpen.has(herb);
  }
}
