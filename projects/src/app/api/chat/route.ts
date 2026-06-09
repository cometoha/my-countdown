// 对话细化接口 — 流式输出，支持方案调整和追问
import { NextRequest } from 'next/server';
import { LLMClient, Config, HeaderUtils } from 'coze-coding-dev-sdk';
import type { UserPreferences, TravelPlan, ChatMessage } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { preferences, currentPlans, message, chatHistory } = (await request.json()) as {
      preferences: UserPreferences;
      currentPlans: TravelPlan[];
      message: string;
      chatHistory: ChatMessage[];
    };

    if (!message) {
      return new Response(
        JSON.stringify({ error: '请输入消息' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const currentPlansSummary = currentPlans
      .map(
        (plan) =>
          `【${plan.title}】${plan.tagline}
目的地: ${plan.destination.name}（${plan.destination.province}）
预算: ${plan.totalBudget[0]}-${plan.totalBudget[1]}元
亮点: ${plan.highlights.join('、')}
行程: ${plan.dayPlans.map((d) => d.title).join(' → ')}`
      )
      .join('\n\n');

    const systemPrompt = `你是一位贴心的旅行顾问。用户已经有了初步的旅行方案，现在想和讨论调整细节。

你的职责：
1. 理解用户的调整需求，给出具体的修改建议
2. 如果用户想换目的地，推荐替代选项并说明理由
3. 如果用户觉得行程太赶/太松，重新建议时间分配
4. 主动提醒用户可能没考虑到的因素（如天气、交通、体力）
5. 语气亲切自然，像一个懂旅行的朋友

当前用户偏好：${JSON.stringify(preferences, null, 2)}

当前方案概览：
${currentPlansSummary}

注意：你的回复应该是自然语言，不需要返回 JSON。如果需要修改方案，请说明具体修改建议。`;

    // 构建对话历史
    const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
    ];

    // 加入历史对话
    for (const msg of chatHistory.slice(-6)) {
      messages.push({
        role: msg.role,
        content: msg.content,
      });
    }

    // 加入当前消息
    messages.push({ role: 'user', content: message });

    // 流式输出
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const llmStream = client.stream(messages, {
            model: 'doubao-seed-2-0-lite-260215',
            temperature: 0.8,
          });

          for await (const chunk of llmStream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`)
              );
            }
          }

          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`)
          );
          controller.close();
        } catch (error) {
          console.error('流式输出错误:', error);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: '生成回复失败' })}\n\n`
            )
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    });
  } catch (error) {
    console.error('对话接口失败:', error);
    return new Response(
      JSON.stringify({ error: '对话接口失败' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
