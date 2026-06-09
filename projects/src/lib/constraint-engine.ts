// 约束求解引擎
// 根据用户偏好对目的地进行过滤、评分和排序

import type {
  Destination,
  UserPreferences,
  ConstraintResult,
  SceneType,
  Season,
  BudgetLevel,
  PhysicalConstraint,
  CompanionType,
} from '@/lib/types';
import { destinations } from '@/data/tourism';

// ========== 预算日均映射 ==========
const budgetDailyRange: Record<BudgetLevel, [number, number]> = {
  budget: [0, 300],
  economy: [300, 600],
  comfort: [600, 1500],
  luxury: [1500, Infinity],
};

// ========== 高反风险与物理约束的冲突矩阵 ==========
type AltitudeRisk = 'none' | 'low' | 'medium' | 'high';

const altitudeConstraintConflict: Record<PhysicalConstraint, AltitudeRisk[]> = {
  none: [],
  elderly: ['medium', 'high'],
  toddler: ['low', 'medium', 'high'],
  pregnancy: ['low', 'medium', 'high'],
  mobility: ['low', 'medium', 'high'],
};

// ========== 同伴类型的体力限制 ==========
const companionPhysicalDemand: Record<CompanionType, number> = {
  solo: 5,
  couple: 4,
  'family-young': 2,
  'family-teen': 3,
  'family-elder': 2,
  friends: 4,
  team: 3,
};

// ========== 核心评分函数 ==========
function scoreDestination(
  dest: Destination,
  prefs: UserPreferences
): ConstraintResult {
  let score = 50; // 基础分
  const matchedReasons: string[] = [];
  const warningReasons: string[] = [];

  // 1. 场景匹配 (+0~30分)
  const sceneOverlap = prefs.scenes.filter((s) => dest.scenes.includes(s));
  if (sceneOverlap.length > 0) {
    const sceneScore = Math.min(30, sceneOverlap.length * 15);
    score += sceneScore;
    matchedReasons.push(`匹配你偏好的${sceneOverlap.map((s) => sceneLabel(s)).join('、')}场景`);
  } else {
    score -= 20;
    warningReasons.push('场景类型与你的偏好不太匹配');
  }

  // 2. 预算匹配 (+0~15分)
  const [budgetMin, budgetMax] = budgetDailyRange[prefs.budget];
  const [destBudgetMin, destBudgetMax] = dest.budgetRange;
  if (destBudgetMin <= budgetMax && destBudgetMax >= budgetMin) {
    score += 15;
    matchedReasons.push(`${budgetLabel(prefs.budget)}预算可覆盖`);
  } else if (destBudgetMin > budgetMax) {
    score -= 15;
    warningReasons.push('消费水平可能超出你的预算');
  } else {
    score += 5;
    matchedReasons.push('消费低于你的预算，可以升级体验');
  }

  // 3. 季节匹配 (+0~15分)
  if (dest.bestSeasons.includes(prefs.season)) {
    score += 15;
    matchedReasons.push(`${seasonLabel(prefs.season)}是最佳出行季节`);
  } else if (dest.avoidSeasons.includes(prefs.season)) {
    score -= 15;
    warningReasons.push(`${seasonLabel(prefs.season)}不是推荐的出行季节`);
  } else {
    score += 5;
  }

  // 4. 物理约束检查 (-0~30分)
  for (const constraint of prefs.physicalConstraints) {
    const conflicts = altitudeConstraintConflict[constraint];
    if ((conflicts as AltitudeRisk[]).includes(dest.altitudeRisk)) {
      score -= 30;
      warningReasons.push(`海拔${dest.altitude}米，${constraintLabel(constraint)}不建议前往`);
    }
  }

  // 5. 同伴体力匹配 (+0~10分)
  const maxPhysicalDemand = Math.max(
    ...prefs.companions.map((c) => companionPhysicalDemand[c])
  );
  if (dest.physicalDemand <= maxPhysicalDemand) {
    score += 10;
    matchedReasons.push('体力要求与同行人匹配');
  } else {
    score -= 10;
    warningReasons.push(`体力要求较高（${dest.physicalDemand}/5），同行人可能吃不消`);
  }

  // 6. 交通便利度调整 (+0~5分)
  if (prefs.transport === 'self-drive') {
    // 自驾对交通便利度要求低
    score += Math.max(0, (3 - dest.accessibility) * 0); // 不加分不扣分
  } else {
    score += dest.accessibility; // 1-5分
  }

  // 7. 惊喜度加成 — 小众目的地加分
  if (dest.accessibility <= 2) {
    score += 5;
    matchedReasons.push('小众秘境，惊喜度高');
  }

  // 8. 心仪目的地匹配（强加权）
  if (prefs.destination) {
    const input = prefs.destination.toLowerCase();
    const nameMatch = dest.name.toLowerCase().includes(input) || input.includes(dest.name.toLowerCase());
    const provinceMatch = dest.province.toLowerCase().includes(input) || input.includes(dest.province.toLowerCase());
    const tagMatch = dest.tags.some((tag) => input.includes(tag) || tag.includes(input));
    if (nameMatch || provinceMatch) {
      score += 25;
      matchedReasons.push(`符合你心仪的目的地"${prefs.destination}"`);
    } else if (tagMatch) {
      score += 15;
      matchedReasons.push(`与你想去的"${prefs.destination}"相关`);
    }
  }

  // 9. 特殊需求关键词匹配
  if (prefs.specialRequests) {
    const req = prefs.specialRequests.toLowerCase();
    const matched = dest.tags.some((tag) => req.includes(tag) || tag.includes(req));
    if (matched) {
      score += 10;
      matchedReasons.push(`满足你的特殊需求"${prefs.specialRequests}"`);
    }
  }

  // 10. 自由文字输入匹配
  if (prefs.freeText) {
    const freeText = prefs.freeText.toLowerCase();
    const matched = dest.tags.some(
      (tag) => freeText.includes(tag) || tag.includes(freeText)
    );
    if (matched) {
      score += 8;
      matchedReasons.push('与你的描述匹配');
    }
  }

  // 确保分数在0-100之间
  score = Math.max(0, Math.min(100, score));

  return {
    destination: dest,
    score,
    matchedReasons,
    warningReasons,
  };
}

// ========== 主筛选函数 ==========
export function solveConstraints(prefs: UserPreferences): ConstraintResult[] {
  const results = destinations.map((dest) => scoreDestination(dest, prefs));

  // 按分数降序排列
  results.sort((a, b) => b.score - a.score);

  // 过滤掉严重冲突的（分数 < 20 的基本不可行）
  const viable = results.filter((r) => r.score >= 20);

  // 确保结果中有差异化：
  // - 取top 5中至少1个小众目的地（accessibility <= 2）
  // - 避免同一省份出现3个以上

  const topResults = viable.slice(0, 10);
  const finalResults: ConstraintResult[] = [];
  const provinceCount: Record<string, number> = {};

  for (const result of topResults) {
    const province = result.destination.province;
    if ((provinceCount[province] || 0) < 2) {
      finalResults.push(result);
      provinceCount[province] = (provinceCount[province] || 0) + 1;
    }
  }

  // 确保至少包含1个小众目的地
  const hasNiche = finalResults.some((r) => r.destination.accessibility <= 2);
  if (!hasNiche) {
    const niche = viable.find(
      (r) =>
        r.destination.accessibility <= 2 &&
        !finalResults.some((f) => f.destination.id === r.destination.id)
    );
    if (niche && finalResults.length >= 3) {
      finalResults[finalResults.length - 1] = niche; // 替换最后一个
    } else if (niche) {
      finalResults.push(niche);
    }
  }

  return finalResults.slice(0, 5);
}

// ========== 标签辅助函数 ==========
function sceneLabel(scene: SceneType): string {
  const labels: Record<SceneType, string> = {
    mountain: '山川',
    ocean: '海滨',
    'ancient-town': '古镇',
    grassland: '草原',
    forest: '森林',
    desert: '大漠',
    city: '都市',
    snow: '冰雪',
    island: '海岛',
    'hot-spring': '温泉',
    culture: '人文',
    adventure: '探险',
  };
  return labels[scene];
}

function seasonLabel(season: Season): string {
  const labels: Record<Season, string> = {
    spring: '春季',
    summer: '夏季',
    autumn: '秋季',
    winter: '冬季',
  };
  return labels[season];
}

function budgetLabel(budget: BudgetLevel): string {
  const labels: Record<BudgetLevel, string> = {
    budget: '穷游',
    economy: '经济',
    comfort: '舒适',
    luxury: '奢华',
  };
  return labels[budget];
}

function constraintLabel(constraint: PhysicalConstraint): string {
  const labels: Record<PhysicalConstraint, string> = {
    none: '',
    elderly: '老人',
    toddler: '幼儿',
    pregnancy: '孕妇',
    mobility: '行动不便者',
  };
  return labels[constraint];
}
