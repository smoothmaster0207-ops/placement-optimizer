/**
 * charts.js — Canvas ベースのグラフ描画
 * 外部ライブラリを使用せず、Canvas APIで軽量に描画する
 */

import { PLACEMENTS, getPlacementLabel, getPlacementColor } from './utils.js';

const CHART_BG = '#162230';
const CHART_GRID = 'rgba(255,255,255,0.06)';
const CHART_TEXT = '#8fa3b8';
const CHART_TEXT_LIGHT = '#a0b4c8';

/**
 * 配置先別人数の棒グラフを描画
 */
export function drawPlacementChart(canvasId, stats) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  // High-DPI対応
  const displayWidth = canvas.parentElement.clientWidth - 48;
  const displayHeight = 280;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const placements = PLACEMENTS.filter(p => (stats.placementCounts[p.id] || 0) > 0 || true);
  const values = placements.map(p => stats.placementCounts[p.id] || 0);
  const maxVal = Math.max(...values, 1);

  const padding = { top: 20, right: 20, bottom: 60, left: 40 };
  const chartW = displayWidth - padding.left - padding.right;
  const chartH = displayHeight - padding.top - padding.bottom;
  const barWidth = Math.min(chartW / placements.length * 0.7, 40);
  const gap = chartW / placements.length;

  // グリッド線
  ctx.strokeStyle = CHART_GRID;
  ctx.lineWidth = 1;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(displayWidth - padding.right, y);
    ctx.stroke();

    // Y軸ラベル
    ctx.fillStyle = CHART_TEXT;
    ctx.font = '10px "Noto Sans JP"';
    ctx.textAlign = 'right';
    const val = Math.round(maxVal * (1 - i / gridLines));
    ctx.fillText(val.toString(), padding.left - 6, y + 4);
  }

  // バー描画
  placements.forEach((p, idx) => {
    const x = padding.left + gap * idx + (gap - barWidth) / 2;
    const val = values[idx];
    const barH = (val / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    // グラデーション
    const color = getPlacementColor(p.id);
    const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    gradient.addColorStop(0, color);
    gradient.addColorStop(1, color + '40');

    // バー
    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, barWidth, barH, 4);
    ctx.fill();

    // 値ラベル
    if (val > 0) {
      ctx.fillStyle = CHART_TEXT_LIGHT;
      ctx.font = 'bold 11px "Noto Sans JP"';
      ctx.textAlign = 'center';
      ctx.fillText(val.toString(), x + barWidth / 2, y - 6);
    }

    // X軸ラベル
    ctx.fillStyle = CHART_TEXT;
    ctx.font = '10px "Noto Sans JP"';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(x + barWidth / 2, displayHeight - padding.bottom + 14);
    ctx.rotate(-Math.PI / 6);
    const label = p.label.replace('急性_', '');
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

/**
 * 希望順位達成状況グラフを描画
 */
export function drawPreferenceChart(canvasId, stats) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const displayWidth = canvas.parentElement.clientWidth - 48;
  const displayHeight = 280;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const ranks = [1, 2, 3, 4, 5, 6, 7, 8];
  const values = ranks.map(r => stats.rankCounts[r] || 0);
  const maxVal = Math.max(...values, 1);

  const colors = [
    '#fbbf24', '#c0c0c0', '#cd7f32', '#38bdf8',
    '#34d399', '#8b5cf6', '#ec4899', '#6366f1'
  ];

  const padding = { top: 20, right: 20, bottom: 50, left: 40 };
  const chartW = displayWidth - padding.left - padding.right;
  const chartH = displayHeight - padding.top - padding.bottom;
  const barWidth = Math.min(chartW / ranks.length * 0.6, 50);
  const gap = chartW / ranks.length;

  // グリッド
  ctx.strokeStyle = CHART_GRID;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(displayWidth - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = CHART_TEXT;
    ctx.font = '10px "Noto Sans JP"';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * (1 - i / gridLines)).toString(), padding.left - 6, y + 4);
  }

  // バー
  ranks.forEach((r, idx) => {
    const x = padding.left + gap * idx + (gap - barWidth) / 2;
    const val = values[idx];
    const barH = (val / maxVal) * chartH;
    const y = padding.top + chartH - barH;

    const gradient = ctx.createLinearGradient(x, y, x, padding.top + chartH);
    gradient.addColorStop(0, colors[idx]);
    gradient.addColorStop(1, colors[idx] + '40');

    ctx.fillStyle = gradient;
    roundRect(ctx, x, y, barWidth, barH, 4);
    ctx.fill();

    if (val > 0) {
      ctx.fillStyle = CHART_TEXT_LIGHT;
      ctx.font = 'bold 11px "Noto Sans JP"';
      ctx.textAlign = 'center';
      ctx.fillText(val.toString(), x + barWidth / 2, y - 6);
    }

    ctx.fillStyle = CHART_TEXT;
    ctx.font = '11px "Noto Sans JP"';
    ctx.textAlign = 'center';
    ctx.fillText(`第${r}`, x + barWidth / 2, displayHeight - padding.bottom + 16);
  });
}

/**
 * 課程分布グラフを描画（スタック棒グラフ）
 */
export function drawCourseDistribution(canvasId, stats) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  const displayWidth = canvas.parentElement.clientWidth - 48;
  const displayHeight = 280;
  canvas.width = displayWidth * dpr;
  canvas.height = displayHeight * dpr;
  canvas.style.width = displayWidth + 'px';
  canvas.style.height = displayHeight + 'px';
  ctx.scale(dpr, dpr);

  ctx.clearRect(0, 0, displayWidth, displayHeight);

  const placements = PLACEMENTS.filter(p => (stats.placementCounts[p.id] || 0) > 0);
  if (placements.length === 0) return;

  const maxVal = Math.max(...placements.map(p => stats.placementCounts[p.id] || 0), 1);

  const padding = { top: 30, right: 20, bottom: 60, left: 40 };
  const chartW = displayWidth - padding.left - padding.right;
  const chartH = displayHeight - padding.top - padding.bottom;
  const barWidth = Math.min(chartW / placements.length * 0.7, 35);
  const gap = chartW / placements.length;

  // 凡例
  const legendY = 8;
  const legendItems = [
    { label: '一般', color: '#38bdf8' },
    { label: '保健師', color: '#f59e0b' },
    { label: '養護教諭', color: '#ec4899' },
  ];
  let legendX = padding.left;
  legendItems.forEach(item => {
    ctx.fillStyle = item.color;
    ctx.fillRect(legendX, legendY, 10, 10);
    ctx.fillStyle = CHART_TEXT;
    ctx.font = '10px "Noto Sans JP"';
    ctx.textAlign = 'left';
    ctx.fillText(item.label, legendX + 14, legendY + 9);
    legendX += ctx.measureText(item.label).width + 30;
  });

  // グリッド
  ctx.strokeStyle = CHART_GRID;
  const gridLines = 5;
  for (let i = 0; i <= gridLines; i++) {
    const y = padding.top + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(displayWidth - padding.right, y);
    ctx.stroke();

    ctx.fillStyle = CHART_TEXT;
    ctx.font = '10px "Noto Sans JP"';
    ctx.textAlign = 'right';
    ctx.fillText(Math.round(maxVal * (1 - i / gridLines)).toString(), padding.left - 6, y + 4);
  }

  // スタック棒グラフ
  placements.forEach((p, idx) => {
    const x = padding.left + gap * idx + (gap - barWidth) / 2;
    const total = stats.placementCounts[p.id] || 0;
    const hoken = stats.placementHokenshi[p.id] || 0;
    const yogo = stats.placementYogo[p.id] || 0;
    const general = total - hoken - yogo;

    // 重複がありえる（保健師かつ養護教諭の場合）ので簡易的に描画
    const segments = [
      { val: Math.max(0, general), color: '#38bdf8' },
      { val: hoken, color: '#f59e0b' },
      { val: yogo, color: '#ec4899' },
    ];

    let currentY = padding.top + chartH;
    segments.forEach(seg => {
      if (seg.val > 0) {
        const barH = (seg.val / maxVal) * chartH;
        currentY -= barH;
        ctx.fillStyle = seg.color + 'cc';
        roundRect(ctx, x, currentY, barWidth, barH, idx === 0 ? 4 : 2);
        ctx.fill();
      }
    });

    // X軸ラベル
    ctx.fillStyle = CHART_TEXT;
    ctx.font = '10px "Noto Sans JP"';
    ctx.textAlign = 'center';
    ctx.save();
    ctx.translate(x + barWidth / 2, displayHeight - padding.bottom + 14);
    ctx.rotate(-Math.PI / 6);
    const label = p.label.replace('急性_', '');
    ctx.fillText(label, 0, 0);
    ctx.restore();
  });
}

/**
 * 角丸矩形を描画
 */
function roundRect(ctx, x, y, w, h, r) {
  if (h <= 0) return;
  r = Math.min(r, h / 2, w / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
