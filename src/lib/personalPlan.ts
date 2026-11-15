import kbData from '../data/plan_kb.json';
import { ageText, bestForRole, UNKNOWN } from './engine';
import type { ChildCard, Community, CommunitySection, KbLink, PersonalPlan, PersonalStage, PersonalStep, StageId, VideoChannel, VideoLink } from './types';

/**
 * The family plan skeleton. Stages, steps, documents and official links live in plan_kb.json (reviewed content) and
 * the same rules run on the server (api/app/personal_plan.py): shared/plan_cases.json is checked on both sides.
 * The AI never writes links; it only adds personal comments to these steps.
 */
interface When {
  age_min?: number; age_max?: number; features_any?: string[]; features_none?: string[]; goals_any?: string[];
  disability_in?: string[]; comm_in?: string[]; react_in?: string[]; any_of?: When[];
}
type Condition = When | When[];
interface KbStep {
  id: string; stage: StageId; order: number; title: string; title_kk: string; subtitle: string; why: string;
  how: string[]; docs: string[]; where: string; timeline: string; ask: string[]; links: string[];
  age_notes?: { age_min: number; age_max: number; text: string }[];
  internal?: { to: string; label: string }; specialist_role?: string; when: Condition;
}
interface KbVideo { id: string; audience: 'parents' | 'child'; label: string; query: string; when: Condition }
interface Kb {
  stages: { id: StageId; title: string; title_kk: string; hint: string }[];
  resources: Record<string, { title: string; url: string; kind: string; desc: string }>;
  communities: Community[];
  community_sections: { id: string; title: string; title_kk: string }[];
  feature_sections: Record<string, string>;
  videos: KbVideo[];
  steps: KbStep[];
}
export const KB = kbData as unknown as Kb;

function hasFeature(features: string[], wanted: string[]) {
  const values = features.filter(f => f !== UNKNOWN);
  return wanted.some(w => w === '__none__' ? values.length === 0 : values.includes(w));
}
function matchOne(when: When, card: ChildCard) {
  if (when.age_min !== undefined && card.age < when.age_min) return false;
  if (when.age_max !== undefined && card.age > when.age_max) return false;
  if (when.features_any && !hasFeature(card.features, when.features_any)) return false;
  if (when.features_none && when.features_none.some(f => card.features.includes(f as never))) return false;
  if (when.goals_any && !when.goals_any.some(g => card.goals.includes(g as never))) return false;
  if (when.disability_in && !when.disability_in.includes(card.disability)) return false;
  if (when.comm_in && !when.comm_in.includes(card.comm)) return false;
  if (when.react_in && !when.react_in.includes(card.react)) return false;
  return true;
}
export function matches(when: Condition, card: ChildCard): boolean {
  if (Array.isArray(when)) return when.some(item => matches(item, card));
  return matchOne(when, card) && (!when.any_of || when.any_of.some(item => matches(item, card)));
}

export function resolveLinks(ids: string[]): KbLink[] {
  return ids.flatMap(id => {
    const resource = KB.resources[id];
    if (resource) return [{ id, ...resource }];
    const community = KB.communities.find(c => c.id === id);
    return community ? [{ id, title: community.title, url: community.url, kind: community.kind, desc: community.desc }] : [];
  });
}

export function buildPersonalPlan(card: ChildCard): PersonalPlan {
  const order = new Map(KB.stages.map((stage, index) => [stage.id, index]));
  const chosen = KB.steps.filter(step => matches(step.when, card))
    .sort((a, b) => (order.get(a.stage)! - order.get(b.stage)!) || a.order - b.order);
  const steps: PersonalStep[] = chosen.map(step => {
    const found = step.specialist_role ? bestForRole(card, step.specialist_role) : null;
    return {
      id: step.id, stage: step.stage, title: step.title, title_kk: step.title_kk, subtitle: step.subtitle, why: step.why,
      how: step.how, docs: step.docs, where: found ? found.name : step.where, timeline: step.timeline, ask: step.ask,
      links: resolveLinks(step.links),
      age_notes: (step.age_notes ?? []).filter(n => card.age >= n.age_min && card.age <= n.age_max).map(n => n.text),
      internal: step.internal ?? null,
      specialist_id: found?.id ?? null, specialist_name: found?.name ?? null, address: found?.address ?? null, minutes: found?.minutes ?? null,
    };
  });
  const stages: PersonalStage[] = KB.stages.map(stage => ({ ...stage, steps: steps.filter(step => step.stage === stage.id) })).filter(stage => stage.steps.length);
  return { stages, steps };
}
/** Ids only: used by the parity test against the server rules. */
export const stepIds = (card: ChildCard) => buildPersonalPlan(card).steps.map(step => step.id);

// ---- Communities (grouped by condition) ----------------------------------------------------------------------
export function communitySections(card: ChildCard | null): CommunitySection[] {
  const relevantIds = new Set<string>(['general']);
  for (const feature of card?.features ?? []) { const id = KB.feature_sections[feature]; if (id) relevantIds.add(id); }
  const parents = 'parents';
  const rank = (id: string) => id === parents ? 1 : relevantIds.has(id) ? 0 : 2;
  return KB.community_sections
    .map(section => ({ ...section, items: KB.communities.filter(c => c.sections.includes(section.id)), relevant: relevantIds.has(section.id) || section.id === parents }))
    .sort((a, b) => rank(a.id) - rank(b.id) || KB.community_sections.findIndex(s => s.id === a.id) - KB.community_sections.findIndex(s => s.id === b.id));
}

// ---- Videos: verified channels + searches built from the card -------------------------------------------------
const searchUrl = (query: string) => `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
export function videoLinks(card: ChildCard | null): { parents: VideoLink[]; child: VideoLink[] } {
  const age = card ? ageText(card.age) : '';
  const base: ChildCard = card ?? { age: 0, district: '', features: [], comm: 'Говорит фразами', react: 'Спокойно', goals: [], disability: 'Нет' };
  const picked = KB.videos.filter(video => matches(video.when, base) && (card || Object.keys(video.when).length === 0));
  const make = (video: KbVideo): VideoLink => ({ id: video.id, label: video.label, audience: video.audience, url: searchUrl(video.query.replace('{age}', age).replace(/\s+/g, ' ').trim()) });
  const result = picked.map(make);
  return { parents: result.filter(v => v.audience === 'parents'), child: result.filter(v => v.audience === 'child') };
}
export function videoChannels(card: ChildCard | null): VideoChannel[] {
  const features = card?.features ?? [];
  const channels: VideoChannel[] = [];
  const add = (id: string) => { const c = KB.communities.find(x => x.id === id); if (c) channels.push({ id, title: c.title, url: c.url, desc: c.desc }); };
  if (!card || features.includes('РАС')) add('autism-yt');
  if (!card || features.includes('Синдром Дауна')) add('downsideup-yt');
  return channels;
}
