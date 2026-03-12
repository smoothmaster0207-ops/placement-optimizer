/**
 * export.js — CSV/集計エクスポート
 */

import { getState } from './state.js';
import { PLACEMENTS, getPlacementLabel } from './utils.js';

/**
 * 配置結果CSVをダウンロード
 */
export function exportResultsCSV() {
  const state = getState();
  if (!state.results || !state.results.assignments) {
    alert('エクスポートする結果がありません');
    return;
  }

  const assignments = state.results.assignments;
  const headers = [
    '学生ID', '氏名', '配置先', '希望順位', '基本点', 'キーワード加点', '合計点', '適用された制約', '適用希望理由', '保健師課程', '養護教諭課程'
  ];

  const rows = assignments.map(a => {
    let constraintsText = '';
    if (a.constraints && (a.constraints.required.length > 0 || a.constraints.forbidden.length > 0)) {
      const parts = [];
      if (a.constraints.required.length > 0) parts.push(`必須: ${a.constraints.required.map(getPlacementLabel).join(', ')}`);
      if (a.constraints.forbidden.length > 0) parts.push(`禁止: ${a.constraints.forbidden.map(getPlacementLabel).join(', ')}`);
      constraintsText = parts.join(' / ');
    }

    let activeReason = '';
    if (a.rank === 1) activeReason = a.reason;
    else if (a.rank === 2) activeReason = a.reason2;
    else if (a.rank === 3) activeReason = a.reason3;

    return [
      a.studentId,
      a.name,
      a.placementLabel,
      a.rank > 0 ? `第${a.rank}希望` : '希望外',
      a.baseScore,
      a.keywordBonus,
      a.totalScore,
      constraintsText,
      activeReason || '',
      a.hokenshi ? 'Yes' : 'No',
      a.yogo ? 'Yes' : 'No',
    ];
  });

  downloadCSV('配置結果.csv', headers, rows);
}

/**
 * 集計結果CSVをダウンロード
 */
export function exportSummaryCSV() {
  const state = getState();
  if (!state.results || !state.results.stats) {
    alert('エクスポートする結果がありません');
    return;
  }

  const stats = state.results.stats;

  // シート1: 基本統計
  const basicHeaders = ['項目', '値'];
  const basicRows = [
    ['学生数', stats.studentCount],
    ['配置完了人数', stats.assignedCount],
    ['総得点', stats.totalScore],
    ['平均得点', stats.avgScore],
  ];

  // 希望順位別
  for (let r = 1; r <= 8; r++) {
    basicRows.push([`第${r}希望配置人数`, stats.rankCounts[r] || 0]);
  }

  basicRows.push(['']);
  basicRows.push(['■ 配置先別集計']);
  basicRows.push(['配置先', '人数', '保健師課程', '養護教諭課程']);

  PLACEMENTS.forEach(p => {
    const count = stats.placementCounts[p.id] || 0;
    if (count > 0 || true) {
      basicRows.push([
        p.label,
        count,
        stats.placementHokenshi[p.id] || 0,
        stats.placementYogo[p.id] || 0,
      ]);
    }
  });

  downloadCSV('集計結果.csv', basicHeaders, basicRows);
}

/**
 * CSVをダウンロード
 */
function downloadCSV(filename, headers, rows) {
  // BOM付きUTF-8でExcel対応
  const BOM = '\uFEFF';
  const csvContent = BOM + [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const str = String(cell ?? '');
        // カンマや改行を含む場合はダブルクォートで囲む
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
