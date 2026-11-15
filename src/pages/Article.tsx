import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, Header, Page } from '../components/support/ui';
import { Markdown } from '../components/support/Markdown';
import { articleCategory, designArticles, materialImage, readingMinutes, safeExternalUrl } from '../components/support/articles';
import { useT } from '../i18n';
import { article } from '../lib/api';
import type { Article as ArticleData } from '../lib/types';

export default function Article() {
  const { id = '' } = useParams(); const { t, language } = useT();
  const [result, setResult] = useState<{ id: string; data: ArticleData | null; error: boolean } | null>(null);
  useEffect(() => { let active = true; void article(id).then(response => { if (active) setResult({ id, data: response.data, error: false }); }, () => { if (active) setResult({ id, data: null, error: true }); }); return () => { active = false; }; }, [id]);
  const design = designArticles(t).find(item => item.id === id); const data = result?.id === id && result.data ? result.data : design; const loaded = result?.id === id;
  const external = safeExternalUrl(data?.link ?? null); const image = data ? materialImage(data.id, language) : undefined;
  return <Page className="support-fullscreen"><Header fallback="/useful" /><div className="support-content" style={{ padding: '8px 24px 40px', gap: 16 }}>{data ? <><span className="support-pill" style={{ alignSelf: 'flex-start' }}>{t(`support.${articleCategory(data.category)}`)}</span><h1 style={{ textWrap: 'balance' }}>{data.title}</h1><div className="support-row support-muted" style={{ fontSize: 14, fontWeight: 700, gap: 6 }}><Icon name="hourglass" size={16} />{readingMinutes(data)} {t('support.readMinutes')}</div><Markdown body={data.body} />{image && <a href={image} target="_blank" rel="noopener noreferrer" aria-label={t('support.materialOpenFull')}><img src={image} alt={data.title} style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 18 }} /></a>}{external && <a className="support-button support-secondary" href={external} target="_blank" rel="noopener noreferrer">{new URL(external).hostname} ↗</a>}{data.is_demo && <div style={{ background: '#F4F2F7', borderRadius: 18, padding: '14px 16px', fontSize: 14, lineHeight: '20px', color: '#6E6880' }}>{t('support.demoArticle')}</div>}</> : !loaded ? <p role="status">{t('support.loading')}</p> : <><Empty title={t('support.notFound')} /><Link className="support-button support-secondary" to="/useful">{t('support.backUseful')}</Link></>}</div></Page>;
}
