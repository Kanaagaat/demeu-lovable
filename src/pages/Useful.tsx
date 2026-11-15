import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Empty, Header, Page } from '../components/support/ui';
import { articleCategory, designArticles, readingMinutes } from '../components/support/articles';
import { useT } from '../i18n';
import { useArticles } from '../lib/hooks';

export default function Useful() {
  const { t, language } = useT(); const resource = useArticles(); const [category, setCategory] = useState<string | null>(null);
  const featured = designArticles(t); const articles = [...featured, ...(resource.data?.items ?? []).filter(item => !featured.some(design => design.id === item.id || design.title === item.title))];
  const rightsCount = articles.filter(item => articleCategory(item.category) === 'rights').length;
  const visible = category ? articles.filter(item => articleCategory(item.category) === category) : articles;
  return <Page className="support-fullscreen"><Header title={t('support.useful')} /><div className="support-content" style={{ gap: 22 }}><div className="support-categories">
    <button className="support-category" style={{ background: '#F5F1FF', outline: category === 'rights' ? '2px solid #6755B2' : undefined }} aria-pressed={category === 'rights'} onClick={() => setCategory(category === 'rights' ? null : 'rights')}><Icon name="shield" size={32} /><div><strong>{t('support.rights')}</strong><small>{rightsCount} {t(`support.articlesForm.${new Intl.PluralRules(language === 'kz' ? 'kk' : 'ru').select(rightsCount)}`)}</small></div></button>
    <button className="support-category" style={{ background: '#FFF8F1', outline: category === 'documents' ? '2px solid #6755B2' : undefined }} aria-pressed={category === 'documents'} onClick={() => setCategory(category === 'documents' ? null : 'documents')}><Icon name="todo-list" size={32} /><div><strong>{t('support.documents')}</strong><small>{t('support.docSub')}</small></div></button>
    <Link className="support-category support-card" to="/resources#communities"><Icon name="groups" size={32} /><div><strong>{t('support.communities')}</strong><small>{t('support.communitySub')}</small></div></Link>
  </div><div><div className="support-section-heading"><h2>{category ? t(`support.${category}`) : t('support.popular')}</h2>{category && <button className="support-text-button" onClick={() => setCategory(null)}>{t('support.allArticles')}</button>}</div><div className="support-stack">{visible.map(item => <Link key={item.id} className="support-card support-article-link" to={`/useful/${encodeURIComponent(item.id)}`}><small style={{ color: articleCategory(item.category) === 'documents' ? '#C6866A' : undefined }}>{t(`support.${articleCategory(item.category)}`)} · {readingMinutes(item)} {t('support.readMinutes')}</small><strong>{item.title}</strong></Link>)}</div>{visible.length === 0 && <Empty title={t('support.emptyArticles')} />}{resource.loading && <p role="status" className="support-muted">{t('support.loading')}</p>}{resource.error && <button className="support-button support-secondary" onClick={resource.reload}>{t('support.retry')}</button>}</div></div></Page>;
}
