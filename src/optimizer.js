/**
 * optimizer.js — 整数計画法による配置最適化エンジン
 * GLPK.js (WebAssembly) を使用して学生配置を最適化する
 */

import { getState } from './state.js';
import {
  PLACEMENTS, CATEGORY_MAP, DEFAULT_SCORES,
  matchKeyword, getPlacementLabel, extractPlacementConstraints
} from './utils.js';

/**
 * GLPK.jsを動的にロードする
 */
let glpkInstance = null;
async function getGLPK() {
  if (glpkInstance) return glpkInstance;
  const GLPK = (await import('glpk.js')).default;
  glpkInstance = await GLPK();
  return glpkInstance;
}

/**
 * 学生iが配置先jに割り当てられた場合の希望順位点を計算する
 */
function calcPreferenceScore(student, placementId, scores) {
  const placement = PLACEMENTS.find(p => p.id === placementId);
  if (!placement) return 0;

  // 配置先IDが属する大分類を取得
  let categoryName = placement.label;
  if (placement.category === 'acute') {
    categoryName = '急性';
  }

  // 学生の希望順位で一致を探す
  for (let rank = 0; rank < student.preferences.length; rank++) {
    if (student.preferences[rank] === categoryName) {
      return scores[rank + 1] || 0;
    }
  }

  return 0; // 希望に入っていない場合
}

/**
 * 学生iが配置先jに割り当てられた場合のキーワード加点を計算する
 */
function calcKeywordBonus(student, placementId, keywordRules) {
  if (!student.reason) return 0;

  let totalBonus = 0;
  for (const rule of keywordRules) {
    if (rule.placement === placementId && matchKeyword(student.reason, rule.keyword)) {
      totalBonus += (rule.bonus || 0);
    }
  }
  return totalBonus;
}

/**
 * 配置先jが学生の第何希望かを返す (1-indexed, 見つからない場合は0)
 */
function getPreferenceRank(student, placementId) {
  const placement = PLACEMENTS.find(p => p.id === placementId);
  if (!placement) return 0;

  let categoryName = placement.label;
  if (placement.category === 'acute') {
    categoryName = '急性';
  }

  for (let rank = 0; rank < student.preferences.length; rank++) {
    if (student.preferences[rank] === categoryName) {
      return rank + 1;
    }
  }
  return 0;
}

/**
 * メインの最適化関数
 * @returns {Object} { assignments, stats, feasible }
 */
export async function runOptimization(onProgress) {
  const state = getState();
  const { students, capacities, scores, dispersion, keywordRules } = state;

  if (students.length === 0) {
    throw new Error('学生データが読み込まれていません');
  }

  // 定員チェック
  const totalCapacity = Object.values(capacities).reduce((s, v) => s + (parseInt(v) || 0), 0);
  if (totalCapacity < students.length) {
    throw new Error(
      `定員合計(${totalCapacity}名)が学生数(${students.length}名)より少ないため、配置できません。定員設定を確認してください。`
    );
  }

  if (onProgress) onProgress('GLPKソルバーを初期化中...', 10);

  const glpk = await getGLPK();

  if (onProgress) onProgress('最適化モデルを構築中...', 30);

  const n = students.length;
  const placements = PLACEMENTS.filter(p => (parseInt(capacities[p.id]) || 0) > 0);
  const m = placements.length;

  if (m === 0) {
    throw new Error('有効な配置先がありません。定員を1以上に設定してください。');
  }

  // ---- GLPK モデル構築 ----
  const vars = [];       // 変数名リスト
  const objective = [];  // 目的関数の係数

  // 変数命名: x_i_j (学生i, 配置先j)
  const varName = (i, j) => `x_${i}_${j}`;

  // 目的関数の係数（第2段階用：スコア最大化）
  const stage2Objective = [];
  // 目的関数の係数（第1段階用：第5希望以下最小化）
  const stage1Objective = [];
  const badPlacementVars = []; // 第5希望以下の変数リスト

  for (let i = 0; i < n; i++) {
    for (let jIdx = 0; jIdx < m; jIdx++) {
      const pId = placements[jIdx].id;
      const vn = varName(i, jIdx);
      vars.push(vn);

      // 希望順位点と加点
      const prefScore = calcPreferenceScore(students[i], pId, scores);
      const kwBonus = calcKeywordBonus(students[i], pId, keywordRules);
      stage2Objective.push({ name: vn, coef: prefScore + kwBonus });

      // 第5希望以下の判定
      const rank = getPreferenceRank(students[i], pId);
      if (rank >= 5 || rank === 0) {
        stage1Objective.push({ name: vn, coef: -1 }); // 最大化問題なので負にする
        badPlacementVars.push({ name: vn, coef: 1 });
      } else {
        stage1Objective.push({ name: vn, coef: 0 });
      }
    }
  }

  // 制約条件（必須）
  const subjectTo = [];
  // 制約条件（緩和可能）
  const optionalConstraints = [];

  // 制約1: 各学生は正確に1つの配置先
  for (let i = 0; i < n; i++) {
    const constraint = {
      name: `student_${i}`,
      vars: [],
      bnds: { type: glpk.GLP_FX, ub: 1.0, lb: 1.0 },
    };
    for (let jIdx = 0; jIdx < m; jIdx++) {
      constraint.vars.push({ name: varName(i, jIdx), coef: 1.0 });
    }
    subjectTo.push(constraint);
  }

  // 制約2: 各配置先は定員以内
  for (let jIdx = 0; jIdx < m; jIdx++) {
    const pId = placements[jIdx].id;
    const cap = parseInt(capacities[pId]) || 0;
    const constraint = {
      name: `cap_${jIdx}`,
      vars: [],
      bnds: { type: glpk.GLP_UP, ub: cap, lb: 0 },
    };
    for (let i = 0; i < n; i++) {
      constraint.vars.push({ name: varName(i, jIdx), coef: 1.0 });
    }
    subjectTo.push(constraint);
  }

  // 制約2.5: 第1希望集中領域の保護（定員以上に第1希望がいる場合、その領域は第1希望の学生だけが配置される）
  for (let jIdx = 0; jIdx < m; jIdx++) {
    const pId = placements[jIdx].id;
    const cap = parseInt(capacities[pId]) || 0;
    
    // この領域を第1希望としている学生数をカウント
    let firstPrefCount = 0;
    for (let i = 0; i < n; i++) {
      if (getPreferenceRank(students[i], pId) === 1) {
        firstPrefCount++;
      }
    }
    
    // 第1希望の学生数が定員以上の場合、第1希望でない学生をこの領域に配置しない
    if (cap > 0 && firstPrefCount >= cap) {
      for (let i = 0; i < n; i++) {
        if (getPreferenceRank(students[i], pId) !== 1) {
          optionalConstraints.push({
            name: `protect_first_${i}_${jIdx}`,
            vars: [{ name: varName(i, jIdx), coef: 1.0 }],
            bnds: { type: glpk.GLP_FX, ub: 0.0, lb: 0.0 }, // 第1希望以外の配置を禁止
          });
        }
      }
    }
  }

  // 制約3: 備考欄からの強制配置・禁止配置
  for (let i = 0; i < n; i++) {
    const mergedText = [students[i].reason, students[i].reason2, students[i].reason3, students[i].notes].filter(Boolean).join(' ');
    const constraints = extractPlacementConstraints(mergedText);
    
    // 強制配置 (required) : 指定されたいずれかに配置する
    if (constraints.required && constraints.required.length > 0) {
      const constraint = {
        name: `req_${i}`,
        vars: [],
        bnds: { type: glpk.GLP_FX, ub: 1.0, lb: 1.0 },
      };
      let added = false;
      for (const pId of constraints.required) {
        const jIdx = placements.findIndex(p => p.id === pId);
        if (jIdx !== -1) {
          constraint.vars.push({ name: varName(i, jIdx), coef: 1.0 });
          added = true;
        }
      }
      if (added) subjectTo.push(constraint);
    }

    // 禁止配置 (forbidden) : 指定されたすべてに配置しない
    if (constraints.forbidden && constraints.forbidden.length > 0) {
      for (const pId of constraints.forbidden) {
        const jIdx = placements.findIndex(p => p.id === pId);
        if (jIdx !== -1) {
          subjectTo.push({
            name: `forbid_${i}_${jIdx}`,
            vars: [{ name: varName(i, jIdx), coef: 1.0 }],
            bnds: { type: glpk.GLP_FX, ub: 0.0, lb: 0.0 },
          });
        }
      }
    }
  }

  // 偏りペナルティ（ソフト制約として補助変数の導入）
  // 各配置先における課程比率が全体平均に近くなるようペナルティを課す
  const penaltyVars = [];
  const dispersionStrength = {
    hokenshi: parseFloat(dispersion.hokenshi) || 0,
    yogo: parseFloat(dispersion.yogo) || 0,
  };

  // 保健師課程の偏り抑制
  if (dispersionStrength.hokenshi > 0) {
    const hokenCount = students.filter(s => s.hokenshi).length;
    if (hokenCount > 0) {
      const avgRatio = hokenCount / n;

      for (let jIdx = 0; jIdx < m; jIdx++) {
        const cap = parseInt(capacities[placements[jIdx].id]) || 0;
        if (cap === 0) continue;

        // 偏差変数 d_h_j+ と d_h_j-
        const dpName = `dh_p_${jIdx}`;
        const dmName = `dh_m_${jIdx}`;
        penaltyVars.push(dpName, dmName);

        // 目的関数にペナルティ追加（偏差を最小化 = 負の係数で足す、第2段階のみ）
        stage2Objective.push({ name: dpName, coef: -dispersionStrength.hokenshi });
        stage2Objective.push({ name: dmName, coef: -dispersionStrength.hokenshi });
        stage1Objective.push({ name: dpName, coef: 0 });
        stage1Objective.push({ name: dmName, coef: 0 });

        // 制約: Σ_i (hokenshi[i] * x[i][j]) - avgRatio * Σ_i x[i][j] = d+ - d-
        // => Σ_i (hokenshi[i] - avgRatio) * x[i][j] - d+ + d- = 0
        const constraint = {
          name: `hoken_balance_${jIdx}`,
          vars: [],
          bnds: { type: glpk.GLP_FX, ub: 0, lb: 0 },
        };

        for (let i = 0; i < n; i++) {
          const coef = (students[i].hokenshi ? 1 : 0) - avgRatio;
          if (Math.abs(coef) > 1e-9) {
            constraint.vars.push({ name: varName(i, jIdx), coef: coef });
          }
        }
        constraint.vars.push({ name: dpName, coef: -1 });
        constraint.vars.push({ name: dmName, coef: 1 });
        subjectTo.push(constraint);
      }
    }
  }

  // 養護教諭課程の偏り抑制
  if (dispersionStrength.yogo > 0) {
    const yogoCount = students.filter(s => s.yogo).length;
    if (yogoCount > 0) {
      const avgRatio = yogoCount / n;

      for (let jIdx = 0; jIdx < m; jIdx++) {
        const cap = parseInt(capacities[placements[jIdx].id]) || 0;
        if (cap === 0) continue;

        const dpName = `dy_p_${jIdx}`;
        const dmName = `dy_m_${jIdx}`;
        penaltyVars.push(dpName, dmName);

        stage2Objective.push({ name: dpName, coef: -dispersionStrength.yogo });
        stage2Objective.push({ name: dmName, coef: -dispersionStrength.yogo });
        stage1Objective.push({ name: dpName, coef: 0 });
        stage1Objective.push({ name: dmName, coef: 0 });

        const constraint = {
          name: `yogo_balance_${jIdx}`,
          vars: [],
          bnds: { type: glpk.GLP_FX, ub: 0, lb: 0 },
        };

        for (let i = 0; i < n; i++) {
          const coef = (students[i].yogo ? 1 : 0) - avgRatio;
          if (Math.abs(coef) > 1e-9) {
            constraint.vars.push({ name: varName(i, jIdx), coef: coef });
          }
        }
        constraint.vars.push({ name: dpName, coef: -1 });
        constraint.vars.push({ name: dmName, coef: 1 });
        subjectTo.push(constraint);
      }
    }
  }

  // 二値変数の定義
  const binaries = [];
  for (let i = 0; i < n; i++) {
    for (let jIdx = 0; jIdx < m; jIdx++) {
      binaries.push(varName(i, jIdx));
    }
  }

  // ペナルティ変数は連続変数（>=0の制約をgeneralsではなくboundsで）
  const generals = [];

  // ペナルティ変数にはboundsが必要（非負制約）
  const bounds = penaltyVars.length > 0 ? penaltyVars.map(v => ({
    name: v,
    type: glpk.GLP_LO,
    lb: 0,
    ub: 0,
  })) : [];

  if (onProgress) onProgress('第1段階：第5希望以下の配置を最小化中...', 40);

  // === 第1段階（辞書式最適化）：第5希望以下人数を最小化 ===
  const lpStage1 = {
    name: 'stage1_minimize_bad_placements',
    objective: { direction: glpk.GLP_MAX, name: 'obj_stage1', vars: stage1Objective },
    subjectTo: [...subjectTo, ...optionalConstraints], // まずは厳密な制約で試す
    binaries: binaries,
    generals: generals,
    bounds: bounds,
  };

  let res1;
  let usedSubjectTo = lpStage1.subjectTo;

  try {
    res1 = await glpk.solve(lpStage1, { msglev: glpk.GLP_MSG_OFF, tmlim: 30 });
    
    // もし optionalConstraints を含めた状態（第1希望保護あり）で Infeasible になった場合は、制約を緩和してリトライ
    if (res1.result.status !== glpk.GLP_OPT && res1.result.status !== glpk.GLP_FEAS) {
      if (optionalConstraints.length > 0) {
        if (onProgress) onProgress('第1希望保護制約による解なしを検知。保護を一部解除して再計算します...', 45);
        lpStage1.subjectTo = subjectTo; // 必須制約のみで再試行
        res1 = await glpk.solve(lpStage1, { msglev: glpk.GLP_MSG_OFF, tmlim: 30 });
        usedSubjectTo = subjectTo;
      }
    }
  } catch (err) {
    throw new Error(`第1段階の最適化計算中にエラーが発生しました: ${err.message}`);
  }

  if (res1.result.status !== glpk.GLP_OPT && res1.result.status !== glpk.GLP_FEAS) {
    throw new Error('最適な配置が見つかりませんでした。定員設定や制約条件を見直してください。');
  }

  // 第1段階で得られた「第5希望以下になる人数の最小値」
  const minBadCount = -Math.round(res1.result.z);
  
  if (onProgress) onProgress(`第2段階：得点を最大化中... (第5希望以下対象人数: ${minBadCount}名)`, 60);

  // === 第2段階：第1段階の条件を満たしつつ総得点を最大化 ===
  const stage2SubjectTo = [
    ...usedSubjectTo, // 第1段階で成功した制約セットを引き継ぐ
    {
      name: 'limit_bad_placements',
      vars: badPlacementVars,
      bnds: { type: glpk.GLP_UP, lb: 0, ub: minBadCount }
    }
  ];

  const lpStage2 = {
    name: 'stage2_maximize_score',
    objective: { direction: glpk.GLP_MAX, name: 'obj_stage2', vars: stage2Objective },
    subjectTo: stage2SubjectTo,
    binaries: binaries,
    generals: generals,
    bounds: bounds,
  };

  let result;
  try {
    result = await glpk.solve(lpStage2, { msglev: glpk.GLP_MSG_OFF, tmlim: 30 });
  } catch (err) {
    throw new Error(`第2段階の最適化計算中にエラーが発生しました: ${err.message}`);
  }

  if (onProgress) onProgress('結果を集計中...', 80);

  // 結果チェック
  if (result.result.status !== glpk.GLP_OPT && result.result.status !== glpk.GLP_FEAS) {
    throw new Error(
      '最適な配置が見つかりませんでした。定員設定や制約条件を見直してください。'
    );
  }

  // 結果の抽出 (一旦 rawAssignments に保存)
  const rawAssignments = [];
  for (let i = 0; i < n; i++) {
    let assignedPlacement = null;
    let maxVal = 0;

    for (let jIdx = 0; jIdx < m; jIdx++) {
      const vn = varName(i, jIdx);
      const val = result.result.vars[vn] || 0;
      if (val > maxVal) {
        maxVal = val;
        assignedPlacement = placements[jIdx].id;
      }
    }

    if (!assignedPlacement) {
      // フォールバック: 最初の利用可能な配置先
      assignedPlacement = placements[0].id;
    }

    rawAssignments.push({
      studentIndex: i,
      student: students[i],
      placementId: assignedPlacement
    });
  }

  // 交差解消（パレート改善スワップ）処理
  // 学生Aと学生Bで、お互いに相手の配置先の方が希望順位が高い場合に入れ替える
  // これにより「希望順位の逆転（交差）」による不公平感を排除する
  const getRankOrHigh = (stu, pId) => {
    const r = getPreferenceRank(stu, pId);
    return r === 0 ? 999 : r; // 希望外は極めて低い優先度として扱う
  };

  let swapped;
  let swapCount = 0;
  do {
    swapped = false;
    for (let a = 0; a < rawAssignments.length; a++) {
      for (let b = a + 1; b < rawAssignments.length; b++) {
        const studentA = rawAssignments[a].student;
        const studentB = rawAssignments[b].student;
        const pIdA = rawAssignments[a].placementId;
        const pIdB = rawAssignments[b].placementId;
        
        if (pIdA === pIdB) continue; // 同じ配置先ならスワップ意味なし

        // 強制・禁止制約を破らないかチェック
        const mergedTextA = [studentA.reason, studentA.reason2, studentA.reason3, studentA.notes].filter(Boolean).join(' ');
        const mergedTextB = [studentB.reason, studentB.reason2, studentB.reason3, studentB.notes].filter(Boolean).join(' ');
        const constraintsA = extractPlacementConstraints(mergedTextA);
        const constraintsB = extractPlacementConstraints(mergedTextB);

        // 学生AがpIdBに移動しても制約違反にならないか
        if (constraintsA.forbidden.includes(pIdB)) continue;
        if (constraintsA.required.length > 0 && !constraintsA.required.includes(pIdB)) continue;
        
        // 学生BがpIdAに移動しても制約違反にならないか
        if (constraintsB.forbidden.includes(pIdA)) continue;
        if (constraintsB.required.length > 0 && !constraintsB.required.includes(pIdA)) continue;

        // 現在のランク
        const rankA_curr = getRankOrHigh(studentA, pIdA);
        const rankB_curr = getRankOrHigh(studentB, pIdB);
        // スワップした場合のランク
        const rankA_swap = getRankOrHigh(studentA, pIdB);
        const rankB_swap = getRankOrHigh(studentB, pIdA);

        // 両者にとって「希望順位が上がる（rankの数値が小さくなる）」ならスワップ
        if (rankA_swap < rankA_curr && rankB_swap < rankB_curr) {
          rawAssignments[a].placementId = pIdB;
          rawAssignments[b].placementId = pIdA;
          swapped = true;
          swapCount++;
        }
      }
    }
  } while (swapped);

  if (swapCount > 0) {
    if (onProgress) onProgress(`交差解消のため ${swapCount} 件の配置スワップを実行しました`, 90);
  }

  // 最終的なアサインメント情報を構築
  const assignments = [];
  for (const rA of rawAssignments) {
    const stu = rA.student;
    const pId = rA.placementId;

    const rank = getPreferenceRank(stu, pId);
    const prefScore = calcPreferenceScore(stu, pId, scores);
    const kwBonus = calcKeywordBonus(stu, pId, keywordRules);

    assignments.push({
      studentId: stu.id,
      name: stu.name,
      placement: pId,
      placementLabel: getPlacementLabel(pId),
      rank: rank,
      baseScore: prefScore,
      keywordBonus: kwBonus,
      totalScore: prefScore + kwBonus,
      hokenshi: stu.hokenshi,
      yogo: stu.yogo,
      reason: stu.reason,
      reason2: stu.reason2,
      reason3: stu.reason3,
      notes: stu.notes,
      constraints: extractPlacementConstraints([stu.reason, stu.reason2, stu.reason3, stu.notes].filter(Boolean).join(' ')), // 結果表示用に追加
    });
  }

  // 統計計算
  const stats = calcStats(assignments, placements, capacities);

  if (onProgress) onProgress('完了！', 100);

  return {
    assignments,
    stats,
    feasible: true,
    objectiveValue: result.result.z,
  };
}

/**
 * 統計を計算する
 */
function calcStats(assignments, placements, capacities) {
  const n = assignments.length;
  const totalScore = assignments.reduce((s, a) => s + a.totalScore, 0);
  const avgScore = n > 0 ? totalScore / n : 0;

  // 希望順位別人数
  const rankCounts = {};
  for (let r = 1; r <= 8; r++) rankCounts[r] = 0;
  rankCounts[0] = 0; // 希望外
  assignments.forEach(a => {
    if (a.rank >= 1 && a.rank <= 8) {
      rankCounts[a.rank]++;
    } else {
      rankCounts[0]++;
    }
  });

  // 配置先別人数
  const placementCounts = {};
  const placementHokenshi = {};
  const placementYogo = {};
  PLACEMENTS.forEach(p => {
    placementCounts[p.id] = 0;
    placementHokenshi[p.id] = 0;
    placementYogo[p.id] = 0;
  });

  assignments.forEach(a => {
    placementCounts[a.placement] = (placementCounts[a.placement] || 0) + 1;
    if (a.hokenshi) placementHokenshi[a.placement] = (placementHokenshi[a.placement] || 0) + 1;
    if (a.yogo) placementYogo[a.placement] = (placementYogo[a.placement] || 0) + 1;
  });

  return {
    studentCount: n,
    assignedCount: assignments.filter(a => a.placement).length,
    totalScore,
    avgScore: Math.round(avgScore * 100) / 100,
    rankCounts,
    placementCounts,
    placementHokenshi,
    placementYogo,
  };
}
