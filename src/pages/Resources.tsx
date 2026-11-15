import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useT } from '../i18n';
import { useAppState } from '../state/AppState';
import { Icon } from '../components/Icon';
import { Content, Empty, Page } from '../components/plan/ui';
import { LinkRow, linkIcon } from '../components/plan/personal';
import { communitySections, resolveLinks, videoChannels, videoLinks } from '../lib/personalPlan';
import type { Community } from '../lib/types';

type Tab = 'gov' | 'communities' | 'videos';
const GOV_ORDER = ['egov', 'gov4c', 'kursiv_guide', 'mse_news', 'aleumet', 'eotinish', 'social_code', 'edu_ministry', 'enbek_ministry', 'special_edu', 'unicef', 'ozim'];
const kindLabel: Record<string, string> = { site: 'Сайт', facebook: 'Facebook', instagram: 'Instagram', youtube: 'YouTube' };

function CommunityRow({ item }: { item: Community }) {
  const { t } = useT();
  return <a href={item.url} target="_blank" rel="noopener noreferrer" aria-label={`${item.title}, ${item.org}. ${t('plan.externalHint')}`} className="flex items-start gap-3 rounded-[16px] bg-white p-3 text-ink shadow-card">
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#F5F1FF]"><Icon name={linkIcon(item.kind)} size={22} /></span>
    <span className="min-w-0 flex-1"><strong className="block text-[15px] font-extrabold leading-5">{item.title}</strong><small className="block text-[12px] font-bold leading-4 text-brand">{item.org} · {item.city} · {kindLabel[item.kind] ?? item.kind}</small><small className="mt-0.5 block text-[13px] leading-[18px] text-muted">{item.desc}</small></span>
    <Icon name="external-link" size={16} />
  </a>;
}

export default function Resources() {
  const { t, language } = useT();
  const { card } = useAppState();
  const { hash } = useLocation();
  const [tab, setTab] = useState<Tab>(hash === '#videos' ? 'videos' : hash === '#communities' ? 'communities' : 'gov');
  const sections = communitySections(card);
  const videos = videoLinks(card);
  const channels = videoChannels(card);
  const relevant = sections.filter(s => s.relevant), rest = sections.filter(s => !s.relevant);
  const tabs: [Tab, string][] = [['gov', 'resources.tabGov'], ['communities', 'resources.tabCommunities'], ['videos', 'resources.tabVideos']];
  const sectionTitle = (s: { title: string; title_kk: string }) => language === 'kz' ? s.title_kk : s.title;
  return <Page title={t('resources.title')}><Content>
    <div className="pl-segments" role="group">{tabs.map(([id, key]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{t(key)}</button>)}</div>
    {tab === 'gov' && <section className="flex flex-col gap-2.5"><p className="pl-muted !text-[15px] !leading-[22px]">{t('resources.govIntro')}</p>{resolveLinks(GOV_ORDER).map(link => <LinkRow key={link.id} link={link} />)}</section>}
    {tab === 'communities' && <section className="flex flex-col gap-4"><p className="pl-muted !text-[15px] !leading-[22px]">{t('resources.communitiesIntro')}</p>
      {[...relevant, ...rest].map((section, index) => <div key={section.id} className="flex flex-col gap-2"><div className="flex items-center gap-2"><h2 className="!text-[19px] !leading-6">{sectionTitle(section)}</h2>{card && section.relevant && section.id !== 'general' && section.id !== 'parents' && <span className="rounded-full bg-[#EAF2EB] px-2.5 py-[3px] text-xs font-extrabold text-[#4F7454]">{t('resources.forYou')}</span>}</div>
        {index === relevant.length && rest.length > 0 && <span className="sr-only">{t('resources.other')}</span>}
        {section.items.length ? section.items.map(item => <CommunityRow key={item.id} item={item} />) : <p className="pl-muted rounded-[16px] bg-[#F4F2F7] p-3 !text-[14px] !leading-5">{t('resources.noCommunities')}</p>}</div>)}
      <p className="pl-muted !text-[13px] !leading-[18px]">{t('resources.communitiesNote')}</p></section>}
    {tab === 'videos' && <section className="flex flex-col gap-4"><p className="pl-muted !text-[15px] !leading-[22px]">{t('resources.videosIntro')}</p>
      {!card && <Empty mascot="m-laptop" title={t('resources.noCardVideos')} action={<Link to="/quiz" className="pl-primary">{t('resources.fillCard')}</Link>} />}
      {card && <>
        {[['resources.videosParents', videos.parents], ['resources.videosChild', videos.child]].map(([key, list]) => (list as typeof videos.parents).length > 0 && <div key={key as string} id={key === 'resources.videosChild' ? 'child-videos' : undefined} className="flex flex-col gap-2"><h2 className="!text-[19px] !leading-6">{t(key as string)}</h2>{(list as typeof videos.parents).map(video => <a key={video.id} href={video.url} target="_blank" rel="noopener noreferrer" aria-label={`${video.label}. ${t('resources.searchHint')}`} className="flex items-center gap-3 rounded-[16px] bg-white p-3 text-ink shadow-card"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#FFF8F1]"><Icon name="training" size={22} /></span><span className="min-w-0 flex-1"><strong className="block text-[15px] font-extrabold leading-5">{video.label}</strong><small className="block text-[12px] leading-4 text-muted">{t('resources.searchHint')}</small></span><Icon name="external-link" size={16} /></a>)}</div>)}
        {channels.length > 0 && <div className="flex flex-col gap-2"><h2 className="!text-[19px] !leading-6">{t('resources.channels')}</h2>{channels.map(channel => <LinkRow key={channel.id} link={{ id: channel.id, title: channel.title, url: channel.url, kind: 'youtube', desc: channel.desc }} />)}</div>}
      </>}
      <p className="rounded-[16px] bg-[#FFF8F1] p-3.5 !text-[14px] !leading-5">{t('resources.videosNote')}</p></section>}
  </Content></Page>;
}
