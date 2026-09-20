import type { GameState, GamePhase, Prescription, WeighResult, WeighAttempt, WeighFeedback, LevelConfig, ScoreBreakdown } from '../types';
import { getLevelConfig } from '../levels';
import { generatePrescription, generateReviewQuestion } from '../prescription';
import { judgeWeight } from '../weighing';
import { scoreRound } from '../scoring';
import { getRandomHerbs } from '../herbs';
import type { HerbMeta } from '../types';

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
  /** 本关每一次确认称重的记录（含重抓），结算屏可回查 */
  attempts: WeighAttempt[] = [];
  /** 每味成功药对应的计分分项（基础/精度/连击/时间） */
  scoreDetails: Array<{ herb: string; breakdown: ScoreBreakdown }> = [];
  /** 最近一次确认称重的四档反馈，用于界面即时提示 */
  lastFeedback: WeighFeedback | null = null;
  feedbackTime = 0;
  /** 本关是否通过，finishLevel 时写入，结算屏与按键处理共用 */
  lastPassed = false;
  packages: Array<{ herb: string; grams: number; decoct: string }> = [];
  reviewQuestion: ReturnType<typeof generateReviewQuestion> = null;
  reviewSelected: number | null = null;
  reviewResult: boolean | null = null;
  levelConfig: LevelConfig = getLevelConfig(1);

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
    this.attempts = [];
    this.scoreDetails = [];
    this.lastFeedback = null;
    this.feedbackTime = 0;
    this.lastPassed = false;
    this.packages = [];
    this.reviewQuestion = null;
    this.reviewSelected = null;
    this.reviewResult = null;
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

    if (this.feedbackTime > 0) {
      this.feedbackTime -= dt;
      if (this.feedbackTime <= 0) this.lastFeedback = null;
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
    this.drawerOpen.add(herb);
    this.currentHerb = herb;
    this.targetGrams = needed.grams;
    this.currentWeight = 0;
    this.phase = 'weighing';
    return true;
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

  confirmWeight(): WeighResult | null {
    if (!this.currentHerb || !this.prescription) return null;
    const tolerance = this.levelConfig.tolerance;
    const result = judgeWeight(this.currentWeight, this.targetGrams, tolerance);
    result.herb = this.currentHerb;
    const herb = this.currentHerb;

    // 同一味药的重抓历史：本次是第几回、上一回差多少
    const prevAttempts = this.attempts.filter(a => a.herb === herb);
    const attempt = prevAttempts.length + 1;
    const prevDelta = prevAttempts.length > 0 ? prevAttempts[prevAttempts.length - 1].deltaG : null;

    this.attempts.push({ ...result, attempt });
    this.lastFeedback = {
      herb,
      status: result.status,
      target: result.target,
      actual: result.actual,
      deltaG: result.deltaG,
      attempt,
      prevDelta,
    };
    this.feedbackTime = 3;

    if (result.ok) {
      // 在允许范围内（perfect / good）：计分并收下这味药
      const breakdown = scoreRound(result, tolerance, this.state.combo, this.timeUsed, this.levelConfig.timeLimit);
      this.state.combo++;
      this.state.score += breakdown.total;
      this.results.push(result);
      this.scoreDetails.push({ herb, breakdown });
      this.weighed.add(herb);
      const item = this.prescription.items.find(i => i.herb === herb);
      if (item) {
        this.packages.push({ herb: item.herb, grams: this.currentWeight, decoct: item.decoct });
      }
    } else {
      // 偏出允许范围（warning / fail）：断连击，整味重抓
      this.state.combo = 0;
    }

    this.drawerOpen.delete(herb);
    this.currentHerb = null;
    this.currentWeight = 0;
    this.zeroOffset = 0;

    if (this.weighed.size >= this.prescription.items.length) {
      this.startReview();
    } else {
      this.phase = 'playing';
    }

    return result;
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
    const allWeighed = this.prescription !== null && this.weighed.size >= this.prescription.items.length;
    const passed = allWeighed && this.state.satisfaction > 0;
    this.lastPassed = passed;
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
