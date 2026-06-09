// 旅游策划核心类型定义

// ========== 偏好与场景 ==========

export type SceneType =
  | 'mountain'     // 山川云海
  | 'ocean'        // 海滨星空
  | 'ancient-town' // 古镇漫步
  | 'grassland'    // 草原旷野
  | 'forest'       // 森林秘境
  | 'desert'       // 大漠孤烟
  | 'city'         // 都市霓虹
  | 'snow'         // 冰雪奇缘
  | 'island'       // 海岛度假
  | 'hot-spring'   // 温泉养生
  | 'culture'      // 人文古迹
  | 'adventure'    // 户外探险

export type CompanionType =
  | 'solo'         // 独行
  | 'couple'       // 情侣
  | 'family-young' // 亲子（幼儿）
  | 'family-teen'  // 亲子（青少年）
  | 'family-elder' // 带老人
  | 'friends'      // 朋友结伴
  | 'team'         // 团建

export type BudgetLevel =
  | 'budget'       // 穷游 (<300/天)
  | 'economy'      // 经济 (300-600/天)
  | 'comfort'      // 舒适 (600-1500/天)
  | 'luxury'       // 奢华 (>1500/天)

export type TransportMode =
  | 'high-speed-rail' // 高铁
  | 'flight'          // 飞机
  | 'self-drive'      // 自驾
  | 'mixed'           // 混合

export type Season =
  | 'spring'  // 3-5月
  | 'summer'  // 6-8月
  | 'autumn'  // 9-11月
  | 'winter'  // 12-2月

export type PhysicalConstraint =
  | 'none'           // 无限制
  | 'elderly'        // 老人体力有限
  | 'toddler'        // 幼儿出行
  | 'pregnancy'      // 孕妇
  | 'mobility'       // 行动不便

// ========== 用户输入 ==========

export interface RegionInfo {
  code: string        // 12位行政区划编码
  province: string    // 省名
  city?: string       // 市名
  district?: string   // 区县名
  displayText: string // 完整显示文本 如"四川省 / 成都市 / 武侯区"
}

export interface UserPreferences {
  departure?: RegionInfo      // 出发地
  scenes: SceneType[]          // 偏好场景
  freeText?: string            // 自由文字输入
  destination?: string         // 心仪目的地（如"成都周边"、"丽江"）
  destinationRegion?: RegionInfo // 目的地行政区划（可选，可只选省或市）
  companions: CompanionType[]  // 出行同伴
  duration: number             // 天数
  customDuration?: number      // 自定义天数
  budget: BudgetLevel          // 预算级别
  transport: TransportMode     // 出行方式
  season: Season               // 出行季节
  physicalConstraints: PhysicalConstraint[]  // 物理限制
  specialRequests?: string     // 特别需求（如"想去露营"）
  conflictNote?: string        // 图片与文字冲突时的提示
}

// ========== 问答步骤 ==========

export type WizardStep =
  | 'scene'      // 场景选择
  | 'companion'  // 同伴选择
  | 'duration'   // 天数
  | 'budget'     // 预算
  | 'season'     // 季节
  | 'transport'  // 出行方式
  | 'generate'   // 生成中

export interface WizardStepConfig {
  step: WizardStep
  title: string
  subtitle: string
  index: number
}

// ========== 目的地数据 ==========

export interface Destination {
  id: string
  name: string
  province: string
  region: string                // 所属大区
  scenes: SceneType[]           // 匹配场景
  altitude: number              // 海拔(米)
  altitudeRisk: 'none' | 'low' | 'medium' | 'high'  // 高反风险
  budgetRange: [number, number] // 日均花费范围(元)
  bestSeasons: Season[]         // 最佳季节
  avoidSeasons: Season[]        // 不推荐季节
  accessibility: number         // 交通便利度 1-5
  physicalDemand: number        // 体力要求 1-5
  highlights: string[]          // 亮点
  warnings: string[]            // 注意事项/风险
  tags: string[]                // 搜索标签
  coverImage: string            // 封面图描述
}

export interface ScenicSpot {
  id: string
  name: string
  destinationId: string
  type: SceneType[]
  altitude: number
  visitDuration: number         // 建议游览时长(小时)
  ticketPrice: number           // 门票(元), 0=免费
  physicalDemand: number        // 体力要求 1-5
  accessibility: number         // 无障碍友好度 1-5
  description: string
  tips: string[]
}

// ========== 约束引擎 ==========

export interface ConstraintResult {
  destination: Destination
  score: number                 // 综合匹配分 0-100
  matchedReasons: string[]      // 匹配原因
  warningReasons: string[]      // 风险/不匹配原因
}

// ========== 行程方案 ==========

export interface DayPlan {
  day: number
  title: string
  morning: string
  afternoon: string
  evening: string
  transport: string             // 当日交通
  tips: string[]
  meals: string                 // 餐饮建议
  accommodation: string         // 住宿区域建议
}

export interface TravelPlan {
  id: string
  destination: Destination
  title: string                 // 方案标题，如"成都+九寨沟5日慢旅"
  tagline: string               // 一句话亮点
  totalBudget: [number, number] // 预估总花费范围
  dayPlans: DayPlan[]
  warnings: string[]            // 方案级注意事项
  highlights: string[]          // 方案亮点
  transportOverview: string     // 交通概览
  transportTips?: string        // 出行方式专属贴士
  timelinessNote?: string       // 时效性提示
  surpriseFactor: number        // 惊喜度 1-5 (越高越非常规)
}

// ========== 对话消息 ==========

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
}

// ========== API 请求/响应 ==========

export interface PlanGenerateRequest {
  preferences: UserPreferences
  chatHistory?: ChatMessage[]
}

export interface PlanGenerateResponse {
  plans: TravelPlan[]
  summary: string               // AI总结推荐理由
}

export interface ChatRefineRequest {
  preferences: UserPreferences
  currentPlans: TravelPlan[]
  message: string
  chatHistory: ChatMessage[]
}

export interface IntentParseRequest {
  text: string
  currentPreferences?: Partial<UserPreferences>
}

export interface IntentParseResponse {
  scenes?: SceneType[]
  companions?: CompanionType[]
  budget?: BudgetLevel
  duration?: number
  season?: Season
  transport?: TransportMode
  physicalConstraints?: PhysicalConstraint[]
  specialRequests?: string
  destination?: string
  conflictNote?: string
  confidence: number            // 解析置信度 0-1
  needsClarification: boolean
  clarificationQuestion?: string
}
