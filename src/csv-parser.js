/**
 * csv-parser.js — CSV読込・パース・バリデーション
 * FileReader APIによるCSV読込と列マッピング処理
 */

import { getState, setCsvData, setColumnMapping, setStudents } from './state.js';
import {
  COLUMN_MAPPINGS, PREFERENCE_CATEGORIES,
  normalizeStr, normalizePlacementName, parseBooleanValue, showToast
} from './utils.js';

/**
 * CSVファイルを読み込んでパースする
 */
export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    // まずUTF-8で読み込み、文字化けがあればShift_JISで再試行
    const tryRead = (encoding) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          let text = e.target.result;
          // UTF-8で文字化けチェック（置換文字の存在）
          if (encoding === 'UTF-8' && text.includes('\uFFFD')) {
            tryRead('Shift_JIS');
            return;
          }
          // BOM除去
          if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
          const { headers, data } = parseCSVText(text);
          setCsvData(headers, data);
          resolve({ headers, data });
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(new Error('ファイルの読み込みに失敗しました'));
      reader.readAsText(file, encoding);
    };
    tryRead('UTF-8');
  });
}

/**
 * CSVテキストをパースする（ダブルクォート内改行対応）
 */
function parseCSVText(text) {
  // ダブルクォート内の改行を考慮した行分割
  const rows = splitCSVRows(text);
  if (rows.length < 2) {
    throw new Error('CSVにヘッダーとデータ行が必要です（最低2行）');
  }

  const headers = parseCSVLine(rows[0]);
  const data = [];

  for (let i = 1; i < rows.length; i++) {
    const row = parseCSVLine(rows[i]);
    // ヘッダーと同じ列数に調整
    while (row.length < headers.length) row.push('');
    // 完全に空の行のみスキップ（1セルでも値があれば保持）
    data.push(row);
  }

  return { headers, data };
}

/**
 * ダブルクォート内の改行を考慮してCSVを行単位に分割する
 */
function splitCSVRows(text) {
  const rows = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          current += '""';
          i++;
        } else {
          inQuotes = false;
          current += ch;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        current += ch;
      } else if (ch === '\n') {
        // 行終端：空でなければ追加
        const trimmed = current.replace(/\r$/, '');
        if (trimmed.length > 0) {
          rows.push(trimmed);
        }
        current = '';
      } else {
        current += ch;
      }
    }
  }

  // 最終行
  const trimmed = current.replace(/\r$/, '').trim();
  if (trimmed.length > 0) {
    rows.push(trimmed);
  }

  return rows;
}

/**
 * CSV1行をパースする（ダブルクォート対応）
 */
function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/**
 * CSVヘッダーから列マッピングを自動検出する
 */
export function autoDetectMapping(headers) {
  const mapping = {};

  for (const [fieldId, fieldDef] of Object.entries(COLUMN_MAPPINGS)) {
    mapping[fieldId] = -1; // 未マッピング

    for (let i = 0; i < headers.length; i++) {
      const normalized = normalizeStr(headers[i]);
      for (const candidate of fieldDef.candidates) {
        if (normalized === normalizeStr(candidate) || normalized.includes(normalizeStr(candidate))) {
          mapping[fieldId] = i;
          break;
        }
      }
      if (mapping[fieldId] !== -1) break;
    }
  }

  return mapping;
}

/**
 * マッピングのバリデーション
 */
export function validateMapping(mapping) {
  const errors = [];
  const warnings = [];

  // 必須列チェック
  for (const [fieldId, fieldDef] of Object.entries(COLUMN_MAPPINGS)) {
    if (fieldDef.required && (mapping[fieldId] === -1 || mapping[fieldId] === undefined)) {
      errors.push(`必須列「${fieldDef.label}」がマッピングされていません`);
    }
  }

  // 重複チェック
  const usedIndices = {};
  for (const [fieldId, colIndex] of Object.entries(mapping)) {
    if (colIndex >= 0) {
      if (usedIndices[colIndex]) {
        warnings.push(`列${colIndex + 1}が「${COLUMN_MAPPINGS[fieldId].label}」と「${COLUMN_MAPPINGS[usedIndices[colIndex]].label}」の両方にマッピングされています`);
      }
      usedIndices[colIndex] = fieldId;
    }
  }

  // 任意列の欠如警告
  if (mapping.hokenshi === -1) {
    warnings.push('「保健師課程」列が見つかりません。偏り抑制は保健師課程に対して無効になります');
  }
  if (mapping.yogo === -1) {
    warnings.push('「養護教諭課程」列が見つかりません。偏り抑制は養護教諭課程に対して無効になります');
  }
  if (mapping.reason === -1) {
    warnings.push('「第1希望理由」列が見つかりません。キーワード加点は適用されません');
  }

  return { errors, warnings };
}

/**
 * マッピングに従ってデータを学生オブジェクトに変換する
 */
export function applyMappingAndParse(mapping) {
  const state = getState();
  const { csvHeaders, rawCsvData } = state;
  const students = [];
  const errors = [];

  for (let rowIdx = 0; rowIdx < rawCsvData.length; rowIdx++) {
    const row = rawCsvData[rowIdx];
    const lineNum = rowIdx + 2; // ヘッダー行の分+1, 1-indexed

    // 学生IDと氏名
    const studentId = mapping.studentId >= 0 ? normalizeStr(row[mapping.studentId]) : '';
    const name = mapping.name >= 0 ? row[mapping.name]?.trim() : '';

    if (!studentId && !name) {
      continue; // IDも氏名もなければスキップ
    }

    // 希望データ
    const preferences = [];
    let prefValid = true;
    for (let p = 1; p <= 8; p++) {
      const fid = `pref${p}`;
      if (mapping[fid] >= 0) {
        const rawPref = row[mapping[fid]]?.trim();
        const normalized = normalizePlacementName(rawPref);
        if (normalized && PREFERENCE_CATEGORIES.includes(normalized)) {
          preferences.push(normalized);
        } else if (rawPref) {
          errors.push(`行${lineNum}: 第${p}希望「${rawPref}」は有効な領域名ではありません`);
          prefValid = false;
          preferences.push(rawPref); // 一応保持
        } else {
          preferences.push('');
        }
      } else {
        preferences.push('');
      }
    }

    // 保健師課程・養護教諭課程
    const hokenshi = mapping.hokenshi >= 0 ? parseBooleanValue(row[mapping.hokenshi]) : false;
    const yogo = mapping.yogo >= 0 ? parseBooleanValue(row[mapping.yogo]) : false;

    // 希望理由・備考
    const reason = mapping.reason >= 0 ? (row[mapping.reason] || '') : '';
    const reason2 = mapping.reason2 >= 0 ? (row[mapping.reason2] || '') : '';
    const reason3 = mapping.reason3 >= 0 ? (row[mapping.reason3] || '') : '';
    const notes = mapping.notes >= 0 ? (row[mapping.notes] || '') : '';

    students.push({
      id: studentId || `student_${rowIdx + 1}`,
      name: name || `学生${rowIdx + 1}`,
      preferences,
      hokenshi,
      yogo,
      reason,
      reason2,
      reason3,
      notes,
      rowIndex: rowIdx,
    });
  }

  // 重複チェック
  const idCounts = {};
  students.forEach(s => {
    idCounts[s.id] = (idCounts[s.id] || 0) + 1;
  });
  const duplicates = Object.entries(idCounts).filter(([_, count]) => count > 1);
  if (duplicates.length > 0) {
    duplicates.forEach(([id, count]) => {
      errors.push(`学生ID「${id}」が${count}件重複しています`);
    });
  }

  setStudents(students);
  setColumnMapping(mapping);

  return { students, errors };
}

/**
 * プレビューテーブルを生成
 */
export function renderPreviewTable(headers, data, maxRows = 5) {
  let html = '<thead><tr>';
  headers.forEach(h => { html += `<th>${escapeHtml(h)}</th>`; });
  html += '</tr></thead><tbody>';

  const displayRows = data.slice(0, maxRows);
  displayRows.forEach(row => {
    html += '<tr>';
    headers.forEach((_, i) => {
      html += `<td>${escapeHtml(row[i] || '')}</td>`;
    });
    html += '</tr>';
  });

  if (data.length > maxRows) {
    html += `<tr><td colspan="${headers.length}" style="text-align:center;color:var(--text-muted);">... 他 ${data.length - maxRows} 行</td></tr>`;
  }

  html += '</tbody>';
  return html;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * 列マッピングUIを生成
 */
export function renderMappingUI(headers, currentMapping) {
  let html = '';

  for (const [fieldId, fieldDef] of Object.entries(COLUMN_MAPPINGS)) {
    const isRequired = fieldDef.required;
    const selectedIdx = currentMapping[fieldId] ?? -1;

    html += `<div class="mapping-item">`;
    html += `<label>${fieldDef.label}${isRequired ? '<span class="required">*</span>' : ''}</label>`;
    html += `<select class="select-input mapping-select" data-field="${fieldId}">`;
    html += `<option value="-1"${selectedIdx === -1 ? ' selected' : ''}>-- 未設定 --</option>`;

    headers.forEach((h, i) => {
      const sel = selectedIdx === i ? ' selected' : '';
      html += `<option value="${i}"${sel}>${escapeHtml(h)}</option>`;
    });

    html += `</select></div>`;
  }

  return html;
}
