'use client';

import { useState, useCallback } from 'react';
import type {
  UserPreferences,
  WizardStep,
  TravelPlan,
  ChatMessage,
  SceneType,
  CompanionType,
  BudgetLevel,
  Season,
  TransportMode,
  PhysicalConstraint,
  RegionInfo,
} from '@/lib/types';
import {
  sceneCards,
  companionOptions,
  budgetOptions,
  seasonOptions,
  transportOptions,
  durationOptions,
  destinationRegionScenicSpots,
} from '@/data/tourism';
import RegionCascader from '@/components/RegionCascader';

// ========== 主组件 ==========
export default function TravelPlanner() {
  const [phase, setPhase] = useState<'hero' | 'wizard' | 'loading' | 'result'>('hero');
  const [currentStep, setCurrentStep] = useState<WizardStep>('scene');
  const [preferences, setPreferences] = useState<UserPreferences>({
    departure: undefined,
    scenes: [],
    destination: '',
    destinationRegion: undefined,
    companions: [],
    duration: 3,
    budget: 'comfort',
    transport: 'mixed',
    season: 'autumn',
    physicalConstraints: [],
  });
  const [plans, setPlans] = useState<TravelPlan[]>([]);
  const [summary, setSummary] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatStreaming, setChatStreaming] = useState(false);
  const [freeTextInput, setFreeTextInput] = useState('');
  const [destinationInput, setDestinationInput] = useState('');
  const [conflictNote, setConflictNote] = useState('');
  const [departureText, setDepartureText] = useState('');
  const [destinationRegionText, setDestinationRegionText] = useState('');
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [showAdjust, setShowAdjust] = useState(false);
  const [customDuration, setCustomDuration] = useState(3);

  // 步骤配置
  const steps: { key: WizardStep; label: string; index: number }[] = [
    { key: 'scene', label: '场景', index: 0 },
    { key: 'companion', label: '同伴', index: 1 },
    { key: 'duration', label: '天数', index: 2 },
    { key: 'budget', label: '预算', index: 3 },
    { key: 'season', label: '季节', index: 4 },
    { key: 'transport', label: '出行', index: 5 },
  ];

  const currentStepIndex = steps.find((s) => s.key === currentStep)?.index ?? 0;

  // 切换到下一步
  const goNext = useCallback(() => {
    const order: WizardStep[] = ['scene', 'companion', 'duration', 'budget', 'season', 'transport', 'generate'];
    const idx = order.indexOf(currentStep);
    if (idx < order.length - 1) {
      setCurrentStep(order[idx + 1]);
    }
  }, [currentStep]);

  const goPrev = useCallback(() => {
    const order: WizardStep[] = ['scene', 'companion', 'duration', 'budget', 'season', 'transport', 'generate'];
    const idx = order.indexOf(currentStep);
    if (idx > 0) {
      setCurrentStep(order[idx - 1]);
    }
  }, [currentStep]);

  // 生成方案
  const generatePlans = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json() as { plans: TravelPlan[]; summary: string };
      setPlans(data.plans || []);
      setSummary(data.summary || '');
      setPhase('result');
      if (data.plans?.length > 0) {
        setExpandedPlan(data.plans[0].id);
      }
    } catch (err) {
      console.error('方案生成失败:', err);
      setPhase('result');
    }
  }, [preferences]);

  // 重新生成
  const regenerate = useCallback(async () => {
    setPhase('loading');
    try {
      const res = await fetch('/api/plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferences }),
      });
      const data = await res.json() as { plans: TravelPlan[]; summary: string };
      setPlans(data.plans || []);
      setSummary(data.summary || '');
      setPhase('result');
    } catch (err) {
      console.error('重新生成失败:', err);
      setPhase('result');
    }
  }, [preferences]);

  // 处理自由文字输入（意图解析）
  const handleFreeText = useCallback(async () => {
    if (!freeTextInput.trim()) return;
    try {
      const res = await fetch('/api/understand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: freeTextInput,
          currentPreferences: preferences,
        }),
      });
      const data = await res.json() as {
        scenes?: SceneType[];
        companions?: CompanionType[];
        budget?: BudgetLevel;
        duration?: number;
        season?: Season;
        transport?: TransportMode;
        physicalConstraints?: PhysicalConstraint[];
        specialRequests?: string;
        destination?: string;
        conflictNote?: string;
        confidence: number;
        needsClarification: boolean;
        clarificationQuestion?: string;
      };

      // 冲突处理：文字优先，图片补充
      // 如果 LLM 返回了 scenes，说明文字中有明确的场景偏好，用文字结果
      // 如果没有返回 scenes，保留图片选择
      const newScenes = data.scenes?.length ? data.scenes : preferences.scenes;
      
      setPreferences((prev) => ({
        ...prev,
        scenes: newScenes,
        companions: data.companions?.length ? data.companions : prev.companions,
        budget: data.budget || prev.budget,
        duration: data.duration || prev.duration,
        season: data.season || prev.season,
        transport: data.transport || prev.transport,
        physicalConstraints: data.physicalConstraints?.length
          ? data.physicalConstraints
          : prev.physicalConstraints,
        specialRequests: data.specialRequests || prev.specialRequests,
        destination: data.destination || prev.destination,
        conflictNote: data.conflictNote || prev.conflictNote,
      }));

      // 显示冲突提示
      if (data.conflictNote) {
        setConflictNote(data.conflictNote);
      }

      if (data.scenes?.length || data.companions?.length || data.destination) {
        goNext();
      }
      setFreeTextInput('');
    } catch (err) {
      console.error('意图解析失败:', err);
    }
  }, [freeTextInput, preferences, goNext]);

  // 发送聊天消息
  const sendChat = useCallback(async () => {
    if (!chatInput.trim() || chatStreaming) return;
    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: chatInput,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setChatStreaming(true);

    const assistantMsg: ChatMessage = {
      id: `msg-${Date.now() + 1}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, assistantMsg]);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          preferences,
          currentPlans: plans,
          message: chatInput,
          chatHistory: chatMessages,
        }),
      });

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        let fullContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value, { stream: true });
          const lines = text.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const json = JSON.parse(line.slice(6)) as { content?: string; done?: boolean; error?: string };
                if (json.content) {
                  fullContent += json.content;
                  setChatMessages((prev) =>
                    prev.map((m) =>
                      m.id === assistantMsg.id ? { ...m, content: fullContent } : m
                    )
                  );
                }
              } catch {
                // skip malformed chunks
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('聊天失败:', err);
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: '抱歉，回复生成失败，请重试。' }
            : m
        )
      );
    }
    setChatStreaming(false);
  }, [chatInput, chatStreaming, preferences, plans, chatMessages]);

  // ========== 渲染 ==========
  return (
    <div className="min-h-screen bg-[#FAFAF9]">
      {/* Hero 阶段 */}
      {phase === 'hero' && (
        <HeroSection
          departureText={departureText}
          onDepartureChange={(code, displayText, province, city, district) => {
            setDepartureText(displayText);
            setPreferences((p) => ({
              ...p,
              departure: code ? { code, province, city, district, displayText } : undefined,
            }));
          }}
          onStart={() => setPhase('wizard')}
        />
      )}

      {/* 问答引导阶段 */}
      {phase === 'wizard' && (
        <div className="min-h-screen flex flex-col">
          {/* 进度条 */}
          <div className="sticky top-0 z-10 bg-[#FAFAF9]/90 backdrop-blur-sm border-b border-[#E7E5E4] px-6 py-4">
            <div className="max-w-2xl mx-auto">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-[#78716C]">找到你的下一段旅途</span>
                <span className="text-sm text-[#78716C]">{currentStepIndex + 1} / {steps.length}</span>
              </div>
              <div className="flex gap-1.5">
                {steps.map((step) => (
                  <div
                    key={step.key}
                    className={`h-1.5 rounded-full flex-1 transition-all duration-300 ${
                      step.index <= currentStepIndex
                        ? 'bg-[#F97316]'
                        : 'bg-[#E7E5E4]'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* 步骤内容 */}
          <div className="flex-1 flex items-center justify-center px-6 py-12">
            <div className="max-w-2xl w-full step-enter" key={currentStep}>
              {currentStep === 'scene' && (
                <SceneStep
                  selected={preferences.scenes}
                  freeText={freeTextInput}
                  destinationInput={destinationInput}
                  conflictNote={conflictNote}
                  destinationRegionText={destinationRegionText}
                  onFreeTextChange={setFreeTextInput}
                  onFreeTextSubmit={handleFreeText}
                  onDestinationChange={(v) => {
                    setDestinationInput(v);
                    setPreferences((p) => ({ ...p, destination: v }));
                  }}
                  onDestinationRegionChange={(code, displayText, province, city, district) => {
                    setDestinationRegionText(displayText);
                    setPreferences((p) => ({
                      ...p,
                      destinationRegion: code ? { code, province, city, district, displayText } : undefined,
                      destination: displayText || p.destination,
                    }));
                  }}
                  onSelect={(scenes) =>
                    setPreferences((p) => ({ ...p, scenes }))
                  }
                  onNext={goNext}
                />
              )}
              {currentStep === 'companion' && (
                <CompanionStep
                  selected={preferences.companions}
                  onSelect={(companions) => {
                    setPreferences((p) => {
                      const newPrefs = { ...p, companions };
                      // 自动推导物理约束
                      const constraints: PhysicalConstraint[] = [];
                      if (companions.includes('family-elder')) constraints.push('elderly');
                      if (companions.includes('family-young')) constraints.push('toddler');
                      return { ...newPrefs, physicalConstraints: constraints };
                    });
                  }}
                  onNext={goNext}
                  onPrev={goPrev}
                />
              )}
              {currentStep === 'duration' && (
                <DurationStep
                  selected={preferences.duration}
                  customDuration={customDuration}
                  onSelect={(duration) =>
                    setPreferences((p) => ({ ...p, duration }))
                  }
                  onCustomDurationChange={(d) => {
                    setCustomDuration(d);
                    setPreferences((p) => ({ ...p, duration: d }));
                  }}
                  onNext={goNext}
                  onPrev={goPrev}
                />
              )}
              {currentStep === 'budget' && (
                <BudgetStep
                  selected={preferences.budget}
                  onSelect={(budget) =>
                    setPreferences((p) => ({ ...p, budget }))
                  }
                  onNext={goNext}
                  onPrev={goPrev}
                />
              )}
              {currentStep === 'season' && (
                <SeasonStep
                  selected={preferences.season}
                  onSelect={(season) =>
                    setPreferences((p) => ({ ...p, season }))
                  }
                  onNext={goNext}
                  onPrev={goPrev}
                />
              )}
              {currentStep === 'transport' && (
                <TransportStep
                  selected={preferences.transport}
                  onSelect={(transport) =>
                    setPreferences((p) => ({ ...p, transport }))
                  }
                  onGenerate={generatePlans}
                  onPrev={goPrev}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 加载阶段 */}
      {phase === 'loading' && <LoadingSection />}

      {/* 结果阶段 */}
      {phase === 'result' && (
        <div className="min-h-screen">
          {/* 顶栏 */}
          <div className="sticky top-0 z-10 bg-[#FAFAF9]/90 backdrop-blur-sm border-b border-[#E7E5E4] px-6 py-3">
            <div className="max-w-5xl mx-auto flex items-center justify-between">
              <h1 className="text-lg font-semibold text-[#1C1917]">你的旅行方案</h1>
              <div className="flex gap-2">
                <button
                  onClick={() => setPhase('wizard')}
                  className="px-3 py-1.5 text-sm rounded-lg border border-[#E7E5E4] hover:bg-[#F5F5F4] transition-colors flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                  返回修改
                </button>
                <button
                  onClick={() => setShowAdjust(!showAdjust)}
                  className="px-3 py-1.5 text-sm rounded-lg border border-[#E7E5E4] hover:bg-[#F5F5F4] transition-colors"
                >
                  调整条件
                </button>
                <button
                  onClick={() => setShowChat(!showChat)}
                  className="px-3 py-1.5 text-sm rounded-lg bg-[#F97316] text-white hover:bg-[#EA580C] transition-colors"
                >
                  继续聊聊
                </button>
              </div>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-6 py-8">
            {/* AI 总结 */}
            {summary && (
              <div className="mb-8 p-4 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] text-sm text-[#9A3412]">
                {summary}
              </div>
            )}

            {/* 调整面板 */}
            {showAdjust && (
              <AdjustPanel
                preferences={preferences}
                onChange={(newPrefs) => {
                  setPreferences(newPrefs);
                }}
                onRegenerate={regenerate}
              />
            )}

            {/* 方案卡片 */}
            {plans.length === 0 ? (
              <EmptyState onRetry={() => setPhase('wizard')} />
            ) : (
              <div className="space-y-6">
                {plans.map((plan, index) => (
                  <PlanCard
                    key={plan.id}
                    plan={plan}
                    index={index}
                    expanded={expandedPlan === plan.id}
                    onToggle={() =>
                      setExpandedPlan(expandedPlan === plan.id ? null : plan.id)
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* 聊天面板 */}
          {showChat && (
            <ChatPanel
              messages={chatMessages}
              input={chatInput}
              streaming={chatStreaming}
              onInputChange={setChatInput}
              onSend={sendChat}
              onClose={() => setShowChat(false)}
            />
          )}
        </div>
      )}
    </div>
  );
}

// ========== Hero 区域 ==========
function HeroSection({
  departureText,
  onDepartureChange,
  onStart,
}: {
  departureText: string;
  onDepartureChange: (code: string, displayText: string, province: string, city?: string, district?: string) => void;
  onStart: () => void;
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-gradient-to-b from-[#FFF7ED] via-[#FAFAF9] to-[#FAFAF9]">
      <div className="max-w-lg text-center">
        <div className="mb-6">
          <svg className="w-16 h-16 text-[#F97316] mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
        </div>
        <h1 className="text-3xl font-semibold text-[#1C1917] tracking-tight mb-4">
          行途
        </h1>
        <p className="text-[#78716C] text-lg mb-2 leading-relaxed">
          从「想去旅游」到「知道去哪」
        </p>
        <p className="text-[#A8A29E] text-sm mb-8 leading-relaxed">
          回答几个简单问题，5分钟内获得为你量身定制的旅行方案
        </p>

        {/* 出发地选择 */}
        <div className="mb-6 text-left">
          <label className="text-sm text-[#57534E] mb-2 block font-medium">你从哪里出发？</label>
          <RegionCascader
            maxLevel={3}
            required={true}
            placeholder="选择出发城市"
            onChange={onDepartureChange}
          />
          {departureText && (
            <p className="mt-2 text-xs text-[#22C55E] flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              出发地：{departureText}
            </p>
          )}
        </div>

        <button
          onClick={onStart}
          className="px-8 py-3 rounded-xl bg-[#F97316] text-white font-medium text-base hover:bg-[#EA580C] transition-all hover:shadow-lg hover:shadow-orange-200 active:scale-[0.98]"
        >
          开始策划
        </button>
        <p className="mt-6 text-xs text-[#A8A29E]">
          也可以直接告诉我你想去哪 — 稍后在问答中输入即可
        </p>
      </div>
    </div>
  );
}

// ========== 场景选择步骤 ==========
function SceneStep({
  selected,
  freeText,
  destinationInput,
  conflictNote,
  destinationRegionText,
  onFreeTextChange,
  onFreeTextSubmit,
  onDestinationChange,
  onDestinationRegionChange,
  onSelect,
  onNext,
}: {
  selected: SceneType[];
  freeText: string;
  destinationInput: string;
  conflictNote: string;
  destinationRegionText: string;
  onFreeTextChange: (v: string) => void;
  onFreeTextSubmit: () => void;
  onDestinationChange: (v: string) => void;
  onDestinationRegionChange: (code: string, displayText: string, province: string, city?: string, district?: string) => void;
  onSelect: (scenes: SceneType[]) => void;
  onNext: () => void;
}) {
  const toggle = (type: SceneType) => {
    if (selected.includes(type)) {
      onSelect(selected.filter((s) => s !== type));
    } else {
      onSelect([...selected, type]);
    }
  };

  // 根据目的地区域推荐景点
  const scenicSpots = destinationRegionText
    ? destinationRegionScenicSpots[destinationRegionText] ||
      // 尝试只匹配省份
      Object.entries(destinationRegionScenicSpots).find(([key]) =>
        destinationRegionText.startsWith(key)
      )?.[1] || []
    : [];

  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#1C1917] text-center mb-2">
        这次出行，哪个画面最让你心动？
      </h2>
      <p className="text-[#78716C] text-center mb-8">可多选，选错了也没关系</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {sceneCards.map((card) => {
          const isSelected = selected.includes(card.type);
          return (
            <button
              key={card.type}
              onClick={() => toggle(card.type)}
              className={`p-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5 ${
                isSelected
                  ? 'border-[#F97316] bg-[#FFF7ED] shadow-sm'
                  : 'border-[#E7E5E4] bg-white hover:border-[#D6D3D1]'
              }`}
            >
              <div className="text-2xl mb-2">{card.emoji}</div>
              <div className="font-medium text-sm text-[#1C1917] mb-1">
                {card.title}
              </div>
              <div className="text-xs text-[#78716C] leading-relaxed">
                {card.description}
              </div>
            </button>
          );
        })}
      </div>

      {/* 冲突提示 */}
      {conflictNote && (
        <div className="mb-4 p-3 rounded-lg bg-[#FEF3C7] border border-[#FDE68A] text-sm text-[#92400E] flex items-start gap-2">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span>{conflictNote}</span>
        </div>
      )}

      {/* 目的地选择（省市区联动） */}
      <div className="mb-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-[#E7E5E4]" />
          <span className="text-xs text-[#A8A29E]">想去哪里？可选省、市或区</span>
          <div className="h-px flex-1 bg-[#E7E5E4]" />
        </div>
        <RegionCascader
          maxLevel={3}
          required={false}
          placeholder="选择目的地区域"
          onChange={onDestinationRegionChange}
        />
        {/* 景点推荐 */}
        {scenicSpots.length > 0 && (
          <div className="mt-3 step-enter">
            <p className="text-xs text-[#78716C] mb-2">该区域热门景点：</p>
            <div className="flex flex-wrap gap-1.5">
              {scenicSpots.map((spot) => (
                <button
                  key={spot}
                  onClick={() => onDestinationChange(spot)}
                  className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${
                    destinationInput === spot
                      ? 'border-[#F97316] bg-[#FFF7ED] text-[#9A3412]'
                      : 'border-[#E7E5E4] text-[#57534E] hover:border-[#D6D3D1] hover:bg-[#F5F5F4]'
                  }`}
                >
                  {spot}
                </button>
              ))}
            </div>
          </div>
        )}
        {/* 也可以手动输入具体目的地 */}
        <div className="mt-3">
          <input
            type="text"
            value={destinationInput}
            onChange={(e) => onDestinationChange(e.target.value)}
            placeholder="或输入具体目的地，如：崇州金凤山、苍山洱海..."
            className="w-full px-4 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-sm placeholder:text-[#A8A29E] focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] transition-colors"
          />
        </div>
      </div>

      {/* 自由文字输入 */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div className="h-px flex-1 bg-[#E7E5E4]" />
          <span className="text-xs text-[#A8A29E]">或者直接告诉我你想做什么</span>
          <div className="h-px flex-1 bg-[#E7E5E4]" />
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={freeText}
            onChange={(e) => onFreeTextChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && onFreeTextSubmit()}
            placeholder="比如：想去露营、带老人泡温泉、夏天成都周边玩水..."
            className="flex-1 px-4 py-2.5 rounded-lg border border-[#E7E5E4] bg-white text-sm placeholder:text-[#A8A29E] focus:outline-none focus:border-[#F97316] focus:ring-1 focus:ring-[#F97316] transition-colors"
          />
          <button
            onClick={onFreeTextSubmit}
            disabled={!freeText.trim()}
            className="px-4 py-2.5 rounded-lg bg-[#F97316] text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EA580C] transition-colors"
          >
            确定
          </button>
        </div>
        <p className="mt-2 text-xs text-[#A8A29E]">
          输入你想体验的活动、想去的地方，或任何旅行想法，我会智能理解你的需求
        </p>
      </div>

      <div className="flex justify-end">
        <button
          onClick={onNext}
          disabled={selected.length === 0 && !freeText.trim() && !destinationInput.trim()}
          className="px-6 py-2.5 rounded-lg bg-[#F97316] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EA580C] transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}

// ========== 同伴选择步骤 ==========
function CompanionStep({
  selected,
  onSelect,
  onNext,
  onPrev,
}: {
  selected: CompanionType[];
  onSelect: (c: CompanionType[]) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const toggle = (type: CompanionType) => {
    if (selected.includes(type)) {
      onSelect(selected.filter((s) => s !== type));
    } else {
      onSelect([...selected, type]);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#1C1917] text-center mb-2">
        和谁一起去？
      </h2>
      <p className="text-[#78716C] text-center mb-8">可多选，这会影响目的地推荐</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
        {companionOptions.map((opt) => {
          const isSelected = selected.includes(opt.type);
          return (
            <button
              key={opt.type}
              onClick={() => toggle(opt.type)}
              className={`p-4 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5 ${
                isSelected
                  ? 'border-[#F97316] bg-[#FFF7ED] shadow-sm'
                  : 'border-[#E7E5E4] bg-white hover:border-[#D6D3D1]'
              }`}
            >
              <div className="font-medium text-sm text-[#1C1917] mb-1">
                {opt.label}
              </div>
              <div className="text-xs text-[#78716C]">{opt.description}</div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 rounded-lg border border-[#E7E5E4] text-[#78716C] hover:bg-[#F5F5F4] transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          disabled={selected.length === 0}
          className="px-6 py-2.5 rounded-lg bg-[#F97316] text-white font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#EA580C] transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}

// ========== 天数步骤 ==========
function DurationStep({
  selected,
  customDuration,
  onSelect,
  onCustomDurationChange,
  onNext,
  onPrev,
}: {
  selected: number;
  customDuration: number;
  onSelect: (d: number) => void;
  onCustomDurationChange: (d: number) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  const isCustom = selected === 0;

  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#1C1917] text-center mb-2">
        计划玩几天？
      </h2>
      <p className="text-[#78716C] text-center mb-8">1天也能玩得开心，长假可以更深入</p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        {durationOptions.map((opt) => {
          const isSelected = opt.value === 0 ? isCustom : selected === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => onSelect(opt.value)}
              className={`p-4 rounded-xl border-2 text-center transition-all hover:-translate-y-0.5 ${
                isSelected
                  ? 'border-[#F97316] bg-[#FFF7ED] shadow-sm'
                  : 'border-[#E7E5E4] bg-white hover:border-[#D6D3D1]'
              }`}
            >
              <div className="font-semibold text-[#1C1917]">{opt.label}</div>
            </button>
          );
        })}
      </div>

      {/* 自定义天数输入 */}
      {isCustom && (
        <div className="mb-6 p-4 rounded-xl bg-[#FFF7ED] border border-[#FED7AA] step-enter">
          <label className="text-sm text-[#9A3412] mb-2 block">
            输入你想玩的天数：
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={1}
              max={30}
              value={customDuration}
              onChange={(e) => onCustomDurationChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 px-3 py-2 rounded-lg border border-[#E7E5E4] text-center text-sm bg-white focus:outline-none focus:border-[#F97316]"
            />
            <span className="text-sm text-[#78716C]">天</span>
          </div>
        </div>
      )}

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 rounded-lg border border-[#E7E5E4] text-[#78716C] hover:bg-[#F5F5F4] transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-[#F97316] text-white font-medium hover:bg-[#EA580C] transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}

// ========== 预算步骤 ==========
function BudgetStep({
  selected,
  onSelect,
  onNext,
  onPrev,
}: {
  selected: BudgetLevel;
  onSelect: (b: BudgetLevel) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#1C1917] text-center mb-2">
        预算大概多少？
      </h2>
      <p className="text-[#78716C] text-center mb-8">按人均每日花费估算</p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {budgetOptions.map((opt) => {
          const isSelected = selected === opt.level;
          return (
            <button
              key={opt.level}
              onClick={() => onSelect(opt.level)}
              className={`p-5 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5 ${
                isSelected
                  ? 'border-[#F97316] bg-[#FFF7ED] shadow-sm'
                  : 'border-[#E7E5E4] bg-white hover:border-[#D6D3D1]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{opt.icon}</span>
                <span className="font-semibold text-[#1C1917]">{opt.label}</span>
              </div>
              <div className="text-xs text-[#78716C]">{opt.range}</div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 rounded-lg border border-[#E7E5E4] text-[#78716C] hover:bg-[#F5F5F4] transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-[#F97316] text-white font-medium hover:bg-[#EA580C] transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}

// ========== 季节步骤 ==========
function SeasonStep({
  selected,
  onSelect,
  onNext,
  onPrev,
}: {
  selected: Season;
  onSelect: (s: Season) => void;
  onNext: () => void;
  onPrev: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#1C1917] text-center mb-2">
        什么时候出发？
      </h2>
      <p className="text-[#78716C] text-center mb-8">不同季节有完全不同的风景</p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {seasonOptions.map((opt) => {
          const isSelected = selected === opt.season;
          return (
            <button
              key={opt.season}
              onClick={() => onSelect(opt.season)}
              className={`p-5 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5 ${
                isSelected
                  ? 'border-[#F97316] bg-[#FFF7ED] shadow-sm'
                  : 'border-[#E7E5E4] bg-white hover:border-[#D6D3D1]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{opt.icon}</span>
                <span className="font-semibold text-[#1C1917]">{opt.label}</span>
              </div>
              <div className="text-xs text-[#78716C]">{opt.months}</div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 rounded-lg border border-[#E7E5E4] text-[#78716C] hover:bg-[#F5F5F4] transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onNext}
          className="px-6 py-2.5 rounded-lg bg-[#F97316] text-white font-medium hover:bg-[#EA580C] transition-colors"
        >
          下一步
        </button>
      </div>
    </div>
  );
}

// ========== 出行方式步骤 ==========
function TransportStep({
  selected,
  onSelect,
  onGenerate,
  onPrev,
}: {
  selected: TransportMode;
  onSelect: (t: TransportMode) => void;
  onGenerate: () => void;
  onPrev: () => void;
}) {
  return (
    <div>
      <h2 className="text-2xl font-semibold text-[#1C1917] text-center mb-2">
        偏好哪种出行方式？
      </h2>
      <p className="text-[#78716C] text-center mb-8">这会影响路线规划和交通安排</p>

      <div className="grid grid-cols-2 gap-3 mb-8">
        {transportOptions.map((opt) => {
          const isSelected = selected === opt.mode;
          return (
            <button
              key={opt.mode}
              onClick={() => onSelect(opt.mode)}
              className={`p-5 rounded-xl border-2 text-left transition-all hover:-translate-y-0.5 ${
                isSelected
                  ? 'border-[#F97316] bg-[#FFF7ED] shadow-sm'
                  : 'border-[#E7E5E4] bg-white hover:border-[#D6D3D1]'
              }`}
            >
              <div className="font-semibold text-sm text-[#1C1917] mb-1">
                {opt.label}
              </div>
              <div className="text-xs text-[#78716C]">{opt.description}</div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-between">
        <button
          onClick={onPrev}
          className="px-6 py-2.5 rounded-lg border border-[#E7E5E4] text-[#78716C] hover:bg-[#F5F5F4] transition-colors"
        >
          上一步
        </button>
        <button
          onClick={onGenerate}
          className="px-8 py-2.5 rounded-lg bg-[#F97316] text-white font-medium hover:bg-[#EA580C] hover:shadow-lg hover:shadow-orange-200 transition-all"
        >
          生成方案
        </button>
      </div>
    </div>
  );
}

// ========== 加载动画 ==========
function LoadingSection() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-[#FFF7ED] via-[#FAFAF9] to-[#FAFAF9]">
      <div className="text-center">
        <svg className="w-10 h-10 text-[#F97316] mx-auto mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l5.447 2.724A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>
        <h2 className="text-xl font-semibold text-[#1C1917] mb-2">
          正在为你策划旅行方案...
        </h2>
        <p className="text-sm text-[#78716C]">
          综合你的偏好、预算和季节，匹配最适合的目的地
        </p>
        <div className="mt-6 flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-[#F97316] animate-pulse"
              style={{ animationDelay: `${i * 0.3}s` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ========== 方案卡片 ==========
function PlanCard({
  plan,
  index,
  expanded,
  onToggle,
}: {
  plan: TravelPlan;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const planLabels = ['稳妥之选', '深度体验', '惊喜探索'];
  const planColors = ['bg-[#22C55E]', 'bg-[#3B82F6]', 'bg-[#A855F7]'];

  return (
    <div className="rounded-2xl border border-[#E7E5E4] bg-white overflow-hidden transition-all hover:shadow-md">
      {/* 卡片头部 */}
      <button
        onClick={onToggle}
        className="w-full text-left p-5 flex items-start gap-4"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 rounded-full text-xs text-white font-medium ${planColors[index] || 'bg-[#6B7280]'}`}>
              {planLabels[index] || `方案${index + 1}`}
            </span>
            {plan.surpriseFactor >= 4 && (
              <span className="px-2 py-0.5 rounded-full text-xs bg-[#FFF7ED] text-[#9A3412] font-medium">
                小众秘境
              </span>
            )}
          </div>
          <h3 className="text-lg font-semibold text-[#1C1917] mb-1">
            {plan.title}
          </h3>
          <p className="text-sm text-[#78716C]">{plan.tagline}</p>

          {/* 快速信息 */}
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="px-2 py-1 rounded-md bg-[#F5F5F4] text-xs text-[#57534E]">
              {plan.destination.name} · {plan.destination.province}
            </span>
            <span className="px-2 py-1 rounded-md bg-[#F5F5F4] text-xs text-[#57534E]">
              {plan.dayPlans.length}天行程
            </span>
            <span className="px-2 py-1 rounded-md bg-[#F5F5F4] text-xs text-[#57534E]">
              {plan.totalBudget[0]}-{plan.totalBudget[1]}元/人
            </span>
          </div>
        </div>
        <svg
          className={`w-5 h-5 text-[#A8A29E] transition-transform flex-shrink-0 mt-1 ${
            expanded ? 'rotate-180' : ''
          }`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展开内容 */}
      {expanded && (
        <div className="border-t border-[#E7E5E4] p-5 step-enter">
          {/* 交通概览 */}
          <div className="mb-4 p-3 rounded-lg bg-[#F5F5F4]">
            <div className="text-xs text-[#78716C] mb-1">交通概览</div>
            <div className="text-sm text-[#1C1917]">{plan.transportOverview}</div>
          </div>

          {/* 出行方式专属贴士 */}
          {plan.transportTips && (
            <div className="mb-4 p-3 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE]">
              <div className="text-xs text-[#1E40AF] mb-1 font-medium">出行贴士</div>
              <div className="text-sm text-[#1E3A5F] whitespace-pre-line">{plan.transportTips}</div>
            </div>
          )}

          {/* 逐日行程 */}
          <div className="space-y-4">
            {plan.dayPlans.map((day) => (
              <div key={day.day} className="relative pl-6">
                {/* 时间轴点 */}
                <div className="absolute left-0 top-1.5 w-3 h-3 rounded-full bg-[#F97316]" />
                {day.day < plan.dayPlans.length && (
                  <div className="absolute left-1.5 top-4 w-0.5 h-[calc(100%-8px)] bg-[#E7E5E4]" />
                )}

                <div>
                  <h4 className="font-medium text-sm text-[#1C1917] mb-2">
                    {day.title}
                  </h4>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex gap-2">
                      <span className="text-[#A8A29E] w-12 flex-shrink-0">上午</span>
                      <span className="text-[#57534E]">{day.morning}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#A8A29E] w-12 flex-shrink-0">下午</span>
                      <span className="text-[#57534E]">{day.afternoon}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#A8A29E] w-12 flex-shrink-0">晚上</span>
                      <span className="text-[#57534E]">{day.evening}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#A8A29E] w-12 flex-shrink-0">交通</span>
                      <span className="text-[#57534E]">{day.transport}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#A8A29E] w-12 flex-shrink-0">餐饮</span>
                      <span className="text-[#57534E]">{day.meals}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[#A8A29E] w-12 flex-shrink-0">住宿</span>
                      <span className="text-[#57534E]">{day.accommodation}</span>
                    </div>
                  </div>

                  {/* 日贴士 */}
                  {day.tips && day.tips.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {day.tips.map((tip, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded text-xs bg-[#FEF3C7] text-[#92400E]"
                        >
                          {tip}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* 亮点 */}
          {plan.highlights.length > 0 && (
            <div className="mt-5 pt-4 border-t border-[#E7E5E4]">
              <div className="text-xs text-[#78716C] mb-2">方案亮点</div>
              <div className="flex flex-wrap gap-1.5">
                {plan.highlights.map((h, i) => (
                  <span
                    key={i}
                    className="px-2 py-0.5 rounded-full text-xs bg-[#FFF7ED] text-[#9A3412]"
                  >
                    {h}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 注意事项 */}
          {plan.warnings.length > 0 && (
            <div className="mt-4 pt-4 border-t border-[#E7E5E4]">
              <div className="text-xs text-[#78716C] mb-2">注意事项</div>
              <div className="space-y-1">
                {plan.warnings.map((w, i) => (
                  <div key={i} className="flex items-start gap-1.5 text-xs">
                    <span className="text-[#EF4444] mt-0.5">!</span>
                    <span className="text-[#57534E]">{w}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 时效性提示 */}
          {plan.timelinessNote && (
            <div className="mt-3 p-2.5 rounded-lg bg-[#FFFBEB] border border-[#FDE68A]">
              <div className="flex items-start gap-1.5 text-xs">
                <span className="text-[#D97706] mt-0.5">⏱</span>
                <span className="text-[#92400E]">{plan.timelinessNote}</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ========== 调整面板 ==========
function AdjustPanel({
  preferences,
  onChange,
  onRegenerate,
}: {
  preferences: UserPreferences;
  onChange: (p: UserPreferences) => void;
  onRegenerate: () => void;
}) {
  return (
    <div className="mb-6 p-5 rounded-xl border border-[#E7E5E4] bg-white step-enter">
      <h3 className="font-medium text-sm text-[#1C1917] mb-4">调整出行条件</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {/* 出发地 */}
        <div className="col-span-2 sm:col-span-3">
          <label className="text-xs text-[#78716C] mb-1 block">出发地</label>
          <RegionCascader
            maxLevel={3}
            required={true}
            placeholder="选择出发城市"
            onChange={(code, displayText, province, city, district) => {
              onChange({
                ...preferences,
                departure: code ? { code, province, city, district, displayText } : undefined,
              });
            }}
          />
          {preferences.departure && (
            <p className="mt-1 text-xs text-[#22C55E]">当前：{preferences.departure.displayText}</p>
          )}
        </div>

        {/* 预算调整 */}
        <div>
          <label className="text-xs text-[#78716C] mb-1 block">预算</label>
          <select
            value={preferences.budget}
            onChange={(e) =>
              onChange({ ...preferences, budget: e.target.value as BudgetLevel })
            }
            className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm bg-white focus:outline-none focus:border-[#F97316]"
          >
            {budgetOptions.map((b) => (
              <option key={b.level} value={b.level}>
                {b.label} ({b.range})
              </option>
            ))}
          </select>
        </div>

        {/* 天数调整 */}
        <div>
          <label className="text-xs text-[#78716C] mb-1 block">天数</label>
          <select
            value={preferences.duration}
            onChange={(e) =>
              onChange({ ...preferences, duration: parseInt(e.target.value) })
            }
            className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm bg-white focus:outline-none focus:border-[#F97316]"
          >
            {durationOptions.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
        </div>

        {/* 季节调整 */}
        <div>
          <label className="text-xs text-[#78716C] mb-1 block">季节</label>
          <select
            value={preferences.season}
            onChange={(e) =>
              onChange({ ...preferences, season: e.target.value as Season })
            }
            className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm bg-white focus:outline-none focus:border-[#F97316]"
          >
            {seasonOptions.map((s) => (
              <option key={s.season} value={s.season}>
                {s.icon} {s.label} ({s.months})
              </option>
            ))}
          </select>
        </div>

        {/* 出行方式调整 */}
        <div>
          <label className="text-xs text-[#78716C] mb-1 block">出行方式</label>
          <select
            value={preferences.transport}
            onChange={(e) =>
              onChange({ ...preferences, transport: e.target.value as TransportMode })
            }
            className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm bg-white focus:outline-none focus:border-[#F97316]"
          >
            {transportOptions.map((t) => (
              <option key={t.mode} value={t.mode}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        {/* 目的地区域调整 */}
        <div className="col-span-2">
          <label className="text-xs text-[#78716C] mb-1 block">目的地区域</label>
          <RegionCascader
            maxLevel={3}
            required={false}
            placeholder="选择目的地区域"
            onChange={(code, displayText, province, city, district) => {
              onChange({
                ...preferences,
                destinationRegion: code ? { code, province, city, district, displayText } : undefined,
                destination: displayText || preferences.destination,
              });
            }}
          />
        </div>

        {/* 心仪目的地调整 */}
        <div className="col-span-2 sm:col-span-3">
          <label className="text-xs text-[#78716C] mb-1 block">具体目的地</label>
          <input
            type="text"
            value={preferences.destination || ''}
            onChange={(e) =>
              onChange({ ...preferences, destination: e.target.value })
            }
            placeholder="比如：崇州金凤山、苍山洱海..."
            className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm bg-white placeholder:text-[#A8A29E] focus:outline-none focus:border-[#F97316]"
          />
        </div>

        {/* 个人想法/特别需求 */}
        <div className="col-span-2 sm:col-span-3">
          <label className="text-xs text-[#78716C] mb-1 block">个人想法 / 特别需求</label>
          <textarea
            value={preferences.specialRequests || ''}
            onChange={(e) =>
              onChange({ ...preferences, specialRequests: e.target.value })
            }
            placeholder="比如：想吃当地特色美食、想住有山景的民宿、避开人多的景点..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm bg-white placeholder:text-[#A8A29E] focus:outline-none focus:border-[#F97316] resize-none"
          />
        </div>

        {/* 自由描述 */}
        <div className="col-span-2 sm:col-span-3">
          <label className="text-xs text-[#78716C] mb-1 block">自由描述</label>
          <textarea
            value={preferences.freeText || ''}
            onChange={(e) =>
              onChange({ ...preferences, freeText: e.target.value })
            }
            placeholder="用你自己的话描述这次旅行，比如：想带女朋友去一个浪漫的地方，最好有海..."
            rows={2}
            className="w-full px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm bg-white placeholder:text-[#A8A29E] focus:outline-none focus:border-[#F97316] resize-none"
          />
        </div>
      </div>
      <div className="mt-4 flex justify-end">
        <button
          onClick={onRegenerate}
          className="px-5 py-2 rounded-lg bg-[#F97316] text-white text-sm font-medium hover:bg-[#EA580C] transition-colors"
        >
          重新生成方案
        </button>
      </div>
    </div>
  );
}

// ========== 聊天面板 ==========
function ChatPanel({
  messages,
  input,
  streaming,
  onInputChange,
  onSend,
  onClose,
}: {
  messages: ChatMessage[];
  input: string;
  streaming: boolean;
  onInputChange: (v: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-0 right-0 w-full sm:w-96 h-[500px] bg-white border-l border-t border-[#E7E5E4] rounded-tl-2xl shadow-2xl flex flex-col z-50 step-enter">
      {/* 头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E7E5E4]">
        <div className="flex items-center gap-2">
          <span className="text-lg"><svg className="w-5 h-5 text-[#F97316]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg></span>
          <span className="font-medium text-sm text-[#1C1917]">聊聊你的方案</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-[#F5F5F4] transition-colors"
        >
          <svg className="w-4 h-4 text-[#78716C]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-sm text-[#A8A29E]">
              有什么想调整的？比如：
            </p>
            <div className="mt-2 space-y-1">
              {['第3天太赶了', '有没有更小众的地方', '带老人有什么要注意的'].map(
                (suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => onInputChange(suggestion)}
                    className="block mx-auto text-xs text-[#F97316] hover:underline"
                  >
                    {suggestion}
                  </button>
                )
              )}
            </div>
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#F97316] text-white'
                  : 'bg-[#F5F5F4] text-[#1C1917]'
              } ${!msg.content && msg.role === 'assistant' ? 'typing-cursor' : ''}`}
            >
              {msg.content || ' '}
            </div>
          </div>
        ))}
      </div>

      {/* 输入框 */}
      <div className="px-4 py-3 border-t border-[#E7E5E4]">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && onSend()}
            placeholder="说说你想怎么调整..."
            disabled={streaming}
            className="flex-1 px-3 py-2 rounded-lg border border-[#E7E5E4] text-sm bg-white placeholder:text-[#A8A29E] focus:outline-none focus:border-[#F97316] disabled:opacity-50"
          />
          <button
            onClick={onSend}
            disabled={streaming || !input.trim()}
            className="px-3 py-2 rounded-lg bg-[#F97316] text-white text-sm disabled:opacity-40 hover:bg-[#EA580C] transition-colors"
          >
            {streaming ? '...' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ========== 空状态 ==========
function EmptyState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="text-center py-20">
      <svg className="w-10 h-10 text-[#78716C] mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><circle cx="12" cy="10" r="1" fill="currentColor" /></svg>
      <h3 className="text-lg font-medium text-[#1C1917] mb-2">
        暂时没有找到合适的方案
      </h3>
      <p className="text-sm text-[#78716C] mb-6">
        试试放宽一些条件，比如调整预算或季节
      </p>
      <button
        onClick={onRetry}
        className="px-6 py-2.5 rounded-lg bg-[#F97316] text-white font-medium hover:bg-[#EA580C] transition-colors"
      >
        重新选择条件
      </button>
    </div>
  );
}
