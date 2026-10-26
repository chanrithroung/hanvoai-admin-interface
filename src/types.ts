// Shapes of the /v1/admin API (backend/src/main/java/com/hanvo/api/admin/AdminDtos.java), in camelCase.
// The API leaves null fields out, so anything nullable on the server is optional here.

export type Level = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED'
export const levels: Level[] = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED']

export type Me = { id: string; email?: string; displayName: string }

export type DayStats = { day: string; newLearners: number; sessions: number; activeLearners: number }
export type PlanCount = { planId: string; name: string; subscribers: number }

export type Overview = {
  timezone: string
  totalLearners: number
  newLearners7d: number
  activeLearners7d: number
  sessions7d: number
  practiceMinutes7d: number
  activeSubscribers: number
  subscribersByPlan: PlanCount[]
  topics: number
  activeTopics: number
  lessons: number
  days: DayStats[]
}

export type ScenarioSummary = {
  id: string
  level: Level
  category: string
  titleEn: string
  titleKm: string
  titleZh: string
  active: boolean
  sortOrder: number
  lessonLevels: Level[]
  sessions: number
}

export type ItemKind = 'WORD' | 'PATTERN'
export type LessonItem = { kind: ItemKind; hanzi: string; pinyin: string; en: string; km: string }
export type Lesson = { scenarioId: string; level: Level; objective: string; items: LessonItem[]; roleplay: string }

export type ScenarioDetail = Omit<ScenarioSummary, 'lessonLevels' | 'sessions'> & { goal: string; lessons: Lesson[] }
export type ScenarioRequest = Omit<ScenarioDetail, 'lessons' | 'id'> & { id?: string }
export type LessonRequest = Pick<Lesson, 'objective' | 'roleplay' | 'items'>

export type BillingPeriod = 'MONTHLY' | 'YEARLY'
export type Limits = { planId?: string; dailyTextTurns: number; dailyTranslations: number; dailyVoiceSeconds: number }

export type AdminPlan = Limits & {
  id: string
  name: string
  description: string
  priceCents: number
  currency: string
  billingPeriod: BillingPeriod
  active: boolean
  sortOrder: number
  subscribers: number
  updatedAt: string
}
export type PlansResponse = { freeTier: Limits; plans: AdminPlan[] }
export type PlanRequest = Omit<AdminPlan, 'subscribers' | 'updatedAt' | 'planId' | 'id'> & { id?: string }

export type Status = 'ACTIVE' | 'SUSPENDED'
export type Role = 'LEARNER' | 'ADMIN'
export type Subscription = { planId: string; planName: string; startsAt: string; endsAt?: string; source: string }

export type AdminUser = {
  id: string
  email?: string
  phone?: string
  displayName?: string
  signInMethods: string[]
  status: Status
  role: Role
  level?: Level
  createdAt: string
  lastActiveDay?: string
  sessions: number
  subscription?: Subscription
}
export type UserPage = { items: AdminUser[]; page: number; size: number; total: number }
