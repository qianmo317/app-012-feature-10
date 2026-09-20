import { describe, it, expect } from 'vitest';
import { GameManager } from '../src/game/state';

function weighHerb(gm: GameManager, herb: string, target: number, actual: number) {
  gm.currentHerb = herb;
  gm.targetGrams = target;
  gm.currentWeight = actual;
  gm.phase = 'weighing';
  return gm.confirmWeight();
}

describe('四档判定与重抓', () => {
  it('偏出允许范围要整味重抓：记录第几回与差值，不计分不入包', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const item = gm.prescription!.items[0];
    const tol = gm.levelConfig.tolerance;

    const r = weighHerb(gm, item.herb, item.grams, item.grams + tol * 3)!;
    expect(r.ok).toBe(false);
    expect(r.status).toBe('fail');
    expect(gm.weighed.has(item.herb)).toBe(false);
    expect(gm.results.length).toBe(0);
    expect(gm.packages.length).toBe(0);
    expect(gm.state.combo).toBe(0);

    expect(gm.attempts.length).toBe(1);
    expect(gm.attempts[0].herb).toBe(item.herb);
    expect(gm.attempts[0].attempt).toBe(1);
    expect(gm.attempts[0].deltaG).toBeCloseTo(tol * 3);

    expect(gm.lastFeedback?.status).toBe('fail');
    expect(gm.lastFeedback?.attempt).toBe(1);
    expect(gm.lastFeedback?.prevDelta).toBeNull();
  });

  it('warning 档（偏出但未超两倍）同样整味重抓', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const item = gm.prescription!.items[0];
    const tol = gm.levelConfig.tolerance;

    const r = weighHerb(gm, item.herb, item.grams, item.grams + tol * 1.5)!;
    expect(r.ok).toBe(false);
    expect(r.status).toBe('warning');
    expect(gm.weighed.has(item.herb)).toBe(false);
    expect(gm.results.length).toBe(0);
  });

  it('重抓多回后抓准：记录每回差值，反馈带上一回差值', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const item = gm.prescription!.items[0];
    const tol = gm.levelConfig.tolerance;

    weighHerb(gm, item.herb, item.grams, item.grams + tol * 3);
    weighHerb(gm, item.herb, item.grams, item.grams - tol * 2);
    const r = weighHerb(gm, item.herb, item.grams, item.grams)!;

    expect(r.ok).toBe(true);
    expect(gm.weighed.has(item.herb)).toBe(true);
    expect(gm.attempts.length).toBe(3);
    expect(gm.attempts.map(a => a.attempt)).toEqual([1, 2, 3]);
    expect(gm.attempts[1].deltaG).toBeCloseTo(-tol * 2);

    expect(gm.lastFeedback?.attempt).toBe(3);
    expect(gm.lastFeedback?.prevDelta).toBeCloseTo(-tol * 2);

    expect(gm.results.length).toBe(1);
    expect(gm.scoreDetails.length).toBe(1);
    expect(gm.packages.length).toBe(1);
  });

  it('压线通过给「再校一校」提示，称准给准信', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const tol = gm.levelConfig.tolerance;

    const item1 = gm.prescription!.items[0];
    const r1 = weighHerb(gm, item1.herb, item1.grams, item1.grams + tol * 0.8)!;
    expect(r1.ok).toBe(true);
    expect(r1.status).toBe('good');
    expect(gm.lastFeedback?.status).toBe('good');
    expect(gm.weighed.has(item1.herb)).toBe(true);

    const item2 = gm.prescription!.items[1];
    const r2 = weighHerb(gm, item2.herb, item2.grams, item2.grams)!;
    expect(r2.status).toBe('perfect');
    expect(gm.lastFeedback?.status).toBe('perfect');
  });

  it('成功称重的分项分数被记录（基础/精度/连击/时间）', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const item = gm.prescription!.items[0];

    weighHerb(gm, item.herb, item.grams, item.grams);
    const detail = gm.scoreDetails.find(d => d.herb === item.herb)!;
    expect(detail.breakdown.base).toBe(100);
    expect(detail.breakdown.precisionBonus).toBe(50);
    expect(detail.breakdown.comboBonus).toBe(0);
    expect(detail.breakdown.timePenalty).toBe(0);
    expect(detail.breakdown.total).toBe(150);
    expect(gm.state.score).toBe(150);
  });

  it('重抓断连击：下一味成功时连击加成从 0 重算', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const tol = gm.levelConfig.tolerance;
    const [item1, item2] = gm.prescription!.items;

    weighHerb(gm, item1.herb, item1.grams, item1.grams);
    expect(gm.state.combo).toBe(1);

    weighHerb(gm, item2.herb, item2.grams, item2.grams + tol * 3);
    expect(gm.state.combo).toBe(0);

    weighHerb(gm, item2.herb, item2.grams, item2.grams);
    const detail = gm.scoreDetails.find(d => d.herb === item2.herb)!;
    expect(detail.breakdown.comboBonus).toBe(0);
  });

  it('重抓过的关卡照样能过：finishLevel 按是否称完判定', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const tol = gm.levelConfig.tolerance;

    for (const item of gm.prescription!.items) {
      weighHerb(gm, item.herb, item.grams, item.grams + tol * 3);
      weighHerb(gm, item.herb, item.grams, item.grams);
    }

    expect(gm.phase).toBe('review');
    gm.finishLevel();
    expect(gm.lastPassed).toBe(true);
    expect(gm.phase).toBe('result');
  });

  it('反馈在倒计时结束后清除', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const item = gm.prescription!.items[0];
    weighHerb(gm, item.herb, item.grams, item.grams);
    expect(gm.lastFeedback).not.toBeNull();

    gm.lastTick = 1000;
    gm.tick(4600);
    expect(gm.lastFeedback).toBeNull();
  });

  it('重开一关时清空重抓记录与分项', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const item = gm.prescription!.items[0];
    const tol = gm.levelConfig.tolerance;
    weighHerb(gm, item.herb, item.grams, item.grams + tol * 3);
    weighHerb(gm, item.herb, item.grams, item.grams);
    expect(gm.attempts.length).toBe(2);

    gm.startLevel(2);
    expect(gm.attempts.length).toBe(0);
    expect(gm.results.length).toBe(0);
    expect(gm.scoreDetails.length).toBe(0);
    expect(gm.lastFeedback).toBeNull();
    expect(gm.lastPassed).toBe(false);
  });
});
