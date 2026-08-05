// cascade.mjs — THE MODEL CASCADE. Local-first routing for a Didy conductor.
//
// A request descends to the cheapest tier that can answer it. Tiers T0–T2.5 run on hardware the
// operator owns; T3–T4 leave the machine and are therefore CONSENT-GATED. The load-bearing safety
// property — the one the tests exist to prove — is:
//
//     A REQUEST CAN NEVER REACH A TIER THE OPERATOR HAS NOT EXPLICITLY ALLOWED.
//
// Not "should not" by policy: the remote provider is never invoked, so the prompt is never
// serialised outward. If every allowed tier declines, the cascade returns an honest failure rather
// than silently escalating. Providers are INJECTED (the kernel stays pure, deterministic, gated);
// a provider returns { text, confidence } or null/undefined to decline, and a provider that throws
// is treated as unavailable rather than taking the cascade down.

export const TIERS = [
  { id: 'T0',   name: 'built-in deterministic logic', local: true,  consent: false },
  { id: 'T1',   name: 'in-browser model',             local: true,  consent: false },
  { id: 'T2',   name: 'local host (Ollama)',          local: true,  consent: false },
  { id: 'T2.5', name: 'large local / co-located',     local: true,  consent: false },
  { id: 'T3',   name: 'free-tier API',                local: false, consent: true  },
  { id: 'T4',   name: 'frontier model',               local: false, consent: true  },
];

export const tier = id => TIERS.find(t => t.id === id) || null;
export const isLocal = id => { const t = tier(id); return !!t && t.local; };

// Normalise the operator's consent list: only ids that exist, and only tiers that actually need consent.
export function allowed(allow = []) {
  const set = new Set(Array.isArray(allow) ? allow.map(String) : []);
  return TIERS.filter(t => !t.consent || set.has(t.id)).map(t => t.id);
}

// A tier may run iff it needs no consent, or the operator named it.
export function permits(allow, id) { return allowed(allow).includes(id); }

const conf = r => (r && Number.isFinite(+r.confidence)) ? Math.max(0, Math.min(1, +r.confidence)) : 0;

// ── ask: descend the tiers in order; return the first answer at or above `threshold`.
//    `providers` maps tier id → (prompt, ctx) => { text, confidence } | null.
//    Returns { ok, text, tier, local, tried, declined, reason }. `tried` records ONLY tiers actually
//    invoked — so a test can prove a disallowed tier was never touched. ──
export function ask(cascade, prompt, { threshold = 0.5, ctx = null } = {}) {
  const src = cascade || {};
  const providers = (src.providers && typeof src.providers === 'object') ? src.providers : {};
  const allow = src.allow;
  const p = String(prompt == null ? '' : prompt);
  const tried = [], declined = [];
  let best = null;
  for (const t of TIERS) {
    if (!permits(allow, t.id)) { declined.push({ id: t.id, why: 'not permitted' }); continue; }
    const fn = providers[t.id];
    if (typeof fn !== 'function') { declined.push({ id: t.id, why: 'unavailable' }); continue; }
    tried.push(t.id);
    let r = null;
    try { r = fn(p, ctx); } catch { declined.push({ id: t.id, why: 'errored' }); continue; }
    const c = conf(r);
    if (!r || typeof r.text !== 'string' || !r.text) { declined.push({ id: t.id, why: 'declined' }); continue; }
    if (c >= threshold) return { ok: true, text: r.text, tier: t.id, local: t.local, confidence: c, tried, declined };
    declined.push({ id: t.id, why: 'below threshold' });
    if (!best || c > best.confidence) best = { text: r.text, tier: t.id, local: t.local, confidence: c };
  }
  // Honest failure: nothing permitted answered well enough. We do NOT escalate past consent to fix that.
  return { ok: false, text: null, tier: null, local: true, tried, declined,
           reason: 'no permitted tier answered at or above the threshold — grant a higher tier or lower the threshold',
           best: best || null };
}

// A plain-language account of where a request went and where it did not — for the operator, not the log.
export function explain(result) {
  if (!result) return '';
  if (result.ok) return `answered by ${result.tier} (${tier(result.tier).name}) · ${result.local ? 'on your hardware' : 'left the machine, with your consent'}`;
  return `no answer · tried ${result.tried.length ? result.tried.join(', ') : 'nothing'} · ${result.reason}`;
}

// Did this run stay entirely on hardware the operator owns?
export const stayedLocal = result => !!result && result.tried.every(isLocal);

export default { TIERS, tier, isLocal, allowed, permits, ask, explain, stayedLocal };
