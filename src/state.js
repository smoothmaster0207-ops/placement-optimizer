/**
 * state.js — アプリケーション状態管理
 * グローバル状態の一元管理とlocalStorage永続化
 */

import { PLACEMENTS, DEFAULT_SCORES } from './utils.js';

const STORAGE_KEY = 'placement-optimizer-settings';

// ====== アプリケーション状態 ======
const state = {
  // CSV関連
  rawCsvData: [],          // 生のCSVデータ（配列の配列）
  csvHeaders: [],          // CSVヘッダー行
  columnMapping: {},       // 列マッピング { fieldId: csvColumnIndex }
  students: [],            // パース済み学生データ

  // 設定
  capacities: {},          // 各配置先の定員 { placementId: number }
  scores: { ...DEFAULT_SCORES },
  dispersion: {
    hokenshi: 3,           // 保健師偏り抑制強度 (0, 1, 3, 5)
    yogo: 3,               // 養護教諭偏り抑制強度
  },
  studentCountOverride: null, // null=CSV連動, 数値=手動設定
  keywordRules: [
    { keyword: '集中治療', placement: 'kyusei_icu', bonus: 2 },
    { keyword: '救急', placement: 'kyusei_er', bonus: 2 },
    { keyword: '手術室', placement: 'kyusei_or', bonus: 2 },
  ],

  // 最適化結果
  results: null,           // 最適化結果
  optimizationStatus: 'idle', // idle, running, done, error

  // UI状態
  currentStep: 1,
  csvLoaded: false,
  mappingApplied: false,
};

// ====== 定員の初期値 ======
function initCapacities() {
  const caps = {};
  PLACEMENTS.forEach(p => {
    caps[p.id] = 5; // デフォルト5人
  });
  state.capacities = caps;
}

// ====== localStorage永続化 ======
function saveSettings() {
  try {
    const settingsToSave = {
      capacities: state.capacities,
      studentCountOverride: state.studentCountOverride,
      dispersion: state.dispersion,
      keywordRules: state.keywordRules,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settingsToSave));
  } catch (e) {
    console.warn('設定の保存に失敗:', e);
  }
}

function loadSettings() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.capacities) state.capacities = { ...state.capacities, ...parsed.capacities };
      if (parsed.dispersion) state.dispersion = { ...state.dispersion, ...parsed.dispersion };
      if (parsed.keywordRules) state.keywordRules = parsed.keywordRules;
      if (parsed.studentCountOverride !== undefined) state.studentCountOverride = parsed.studentCountOverride;
    }
  } catch (e) {
    console.warn('設定の読込に失敗:', e);
  }
}

// ====== 初期化 ======
initCapacities();
loadSettings();

// ====== 状態操作関数 ======
export function getState() {
  return state;
}

export function setCsvData(headers, data) {
  state.csvHeaders = headers;
  state.rawCsvData = data;
  state.csvLoaded = true;
}

export function setColumnMapping(mapping) {
  state.columnMapping = mapping;
  state.mappingApplied = true;
}

export function setStudents(students) {
  state.students = students;
}

export function setCapacity(placementId, value) {
  state.capacities[placementId] = value;
  saveSettings();
}

export function setDispersion(type, value) {
  state.dispersion[type] = value;
  saveSettings();
}

export function setKeywordRules(rules) {
  state.keywordRules = rules;
  saveSettings();
}

export function addKeywordRule(rule) {
  state.keywordRules.push(rule);
  saveSettings();
}

export function removeKeywordRule(index) {
  state.keywordRules.splice(index, 1);
  saveSettings();
}

export function updateKeywordRule(index, rule) {
  state.keywordRules[index] = rule;
  saveSettings();
}

export function setResults(results) {
  state.results = results;
  state.optimizationStatus = results ? 'done' : 'idle';
}

export function setOptimizationStatus(status) {
  state.optimizationStatus = status;
}

export function setCurrentStep(step) {
  state.currentStep = step;
}

export function setStudentCountOverride(value) {
  state.studentCountOverride = value;
  saveSettings();
}

export function getTotalCapacity() {
  return Object.values(state.capacities).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
}

export function getStudentCount() {
  return state.students.length;
}

/** 定員チェック用の学生数（オーバーライドがあればそちらを使用） */
export function getTargetStudentCount() {
  if (state.studentCountOverride !== null && state.studentCountOverride !== undefined && state.studentCountOverride > 0) {
    return state.studentCountOverride;
  }
  return state.students.length;
}
