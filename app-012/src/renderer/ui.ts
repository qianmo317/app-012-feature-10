import type { Prescription, ResultRow, ScoreBreakdown, WeightTier } from '../types';
import { TIER_TEXT, TIER_COLOR, TIER_FEEDBACK, formatDelta } from '../weighing';

export interface ButtonRect {
  x: number;
  y: number;
  w: number;
  h: number;
  action: string;
}

export class UIRenderer {
  prescriptionX: number = 20;
  prescriptionY: number = 60;
  prescriptionW: number = 260;
  buttonRects: ButtonRect[] = [];

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

  // ===================== 称量阶段 =====================

  /**
   * 秤下方的控制条：+1g / -1g / 归零 / 确认
   * 返回确认键热区由调用方通过 buttonRects 取用（action: weight+ / weight- / tare / confirm）
   */
  drawWeighControls(ctx: CanvasRenderingContext2D, scaleX: number, scaleY: number, _scaleW: number, scaleH: number): void {
    const y = scaleY + scaleH + 10;
    const gap = 8;
    const bw = 64;
    const bh = 36;
    const defs: Array<{ action: string; label: string }> = [
      { action: 'weight+', label: '+1g' },
      { action: 'weight-', label: '-1g' },
      { action: 'tare', label: '归零' },
      { action: 'confirm', label: '确认' },
    ];

    this.buttonRects = this.buttonRects.filter(b => !['weight+', 'weight-', 'tare', 'confirm'].includes(b.action));
    defs.forEach((def, i) => {
      const bx = scaleX + i * (bw + gap);
      const isConfirm = def.action === 'confirm';
      ctx.fillStyle = isConfirm ? '#8b5a2b' : '#f5e6d3';
      ctx.fillRect(bx, y, bw, bh);
      ctx.strokeStyle = '#8b6914';
      ctx.lineWidth = 2;
      ctx.strokeRect(bx, y, bw, bh);
      ctx.fillStyle = isConfirm ? '#fff8f0' : '#333';
      ctx.font = 'bold 15px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(def.label, bx + bw / 2, y + bh / 2 + 1);
      this.buttonRects.push({ x: bx, y, w: bw, h: bh, action: def.action });
    });
  }

  /** 实时档位提示：当前重量离目标差多少、落在四档哪一档（不按确认也能看到） */
  drawLiveTier(ctx: CanvasRenderingContext2D, scaleX: number, scaleY: number, scaleW: number, scaleH: number, currentWeight: number, target: number, tolerance: number, attemptNo: number, prevDeltaG: number | null): void {
    const unweighed = currentWeight === 0;
    const absDelta = Math.abs(currentWeight - target);
    const tier: WeightTier = absDelta <= tolerance * 0.3 ? 'perfect'
      : absDelta <= tolerance ? 'good'
      : absDelta <= tolerance * 2 ? 'warning'
      : 'fail';
    const label = unweighed ? '待称' : TIER_TEXT[tier];
    const color = unweighed ? '#999' : TIER_COLOR[tier];
    const hint = unweighed ? '拖药到秤盘，或用 +1g / 滚轮加药' : TIER_FEEDBACK[tier];

    const x = scaleX;
    const y = scaleY + scaleH + 56;
    const w = Math.max(scaleW, 280);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(x, y, w, 62);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 61);

    // 左：档位徽标
    ctx.fillStyle = color;
    ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + 12, y + 31);

    // 右：数值与说明
    ctx.fillStyle = '#f5e6d3';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText(`目标 ${target}g · 现称 ${currentWeight.toFixed(1)}g · 差 ${formatDelta(currentWeight - target)}`, x + 56, y + 20);
    ctx.fillStyle = color;
    ctx.fillText(hint, x + 56, y + 44);

    // 第几次上秤 + 上回差多少（重抓时）
    if (attemptNo > 1 || prevDeltaG !== null) {
      ctx.fillStyle = '#ffb347';
      ctx.font = '12px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'right';
      const prevText = prevDeltaG === null ? `第 ${attemptNo} 回上秤` : `第 ${attemptNo} 回上秤 · 上回差 ${formatDelta(prevDeltaG)}`;
      ctx.fillText(prevText, x + w - 10, y + 20);
    }
  }

  /**
   * 按确认后的结果横幅。
   * - accepted：准信 / 压线提示，短暂展示
   * - rejected：偏出范围，整味重抓，停留到下一次调整
   */
  drawConfirmBanner(ctx: CanvasRenderingContext2D, canvasW: number, feedback: {
    tier: WeightTier;
    deltaG: number;
    actual: number;
    target: number;
    attempt: number;
    prevDeltaG: number | null;
    accepted: boolean;
    breakdown: ScoreBreakdown | null;
  }): void {
    const w = 380;
    const h = feedback.accepted ? 64 : 92;
    const x = (canvasW - w) / 2;
    const y = 56;
    const color = TIER_COLOR[feedback.tier];

    ctx.fillStyle = 'rgba(20, 14, 6, 0.92)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(x + 1.5, y + 1.5, w - 3, h - 3);

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.font = 'bold 20px "Microsoft YaHei", sans-serif';
    ctx.fillText(`${TIER_TEXT[feedback.tier]}｜${TIER_FEEDBACK[feedback.tier]}`, x + 16, y + 26);

    ctx.fillStyle = '#f5e6d3';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText(`目标 ${feedback.target}g · 称得 ${feedback.actual.toFixed(1)}g · 差 ${formatDelta(feedback.deltaG)}`, x + 16, y + 50);

    if (feedback.accepted) {
      if (feedback.breakdown) {
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ffd700';
        ctx.font = 'bold 14px "Microsoft YaHei", sans-serif';
        ctx.fillText(`+${feedback.breakdown.total} 分`, x + w - 16, y + 48);
      }
    } else {
      ctx.fillStyle = '#ffb347';
      ctx.font = '13px "Microsoft YaHei", sans-serif';
      const prevText = feedback.prevDeltaG === null
        ? `这是第 ${feedback.attempt} 回上秤，倒回秤盘重新抓`
        : `第 ${feedback.attempt} 回上秤 · 上一回差 ${formatDelta(feedback.prevDeltaG)}，倒回重抓`;
      ctx.fillText(prevText, x + 16, y + 74);
    }
  }

  // ===================== 结算屏 =====================

  drawResult(ctx: CanvasRenderingContext2D, canvasW: number, canvasH: number, score: number, level: number, rows: ResultRow[], passed: boolean, detailOpen: boolean): void {
    const cx = canvasW / 2;

    const panelW = 540;
    const headerH = 118;
    const rowH = 26;
    const detailExtra = detailOpen ? rows.reduce((sum, r) => sum + r.rejected.length * 17, 0) : 0;
    const footerH = 70;
    const panelH = Math.min(canvasH - 20, headerH + rows.length * rowH + detailExtra + footerH);

    const px = cx - panelW / 2;
    let py = Math.max(10, (canvasH - panelH) / 2);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 0, canvasW, canvasH);

    ctx.fillStyle = '#fff8f0';
    ctx.fillRect(px, py, panelW, panelH);
    ctx.strokeStyle = '#8b6914';
    ctx.lineWidth = 3;
    ctx.strokeRect(px, py, panelW, panelH);

    ctx.fillStyle = passed ? '#228b22' : '#dc143c';
    ctx.font = 'bold 26px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(passed ? '关卡通过！' : '本关结算', cx, py + 26);

    ctx.fillStyle = '#333';
    ctx.font = '16px "Microsoft YaHei", sans-serif';
    ctx.fillText(`第${level}关   总分：${score}`, cx, py + 56);

    // 明细展开开关（右上角）
    const toggleW = 150;
    const toggleH = 28;
    const toggleX = px + panelW - toggleW - 12;
    const toggleY = py + 12;
    ctx.fillStyle = detailOpen ? '#8b5a2b' : '#6b4e23';
    ctx.fillRect(toggleX, toggleY, toggleW, toggleH);
    ctx.strokeStyle = '#d4a574';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(toggleX, toggleY, toggleW, toggleH);
    ctx.fillStyle = '#f5e6d3';
    ctx.font = '13px "Microsoft YaHei", sans-serif';
    ctx.fillText(detailOpen ? '收起重抓记录 ▲' : '查看重抓记录 ▼', toggleX + toggleW / 2, toggleY + toggleH / 2);
    this.buttonRects = this.buttonRects.filter(b => b.action !== 'toggle-detail');
    this.buttonRects.push({ x: toggleX, y: toggleY, w: toggleW, h: toggleH, action: 'toggle-detail' });

    // 表头
    const tableX = px + 16;
    const tableW = panelW - 32;
    const cols = [92, 78, 72, 78, 86, 0];
    cols[5] = tableW - cols.slice(0, 5).reduce((a, b) => a + b, 0);
    let ty = py + 88;
    ctx.fillStyle = '#8b4513';
    ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const headers = ['药材', '基础分', '精度奖励', '连击加成', '时间扣分', '小计'];
    let hx = tableX;
    headers.forEach((head, i) => {
      ctx.fillText(head, hx + 6, ty);
      hx += cols[i];
    });
    ctx.strokeStyle = '#c8b080';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX, ty + 14);
    ctx.lineTo(tableX + tableW, ty + 14);
    ctx.stroke();

    // 每一味药一行
    ty += 16;
    rows.forEach((row, idx) => {
      if (idx % 2 === 1) {
        ctx.fillStyle = 'rgba(212, 165, 116, 0.12)';
        ctx.fillRect(tableX, ty - 12, tableW, rowH - 2);
      }

      const b = row.accepted.breakdown;
      const tierColor = TIER_COLOR[row.accepted.tier];
      ctx.textBaseline = 'middle';

      ctx.fillStyle = tierColor;
      ctx.font = 'bold 13px "Microsoft YaHei", sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`${TIER_TEXT[row.accepted.tier]} ${row.herb}`, tableX + 6, ty);

      if (b) {
        ctx.fillStyle = '#333';
        ctx.font = '13px sans-serif';
        let cx2 = tableX + cols[0];
        const cells = [`${b.base}`, `+${b.precisionBonus}`, `+${b.comboBonus}`, b.timePenalty === 0 ? '0' : `${b.timePenalty}`, `${b.total}`];
        cells.forEach((cell, i) => {
          if (i === 2 && b && b.comboBonus > 0) ctx.fillStyle = '#228b22';
          else if (i === 3 && b && b.timePenalty < 0) ctx.fillStyle = '#dc143c';
          else if (i === 4) ctx.fillStyle = '#8b5a2b';
          else ctx.fillStyle = '#333';
          ctx.fillText(cell, cx2 + 6, ty);
          cx2 += cols[i + 1];
        });
      }

      ty += rowH;

      // 展开时列出这味药每一回重抓尝试
      if (detailOpen) {
        row.rejected.forEach((att) => {
          ctx.fillStyle = 'rgba(220, 20, 60, 0.06)';
          ctx.fillRect(tableX, ty - 11, tableW, 16);
          ctx.fillStyle = TIER_COLOR[att.tier];
          ctx.font = '12px "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'left';
          ctx.fillText(`└ 第${att.attempt}回 ${TIER_TEXT[att.tier]}：称 ${att.actual.toFixed(1)}g，差 ${formatDelta(att.deltaG)}（重抓）`, tableX + 24, ty - 3);
          ctx.textAlign = 'right';
          ctx.fillStyle = '#999';
          ctx.fillText(`${row.herb}`, tableX + tableW - 8, ty - 3);
          ty += 17;
        });
      }
    });

    // 底部按钮
    this.buttonRects = this.buttonRects.filter(b => b.action !== 'next' && b.action !== 'retry');
    const btnLabel = passed ? '下一关' : '重试本关';
    const bw = 130;
    const bh = 40;
    const bx = cx - bw / 2;
    const by = py + panelH - 52;

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
    ctx.fillText('操作: 1-9选抽屉 / 拖拽药材到秤盘 / 滚轮微调 / 空格或「确认」按钮确认 / Z归零', x + 10, y + 10);
    ctx.fillText('判定: 准=称得准  压线=勉强合格建议再校  偏出/重抓=倒回重抓（记录回数与差值）', x + 10, y + 30);
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
