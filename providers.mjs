// providers.mjs — REAL provider adapters for the cascade.
//
// cascade.mjs deliberately takes providers as injected functions so the kernel stays pure and
// deterministic. That leaves one gap: nothing shipped an adapter that actually talks to a model, so
// T2 was a tier with nothing behind it. This closes that — a local Ollama adapter, plus the
// deterministic T0 and a consent-gated remote adapter, all matching the provider contract:
//
//     (prompt, ctx) => { text, confidence } | null      null/undefined = decline
//
// Two properties are preserved deliberately:
//   · a provider that cannot reach its backend DECLINES (returns null) rather than throwing, so the
//     cascade descends instead of failing — an unreachable local host must not break the system.
//   · the remote adapter is a plain adapter with no privileges. It cannot bypass consent, because
//     consent is enforced in the cascade before any provider is invoked at all.
//
// `fetchImpl` is injectable so the adapters are testable without a network and without a live host.

export const OLLAMA_DEFAULT = 'http://localhost:11434';

// Measured on ordinary desktop hardware: the 7B answers in ~9s warm, the 14B in ~24s, and both were
// correct on the same check. So the 7B is the workhorse tier and the 14B is the deliberate escalation
// — which is exactly how the ladder is meant to be used, since the cascade only descends when the
// cheaper tier declines. Ollama unloads an idle model, so keeping the fast one resident matters.
export const LOCAL_FAST = 'qwen2.5:7b';    // T2   · the workhorse
export const LOCAL_DEEP = 'qwen2.5:14b';   // T2.5 · heavier local, for quality over latency

// ── T0 · deterministic. Answers only what needs no model, and declines everything else. ──
export function builtinProvider(answers = {}) {
  return prompt => {
    const key = String(prompt == null ? '' : prompt).trim().toLowerCase();
    if (!key) return null;
    const hit = Object.entries(answers).find(([k]) => k.toLowerCase() === key);
    return hit ? { text: String(hit[1]), confidence: 1 } : null;
  };
}

// ── T2 · your local Ollama host. Declines (never throws) when the host or model is unavailable. ──
export function ollamaProvider({ model = LOCAL_FAST, host = OLLAMA_DEFAULT, fetchImpl, timeoutMs = 120000, confidence = 0.8 } = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const fn = async (prompt, ctx) => {
    if (!doFetch) return null;                                   // no transport here — decline, do not throw
    const p = String(prompt == null ? '' : prompt);
    if (!p) return null;
    const body = { model, prompt: p, stream: false, options: { temperature: 0 } };
    if (ctx && ctx.system) body.system = String(ctx.system);
    try {
      const res = await doFetch(`${host}/api/generate`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
        signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
      });
      if (!res || !res.ok) return null;                          // host up but refused — decline
      const j = await res.json();
      const text = j && typeof j.response === 'string' ? j.response.trim() : '';
      return text ? { text, confidence } : null;                 // empty answer is a decline, not an answer
    } catch { return null; }                                     // unreachable / timeout — decline, descend
  };
  fn.tier = 'T2'; fn.model = model; fn.host = host;
  return fn;
}

// ── T3/T4 · a remote endpoint under the operator's own key. Holds no special privilege: the cascade
//    decides whether it is ever called, so this adapter cannot escalate on its own. ──
export function remoteProvider({ url, apiKey, model, fetchImpl, timeoutMs = 60000, confidence = 0.95, tier = 'T4' } = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  const fn = async (prompt, ctx) => {
    if (!doFetch || !url || !apiKey) return null;                // not configured — decline
    const p = String(prompt == null ? '' : prompt);
    if (!p) return null;
    try {
      const res = await doFetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages: [...(ctx && ctx.system ? [{ role: 'system', content: String(ctx.system) }] : []), { role: 'user', content: p }] }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined,
      });
      if (!res || !res.ok) return null;
      const j = await res.json();
      const text = j?.choices?.[0]?.message?.content?.trim() || '';
      return text ? { text, confidence } : null;
    } catch { return null; }
  };
  fn.tier = tier; fn.model = model;
  return fn;
}

// ── Is a local host actually reachable, and does it have the model? Used to report honestly in a UI
//    rather than presenting a tier as available when nothing is behind it. ──
export async function probeOllama({ host = OLLAMA_DEFAULT, model = LOCAL_FAST, fetchImpl } = {}) {
  const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
  if (!doFetch) return { up: false, models: [], hasModel: false };
  try {
    const res = await doFetch(`${host}/api/tags`, { signal: AbortSignal.timeout ? AbortSignal.timeout(5000) : undefined });
    if (!res || !res.ok) return { up: false, models: [], hasModel: false };
    const j = await res.json();
    const models = Array.isArray(j?.models) ? j.models.map(m => m.name) : [];
    return { up: true, models, hasModel: models.includes(model) };
  } catch { return { up: false, models: [], hasModel: false }; }
}

// ── Assemble the provider set for a cascade from what is actually available. A tier is only included
//    when something can serve it, so the cascade never lists a tier it cannot honour. ──
export function providersFor({ builtin, ollama, ollamaLarge, remote } = {}) {
  const providers = {};
  if (builtin) providers.T0 = builtin;
  if (ollama) providers.T2 = ollama;
  if (ollamaLarge) providers['T2.5'] = ollamaLarge;
  if (remote) providers[remote.tier === 'T3' ? 'T3' : 'T4'] = remote;
  return providers;
}

// The default local pair: the fast model on T2, the deep one on T2.5. A request only reaches the
// heavier model when the faster one declines or falls below the threshold.
export function localPair(opts = {}) {
  return {
    ollama: ollamaProvider({ ...opts, model: LOCAL_FAST }),
    ollamaLarge: ollamaProvider({ ...opts, model: LOCAL_DEEP, confidence: 0.9 }),
  };
}

export default { OLLAMA_DEFAULT, LOCAL_FAST, LOCAL_DEEP, localPair, builtinProvider, ollamaProvider, remoteProvider, probeOllama, providersFor };
