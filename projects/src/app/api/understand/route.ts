// 意图理解接口 — 解析用户自由文字输入为结构化偏好
import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import type { IntentParseResponse } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { text, currentPreferences } = await request.json() as {
      text: string;
      currentPreferences?: Record<string, unknown>;
    };

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: '请提供有效的文字输入' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const systemPrompt = `你是一个旅游偏好解析助手。用户会描述他们的旅行想法，你需要从中提取结构化的旅行偏好。

需要提取的字段：
- scenes: 场景类型数组，可选值: mountain, ocean, ancient-town, grassland, forest, desert, city, snow, island, hot-spring, culture, adventure
- companions: 同伴类型数组，可选值: solo, couple, family-young, family-teen, family-elder, friends, team
- budget: 预算级别，可选值: budget, economy, comfort, luxury
- duration: 天数（整数）
- season: 季节，可选值: spring, summer, autumn, winter
- transport: 出行方式，可选值: high-speed-rail, flight, self-drive, mixed
- physicalConstraints: 物理限制数组，可选值: none, elderly, toddler, pregnancy, mobility
- specialRequests: 特殊需求（自由文本）
- destination: 心仪目的地（如用户明确提到某个城市或地区，如"成都周边"、"丽江"、"大理"）

**重要：冲突处理规则**
- 如果用户已选择了图片场景（currentPreferences中有scenes），而文字输入中表达了不同甚至矛盾的场景偏好，以文字为准（文字是更深思熟虑的表达）
- 但如果文字只是补充了新的维度（如文字说"想露营"而图片选了"海滨"，则合并：scenes保留图片选择+加入adventure）
- 如果文字明确与图片冲突（如图片选了"冰雪奇缘"但文字说"夏天成都玩"），需要生成conflictNote提醒用户，同时以文字为准

如果用户输入中无法确定某个字段，就不要返回该字段。
如果用户的描述比较模糊，需要追问，请设置 needsClarification 为 true 并提供 clarificationQuestion。

你必须以 JSON 格式返回，不要有任何其他文字。格式如下：
{
  "scenes": ["..."],
  "companions": ["..."],
  "budget": "...",
  "duration": 数字,
  "season": "...",
  "transport": "...",
  "physicalConstraints": ["..."],
  "specialRequests": "...",
  "destination": "目的地名称",
  "conflictNote": "冲突提示（如果有冲突的话）",
  "confidence": 0.0到1.0之间的数字,
  "needsClarification": true或false,
  "clarificationQuestion": "需要追问的问题（如果需要的话）"
}`;

    const currentPrefsText = currentPreferences
      ? `\n\n用户已选择的偏好：${JSON.stringify(currentPreferences)}`
      : '';

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      {
        role: 'user' as const,
        content: `请解析以下旅行描述：${text}${currentPrefsText}`,
      },
    ];

    const response = await client.invoke(messages, {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.3,
    });

    // 解析 LLM 返回的 JSON
    let parsed: IntentParseResponse;
    try {
      // 尝试从返回内容中提取 JSON
      const content = response.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]) as IntentParseResponse;
      } else {
        parsed = {
          confidence: 0,
          needsClarification: true,
          clarificationQuestion: '你能再详细描述一下你的旅行想法吗？',
        };
      }
    } catch {
      parsed = {
        confidence: 0,
        needsClarification: true,
        clarificationQuestion: '你能再详细描述一下你的旅行想法吗？',
      };
    }

    return NextResponse.json(parsed);
  } catch (error) {
    console.error('意图解析失败:', error);
    return NextResponse.json(
      { error: '意图解析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
