/**
 * main.js — アプリケーション初期化・画面遷移・イベントバインド
 */

import {
  getState, setCurrentStep, setCapacity, setDispersion,
  setKeywordRules, addKeywordRule, removeKeywordRule, updateKeywordRule,
  setResults, setOptimizationStatus, getTotalCapacity, getStudentCount,
  getTargetStudentCount, setStudentCountOverride
} from './state.js';

import {
  parseCSVFile, autoDetectMapping, validateMapping,
  applyMappingAndParse, renderPreviewTable, renderMappingUI
} from './csv-parser.js';

import { runOptimization } from './optimizer.js';

import { renderSummaryGrid, renderResultTable, applyFilters } from './results.js';

import { drawPlacementChart, drawPreferenceChart, drawCourseDistribution } from './charts.js';

import { exportResultsCSV, exportSummaryCSV } from './export.js';

import { PLACEMENTS, showToast, getPlacementLabel } from './utils.js';

// ====== 画面遷移 ======
function goToStep(step) {
  const state = getState();

  // バリデーション
  if (step === 2 && !state.mappingApplied) {
    showToast('先にCSVデータを読み込んでマッピングを適用してください', 'warning');
    return;
  }
  if (step === 4 && !state.results) {
    showToast('先に最適化を実行してください', 'warning');
    return;
  }
  if (step === 5 && !state.results) {
    showToast('先に最適化を実行してください', 'warning');
    return;
  }

  setCurrentStep(step);

  // パネル表示切替
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`panel-${step}`).classList.add('active');

  // ステッパー更新
  document.querySelectorAll('.stepper .step').forEach(s => {
    const sStep = parseInt(s.dataset.step);
    s.classList.remove('active', 'completed');
    if (sStep === step) s.classList.add('active');
    else if (sStep < step) s.classList.add('completed');
  });

  // ステップライン更新
  const lines = document.querySelectorAll('.step-line');
  lines.forEach((line, idx) => {
    line.classList.toggle('completed', idx < step - 1);
  });

  // ステップ固有の初期化
  if (step === 2) initStep2();
  if (step === 3) initStep3();
  if (step === 4) initStep4();

  // スクロールトップ
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ====== STEP 1: CSV読込 ======
function initStep1() {
  const uploadArea = document.getElementById('upload-area');
  const csvInput = document.getElementById('csv-input');

  // クリックでファイル選択
  uploadArea.addEventListener('click', () => csvInput.click());

  // ドラッグ&ドロップ
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });

  // ファイル選択
  csvInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) handleFile(file);
  });

  // マッピング適用ボタン
  document.getElementById('apply-mapping-btn').addEventListener('click', applyMapping);
  document.getElementById('auto-detect-btn').addEventListener('click', () => {
    const state = getState();
    const mapping = autoDetectMapping(state.csvHeaders);
    renderMappingGrid(mapping);
    showToast('列を自動検出しました。確認して適用してください', 'success');
  });
}

async function handleFile(file) {
  if (!file.name.match(/\.(csv|txt)$/i)) {
    showToast('CSVファイルを選択してください', 'error');
    return;
  }

  try {
    const { headers, data } = await parseCSVFile(file);

    // プレビュー表示
    document.getElementById('csv-preview-section').style.display = '';
    document.getElementById('preview-info').innerHTML = `
      <span>📊 列数: <strong>${headers.length}</strong></span>
      <span>📋 データ行: <strong>${data.length}</strong></span>
      <span>📁 ファイル: <strong>${file.name}</strong></span>
    `;
    document.getElementById('preview-table').innerHTML = renderPreviewTable(headers, data);

    // 列マッピング設定
    const mapping = autoDetectMapping(headers);
    renderMappingGrid(mapping);
    document.getElementById('column-mapping-section').style.display = '';

    showToast(`CSVを読み込みました（${data.length}行）`, 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderMappingGrid(mapping) {
  const state = getState();
  const grid = document.getElementById('mapping-grid');
  grid.innerHTML = renderMappingUI(state.csvHeaders, mapping);

  // セレクト変更イベント
  grid.querySelectorAll('.mapping-select').forEach(sel => {
    sel.addEventListener('change', () => {
      // 現在の変更を一時保持
    });
  });
}

function applyMapping() {
  const state = getState();
  const mapping = {};

  document.querySelectorAll('.mapping-select').forEach(sel => {
    mapping[sel.dataset.field] = parseInt(sel.value);
  });

  // バリデーション
  const { errors, warnings } = validateMapping(mapping);

  if (errors.length > 0) {
    const validationDiv = document.getElementById('validation-results');
    const validationSection = document.getElementById('validation-section');
    validationSection.style.display = '';

    let html = errors.map(e => `<div class="validation-item error">❌ ${e}</div>`).join('');
    html += warnings.map(w => `<div class="validation-item warning">⚠️ ${w}</div>`).join('');
    validationDiv.innerHTML = html;

    showToast('マッピングにエラーがあります', 'error');
    return;
  }

  // データ適用
  const { students, errors: parseErrors } = applyMappingAndParse(mapping);

  // バリデーション結果表示
  const validationDiv = document.getElementById('validation-results');
  const validationSection = document.getElementById('validation-section');
  validationSection.style.display = '';

  let html = `<div class="validation-item success">✅ ${students.length}名の学生データを正常に読み込みました</div>`;

  if (warnings.length > 0) {
    html += warnings.map(w => `<div class="validation-item warning">⚠️ ${w}</div>`).join('');
  }
  if (parseErrors.length > 0) {
    html += parseErrors.map(e => `<div class="validation-item warning">⚠️ ${e}</div>`).join('');
  }

  validationDiv.innerHTML = html;

  // 次のステップへ進めるように
  document.getElementById('to-step2').disabled = false;
  showToast('マッピングを適用しました！条件設定に進めます', 'success');
}

// ====== STEP 2: 条件設定 ======
function initStep2() {
  const state = getState();
  renderCapacityInputs(state);
  renderKeywordRules(state);
  renderStudentCountSetting(state);
  updateCapacitySummary();

  // 偏り抑制のセレクト初期化
  document.getElementById('dispersion-hokenshi').value = state.dispersion.hokenshi;
  document.getElementById('dispersion-yogo').value = state.dispersion.yogo;
}

function renderCapacityInputs(state) {
  const generalEl = document.getElementById('capacity-general');
  const acuteEl = document.getElementById('capacity-acute');

  const generalPlacements = PLACEMENTS.filter(p => p.category === 'general');
  const acutePlacements = PLACEMENTS.filter(p => p.category === 'acute');

  generalEl.innerHTML = generalPlacements.map(p => `
    <div class="capacity-item">
      <label>
        <span class="placement-dot" style="background:${p.color}"></span>
        ${p.label}
      </label>
      <input type="number" class="number-input capacity-input"
             data-placement="${p.id}" value="${state.capacities[p.id] || 0}" min="0" max="99" />
    </div>
  `).join('');

  acuteEl.innerHTML = acutePlacements.map(p => `
    <div class="capacity-item">
      <label>
        <span class="placement-dot" style="background:${p.color}"></span>
        ${p.label.replace('急性_', '')}
      </label>
      <input type="number" class="number-input capacity-input"
             data-placement="${p.id}" value="${state.capacities[p.id] || 0}" min="0" max="99" />
    </div>
  `).join('');

  // イベントバインド
  document.querySelectorAll('.capacity-input').forEach(input => {
    input.addEventListener('change', () => {
      setCapacity(input.dataset.placement, parseInt(input.value) || 0);
      updateCapacitySummary();
    });
    input.addEventListener('input', () => {
      setCapacity(input.dataset.placement, parseInt(input.value) || 0);
      updateCapacitySummary();
    });
  });
}

function updateCapacitySummary() {
  const total = getTotalCapacity();
  const targetCount = getTargetStudentCount();
  const csvCount = getStudentCount();
  const el = document.getElementById('capacity-summary');

  const countLabel = targetCount !== csvCount
    ? `対象学生数: <strong>${targetCount}名</strong>（CSV: ${csvCount}名）`
    : `学生数: <strong>${targetCount}名</strong>`;

  if (targetCount === 0) {
    el.innerHTML = `定員合計: <strong>${total}名</strong>`;
    el.className = 'capacity-summary';
  } else if (total < targetCount) {
    el.innerHTML = `⚠️ 定員合計: <strong>${total}名</strong> ＜ ${countLabel} — 定員が不足しています`;
    el.className = 'capacity-summary error';
  } else {
    el.innerHTML = `✅ 定員合計: <strong>${total}名</strong> ≥ ${countLabel} — OK`;
    el.className = 'capacity-summary';
  }
}

function renderKeywordRules(state) {
  const container = document.getElementById('keyword-rules');
  if (state.keywordRules.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">ルールがありません。「＋ルールを追加」から追加してください。</p>';
    return;
  }

  container.innerHTML = state.keywordRules.map((rule, idx) => `
    <div class="keyword-rule" data-index="${idx}">
      <span class="rule-label">キーワード</span>
      <input type="text" class="text-input kw-keyword" value="${escapeAttr(rule.keyword)}" placeholder="例: 集中治療" />
      <span class="rule-label">→</span>
      <select class="select-input kw-placement">
        ${PLACEMENTS.map(p => `<option value="${p.id}" ${p.id === rule.placement ? 'selected' : ''}>${p.label}</option>`).join('')}
      </select>
      <span class="rule-label">加点</span>
      <input type="number" class="number-input kw-bonus" value="${rule.bonus}" min="0" max="10" />
      <button class="btn-remove" data-index="${idx}">✕</button>
    </div>
  `).join('');

  // イベントバインド
  container.querySelectorAll('.keyword-rule').forEach(ruleEl => {
    const idx = parseInt(ruleEl.dataset.index);

    ruleEl.querySelector('.kw-keyword').addEventListener('change', (e) => {
      updateKeywordRule(idx, {
        ...getState().keywordRules[idx],
        keyword: e.target.value,
      });
    });

    ruleEl.querySelector('.kw-placement').addEventListener('change', (e) => {
      updateKeywordRule(idx, {
        ...getState().keywordRules[idx],
        placement: e.target.value,
      });
    });

    ruleEl.querySelector('.kw-bonus').addEventListener('change', (e) => {
      updateKeywordRule(idx, {
        ...getState().keywordRules[idx],
        bonus: parseInt(e.target.value) || 0,
      });
    });

    ruleEl.querySelector('.btn-remove').addEventListener('click', () => {
      removeKeywordRule(idx);
      renderKeywordRules(getState());
    });
  });
}

function renderStudentCountSetting(state) {
  const container = document.getElementById('student-count-setting');
  if (!container) return;

  const csvCount = getStudentCount();
  const override = state.studentCountOverride;

  container.innerHTML = `
    <div class="setting-row">
      <label>CSVデータ行数</label>
      <span class="value" style="font-weight:600;color:var(--text-primary);">${csvCount}名</span>
    </div>
    <div class="setting-row">
      <label>対象学生数（手動設定）</label>
      <div style="display:flex;align-items:center;gap:8px;">
        <input type="number" class="number-input" id="student-count-override"
               value="${override || ''}" min="1" max="999"
               placeholder="${csvCount}" style="width:100px;" />
        <span style="font-size:0.8rem;color:var(--text-muted);">空欄＝CSV行数を使用</span>
      </div>
    </div>
  `;

  document.getElementById('student-count-override').addEventListener('change', (e) => {
    const val = e.target.value ? parseInt(e.target.value) : null;
    setStudentCountOverride(val);
    updateCapacitySummary();
  });
  document.getElementById('student-count-override').addEventListener('input', (e) => {
    const val = e.target.value ? parseInt(e.target.value) : null;
    setStudentCountOverride(val);
    updateCapacitySummary();
  });
}

// ====== STEP 3: 最適化実行 ======
function initStep3() {
  const state = getState();
  const summaryEl = document.getElementById('optimize-summary');

  const totalCapacity = getTotalCapacity();
  const studentCount = state.students.length;
  const kwCount = state.keywordRules.length;

  summaryEl.innerHTML = `
    <div class="summary-item"><span class="label">学生数</span><span class="value">${studentCount}名</span></div>
    <div class="summary-item"><span class="label">定員合計</span><span class="value">${totalCapacity}名</span></div>
    <div class="summary-item"><span class="label">キーワードルール</span><span class="value">${kwCount}件</span></div>
    <div class="summary-item"><span class="label">保健師偏り抑制</span><span class="value">${getDispersionLabel(state.dispersion.hokenshi)}</span></div>
    <div class="summary-item"><span class="label">養護教諭偏り抑制</span><span class="value">${getDispersionLabel(state.dispersion.yogo)}</span></div>
  `;

  // エラーチェック
  const errorEl = document.getElementById('optimize-error');
  if (totalCapacity < studentCount) {
    errorEl.style.display = '';
    errorEl.innerHTML = `❌ 定員合計(${totalCapacity}名)が学生数(${studentCount}名)より少ないため実行できません。条件設定に戻って定員を増やしてください。`;
    document.getElementById('run-optimize-btn').disabled = true;
  } else {
    errorEl.style.display = 'none';
    document.getElementById('run-optimize-btn').disabled = false;
  }

  // 前回結果があれば表示
  if (state.results) {
    document.getElementById('to-step4').disabled = false;
  }
}

function getDispersionLabel(value) {
  const labels = { 0: '無効', 1: '弱', 3: '中', 5: '強' };
  return labels[value] || `${value}`;
}

async function executeOptimization() {
  const state = getState();
  const btn = document.getElementById('run-optimize-btn');
  const progressEl = document.getElementById('optimize-progress');
  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');
  const errorEl = document.getElementById('optimize-error');

  btn.disabled = true;
  progressEl.style.display = '';
  errorEl.style.display = 'none';
  setOptimizationStatus('running');

  try {
    // 偏り設定を反映
    setDispersion('hokenshi', parseInt(document.getElementById('dispersion-hokenshi').value) || 0);
    setDispersion('yogo', parseInt(document.getElementById('dispersion-yogo').value) || 0);

    const results = await runOptimization((message, progress) => {
      progressText.textContent = message;
      progressFill.style.width = `${progress}%`;
    });

    setResults(results);
    progressFill.style.width = '100%';
    progressText.textContent = '✅ 最適化完了！';

    document.getElementById('to-step4').disabled = false;
    showToast('最適化が完了しました！結果を確認してください', 'success');

    // 自動的に結果画面へ
    setTimeout(() => goToStep(4), 1000);
  } catch (err) {
    setOptimizationStatus('error');
    errorEl.style.display = '';
    errorEl.innerHTML = `❌ ${err.message}`;
    progressEl.style.display = 'none';
    showToast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ====== STEP 4: 結果確認 ======
function initStep4() {
  const state = getState();
  if (!state.results) return;

  const { assignments, stats } = state.results;

  // サマリー
  renderSummaryGrid(stats);

  // テーブル
  renderResultTable(assignments);

  // グラフ
  setTimeout(() => {
    drawPlacementChart('chart-placement', stats);
    drawPreferenceChart('chart-preference', stats);
    drawCourseDistribution('chart-course', stats);
  }, 100);

  // フィルター
  const searchInput = document.getElementById('result-search');
  const filterSelect = document.getElementById('result-filter-placement');

  searchInput.addEventListener('input', () => applyFilters(assignments));
  filterSelect.addEventListener('change', () => applyFilters(assignments));
}

// ====== イベントバインド ======
function bindEvents() {
  // ステップナビゲーション
  document.getElementById('to-step2').addEventListener('click', () => goToStep(2));
  document.getElementById('to-step3').addEventListener('click', () => goToStep(3));
  document.getElementById('to-step4').addEventListener('click', () => goToStep(4));
  document.getElementById('to-step5').addEventListener('click', () => goToStep(5));

  document.getElementById('to-step1').addEventListener('click', () => goToStep(1));
  document.getElementById('to-step2b').addEventListener('click', () => goToStep(2));
  document.getElementById('to-step3b').addEventListener('click', () => goToStep(3));
  document.getElementById('to-step4b').addEventListener('click', () => goToStep(4));

  // ステッパーのクリック
  document.querySelectorAll('.stepper .step').forEach(step => {
    step.addEventListener('click', () => {
      const targetStep = parseInt(step.dataset.step);
      goToStep(targetStep);
    });
  });

  // 最適化実行
  document.getElementById('run-optimize-btn').addEventListener('click', executeOptimization);

  // キーワードルール追加
  document.getElementById('add-keyword-btn').addEventListener('click', () => {
    addKeywordRule({ keyword: '', placement: 'kyusei_icu', bonus: 2 });
    renderKeywordRules(getState());
  });

  // エクスポート
  document.getElementById('export-results-btn').addEventListener('click', exportResultsCSV);
  document.getElementById('export-summary-btn').addEventListener('click', exportSummaryCSV);
}

// ====== 初期化 ======
function init() {
  initStep1();
  bindEvents();
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// DOMContentLoaded で初期化
document.addEventListener('DOMContentLoaded', init);
