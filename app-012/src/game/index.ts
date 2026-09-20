import { GameCanvas } from '../renderer/canvas';
import { CabinetRenderer } from '../renderer/cabinet';
import { ScaleRenderer } from '../renderer/scale';
import { UIRenderer } from '../renderer/ui';
import { GameManager } from './state';
import { getHerbByName } from '../herbs';
import { isTierAccepted } from '../weighing';
import { resumeAudio, playDrawerSound, playDropSound, playPointerSound, playErrorSound, playSuccessSound } from '../audio/synth';
import type { ResultRow } from '../types';

export class ApothecaryGame {
  canvas: GameCanvas;
  cabinet: CabinetRenderer;
  scale: ScaleRenderer;
  ui: UIRenderer;
  game: GameManager;
  animId = 0;
  mouseX = 0;
  mouseY = 0;

  constructor(canvasId: string) {
    this.canvas = new GameCanvas(canvasId);
    this.cabinet = new CabinetRenderer();
    this.scale = new ScaleRenderer();
    this.ui = new UIRenderer();
    this.game = new GameManager();
    this.setupInput();
    this.resize();
    this.loop = this.loop.bind(this);
  }

  resize(): void {
    this.canvas.resize();
    this.cabinet.layout(this.canvas.width, this.canvas.height);
    this.scale.layout(this.canvas.width, this.canvas.height);
    this.ui.layout(this.canvas.width, this.canvas.height);
  }

  start(): void {
    document.getElementById('loading')!.style.display = 'none';
    this.loop(performance.now());
  }

  loop(now: number): void {
    this.animId = requestAnimationFrame(this.loop);
    this.game.tick(now);
    this.scale.animate();
    this.render();
  }

  /** 按处方顺序组装结算行：每味药收下的那次 + 此前被打回的重抓尝试 */
  buildResultRows(): ResultRow[] {
    if (!this.game.prescription) return [];
    const rows: ResultRow[] = [];
    for (const item of this.game.prescription.items) {
      const record = this.game.records.get(item.herb);
      if (!record) continue;
      const accepted = record.attempts.find(a => a.accepted);
      if (!accepted) continue;
      rows.push({
        herb: item.herb,
        target: item.grams,
        accepted,
        rejected: record.attempts.filter(a => !a.accepted),
      });
    }
    return rows;
  }

  render(): void {
    const ctx = this.canvas.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;
    ctx.clearRect(0, 0, w, h);

    if (this.game.phase === 'menu') {
      this.renderMenu(ctx, w, h);
      return;
    }

    ctx.fillStyle = '#2d2418';
    ctx.fillRect(0, 0, w, h);

    this.cabinet.draw(ctx);
    this.scale.draw(ctx, this.game.currentWeight, this.game.zeroOffset);

    if (this.game.prescription) {
      this.ui.drawPrescription(ctx, this.game.prescription, this.game.weighed, this.game.currentHerb);
    }

    this.ui.drawStatus(ctx, this.game.state.level, this.game.state.score, this.game.state.combo, this.game.state.queue, this.game.state.satisfaction, this.game.getTimeLeft());
    this.ui.drawPackageArea(ctx, w, h, this.game.packages);
    this.ui.drawInstructions(ctx, w, h);

    if (this.game.currentHerb) {
      const herbMeta = getHerbByName(this.game.currentHerb);
      if (herbMeta) {
        this.drawHerbPile(ctx, this.scale.x + this.scale.w / 2 - 20, this.scale.y + this.scale.h - 40, herbMeta.color, Math.min(40, this.game.currentWeight * 2));
      }

      // 秤下控制条（+1g / -1g / 归零 / 确认）与实时四档提示
      this.ui.drawWeighControls(ctx, this.scale.x, this.scale.y, this.scale.w, this.scale.h);
      const prev = this.game.currentPrevAttempt();
      this.ui.drawLiveTier(
        ctx,
        this.scale.x,
        this.scale.y,
        this.scale.w,
        this.scale.h,
        this.game.currentWeight,
        this.game.targetGrams,
        this.game.levelConfig.tolerance,
        this.game.currentAttemptNo(),
        prev ? prev.deltaG : null,
      );

      // 重抓时确认横幅一直挂着，直到再次按确认
      if (this.game.lastConfirm && !this.game.lastConfirm.accepted) {
        this.ui.drawConfirmBanner(ctx, w, this.game.lastConfirm);
      }
    }

    // 收下（准/压线）后的短暂准信
    if (this.game.phase === 'playing' && this.game.lastConfirm?.accepted && performance.now() - this.game.acceptedToastAt < 1600) {
      this.ui.drawConfirmBanner(ctx, w, this.game.lastConfirm);
    }

    if (this.game.draggingHerb) {
      const herbMeta = getHerbByName(this.game.draggingHerb);
      if (herbMeta) {
        ctx.globalAlpha = 0.8;
        this.drawHerbPile(ctx, this.mouseX - 20, this.mouseY - 20, herbMeta.color, 30);
        ctx.globalAlpha = 1;
      }
    }

    if (this.game.flashingDrawer) {
      const drawer = this.cabinet.drawers.find(d => d.herb === this.game.flashingDrawer);
      if (drawer) {
        ctx.fillStyle = `rgba(255, 0, 0, ${0.3 + Math.sin(performance.now() / 50) * 0.2})`;
        ctx.fillRect(drawer.x, drawer.y, drawer.w, drawer.h);
      }
    }

    if (this.game.phase === 'review') {
      if (this.game.reviewQuestion) {
        this.ui.drawReview(ctx, w, h, this.game.reviewQuestion.herb, this.game.reviewQuestion.options, this.game.reviewSelected, this.game.reviewResult);
      }
    } else if (this.game.phase === 'result') {
      this.ui.drawResult(ctx, w, h, this.game.state.score, this.game.state.level, this.buildResultRows(), this.game.results.length === this.game.prescription?.items.length, this.game.resultDetailOpen);
    } else if (this.game.phase === 'gameover') {
      this.ui.drawGameOver(ctx, w, h, this.game.state.score, this.game.state.level);
    }
  }

  renderMenu(ctx: CanvasRenderingContext2D, w: number, h: number): void {
    const save = loadSaveData();
    this.ui.drawMenu(ctx, w, h, save.highestScore, save.highestLevel);
  }

  drawHerbPile(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number): void {
    const particles = Math.max(5, Math.floor(size / 3));
    for (let i = 0; i < particles; i++) {
      const px = x + Math.random() * size - size / 2;
      const py = y + Math.random() * size / 2;
      const r = 2 + Math.random() * 3;
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.7 + Math.random() * 0.3;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  setupInput(): void {
    const c = this.canvas.canvas;

    c.addEventListener('mousedown', e => {
      resumeAudio();
      const pos = this.canvas.getMousePos(e);
      this.handlePointerDown(pos.x, pos.y);
    });

    c.addEventListener('mousemove', e => {
      const pos = this.canvas.getMousePos(e);
      this.mouseX = pos.x;
      this.mouseY = pos.y;
      this.handlePointerMove(pos.x, pos.y);
    });

    c.addEventListener('mouseup', () => {
      this.handlePointerUp();
    });

    c.addEventListener('wheel', e => {
      e.preventDefault();
      if (this.game.phase === 'weighing') {
        const dir = e.deltaY > 0 ? 1 : -1;
        this.game.addWeight(dir * 0.5);
        playPointerSound();
      }
    }, { passive: false });

    c.addEventListener('touchstart', e => {
      resumeAudio();
      e.preventDefault();
      if (e.touches.length > 0) {
        const pos = this.canvas.getMousePos(e.touches[0]);
        this.handlePointerDown(pos.x, pos.y);
      }
    }, { passive: false });

    c.addEventListener('touchmove', e => {
      e.preventDefault();
      if (e.touches.length > 0) {
        const pos = this.canvas.getMousePos(e.touches[0]);
        this.mouseX = pos.x;
        this.mouseY = pos.y;
        this.handlePointerMove(pos.x, pos.y);
      }
    }, { passive: false });

    c.addEventListener('touchend', () => {
      this.handlePointerUp();
    });

    window.addEventListener('keydown', e => {
      this.handleKey(e.key);
    });
  }

  /** 处理称重控制条按钮，返回是否命中（命中则拦截其他点击） */
  private handleWeighControl(x: number, y: number): boolean {
    const btn = this.ui.buttonRects.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (!btn) return false;
    if (btn.action === 'weight+') {
      this.game.addWeight(1);
      playPointerSound();
    } else if (btn.action === 'weight-') {
      this.game.addWeight(-1);
      playPointerSound();
    } else if (btn.action === 'tare') {
      this.game.tare();
      playPointerSound();
    } else if (btn.action === 'confirm') {
      this.confirmWeighing();
    } else {
      return false;
    }
    return true;
  }

  private confirmWeighing(): void {
    const feedback = this.game.confirmWeight();
    if (!feedback) return;
    if (isTierAccepted(feedback.tier)) {
      playSuccessSound();
    } else {
      playErrorSound();
    }
  }

  handlePointerDown(x: number, y: number): void {
    if (this.game.phase === 'menu') {
      const btn = this.ui.buttonRects.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (btn) {
        if (btn.action === 'start') {
          this.game.startLevel(1, false);
          this.cabinet.setHerbs(this.game.herbs);
        } else if (btn.action === 'endless') {
          this.game.startLevel(1, true);
          this.cabinet.setHerbs(this.game.herbs);
        }
      }
      return;
    }

    if (this.game.phase === 'review') {
      const btn = this.ui.buttonRects.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (btn && btn.action.startsWith('review-')) {
        const val = parseInt(btn.action.replace('review-', ''));
        const correct = this.game.answerReview(val);
        if (correct) playSuccessSound();
        else playErrorSound();
      }
      return;
    }

    if (this.game.phase === 'result' || this.game.phase === 'gameover') {
      const btn = this.ui.buttonRects.find(b => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
      if (btn) {
        if (btn.action === 'next') {
          this.game.nextLevel();
          this.cabinet.setHerbs(this.game.herbs);
        } else if (btn.action === 'retry') {
          this.game.retryLevel();
          this.cabinet.setHerbs(this.game.herbs);
        } else if (btn.action === 'toggle-detail') {
          this.game.toggleResultDetail();
        } else if (btn.action === 'menu') {
          this.game.phase = 'menu';
        }
      }
      return;
    }

    if (this.game.phase === 'playing') {
      const drawer = this.cabinet.getDrawerAt(x, y);
      if (drawer && drawer.herb) {
        const ok = this.game.selectDrawer(drawer.herb);
        if (ok) {
          playDrawerSound();
          this.cabinet.openDrawer(drawer.herb);
        } else {
          playErrorSound();
        }
      }
      return;
    }

    if (this.game.phase === 'weighing') {
      // 先判定控制条（+/-、归零、确认），再处理拖药到秤盘
      if (this.handleWeighControl(x, y)) return;

      const scaleArea = { x: this.scale.x, y: this.scale.y, w: this.scale.w, h: this.scale.h };
      if (x >= scaleArea.x && x <= scaleArea.x + scaleArea.w && y >= scaleArea.y && y <= scaleArea.y + scaleArea.h) {
        this.game.draggingHerb = this.game.currentHerb;
      }
      return;
    }
  }

  handlePointerMove(x: number, y: number): void {
    this.cabinet.updateHover(x, y);
    if (this.game.phase === 'weighing' && this.game.draggingHerb) {
      const scaleArea = { x: this.scale.x, y: this.scale.y, w: this.scale.w, h: this.scale.h };
      this.game.onScale = x >= scaleArea.x && x <= scaleArea.x + scaleArea.w && y >= scaleArea.y && y <= scaleArea.y + scaleArea.h;
    }
  }

  handlePointerUp(): void {
    if (this.game.phase === 'weighing' && this.game.draggingHerb) {
      if (this.game.onScale) {
        this.game.currentWeight = Math.min(50, this.game.currentWeight + 5);
        playDropSound();
      }
      this.game.draggingHerb = null;
      this.game.onScale = false;
    }
  }

  handleKey(key: string): void {
    if (this.game.phase === 'menu') {
      if (key === 'Enter' || key === ' ') {
        this.game.startLevel(1, false);
        this.cabinet.setHerbs(this.game.herbs);
      }
      return;
    }

    if (this.game.phase === 'playing') {
      const idx = parseInt(key);
      if (!isNaN(idx) && idx >= 1 && idx <= 9) {
        const drawers = this.cabinet.drawers.filter(d => d.herb);
        if (idx <= drawers.length) {
          const ok = this.game.selectDrawer(drawers[idx - 1].herb);
          if (ok) {
            playDrawerSound();
            this.cabinet.openDrawer(drawers[idx - 1].herb);
          } else {
            playErrorSound();
          }
        }
      }
      return;
    }

    if (this.game.phase === 'weighing') {
      if (key === ' ' || key === 'Enter') {
        this.confirmWeighing();
      } else if (key === 'z' || key === 'Z') {
        this.game.tare();
        playPointerSound();
      } else if (key === 'ArrowUp' || key === 'ArrowRight') {
        this.game.addWeight(0.5);
        playPointerSound();
      } else if (key === 'ArrowDown' || key === 'ArrowLeft') {
        this.game.addWeight(-0.5);
        playPointerSound();
      }
      return;
    }

    if (this.game.phase === 'result') {
      if (key === 'Enter' || key === ' ') {
        const passed = this.game.results.length === this.game.prescription?.items.length;
        if (passed) {
          this.game.nextLevel();
        } else {
          this.game.retryLevel();
        }
        this.cabinet.setHerbs(this.game.herbs);
      } else if (key === 'd' || key === 'D') {
        this.game.toggleResultDetail();
      }
      return;
    }

    if (this.game.phase === 'gameover') {
      if (key === 'Enter' || key === ' ') {
        this.game.phase = 'menu';
      }
      return;
    }
  }
}

function loadSaveData(): { highestScore: number; highestLevel: number } {
  try {
    const raw = localStorage.getItem('apothecary-weighing-v1');
    if (raw) {
      const data = JSON.parse(raw);
      return { highestScore: data.highestScore ?? 0, highestLevel: data.highestLevel ?? 0 };
    }
  } catch {
    // ignore
  }
  return { highestScore: 0, highestLevel: 0 };
}
