import type { ReactNode } from 'react';
import { safeExternalUrl } from './articles';

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    const match = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (match) { const href = safeExternalUrl(match[2]); return href ? <a key={i} href={href} target="_blank" rel="noopener noreferrer">{match[1]}</a> : match[1]; }
    return part;
  });
}
export function Markdown({ body }: { body: string }) {
  const lines = body.replace(/\r\n/g, '\n').split('\n'); const blocks: ReactNode[] = [];
  for (let i = 0; i < lines.length;) {
    if (!lines[i].trim()) { i++; continue; }
    const heading = /^(#{1,3})\s+(.+)$/.exec(lines[i]);
    if (heading) { blocks.push(heading[1].length < 3 ? <h2 key={i}>{inline(heading[2])}</h2> : <h3 key={i}>{inline(heading[2])}</h3>); i++; continue; }
    const list = /^(?:[-*]|\d+\.)\s+/.test(lines[i]);
    if (list) {
      const ordered = /^\d+\./.test(lines[i]); const start = i; const items: ReactNode[] = [];
      const matcher = ordered ? /^\d+\.\s+(.*)$/ : /^[-*]\s+(.*)$/;
      while (i < lines.length) { const item = matcher.exec(lines[i]); if (!item) break; items.push(<li key={i}>{inline(item[1])}</li>); i++; }
      blocks.push(ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>); continue;
    }
    const start = i; const paragraph: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(?:#{1,3}\s|[-*]\s|\d+\.\s)/.test(lines[i])) { paragraph.push(lines[i]); i++; }
    if (paragraph.length === 0) { paragraph.push(lines[i]); i++; }
    blocks.push(<p key={start}>{inline(paragraph.join(' '))}</p>);
  }
  return <div className="support-article-body">{blocks}</div>;
}
