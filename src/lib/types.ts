export type Format = 'Кабинет' | 'На дом' | 'Онлайн';
export type Language = 'Русский' | 'Казахский';
export type Feature = 'РАС' | 'ДЦП' | 'Синдром Дауна' | 'ЗПР / ЗРР' | 'Нарушения слуха' | 'Нарушения зрения' | 'Другое' | 'Пока не знаю / не хочу указывать';
export type Goal = 'Речь' | 'Поведение' | 'Самостоятельность' | 'Моторика' | 'Учёба' | 'Общение';
export type Communication = 'Говорит фразами' | 'Отдельные слова' | 'Пока не говорит' | 'Жесты или карточки';
export type Reaction = 'Спокойно' | 'Нужно время, чтобы привыкнуть' | 'Бывают сильные реакции';
export type Disability = 'Да' | 'Нет' | 'В процессе';

export interface ChildCard {
  name?: string | null;
  age: number;
  district: string;
  features: Feature[];
  comm: Communication;
  react: Reaction;
  goals: Goal[];
  disability: Disability;
}
export type SharedCard = { [K in keyof ChildCard]?: ChildCard[K] | null };
export interface Filters {
  kind?: 'child' | 'parent';
  q?: string;
  specialty?: string[];
  exp?: string[];
  price?: ('free' | 'lt5' | '5_10' | '10_15' | 'gt15')[];
  max_minutes?: number | null;
  district?: string | null;
  format?: Format[];
  group?: boolean | null;
  lang?: Language[];
  verified?: boolean | null;
  sort?: 'best' | 'near' | 'cheap' | 'rating';
}
export interface SpecialistCard {
  id: number;
  kind: 'child' | 'parent';
  name: string;
  short: string;
  initials: string;
  role: string;
  exp_years: number;
  price: number;
  quota: boolean;
  formats: Format[];
  group: boolean;
  languages: Language[];
  experiences: string[];
  verified: boolean;
  rating: number;
  reviews_count: number;
  district: string;
  address: string;
  map_x: number;
  map_y: number;
  tint: string;
  is_demo: boolean;
  travel_minutes: number | null;
  next_slot: string | null;
}
export interface Review {
  id: string;
  specialist_id: number;
  author: string;
  child_context: string;
  child_age: number;
  child_features: string[];
  rating: number;
  text: string;
  date: string | null;
  is_demo: boolean;
}
export interface SlotDay { date: string; label: string; times: string[] }
export interface SpecialistDetail extends SpecialistCard {
  bio: string;
  works_with: string[];
  methods: { name: string; desc: string }[];
  education: string[];
  goals: Goal[];
  reviews: Review[];
  slots: SlotDay[];
}
export interface MatchItem extends SpecialistCard { score: number; match: boolean; reasons: string[] }
/** Legacy template codes of the original /api/plan. The family plan uses string ids from plan_kb.json. */
export type PlanCode = 'pmpk' | 'disability' | 'speech' | 'defect' | 'psych' | 'neuro' | 'rehab' | 'benefits' | 'aba';
export interface PlanStep {
  code: PlanCode;
  title: string;
  subtitle: string;
  why: string;
  docs: string[];
  where: string;
  address: string;
  rights: string;
  specialist_id: number | null;
  minutes: number | null;
  approximate: boolean;
}
export interface BookingRequest {
  specialist_id: number;
  slot: string;
  format: Format;
  shared?: SharedCard;
  message?: string | null;
}
export interface BookingResult { id: string; message: string; wa_url: string }
export interface SavedBooking { id: string; specialist_id: number; slot: string; format: Format; created_at: string; /** Card fields the parent chose to send (privacy screen). */ shared?: SharedCard }
export interface Article { id: string; title: string; summary: string; body: string; category: string; is_demo: boolean; tags: string[]; link: string | null }
export interface Meta { districts: string[]; features: Feature[]; goals: Goal[]; roles: string[]; formats: Format[]; languages: Language[] }
export interface SpecialistList { items: SpecialistCard[]; total: number }
export interface MatchResult { items: MatchItem[]; plan: PlanStep[] }
export interface PlanResult { steps: PlanStep[] }
export interface FeedbackRequest { specialist_id: number; booking_id?: string | null; answers: [boolean, boolean, boolean, boolean]; comment?: string }
export interface FeedbackResult { id: string; suggest_alternatives: boolean; alternatives: SpecialistCard[] }
export interface ReportRequest { specialist_id?: number | null; category: string; text: string }
export interface ChatMessage { role: 'user' | 'assistant'; content: string }
export interface ChatContext { age?: number; features?: string[]; comm?: string; react?: string; goals?: string[]; disability?: string }
export interface ChatRequest { messages: ChatMessage[]; context?: ChatContext; language?: 'ru' | 'kz' }
export interface ChatResult { reply: string[]; offer_psychologist: boolean; crisis: boolean }
export interface ArticlesResult { items: Article[] }
export type Source = 'api' | 'seed';
export interface ApiResponse<T> { data: T; source: Source }

export type SpecialistProfile = Omit<SpecialistDetail, 'travel_minutes' | 'next_slot' | 'reviews' | 'slots'> & {
  schedule: { weekday: number; times: string[] }[];
};
export type PlanTemplate = Omit<PlanStep, 'specialist_id' | 'minutes'> & { specialist_role: string | null };
export interface SeedData {
  specialists: SpecialistProfile[];
  reviews: Review[];
  plan_templates: PlanTemplate[];
  district_minutes: Record<string, Record<string, number>>;
  districts: string[];
  articles: Article[];
  meta: { features: Feature[]; goals: Goal[]; comm: Communication[]; react: Reaction[]; disability: Disability[] };
}

// ---- Family plan (4 stages, built from plan_kb.json on every card; the AI adds comments on top) ----------------
export type StageId = 'clinic' | 'status' | 'benefits' | 'growth';
export interface KbLink { id: string; title: string; url: string; kind: string; desc: string }
export interface PersonalStep {
  id: string; stage: StageId; title: string; title_kk: string; subtitle: string; why: string;
  how: string[]; docs: string[]; where: string; timeline: string; ask: string[];
  links: KbLink[]; age_notes: string[]; internal: { to: string; label: string } | null;
  specialist_id: number | null; specialist_name: string | null; address: string | null; minutes: number | null;
}
export interface PersonalStage { id: StageId; title: string; title_kk: string; hint: string; steps: PersonalStep[] }
export interface PersonalPlan { stages: PersonalStage[]; steps: PersonalStep[] }
export interface PlanAiNote { personal: string; ask: string[] }
export interface PlanAiLayer { generated_by: 'ai'; summary: string; first_week: string[]; notes: Record<string, PlanAiNote> }
export interface Community { id: string; title: string; org: string; city: string; kind: string; url: string; desc: string; sections: string[] }
export interface CommunitySection { id: string; title: string; title_kk: string; items: Community[]; relevant: boolean }
export interface VideoLink { id: string; label: string; url: string; audience: 'parents' | 'child' }
export interface VideoChannel { id: string; title: string; url: string; desc: string }
export type NewsKind = 'news' | 'event' | 'benefit' | 'discount' | 'course';
export interface NewsItem { id: string; kind: NewsKind; audience: 'all' | 'parents' | 'children'; title: string; body: string; link: string | null; event_date: string | null; pinned: boolean }
export interface NewsResult { items: NewsItem[] }
