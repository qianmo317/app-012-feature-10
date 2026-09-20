import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GameManager } from '../src/game/state';

beforeEach(() => {
  vi.stubGlobal('performance', { now: vi.fn(() => 0) });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('GameManager 四档判定与重抓流程', () => {
  it('称得准（perfect）：直接收下、计分、连击增加', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const herb = gm.prescription!.items[0].herb;
    const target = gm.prescription!.items[0].grams;

    expect(gm.selectDrawer(herb)).toBe(true);
    gm.setWeight(target);

    const fb = gm.confirmWeight()!;
    expect(fb.tier).toBe('perfect');
    expect(fb.accepted).toBe(true);
    expect(fb.attempt).toBe(1);
    expect(fb.breakdown).not.toBeNull();
    expect(fb.breakdown!.total).toBeGreaterThan(0);
    expect(gm.state.combo).toBe(1);
    expect(gm.weighed.has(herb)).toBe(true);
    expect(gm.phase).not.toBe('weighing');
  });

  it('压线（good）：收下但档位区别于 perfect', () => {
    const gm = new GameManager();
    gm.startLevel(1); // tolerance 1.0
    const herb = gm.prescription!.items[0].herb;
    const target = gm.prescription!.items[0].grams;
    gm.selectDrawer(herb);

    // 差 0.5g：> 0.3*tol，仍在允许范围内
    gm.setWeight(target + 0.5);
    const fb = gm.confirmWeight()!;
    expect(fb.tier).toBe('good');
    expect(fb.accepted).toBe(true);
    expect(gm.weighed.has(herb)).toBe(true);
  });

  it('偏出范围（warning）：不收、不计分、连击清零、留在秤上重抓', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const herb = gm.prescription!.items[0].herb;
    const target = gm.prescription!.items[0].grams;
    gm.selectDrawer(herb);

    // 差 1.5g：tol < |d| <= 2*tol
    gm.setWeight(target + 1.5);
    const fb = gm.confirmWeight()!;
    expect(fb.tier).toBe('warning');
    expect(fb.accepted).toBe(false);
    expect(fb.breakdown).toBeNull();
    expect(gm.state.combo).toBe(0);
    expect(gm.weighed.has(herb)).toBe(false);
    expect(gm.results).toHaveLength(0);
    expect(gm.phase).toBe('weighing');
    expect(gm.currentHerb).toBe(herb);
    expect(gm.currentWeight).toBe(0);
  });

  it('差太远（fail）：同样整味重抓', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const herb = gm.prescription!.items[0].herb;
    const target = gm.prescription!.items[0].grams;
    gm.selectDrawer(herb);

    gm.setWeight(target + 5);
    const fb = gm.confirmWeight()!;
    expect(fb.tier).toBe('fail');
    expect(fb.accepted).toBe(false);
    expect(gm.phase).toBe('weighing');
  });

  it('重抓要记下这是第几回、上一回差了多少', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const herb = gm.prescription!.items[0].herb;
    const target = gm.prescription!.items[0].grams;
    gm.selectDrawer(herb);

    gm.setWeight(target + 1.5);
    const first = gm.confirmWeight()!;
    expect(first.attempt).toBe(1);
    expect(first.prevDeltaG).toBeNull();
    expect(gm.currentAttemptNo()).toBe(2);

    // 重抓时界面可拿到上一回差值
    const prev = gm.currentPrevAttempt()!;
    expect(prev.deltaG).toBeCloseTo(1.5, 5);

    gm.setWeight(target - 3);
    const second = gm.confirmWeight()!;
    expect(second.attempt).toBe(2);
    expect(second.prevDeltaG).toBeCloseTo(1.5, 5);
    expect(second.accepted).toBe(false);
    expect(gm.currentAttemptNo()).toBe(3);

    // 第三回称准，收下
    gm.setWeight(target);
    const third = gm.confirmWeight()!;
    expect(third.attempt).toBe(3);
    expect(third.tier).toBe('perfect');
    expect(third.accepted).toBe(true);

    const record = gm.records.get(herb)!;
    expect(record.attempts).toHaveLength(3);
    expect(record.attempts.map(a => a.accepted)).toEqual([false, false, true]);
    expect(record.attempts[0].deltaG).toBeCloseTo(1.5, 5);
    expect(record.attempts[1].deltaG).toBeCloseTo(-3, 5);
  });

  it('重抓后称准：该味计入结果，关卡最终能通过', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    for (const item of gm.prescription!.items) {
      gm.selectDrawer(item.herb);
      gm.setWeight(item.grams + 1.5); // 先偏出
      expect(gm.confirmWeight()!.accepted).toBe(false);
      gm.setWeight(item.grams);       // 再称准
      expect(gm.confirmWeight()!.accepted).toBe(true);
    }
    // 所有味最终都收下（最后一味收下后进入复核）
    expect(gm.results).toHaveLength(gm.prescription!.items.length);
    expect(gm.phase).toBe('review');
    // 复核阶段不影响 finishLevel 的通过判定
    gm.finishLevel();
    expect(gm.phase).toBe('result');
  });

  it('重开一关不残留上一关的称重档案', () => {
    const gm = new GameManager();
    gm.startLevel(1);
    const item = gm.prescription!.items[0];
    gm.selectDrawer(item.herb);
    gm.setWeight(item.grams + 1.5);
    gm.confirmWeight();
    expect(gm.records.size).toBe(1);

    gm.retryLevel();
    expect(gm.records.size).toBe(0);
    expect(gm.lastConfirm).toBeNull();
    expect(gm.resultDetailOpen).toBe(false);
  });
});
