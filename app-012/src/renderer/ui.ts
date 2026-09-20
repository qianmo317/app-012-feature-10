import type { Prescription, WeighResult, WeighAttempt, WeighFeedback, ScoreBreakdown, WeighStatus } from '../types';

const STATUS_COLOR: Record<WeighStatus, string> = {
  perfect: '#ffd700',
  good: '#9acd32',
  warning: '#ff8c42',
  fail: '#ff4444',
};

/** 浅色面板（结算屏）上用的深色系 */
const STATUS_COLOR_DARK: Record<WeighStatus, string> = {
  perfect: '#b8860b',
  good: '#6b8e23',
  warning: '#c0392b',
  fail: '#c0392b',
};

function fmtDelta(deltaG: number): string {
  return `${deltaG > 0 ? '+' : ''}${deltaG.toFixed(1)}`;
}

export class UIRenderer {
  prescriptionX: number = 20;
  prescriptionY: number = 60;
  prescriptionW: number = 260;
  buttonRects: Array<{ x: number; y: number; w: number; h: number; action: string }> = [];

  layout(canvasW: number, _canvasH: number): void {
    this.prescriptionX = 20;
    this.prescriptionY = 60;
    this.prescriptionW = Math.min(260, canvasW * 0.3);
  }

  drawPrescription(ctx: CanvasRenderingContext2D, prescription: Prescription, weighed: Set<string>, currentHerb: string | null): void {
    const x = this.prescriptionX;
    const y = this.prescriptionY;
    const w = this.prescriptionW;
    const lineH = 32;

    ctx.fillStyle = 'rgba(255, 252, 245, 0.95)';
    ctx.fillRect(x, y, w, prescription.items.length * lineH + 50);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, prescription.items.length * lineH + 50);

    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('处方', x + 10, y + 24);

    prescription.items.forEach((item, i) => {
      const iy = y + 44 + i * lineH;
      const isWeighed = weighed.has(item.herb);
      const isCurrent = currentHerb === item.herb;

      if (isCurrent) {
        ctx.fillStyle = 'rgba(212, 165, 116, 0.3)';
        ctx.fillRect(x + 4, iy - 18, w - 8, lineH - 2);
      }

      ctx.fillStyle = isWeighed ? '#999' : '#333';
      ctx.font = `${isWeighed ? '' : 'bold '}15px "Microsoft YaHei", sans-serif`;
      ctx.textAlign = 'left';
      let text = `${item.herb} ${item.grams}g`;
      if (item.decoct === 'first') text += ' [先煎]';
      if (item.decoct === 'last') text += ' [后下]';
      ctx.fillText(text, x + 12, iy);

      if (isWeighed) {
        ctx.beginPath();
        ctx.moveTo(x + 12, iy - 4);
        ctx.lineTo(x + w - 12, iy - 4);
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });
  }

  drawStatus(ctx: CanvasRenderingContext2D, level: number, score: number, combo: number, queue: number, satisfaction: number, timeLeft: number | null): void {
    const x = 20;
    const y = 10;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, 600, 48);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    let text = `第${level}关  分数:${score}  连击:${combo}  排队:${queue}  满意度:${satisfaction}`;
    if (timeLeft !== null) {
      const color = timeLeft < 10 ? '#ff4444' : '#f5e6d3';
      ctx.fillStyle = color;
      text += `  时间:${Math.ceil(timeLeft)}s`;
    }
    ctx.fillText(text, x, y + 24);
  }

  drawPackageArea(ctx: CanvasRenderingContext2D, _canvasW: number, canvasH: number, packages: Array<{ herb: string; grams: number; decoct: string }>): void {
    const x = 20;
    const y = canvasH - 120;
    const w = 400;
    const h = 100;

    ctx.fillStyle = 'rgba(245, 230, 211, 0.9)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('已分包', x + 10, y + 20);

    packages.forEach((pkg, i) => {
      const px = x + 10 + (i % 4) * 95;
      const py = y + 36 + Math.floor(i / 4) * 28;
      ctx.fillStyle = '#fff8f0';
      ctx.fillRect(px, py, 88, 24);
      ctx.strokeStyle = '#d4a574';
      ctx.lineWidth = 1;
      ctx.strokeRect(px, py, 88, 24);
      ctx.fillStyle = '#333';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      let label = `${pkg.herb}`;
      if (pkg.decoct !== 'normal') label += '*';
      ctx.fillText(label, px + 44, py + 12);
    });
  }

  drawButtons(_ctx: CanvasRenderingContext2D): void {
    this.buttonRects = [];
  }

  drawMenu(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, highestScore: number, highestLevel: number): void {
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(0, 0, canvasW, canvasH);

    const cx = canvasW / 2;
    const cy = canvasH / 2;

    ctx.fillStyle = '#d4a574';
    ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('中药柜抓药', cx, cy - 120);
    ctx.font = '20px "Microsoft YaHei", sans-serif';
    ctx.fillText('戥子称重模拟', cx, cy - 80);

    const buttons = [
      { label: '开始游戏', action: 'start' },
      { label: '无尽模式', action: 'endless' },
    ];

    this.buttonRects = [];
    buttons.forEach((btn, i) => {
      const bx = cx - 80;
      const by = cy - 20 + i * 60;
      const bw = 160;
      const bh = 44;

      ctx.fillStyle = '#6b4e23';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#d4a574';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#f5e6d3';
      ctx.font = '18px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(btn.label, cx, by + bh / 2);

      this.buttonRects.push({ x: bx, y: by, w: bw, h: bh, action: btn.action });
    });

    ctx.fillStyle = '#888';
    ctx.font = '14px sans-serif';
    ctx.fillText(`最高分: ${highestScore}  最高关卡: ${highestLevel}`, cx, cy + 120);
  }

  /** 确认称重后的四档即时反馈：准信 / 压线提示 / 整味重抓（第几回、上一回差多少） */
  drawWeighFeedback(ctx: CanvasRenderingContext2D, canvasW: number, feedback: WeighFeedback): void {
    const color = STATUS_COLOR[feedback.status];
    const delta = fmtDelta(feedback.deltaG);

    let main = '';
    if (feedback.status === 'perfect') {
      main = `✓ ${feedback.herb} 称得刚刚好 —— 准！`;
    } else if (feedback.status === 'good') {
      main = `✓ ${feedback.herb} 压线通过（差 ${delta}g）· 下回再校一校`;
    } else {
      main = `✗ ${feedback.herb} 偏出 ${delta}g · 整味重抓（第 ${feedback.attempt} 回）`;
    }

    let sub = '';
    if (feedback.prevDelta !== null) {
      sub = `上一回差 ${fmtDelta(feedback.prevDelta)}g`;
    }

    const w = 480;
    const h = sub ? 58 : 40;
    const x = (canvasW - w) / 2;
    const y = 54;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    ctx.fillStyle = color;
    ctx.font = 'bold 16px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(main, canvasW / 2, sub ? y + 20 : y + h / 2);

    if (sub) {
      ctx.fillStyle = '#ddd';
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      ctx.fillText(sub, canvasW / 2, y + 44);
    }
  }

  drawReview(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, herb: string, options: number[], selected: number | null, result: boolean | null): void {
    const cx = canvasW / 2;
    const cy = canvasH / 2;
    const w = 360;
    const h = 240;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#fff8f0';
    ctx.fillRect(cx - w / 2, cy - h / 2, w, h);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(cx - w / 2, cy - h / 2, w, h);

    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`复核：刚才 ${herb} 抓了多少克？`, cx, cy - 70);

    this.buttonRects = [];
    options.forEach((opt, i) => {
      const bx = cx - 140 + i * 100;
      const by = cy - 20;
      const bw = 80;
      const bh = 44;

      ctx.fillStyle = selected === opt && result === false ? '#ff6b6b' : selected === opt && result === true ? '#90ee90' : '#f5e6d3';
      ctx.fillRect(bx, by, bw, bh);
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, by, bw, bh);

      ctx.fillStyle = '#333';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${opt}g`, bx + bw / 2, by + bh / 2);

      this.buttonRects.push({ x: bx, y: by, w: bw, h: bh, action: `review-${opt}` });
    });

    if (result !== null) {
      ctx.fillStyle = result ? '#228b22' : '#dc143c';
      ctx.font = 'bold 18px "Microsoft YaHei", sans-serif';
      ctx.fillText(result ? '回答正确！' : '回答错误！', cx, cy + 50);
    }
  }

  /** 结算屏：总分 + 每味药分项（基础/精度/连击/时间）+ 重抓记录 */
  drawResult(
    ctx: CanvasRenderingContext2D,
    canvasW: number,
    canvasH: number,
    score: number,
    level: number,
    results: WeighResult[],
    scoreDetails: Array<{ herb: string; breakdown: ScoreBreakdown }>,
    attempts: WeighAttempt[],
    passed: boolean
  ): void {
    const cx = canvasW / 2;

    // 每味成功药一行分项；重抓记录 = 同一味药抓过两回及以上
    const lines = results.map(r => {
      const detail = scoreDetails.find(d => d.herb === r.herb);
      const breakdown = detail ? detail.breakdown : { base: 0, precisionBonus: 0, comboBonus: 0, timePenalty: 0, total: 0 };
      return { result: r, breakdown };
    });
    const byHerb = new Map<string, WeighAttempt[]>();
    for (const a of attempts) {
      const list = byHerb.get(a.herb);
      if (list) list.push(a);
      else byHerb.set(a.herb, [a]);
    }
    const reweighs: Array<{ herb: string; tries: WeighAttempt[] }> = [];
    for (const [herb, tries] of byHerb) {
      if (tries.length > 1) reweighs.push({ herb, tries });
    }

    const rowH = 22;
    const headH = 24;
    const reweighRowH = 20;
    const reweighRows = Math.max(1, reweighs.length);
    const panelW = Math.min(620, canvasW - 40);
    const panelH = 92 + headH + lines.length * rowH + 24 + 24 + reweighRows * reweighRowH + 66;
    const x0 = cx - panelW / 2;
    const y0 = Math.max(8, (canvasH - panelH) / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#fff8f0';
    ctx.fillRect(x0, y0, panelW, panelH);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(x0, y0, panelW, panelH);

    let y = y0 + 30;
    ctx.fillStyle = passed ? '#228b22' : '#dc143c';
    ctx.font = 'bold 26px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(passed ? '关卡通过！' : '关卡失败', cx, y);

    y += 32;
    ctx.fillStyle = '#333';
    ctx.font = 'bold 17px "Microsoft YaHei", sans-serif';
    ctx.fillText(`第${level}关  总分: ${score}`, cx, y);

    // ---- 分项表 ----
    y += 26;
    const col = {
      herb: x0 + 18,
      weigh: x0 + 108,
      status: x0 + 240,
      base: x0 + 306,
      precision: x0 + 362,
      combo: x0 + 418,
      time: x0 + 474,
      total: x0 + 548,
    };

    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.fillStyle = '#8b4513';
    ctx.textAlign = 'left';
    ctx.fillText('药名', col.herb, y);
    ctx.fillText('目标/实称', col.weigh, y);
    ctx.textAlign = 'center';
    ctx.fillText('判定', col.status, y);
    ctx.fillText('基础', col.base, y);
    ctx.fillText('精度', col.precision, y);
    ctx.fillText('连击', col.combo, y);
    ctx.fillText('时间', col.time, y);
    ctx.fillText('小计', col.total, y);

    y += 6;
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0 + 12, y);
    ctx.lineTo(x0 + panelW - 12, y);
    ctx.stroke();

    ctx.font = '13px "Microsoft YaHei", sans-serif';
    for (const { result, breakdown } of lines) {
      y += rowH;
      const r = result;
      ctx.textAlign = 'left';
      ctx.fillStyle = '#333';
      ctx.fillText(r.herb, col.herb, y);
      ctx.fillText(`${r.target}g / ${r.actual.toFixed(1)}g`, col.weigh, y);

      ctx.textAlign = 'center';
      ctx.fillStyle = STATUS_COLOR_DARK[r.status];
      ctx.fillText(r.status === 'perfect' ? '准' : '压线', col.status, y);

      ctx.fillStyle = '#333';
      ctx.fillText(String(breakdown.base), col.base, y);
      ctx.fillText(`+${breakdown.precisionBonus}`, col.precision, y);
      ctx.fillText(`+${breakdown.comboBonus}`, col.combo, y);
      ctx.fillStyle = breakdown.timePenalty < 0 ? '#c0392b' : '#333';
      ctx.fillText(String(breakdown.timePenalty), col.time, y);
      ctx.fillStyle = '#8b4513';
      ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
      ctx.fillText(String(breakdown.total), col.total, y);
      ctx.font = '13px "Microsoft YaHei", sans-serif';
    }

    // ---- 重抓记录 ----
    y += rowH + 14;
    ctx.strokeStyle = '#d4a574';
    ctx.beginPath();
    ctx.moveTo(x0 + 12, y);
    ctx.lineTo(x0 + panelW - 12, y);
    ctx.stroke();

    y += 20;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
    ctx.fillText('重抓记录', x0 + 18, y);

    ctx.font = '12px "Microsoft YaHei", sans-serif';
    if (reweighs.length === 0) {
      y += reweighRowH;
      ctx.fillStyle = '#888';
      ctx.fillText('本关全部一次抓准，无重抓', x0 + 18, y);
    } else {
      for (const { herb, tries } of reweighs) {
        y += reweighRowH;
        ctx.fillStyle = '#333';
        ctx.textAlign = 'left';
        ctx.fillText(`${herb} 共抓 ${tries.length} 回：`, x0 + 18, y);
        let tx = x0 + 118;
        tries.forEach((t, i) => {
          const label = `${i + 1}) ${fmtDelta(t.deltaG)}g`;
          ctx.fillStyle = STATUS_COLOR_DARK[t.status];
          ctx.fillText(label, tx, y);
          tx += ctx.measureText(label).width + 14;
        });
        ctx.fillStyle = '#228b22';
        ctx.fillText('✓', tx, y);
      }
    }

    // ---- 按钮 ----
    this.buttonRects = [];
    const btnLabel = passed ? '下一关' : '重试';
    const bw = 120;
    const bh = 40;
    const bx = cx - bw / 2;
    const by = y0 + panelH - 52;

    ctx.fillStyle = '#6b4e23';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '18px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(btnLabel, cx, by + bh / 2);

    this.buttonRects.push({ x: bx, y: by, w: bw, h: bh, action: passed ? 'next' : 'retry' });
  }

  drawGameOver(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, score: number, level: number): void {
    const cx = canvasW / 2;
    const cy = canvasH / 2;

    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#dc143c';
    ctx.font = 'bold 36px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('病人都走光了', cx, cy - 60);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '20px sans-serif';
    ctx.fillText(`最终得分: ${score}  通过关卡: ${level}`, cx, cy);

    this.buttonRects = [];
    const bx = cx - 60;
    const by = cy + 50;
    const bw = 120;
    const bh = 40;

    ctx.fillStyle = '#6b4e23';
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 2;
    ctx.strokeRect(bx, by, bw, bh);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '18px "Microsoft YaHei", sans-serif';
    ctx.fillText('返回菜单', cx, by + bh / 2);

    this.buttonRects.push({ x: bx, y: by, w: bw, h: bh, action: 'menu' });
  }

  drawInstructions(ctx: CanvasRenderingContext2D, _canvasW: number, canvasH: number): void {
    const x = 20;
    const y = canvasH - 80;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(x, y, 500, 70);
    ctx.fillStyle = '#ccc';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('操作: 1-9选抽屉 / 拖拽药材到秤盘 / 滚轮微调 / 空格确认 / Z归零', x + 10, y + 10);
    ctx.fillText('目标: 按处方抓药，误差在允许范围内', x + 10, y + 30);
    ctx.fillText('注意: 先煎/后下药要单独分包', x + 10, y + 48);
  }

  drawTareButton(ctx: CanvasRenderingContext2D, x: number, y: number, active: boolean): void {
    ctx.fillStyle = active ? '#d4a574' : '#f5e6d3';
    ctx.fillRect(x, y, 60, 32);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, 60, 32);
    ctx.fillStyle = '#333';
    ctx.font = '14px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('归零', x + 30, y + 16);
  }
}
