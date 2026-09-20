// 渲染管线冒烟：用 Canvas 2D 打桩驱动完整一局，保证任何界面状态都不抛异常。
// 运行：npx tsx tests/smoke-render.ts （仅在仓库内使用，不计入 vitest）
import { GameManager } from '../src/game/state';

function noop() {}
const ctx2d = new Proxy({}, {
  get(_t, prop) {
    if (prop === 'canvas') return {};
    if (prop === 'measureText') return () => ({ width: 10 });
    if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop: noop });
    if (prop === 'getContext') return () => ctx2d;
    return typeof prop === 'string' ? noop : undefined;
  },
  set() { return true; },
});

const fakeCanvas = {
  getContext: () => ctx2d,
  width: 900,
  height: 600,
  style: {},
  addEventListener: noop,
  getBoundingClientRect: () => ({ left: 0, top: 0 }),
  parentElement: { clientWidth: 900, clientHeight: 600 },
};

(globalThis as any).document = {
  getElementById: (id: string) => id === 'game-canvas' ? fakeCanvas : { style: {} },
};
(globalThis as any).window = { addEventListener: noop };
(globalThis as any).performance = { now: () => 0 };
(globalThis as any).localStorage = { getItem: () => null, setItem: noop, removeItem: noop };
(globalThis as any).requestAnimationFrame = noop;

const { ApothecaryGame } = await import('../src/game/index');

const game = new ApothecaryGame('game-canvas');
const gm = game.game;
gm.startLevel(1);
game.cabinet.setHerbs(gm.herbs);

const renderSafe = (label: string) => {
  // 强制渲染若干帧（含 toast 计时窗口）
  for (let i = 0; i < 3; i++) {
    game.render();
    (globalThis as any).performance.now = () => i * 1000;
  }
  console.log(`render ok: ${label}`);
};

renderSafe('playing 初始');

for (const item of gm.prescription!.items) {
  gm.selectDrawer(item.herb);
  game.cabinet.openDrawer(item.herb);
  renderSafe(`weighing ${item.herb} 第一回`);

  // 1) 先称成压线（0.5g，tol=1.0）——收下但应给压线提示
  gm.setWeight(item.grams + 0.5);
  renderSafe(`weighing ${item.herb} 实时档位`);
  // 改成偏出：1.5g → warning，重抓
  gm.setWeight(item.grams + 1.5);
  let fb = gm.confirmWeight()!;
  if (fb.accepted) throw new Error('warning 不应被收下');
  renderSafe(`${item.herb} warning 横幅`);

  // 2) 再来一回差太远 → fail
  gm.setWeight(item.grams + 4);
  fb = gm.confirmWeight()!;
  if (fb.tier !== 'fail') throw new Error('应为 fail');
  renderSafe(`${item.herb} fail 横幅（第2回，提示上回差值）`);

  // 3) 第三回称准
  gm.setWeight(item.grams);
  fb = gm.confirmWeight()!;
  if (!fb.accepted || fb.attempt !== 3) throw new Error('第三回应收下');
  renderSafe(`${item.herb} perfect 准信 toast`);
}

if (gm.phase !== 'review') throw new Error('应进入复核');
renderSafe('review');
if (gm.reviewQuestion) {
  game.handlePointerDown(0, 0); // 空点不报错
  gm.answerReview(gm.reviewQuestion.correct);
}
// answerReview 1.5s 后 finishLevel，直接调
gm.finishLevel();
if (gm.phase !== 'result') throw new Error('应进入结算');
renderSafe('result 收起明细');
gm.toggleResultDetail();
renderSafe('result 展开重抓明细');

const rows = game.buildResultRows();
if (rows.length !== gm.prescription!.items.length) throw new Error('结算行数不对');
for (const row of rows) {
  if (row.rejected.length !== 2) throw new Error(`${row.herb} 应有2条重抓记录`);
  if (!row.accepted.breakdown) throw new Error(`${row.herb} 收下那次应有得分构成`);
  const b = row.accepted.breakdown;
  if (b.base + b.precisionBonus + b.comboBonus + b.timePenalty !== b.total) {
    throw new Error(`${row.herb} 得分构成相加不等于小计`);
  }
}

// 点「下一关」热区（结果按钮）
const nextBtn = game.ui.buttonRects.find(b => b.action === 'next');
if (!nextBtn) throw new Error('缺少下一关按钮');
game.handlePointerDown(nextBtn.x + 5, nextBtn.y + 5);
renderSafe('下一关 playing');
console.log('SMOKE OK');
