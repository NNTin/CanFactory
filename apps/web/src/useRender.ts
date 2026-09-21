import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@canfactory/client';
import { RenderRequestSchema, type ModelDetail, type ParameterValues, type Render, type RenderRequest } from '@canfactory/contracts';
import { Value } from 'typebox/value';

interface DesiredRender { key: string; request: RenderRequest }
interface CompletedRender { key: string; render: Render }
const pause = (milliseconds: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(new Error('Request cancelled.')); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
  if (signal.aborted) abort(); else signal.addEventListener('abort', abort, { once: true });
});

/** One outstanding job per mounted editor; newer inputs replace pending work and fence stale results. */
export function useRender(model: ModelDetail, parameters: ParameterValues, valid: boolean) {
  const key = JSON.stringify([model.id, model.version, parameters]);
  const [completed, setCompleted] = useState<CompletedRender | null>(null);
  const [phase, setPhase] = useState<'idle' | 'queued' | 'running'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const latest = useRef<DesiredRender | null>(null);
  const queued = useRef<DesiredRender | null>(null);
  const active = useRef(false);
  const alive = useRef(true);
  const controller = useRef<AbortController | null>(null);
  const isMounted = useCallback(() => alive.current, []);
  const isCurrent = useCallback((inputKey: string) => alive.current && latest.current?.key === inputKey, []);

  const pump = useCallback(async function pumpQueue() {
    const wanted = queued.current;
    if (active.current || !wanted || !isCurrent(wanted.key)) return;
    active.current = true; queued.current = null;
    const abort = new AbortController(); controller.current = abort;
    setPhase('queued'); setError(null);
    try {
      const response = await api.POST('/api/v1/renders', { body: wanted.request, signal: abort.signal });
      if (response.error) throw new Error(response.error.message);
      let result: Render = response.data;
      while (result.status === 'queued' || result.status === 'running') {
        if (isMounted()) setPhase(result.status);
        await pause(1000, abort.signal);
        const status = await api.GET('/api/v1/renders/{id}', { params: { path: { id: result.id } }, signal: abort.signal });
        if (status.error) throw new Error(status.error.message);
        result = status.data;
      }
      if (result.status === 'failed') throw new Error(result.error?.message ?? 'Rendering failed. Please try again.');
      if (isCurrent(wanted.key)) {
        setCompleted({ key: wanted.key, render: result });
        setError(null);
      }
    } catch (caught) {
      if (!abort.signal.aborted && isCurrent(wanted.key))
        setError(caught instanceof Error ? caught.message : 'Cannot reach the renderer. Please try again.');
    } finally {
      active.current = false;
      if (isMounted()) {
        setPhase('idle');
        void pumpQueue();
      }
    }
  }, [isMounted, isCurrent]);

  useEffect(() => {
    const candidate = { modelId: model.id, modelVersion: model.version, parameters };
    latest.current = valid && Value.Check(RenderRequestSchema, candidate) ? { key, request: candidate } : null;
    queued.current = null;
    setError(null);
    const timer = setTimeout(() => {
      queued.current = latest.current;
      void pump();
    }, 500);
    return () => clearTimeout(timer);
  }, [key, valid, model.id, model.version, parameters, attempt, pump]);

  useEffect(() => () => { alive.current = false; controller.current?.abort(); }, []);
  useEffect(() => {
    if (!completed) return;
    const timer = setTimeout(() => {
      setCompleted(null); setAttempt(value => value + 1);
    }, Math.max(0, completed.render.expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [completed]);

  const retry = useCallback(() => { setError(null); setCompleted(null); setAttempt(value => value + 1); }, []);
  return { completed, phase, error, retry, ready: valid && completed?.key === key && !error, key };
}
