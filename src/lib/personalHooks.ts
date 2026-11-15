import { useCallback, useEffect, useMemo, useState } from 'react';
import * as api from './api';
import { buildPersonalPlan } from './personalPlan';
import type { ChildCard, PersonalPlan, PlanAiLayer } from './types';

/** The plan skeleton is computed on the device from the card, so it is instant and works offline. */
export function usePersonalPlan(card: ChildCard | null): PersonalPlan | null {
  const key = JSON.stringify(card);
  return useMemo(() => key === 'null' ? null : buildPersonalPlan(JSON.parse(key) as ChildCard), [key]);
}

export type AiStatus = 'idle' | 'loading' | 'ready' | 'error';
export interface AiPlanState { status: AiStatus; data: PlanAiLayer | null; reason: 'offline' | 'timeout' | 'unavailable' | null; retry: () => void }

const TTL = 14 * 86400000;
/** The name and district are not part of the key (and are never sent): only what shapes the plan. */
function cacheKey(card: ChildCard, language: string) {
  const { age, features, comm, react, goals, disability } = card;
  const text = JSON.stringify([age, [...features].sort(), comm, react, [...goals].sort(), disability, language]);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = ((hash << 5) + hash + text.charCodeAt(i)) | 0;
  return `demeu.plan.ai.${(hash >>> 0).toString(36)}`;
}
function readCache(key: string): PlanAiLayer | null {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (raw && typeof raw === 'object' && 'at' in raw && 'data' in raw) {
      const { at, data } = raw as { at: number; data: PlanAiLayer };
      if (Date.now() - at < TTL && data?.generated_by === 'ai' && typeof data.summary === 'string' && data.notes) return data;
    }
  } catch { /* not cached */ }
  return null;
}
const inflight = new Map<string, Promise<PlanAiLayer>>();

/** AI comments for the plan. Cached per card on this device; the plan screen works fully while it is loading. */
export function usePlanAi(card: ChildCard | null, language: 'ru' | 'kz'): AiPlanState {
  const cardJson = JSON.stringify(card);
  const key = useMemo(() => cardJson === 'null' ? null : cacheKey(JSON.parse(cardJson) as ChildCard, language), [cardJson, language]);
  const [state, setState] = useState<Omit<AiPlanState, 'retry'>>({ status: 'idle', data: null, reason: null });
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => { if (key) { try { localStorage.removeItem(key); } catch { /* ignore */ } } setAttempt(n => n + 1); }, [key]);
  useEffect(() => {
    if (!key) { setState({ status: 'idle', data: null, reason: null }); return; }
    const cached = readCache(key);
    if (cached) { setState({ status: 'ready', data: cached, reason: null }); return; }
    let active = true;
    setState({ status: 'loading', data: null, reason: null });
    let request = inflight.get(key);
    if (!request) {
      request = api.planAi(JSON.parse(cardJson) as ChildCard, language).finally(() => inflight.delete(key));
      inflight.set(key, request);
    }
    request.then(data => {
      try { localStorage.setItem(key, JSON.stringify({ at: Date.now(), data })); } catch { /* memory only */ }
      if (active) setState({ status: 'ready', data, reason: null });
    }, (error: unknown) => {
      if (active) setState({ status: 'error', data: null, reason: error instanceof api.AssistantError ? error.kind : 'unavailable' });
    });
    return () => { active = false; };
  }, [key, cardJson, language, attempt]);
  return { ...state, retry };
}
