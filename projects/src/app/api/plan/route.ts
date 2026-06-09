// 方案生成接口 — LLM + 约束引擎联合输出旅行方案
import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import { SearchClient } from 'coze-coding-dev-sdk';
import type { UserPreferences, TravelPlan, DayPlan } from '@/lib/types';
import { solveConstraints } from '@/lib/constraint-engine';

export async function POST(request: NextRequest) {
  try {
    const { preferences } = await request.json() as {
      preferences: UserPreferences;
    };

    if (!preferences) {
      return NextResponse.json(
        { error: '请提供旅行偏好' },
        { status: 400 }
      );
    }

    // Step 1: 约束引擎筛选目的地
    const constraintResults = solveConstraints(preferences);

    if (constraintResults.length === 0) {
      return NextResponse.json({
        plans: [],
        summary: '根据您的条件暂时没有找到合适的方案，建议放宽一些约束条件再试试。',
      });
    }

    // Step 2: 用 Web Search 获取实时信息（如景点开放状态、近期注意事项）
    let realtimeInfo = '';
    try {
      const searchConfig = new Config();
      const searchCustomHeaders = HeaderUtils.extractForwardHeaders(request.headers);
      const searchClient = new SearchClient(searchConfig, searchCustomHeaders);
      const topDestNames = constraintResults.slice(0, 3).map(r => r.destination.name);
      const seasonMap: Record<string, string> = { spring: '春季', summer: '夏季', autumn: '秋季', winter: '冬季' };
      const searchQuery = `${topDestNames.join('、')} ${seasonMap[preferences.season] || ''}旅游 2025 开放状态 注意事项`;
      const searchResult = await searchClient.webSearch(searchQuery, 3, true);
      if (searchResult?.web_items?.length) {
        realtimeInfo = searchResult.web_items.slice(0, 3).map((item) => `• ${item.title}: ${item.snippet}`).join('\n');
      }
    } catch {
      // web search 失败不影响主流程
    }

    // Step 3: 取 TOP 3 目的地，用 LLM 生成详细方案
    const topDestinations = constraintResults.slice(0, 3);
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const destinationInfo = topDestinations
      .map(
        (r) =>
          `目的地: ${r.destination.name}（${r.destination.province}）
- 匹配分: ${r.score}/100
- 匹配原因: ${r.matchedReasons.join('；')}
- 风险提示: ${r.warningReasons.join('；') || '无'}
- 海拔: ${r.destination.altitude}米
- 日均花费: ${r.destination.budgetRange[0]}-${r.destination.budgetRange[1]}元
- 最佳季节: ${r.destination.bestSeasons.join('/')}
- 亮点: ${r.destination.highlights.join('、')}
- 注意事项: ${r.destination.warnings.join('；')}
- 体力要求: ${r.destination.physicalDemand}/5
- 交通便利度: ${r.destination.accessibility}/5`
      )
      .join('\n\n');

    // 出行方式对应的专属注意事项
    const transportTipsMap: Record<string, string> = {
      'self-drive': `自驾出行注意事项：
- 出发前检查车辆状况（轮胎、刹车、油量/电量）
- 提前规划沿途充电桩/加油站位置（新能源车尤其注意充电桩间距）
- 关注沿途高速路况和天气（山区路段可能有团雾、结冰）
- 准备应急物品：备胎、千斤顶、充电线、急救包
- 长途驾驶每2小时休息15分钟，避免疲劳驾驶
- 偏远地区（新疆、西藏、青海）注意加油站间距大，半箱油即加
- 冬季自驾需备防滑链，关注封路信息
- 高原自驾注意高反对驾驶的影响，切勿剧烈运动`,
      'high-speed-rail': `高铁出行注意事项：
- 提前购票，节假日和旺季建议提前15-30天
- 大件行李注意尺寸限制（长宽高之和不超过130cm）
- 到站后提前查好接驳交通（公交/地铁/打车）
- 偏远目的地可能需要转车，预留充足中转时间`,
      'flight': `飞机出行注意事项：
- 提前2小时到达机场，关注航班动态
- 行李托运注意重量和禁运物品
- 到达后机场通常离市区较远，提前安排接驳
- 高原目的地（拉萨、九寨沟等）注意落地后高反，当天不要剧烈活动`,
      'mixed': `混合出行注意事项：
- 不同交通方式之间预留充足中转时间
- 注意行李在不同交通工具间的搬运便利性
- 根据各段路况灵活调整出行方式`,
    };

    const transportTips = transportTipsMap[preferences.transport] || transportTipsMap['mixed'];

    const systemPrompt = `你是一位资深的中国旅游策划师，擅长根据用户需求量身定制旅行方案。

核心原则：
1. 方案必须切实可行，不能有交通不衔接、时间不够等问题
2. 3个方案之间必须有明确差异——不同风格、不同体验深度、不同惊喜度
3. 第1个方案是最稳妥的推荐，第2个方案偏向深度体验，第3个方案要有惊喜感（可能是小众目的地或非常规玩法）
4. 每日行程要具体到上午/下午/晚上的安排
5. 要考虑交通时间，不能一天安排3个距离很远的景点
6. 要标注注意事项和风险
7. 1天行程安排当日往返（早上出发、晚上返回），不要安排住宿
8. 出行方式的注意事项必须详细具体

输出格式：严格按 JSON 格式返回，不要有任何其他文字：
{
  "plans": [
    {
      "title": "方案标题",
      "tagline": "一句话亮点",
      "destinationId": "目的地ID",
      "totalBudget": [最低总花费, 最高总花费],
      "transportOverview": "交通概览（包含出发到目的地的大交通方式、时间、费用估算）",
      "transportTips": "出行方式专属注意事项（根据用户的出行方式给出详细贴士）",
      "highlights": ["亮点1", "亮点2"],
      "warnings": ["注意事项1", "注意事项2"],
      "timelinessNote": "时效性提示（如：以上信息基于2025年数据，部分景点开放状态和价格可能变动，建议出发前通过官方渠道确认）",
      "dayPlans": [
        {
          "day": 1,
          "title": "第X天标题",
          "morning": "上午安排",
          "afternoon": "下午安排",
          "evening": "晚上安排",
          "transport": "当日交通（含具体方式、预计时间和费用）",
          "tips": ["贴士1"],
          "meals": "餐饮建议",
          "accommodation": "住宿区域建议（1天行程写'当日返回，无需住宿'）"
        }
      ]
    }
  ],
  "summary": "总结推荐理由"
}`;

    const userMessage = `用户偏好：
- 出发地: ${preferences.departure?.displayText || '未指定（请在方案中标注"请根据实际出发地调整交通安排"）'}
- 想去的场景: ${preferences.scenes.join('、') || '未指定'}
- 出行人数/同伴: ${preferences.companions.join('、') || '未指定'}
- 天数: ${preferences.duration === 1 ? '1天当日往返' : preferences.duration + '天'}
- 预算: ${preferences.budget}（日均${preferences.budget === 'budget' ? '<300' : preferences.budget === 'economy' ? '300-600' : preferences.budget === 'comfort' ? '600-1500' : '>1500'}元）
- 出行季节: ${preferences.season}
- 出行方式: ${preferences.transport}
- 物理限制: ${preferences.physicalConstraints.join('、') || '无'}
${preferences.destinationRegion ? `- 目的地区域: ${preferences.destinationRegion.displayText}` : ''}
${preferences.destination ? `- 心仪目的地: ${preferences.destination}` : ''}
${preferences.specialRequests ? `- 特别需求: ${preferences.specialRequests}` : ''}
${preferences.freeText ? `- 自由描述: ${preferences.freeText}` : ''}
${preferences.conflictNote ? `- 注意: ${preferences.conflictNote}` : ''}

关键约束（必须严格遵守）：
1. 【行程可行性】出发地到目的地的大交通时间必须合理。例如：自驾1天往返的行程，单程驾车不应超过2.5小时；高铁1天往返，单程不应超过2小时。如果出发地到目的地当天往返不可能，必须提醒用户。
2. 【1天行程限制】1天当日往返的方案，只推荐出发地周边200km以内的目的地。行程中必须明确标注"早上XX:XX从出发地出发"，"晚上XX:XX返回出发地"，时间安排要合理，不能出现凌晨出发或深夜返回的情况。
3. 【自驾时间】自驾行程中，每天驾车总时长不应超过6小时（含往返），避免疲劳驾驶。
4. 【物理限制】如果用户有老人/幼儿/孕妇同行，不得推荐高海拔（>2500米）或体力要求高的行程。

${transportTips ? `出行方式专属贴士（请整合到方案中）：\n${transportTips}` : ''}

可选目的地（已按匹配度排序）：

${destinationInfo}

${realtimeInfo ? `实时搜索信息（供参考，需整合到方案中）：\n${realtimeInfo}` : ''}

请基于以上信息，为用户生成3个差异化的旅行方案。`;

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userMessage },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-lite-260215',
      temperature: 0.7,
    });

    // 解析 LLM 返回的方案
    let plans: TravelPlan[] = [];
    let summary = '';

    try {
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as {
          plans: TravelPlan[];
          summary: string;
        };
        summary = parsed.summary || '';

        // 将约束结果中的目的地信息补充到方案中
        plans = parsed.plans.map((plan: TravelPlan, index: number) => {
          const constraintResult = topDestinations[index];
          return {
            ...plan,
            id: `plan-${index}`,
            destination: constraintResult?.destination || topDestinations[0].destination,
            surpriseFactor: index === 0 ? 2 : index === 1 ? 3 : 4,
          };
        });
      }
    } catch (e) {
      console.error('解析方案失败:', e);
      // fallback: 用约束结果直接生成简化方案
      plans = topDestinations.slice(0, 3).map((result, index) => {
        const dest = result.destination;
        const dayPlans: DayPlan[] = Array.from(
          { length: preferences.duration },
          (_, i) => ({
            day: i + 1,
            title: `第${i + 1}天`,
            morning: `游览${dest.highlights[i % dest.highlights.length] || '当地景点'}`,
            afternoon: '自由探索当地特色',
            evening: '品尝当地美食，休息调整',
            transport: '步行或当地交通',
            tips: dest.warnings.slice(0, 2),
            meals: '当地特色餐饮',
            accommodation: `${dest.name}市区酒店`,
          })
        );

        return {
          id: `plan-${index}`,
          destination: dest,
          title: `${dest.name}${preferences.duration}日${index === 0 ? '经典游' : index === 1 ? '深度游' : '秘境游'}`,
          tagline: result.matchedReasons[0] || `发现${dest.name}的魅力`,
          totalBudget: [
            dest.budgetRange[0] * preferences.duration,
            dest.budgetRange[1] * preferences.duration,
          ],
          dayPlans,
          warnings: result.warningReasons,
          highlights: dest.highlights.slice(0, 3),
          transportOverview: '详见每日行程',
          surpriseFactor: index === 0 ? 2 : index === 1 ? 3 : 4,
        };
      });
      summary = `根据您的偏好，为您推荐了${plans.length}个方案，从经典到惊喜各有特色。`;
    }

    return NextResponse.json({ plans, summary });
  } catch (error) {
    console.error('方案生成失败:', error);
    return NextResponse.json(
      { error: '方案生成失败，请稍后重试' },
      { status: 500 }
    );
  }
}
