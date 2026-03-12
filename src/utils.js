/**
 * utils.js — ユーティリティ関数群
 * 文字列正規化、配置先定義、ヘルパー関数
 */

// ====== 配置先定義 ======
export const PLACEMENTS = [
  { id: 'kiso', label: '基礎', category: 'general', color: '#6366f1' },
  { id: 'bosei', label: '母性', category: 'general', color: '#ec4899' },
  { id: 'shoni', label: '小児', category: 'general', color: '#f59e0b' },
  { id: 'kyusei_9a', label: '急性_9A', category: 'acute', parentLabel: '急性', color: '#ef4444' },
  { id: 'kyusei_or', label: '急性_OR', category: 'acute', parentLabel: '急性', color: '#f87171' },
  { id: 'kyusei_icu', label: '急性_ICU', category: 'acute', parentLabel: '急性', color: '#dc2626' },
  { id: 'kyusei_er', label: '急性_ER', category: 'acute', parentLabel: '急性', color: '#b91c1c' },
  { id: 'mansei', label: '慢性', category: 'general', color: '#14b8a6' },
  { id: 'ronen', label: '老年', category: 'general', color: '#8b5cf6' },
  { id: 'seishin', label: '精神', category: 'general', color: '#06b6d4' },
  { id: 'zaitaku', label: '在宅', category: 'general', color: '#22c55e' },
];

// 8大分類と内部配置先のマッピング
export const CATEGORY_MAP = {
  '基礎': ['kiso'],
  '母性': ['bosei'],
  '小児': ['shoni'],
  '急性': ['kyusei_9a', 'kyusei_or', 'kyusei_icu', 'kyusei_er'],
  '慢性': ['mansei'],
  '老年': ['ronen'],
  '精神': ['seishin'],
  '在宅': ['zaitaku'],
};

// 希望順位の大分類名リスト
export const PREFERENCE_CATEGORIES = ['基礎', '母性', '小児', '急性', '慢性', '老年', '精神', '在宅'];

// デフォルトスコア
export const DEFAULT_SCORES = {
  1: 8, 2: 7, 3: 6, 4: 5, 5: 4, 6: 3, 7: 2, 8: 1
};

// ====== 列マッピング候補 ======
export const COLUMN_MAPPINGS = {
  studentId: {
    label: '学生ID',
    required: true,
    candidates: ['学生ID', '学籍番号', 'ID', '学生番号', 'student_id', 'StudentID', '番号', 'No', 'no']
  },
  name: {
    label: '氏名',
    required: true,
    candidates: ['氏名', '名前', '学生名', 'name', 'Name', '学生氏名', 'フルネーム']
  },
  pref1: {
    label: '第1希望',
    required: true,
    candidates: ['第1希望', '第一希望', '希望1', '1st', 'pref1']
  },
  pref2: {
    label: '第2希望',
    required: true,
    candidates: ['第2希望', '第二希望', '希望2', '2nd', 'pref2']
  },
  pref3: {
    label: '第3希望',
    required: true,
    candidates: ['第3希望', '第三希望', '希望3', '3rd', 'pref3']
  },
  pref4: {
    label: '第4希望',
    required: true,
    candidates: ['第4希望', '第四希望', '希望4', '4th', 'pref4']
  },
  pref5: {
    label: '第5希望',
    required: true,
    candidates: ['第5希望', '第五希望', '希望5', '5th', 'pref5']
  },
  pref6: {
    label: '第6希望',
    required: true,
    candidates: ['第6希望', '第六希望', '希望6', '6th', 'pref6']
  },
  pref7: {
    label: '第7希望',
    required: true,
    candidates: ['第7希望', '第七希望', '希望7', '7th', 'pref7']
  },
  pref8: {
    label: '第8希望',
    required: true,
    candidates: ['第8希望', '第八希望', '希望8', '8th', 'pref8']
  },
  hokenshi: {
    label: '保健師課程',
    required: false,
    candidates: ['保健師課程', '保健師', 'hokenshi', '保健師コース']
  },
  yogo: {
    label: '養護教諭課程',
    required: false,
    candidates: ['養護教諭課程', '養護教諭', 'yogo', '養護教諭コース']
  },
  reason: {
    label: '第1希望理由',
    required: false,
    candidates: ['第1希望理由', '第一希望理由', '希望理由1', '理由1', '希望理由', '理由', 'reason', 'Reason', '志望理由', '備考']
  },
  reason2: {
    label: '第2希望理由',
    required: false,
    candidates: ['第2希望理由', '第二希望理由', '希望理由2', '理由2']
  },
  reason3: {
    label: '第3希望理由',
    required: false,
    candidates: ['第3希望理由', '第三希望理由', '希望理由3', '理由3']
  },
  notes: {
    label: '備考',
    required: false,
    candidates: ['備考', 'notes', 'Notes', 'メモ', '特記事項']
  }
};

// ====== 文字列正規化関数 ======

/**
 * 全角英数字を半角に変換
 */
export function zenToHan(str) {
  if (!str) return '';
  return String(str).replace(/[Ａ-Ｚａ-ｚ０-９]/g, ch =>
    String.fromCharCode(ch.charCodeAt(0) - 0xFEE0)
  );
}

/**
 * 半角カタカナを全角に変換
 */
export function hanKataToZen(str) {
  if (!str) return '';
  const map = {
    'ｱ':'ア','ｲ':'イ','ｳ':'ウ','ｴ':'エ','ｵ':'オ',
    'ｶ':'カ','ｷ':'キ','ｸ':'ク','ｹ':'ケ','ｺ':'コ',
    'ｻ':'サ','ｼ':'シ','ｽ':'ス','ｾ':'セ','ｿ':'ソ',
    'ﾀ':'タ','ﾁ':'チ','ﾂ':'ツ','ﾃ':'テ','ﾄ':'ト',
    'ﾅ':'ナ','ﾆ':'ニ','ﾇ':'ヌ','ﾈ':'ネ','ﾉ':'ノ',
    'ﾊ':'ハ','ﾋ':'ヒ','ﾌ':'フ','ﾍ':'ヘ','ﾎ':'ホ',
    'ﾏ':'マ','ﾐ':'ミ','ﾑ':'ム','ﾒ':'メ','ﾓ':'モ',
    'ﾔ':'ヤ','ﾕ':'ユ','ﾖ':'ヨ',
    'ﾗ':'ラ','ﾘ':'リ','ﾙ':'ル','ﾚ':'レ','ﾛ':'ロ',
    'ﾜ':'ワ','ｦ':'ヲ','ﾝ':'ン',
  };
  return str.replace(/[ｱ-ﾝ]/g, ch => map[ch] || ch);
}

/**
 * 文字列を正規化（トリム、全角→半角変換、小文字化）
 */
export function normalizeStr(str) {
  if (!str) return '';
  let s = String(str).trim();
  s = zenToHan(s);
  return s;
}

/**
 * 配置先名を正規化して内部IDに変換
 */
export function normalizePlacementName(name) {
  if (!name) return null;
  let n = normalizeStr(name).toLowerCase();

  // 直接マッチ
  const directMap = {
    '基礎': '基礎',
    '母性': '母性',
    '小児': '小児',
    '急性': '急性',
    '慢性': '慢性',
    '老年': '老年',
    '精神': '精神',
    '在宅': '在宅',
  };

  // 元の名前でマッチ
  const trimmed = String(name).trim();
  for (const [key, val] of Object.entries(directMap)) {
    if (trimmed === key || trimmed.includes(key)) {
      return val;
    }
  }

  return trimmed;
}

/**
 * Yes/No系の値をboolean変換
 */
export function parseBooleanValue(val) {
  if (val === null || val === undefined || val === '') return false;
  const s = normalizeStr(val).toLowerCase();
  return ['yes', '1', 'true', 'はい', '○', '◯', '有', 'y'].includes(s);
}

/**
 * キーワード一致判定（部分一致、正規化済み）
 */
export function matchKeyword(text, keyword) {
  if (!text || !keyword) return false;
  const normalizedText = normalizeStr(text).toLowerCase();
  const normalizedKeyword = normalizeStr(keyword).toLowerCase();
  return normalizedText.includes(normalizedKeyword);
}

/**
 * テキストから強制配置（必須）および禁止配置の制約を抽出する
 * 例: "小児に配置", "急性、慢性には配置しない" 
 * 戻り値: { required: ['shoni'], forbidden: ['kyusei_9a', 'kyusei_or', ..., 'mansei'] }
 */
export function extractPlacementConstraints(text) {
  const result = { required: [], forbidden: [] };
  if (!text) return result;

  const nText = normalizeStr(text).toLowerCase();

  // 否定語句（配置しない、不可、避ける、除外、NG 等）
  const negativeWords = ['しない', '不可', 'さける', '避ける', 'はずす', '外す', 'だめ', 'ダメ', 'ng', '除外', '無理'];
  const hasNegative = negativeWords.some(w => nText.includes(w));

  // 肯定的な指定語句（必須、のみ、限定、確定、絶対 等）
  // または単に「〜に配置」といった強い希望も必須扱いとするか？ 
  // ユーザー要件では「小児に配置」が反映されるか、とのことなので「配置」という言葉があれば対象とする
  const positiveWords = ['必須', 'のみ', '限定', '確定', '絶対', 'に配置'];
  const hasPositive = positiveWords.some(w => nText.includes(w));

  // もし肯定と否定が混在して複雑な場合は、簡易的に全領域名を探して、
  // 文脈（直後に否定語があるか等）で判定する簡易ロジック
  const foundCategories = [];
  for (const cat of PREFERENCE_CATEGORIES) {
    if (nText.includes(cat)) {
      foundCategories.push(cat);
    }
  }

  // もし領域指定がないなら終了
  if (foundCategories.length === 0) return result;

  // 判定ロジック：
  // もし文章全体に否定語句が含まれていれば、見つかった領域を「禁止（forbidden）」とする。
  // それ以外で「配置」などの明確な語句があれば「必須（required）」とする。
  for (const cat of foundCategories) {
    const pIds = CATEGORY_MAP[cat];
    
    // ちょっと高度な判定: 領域名の近くに否定語があるか？
    const catIndex = nText.indexOf(cat);
    const textAfterCat = nText.slice(catIndex, catIndex + 15); // 領域名の後ろ15文字くらい
    
    const isNegativeLocally = negativeWords.some(w => textAfterCat.includes(w));
    
    if (isNegativeLocally) {
      result.forbidden.push(...pIds);
    } else if (hasPositive || nText.includes(cat + 'に配置') || nText.includes(cat + '希望')) {
      // ただ希望理由に書いただけのケースと区別するため、特定の強い語彙がある場合のみ必須とするが、
      // ユーザー要望的に「〜に配置」は必須扱いにする。
      if (hasPositive) {
        result.required.push(...pIds);
      }
    }
  }

  // 重複除去
  result.required = [...new Set(result.required)];
  result.forbidden = [...new Set(result.forbidden)];

  // 万が一同じものが両方に入ったらforbiddenを優先
  result.required = result.required.filter(id => !result.forbidden.includes(id));

  return result;
}

/**
 * Toast通知を表示
 */
export function showToast(message, type = 'success', duration = 3000) {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(30px)';
    toast.style.transition = 'all 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * 配置先IDからラベルを取得
 */
export function getPlacementLabel(id) {
  const p = PLACEMENTS.find(p => p.id === id);
  return p ? p.label : id;
}

/**
 * 配置先IDから色を取得
 */
export function getPlacementColor(id) {
  const p = PLACEMENTS.find(p => p.id === id);
  return p ? p.color : '#888';
}
