import type { Article } from '../../lib/types';
export function designArticles(t: (key: string) => string): Article[] {
  return [
    { id: 'pmpk-guide', title: t('support.pmpkTitle'), body: t('support.pmpkBody'), category: 'rights', tags: ['6'], summary: '', is_demo: true, link: null },
    { id: 'disability-documents', title: t('support.disabilityTitle'), body: t('support.disabilityBody'), category: 'documents', tags: ['4'], summary: '', is_demo: true, link: null },
    { id: 'invataxi-guide', title: t('support.taxiTitle'), body: t('support.taxiBody'), category: 'rights', tags: ['3'], summary: '', is_demo: true, link: null },
    { id: 'benefits-labor', title: t('support.materialLaborTitle'), body: t('support.materialLaborBody'), category: 'rights', tags: ['2'], summary: '', is_demo: false, link: null },
    { id: 'benefits-tax', title: t('support.materialTaxTitle'), body: t('support.materialTaxBody'), category: 'rights', tags: ['2'], summary: '', is_demo: false, link: null },
    { id: 'benefits-housing', title: t('support.materialHousingTitle'), body: t('support.materialHousingBody'), category: 'rights', tags: ['2'], summary: '', is_demo: false, link: null },
  ];
}
/** Info-graphic sheets shown under an article, one file per interface language. */
const MATERIAL_IMAGES: Record<string, { ru: string; kz: string }> = {
  'benefits-labor': { ru: '/materials/labor-ru.jpg', kz: '/materials/labor-kz.jpg' },
  'benefits-tax': { ru: '/materials/tax-ru.jpg', kz: '/materials/tax-kz.jpg' },
  'benefits-housing': { ru: '/materials/housing-ru.jpg', kz: '/materials/housing-kz.jpg' },
};
export function materialImage(id: string, language: string) { const entry = MATERIAL_IMAGES[id]; return entry ? (language === 'kz' ? entry.kz : entry.ru) : undefined; }
export function articleCategory(category: string) {
  if (['rights', 'benefits', 'Права и льготы', 'Льготы'].includes(category)) return 'rights';
  if (['documents', 'Документы'].includes(category)) return 'documents';
  return 'heading';
}
export function readingMinutes(article: Article) { return /^\d+$/.test(article.tags[0] ?? '') ? Number(article.tags[0]) : Math.max(1, Math.ceil(article.body.split(/\s+/).length / 180)); }
export function safeExternalUrl(url: string | null) {
  if (!url) return undefined;
  try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) ? parsed.href : undefined; } catch { return undefined; }
}
