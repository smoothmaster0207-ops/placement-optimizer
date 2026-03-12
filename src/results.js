/**
 * results.js — 結果表示・サマリー計算
 */

import { PLACEMENTS, getPlacementLabel, getPlacementColor } from './utils.js';

/**
 * サマリーカードを生成
 */
export function renderSummaryGrid(stats) {
  const el = document.getElementById('summary-grid');
  if (!el) return;

  const badCount = (stats.rankCounts[5] || 0) + (stats.rankCounts[6] || 0) + 
                   (stats.rankCounts[7] || 0) + (stats.rankCounts[8] || 0) + (stats.rankCounts[0] || 0);

  const cards = [
    { value: stats.studentCount, label: '対象学生数' },
    { value: badCount, label: '第5希望以下', isError: badCount > 0 },
    { value: stats.totalScore, label: '総得点' },
    { value: stats.avgScore, label: '平均得点' },
    { value: stats.rankCounts[1] || 0, label: '第1希望' },
    { value: stats.rankCounts[2] || 0, label: '第2希望' },
    { value: stats.rankCounts[3] || 0, label: '第3希望' },
    { value: stats.rankCounts[4] || 0, label: '第4希望' },
    { value: stats.rankCounts[5] || 0, label: '第5希望', isWarning: (stats.rankCounts[5] || 0) > 0 },
    { value: stats.rankCounts[6] || 0, label: '第6希望', isWarning: (stats.rankCounts[6] || 0) > 0 },
    { value: stats.rankCounts[7] || 0, label: '第7希望', isWarning: (stats.rankCounts[7] || 0) > 0 },
    { value: stats.rankCounts[8] || 0, label: '第8希望', isWarning: (stats.rankCounts[8] || 0) > 0 },
  ];

  el.innerHTML = cards.map(c => {
    let customStyle = '';
    if (c.isError) customStyle = 'color: var(--error); background: none; -webkit-text-fill-color: initial;';
    else if (c.isWarning) customStyle = 'color: #fca5a5; background: none; -webkit-text-fill-color: initial;'; // Slightly lighter red

    return `
      <div class="summary-stat">
        <div class="stat-value" style="${customStyle}">${c.value}</div>
        <div class="stat-label">${c.label}</div>
      </div>
    `;
  }).join('');
}

/**
 * 結果テーブルを生成
 */
export function renderResultTable(assignments) {
  const table = document.getElementById('result-table');
  if (!table) return;

  let html = `
    <thead>
      <tr>
        <th data-sort="studentId">学生ID</th>
        <th data-sort="name">氏名</th>
        <th data-sort="placement">配置先</th>
        <th data-sort="rank">希望順位</th>
        <th data-sort="baseScore">基本点</th>
        <th data-sort="keywordBonus">加点</th>
        <th data-sort="totalScore">合計点</th>
        <th>制約</th>
        <th>保健師</th>
        <th>養護教諭</th>
      </tr>
    </thead>
    <tbody>
  `;

  for (const a of assignments) {
    const rankClass = a.rank <= 3 ? `rank-${a.rank}` : 'rank-other';
    const rankText = a.rank > 0 ? `第${a.rank}希望` : '希望外';
    const placementColor = getPlacementColor(a.placement);

    let constraintsBadge = '';
    if (a.constraints && (a.constraints.required.length > 0 || a.constraints.forbidden.length > 0)) {
      const parts = [];
      if (a.constraints.required.length > 0) parts.push(`<span style="color:var(--success);font-weight:600;" title="強制配置: ${a.constraints.required.map(getPlacementLabel).join(', ')}">必須</span>`);
      if (a.constraints.forbidden.length > 0) parts.push(`<span style="color:var(--error);font-weight:600;" title="禁止配置: ${a.constraints.forbidden.map(getPlacementLabel).join(', ')}">禁止</span>`);
      constraintsBadge = parts.join(' / ');
    }

    let activeReason = '';
    if (a.rank === 1) activeReason = a.reason;
    else if (a.rank === 2) activeReason = a.reason2;
    else if (a.rank === 3) activeReason = a.reason3;

    const fullReason = [activeReason, a.notes].filter(Boolean).join(' ');

    html += `
      <tr>
        <td>${escapeHtml(a.studentId)}</td>
        <td>
          ${escapeHtml(a.name)}
          ${fullReason ? `<div style="font-size:0.75rem;color:var(--text-muted);white-space:normal;max-width:200px;overflow:hidden;text-overflow:ellipsis;" title="${escapeHtml(fullReason)}">${escapeHtml(fullReason)}</div>` : ''}
        </td>
        <td>
          <span class="placement-badge" style="background:${placementColor}20;color:${placementColor};">
            <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${placementColor};"></span>
            ${escapeHtml(a.placementLabel)}
          </span>
        </td>
        <td><span class="rank-badge ${rankClass}">${a.rank > 0 ? a.rank : '-'}</span> ${rankText}</td>
        <td>${a.baseScore}</td>
        <td>${a.keywordBonus > 0 ? `+${a.keywordBonus}` : '-'}</td>
        <td><strong>${a.totalScore}</strong></td>
        <td>${constraintsBadge}</td>
        <td>${a.hokenshi ? '✓' : ''}</td>
        <td>${a.yogo ? '✓' : ''}</td>
      </tr>
    `;
  }

  html += '</tbody>';
  table.innerHTML = html;

  // ソート機能を追加
  setupTableSort(table, assignments);

  // フィルタードロップダウンを更新
  updateFilterDropdown(assignments);
}

/**
 * テーブルソート機能
 */
function setupTableSort(table, assignments) {
  const headers = table.querySelectorAll('th[data-sort]');
  let currentSort = { key: null, asc: true };

  headers.forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.sort;
      if (currentSort.key === key) {
        currentSort.asc = !currentSort.asc;
      } else {
        currentSort.key = key;
        currentSort.asc = true;
      }

      // ソート方向の表示更新
      headers.forEach(h => h.classList.remove('sort-asc', 'sort-desc'));
      th.classList.add(currentSort.asc ? 'sort-asc' : 'sort-desc');

      // データをソート
      const sorted = [...assignments].sort((a, b) => {
        let va = a[key];
        let vb = b[key];
        if (typeof va === 'string') {
          return currentSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
        }
        return currentSort.asc ? va - vb : vb - va;
      });

      renderResultTable(sorted);
    });
  });
}

/**
 * フィルタードロップダウンを更新
 */
function updateFilterDropdown(assignments) {
  const select = document.getElementById('result-filter-placement');
  if (!select) return;

  const uniquePlacements = [...new Set(assignments.map(a => a.placement))];
  select.innerHTML = '<option value="">すべての配置先</option>';
  uniquePlacements.forEach(pId => {
    select.innerHTML += `<option value="${pId}">${getPlacementLabel(pId)}</option>`;
  });
}

/**
 * フィルタリング適用
 */
export function applyFilters(assignments) {
  const searchInput = document.getElementById('result-search');
  const filterSelect = document.getElementById('result-filter-placement');

  let filtered = [...assignments];

  if (searchInput && searchInput.value) {
    const query = searchInput.value.toLowerCase();
    filtered = filtered.filter(a =>
      a.studentId.toLowerCase().includes(query) ||
      a.name.toLowerCase().includes(query)
    );
  }

  if (filterSelect && filterSelect.value) {
    filtered = filtered.filter(a => a.placement === filterSelect.value);
  }

  renderResultTable(filtered);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
