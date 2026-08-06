// cascade.test.mjs — verification for the model cascade. Deterministic, no external calls.
// The load-bearing property is §2: a request CANNOT reach a tier the operator has not allowed —
// proved by spy providers that record whether they were invoked at all. If the remote provider is
// never called, the prompt was never serialised outward; that is a structural guarantee, not a policy.
import { TIERS, tier, isLocal, allowed, permits, ask, askAsync, explain, stayedLocal } from './cascade.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
// a spy provider: records every prompt it ever saw
const spy = (text, confidence) => { const calls = []; const fn = p => { calls.push(p); return text === null ? null : { text, confidence }; }; fn.calls = calls; return fn; };

console.log('\n=== §1 · TIERS — six tiers; the first four are local, the last two need consent ===');
{
  ok(TIERS.length === 6 && TIERS.map(t => t.id).join(',') === 'T0,T1,T2,T2.5,T3,T4', 'the ladder is T0 → T1 → T2 → T2.5 → T3 → T4');
  ok(TIERS.filter(t => t.local).map(t => t.id).join(',') === 'T0,T1,T2,T2.5', 'T0–T2.5 run on hardware the operator owns');
  ok(TIERS.filter(t => t.consent).map(t => t.id).join(',') === 'T3,T4', 'only the two tiers that leave the machine require consent');
  ok(isLocal('T2') === true && isLocal('T4') === false && tier('T2').name.includes('Ollama'), 'a tier reports its locality and identity (T2 is the local host)');
}

console.log('\n=== §2 · THE GUARANTEE — a prompt CANNOT reach a tier the operator has not allowed ===');
{
  const remote = spy('leaked answer', 1);            // would happily answer if it were ever called
  const c = { allow: [], providers: { T0: () => null, T2: () => null, T3: remote, T4: remote } };
  const r = ask(c, 'something confidential');
  ok(remote.calls.length === 0, 'with no consent granted, the remote provider is NEVER INVOKED — the prompt is never serialised outward');
  ok(r.ok === false && r.text === null, 'and the cascade returns an honest failure rather than silently escalating');
  ok(r.declined.some(d => d.id === 'T3' && d.why === 'not permitted') && r.tried.every(isLocal), 'the refusal is recorded per tier, and only local tiers were ever tried');
  ok(/grant a higher tier|lower the threshold/.test(r.reason), 'the failure explains the operator\'s actual options instead of failing silently');
}

console.log('\n=== §3 · LOCAL FIRST — a local tier that can answer ends the descent; nothing escalates ===');
{
  const t2 = spy('local answer', 0.9), t4 = spy('frontier answer', 1);
  const r = ask({ allow: ['T3', 'T4'], providers: { T2: t2, T4: t4 } }, 'a question');
  ok(r.ok && r.tier === 'T2' && r.text === 'local answer', 'the local host answers, so the cascade stops there');
  ok(t4.calls.length === 0, 'the frontier tier is NOT invoked even though it was permitted — cost and exposure are avoided, not merely allowed');
  ok(stayedLocal(r) === true && r.local === true, 'the run is reported as having stayed entirely on the operator\'s hardware');
}

console.log('\n=== §4 · ESCALATION — only with consent, and only when the lower tiers cannot answer ===');
{
  const t4 = spy('frontier answer', 0.95);
  const c = { allow: ['T4'], providers: { T0: () => null, T2: () => ({ text: 'weak', confidence: 0.2 }), T4: t4 } };
  const r = ask(c, 'a hard question');
  ok(r.ok && r.tier === 'T4' && t4.calls.length === 1, 'when the local tiers fall short AND the operator granted T4, the request escalates exactly once');
  ok(r.local === false && stayedLocal(r) === false, 'the result is explicitly flagged as having left the machine');
  ok(/with your consent/.test(explain(r)), 'and the explanation says so in plain language');
  const same = ask({ ...c, allow: [] }, 'a hard question');
  ok(same.ok === false, 'withdraw the consent and the identical request no longer escalates — consent is the only door');
}

console.log('\n=== §5 · ROBUSTNESS — a broken or absent tier degrades, it does not take the cascade down ===');
{
  const boom = () => { throw new Error('provider down'); };
  const r = ask({ allow: [], providers: { T0: boom, T2: () => ({ text: 'recovered', confidence: 0.8 }) } }, 'q');
  ok(r.ok && r.tier === 'T2' && r.declined.some(d => d.id === 'T0' && d.why === 'errored'), 'a throwing provider is recorded as errored and the descent continues');
  const none = ask({ allow: [], providers: {} }, 'q');
  ok(none.ok === false && none.tried.length === 0 && none.declined.length === TIERS.length, 'with no providers at all, every tier is accounted for and nothing is invented');
  const empty = ask({ allow: [], providers: { T0: () => ({ text: '', confidence: 1 }) } }, 'q');
  ok(empty.ok === false, 'an empty answer is a decline, not an answer — the cascade never returns hollow text');
}

console.log('\n=== §6 · THRESHOLD — the operator sets the bar; a weak answer is kept only as a fallback report ===');
{
  const c = { allow: [], providers: { T2: () => ({ text: 'maybe', confidence: 0.4 }) } };
  ok(ask(c, 'q', { threshold: 0.5 }).ok === false, 'below the threshold, the cascade does not claim an answer');
  ok(ask(c, 'q', { threshold: 0.3 }).ok === true, 'lower the bar and the same answer is accepted — the operator decides what is good enough');
  const r = ask(c, 'q', { threshold: 0.9 });
  ok(r.best && r.best.tier === 'T2' && r.best.confidence === 0.4, 'the best sub-threshold attempt is reported for transparency, but is NOT returned as the answer');
  // EXACTLY at the threshold must be ACCEPTED (>=, not >) — the boundary the operator set is inclusive.
  const exact = ask({ allow: [], providers: { T2: () => ({ text: 'on the line', confidence: 0.5 }) } }, 'q', { threshold: 0.5 });
  ok(exact.ok === true && exact.text === 'on the line', 'an answer landing EXACTLY on the threshold is accepted — the bar is inclusive (pins c >= threshold)');
  // ties in the sub-threshold fallback keep the FIRST (highest, earliest) tier — pins the strict > in best-tracking.
  const tie = ask({ allow: [], providers: { T0: () => ({ text: 'earlier', confidence: 0.4 }), T2: () => ({ text: 'later', confidence: 0.4 }) } }, 'q', { threshold: 0.9 });
  ok(tie.best.text === 'earlier' && tie.best.tier === 'T0', 'on an equal-confidence tie the EARLIER (cheaper) tier is kept as best — a later equal answer never displaces it');
}

console.log('\n=== §7 · CONSENT BOOKKEEPING + DETERMINISM + FUZZ ===');
{
  ok(allowed([]).join(',') === 'T0,T1,T2,T2.5' && allowed(['T4']).includes('T4') && !allowed(['T4']).includes('T3'), 'consent is per-tier: granting T4 does not grant T3');
  ok(permits([], 'T0') === true && permits([], 'T4') === false, 'permits() answers per tier');
  const run = () => JSON.stringify(ask({ allow: ['T4'], providers: { T2: () => ({ text: 'x', confidence: 0.4 }), T4: () => ({ text: 'y', confidence: 0.9 }) } }, 'p'));
  ok(run() === run(), 'identical inputs produce identical routing — the cascade is deterministic');
  let threw = false;
  try { ask(null, 'q'); ask({}, null); ask({ providers: null, allow: null }, ''); allowed('nonsense'); permits(null, null); tier('nope'); explain(null); stayedLocal(null); }
  catch { threw = true; }
  ok(!threw, 'null cascades, null prompts and unknown tiers never raise');
  // a null/undefined prompt must reach the provider as EMPTY TEXT, never the literal string "null" —
  // otherwise a dropped variable is silently sent onward to a model as content.
  const seen = spy("ok", 1);
  ask({ allow: [], providers: { T0: seen } }, null);
  ask({ allow: [], providers: { T0: seen } }, undefined);
  ok(seen.calls.length === 2 && seen.calls.every(c => c === ""), `a null or undefined prompt is normalised to empty text, never "null" (got ${JSON.stringify(seen.calls)})`);
}


console.log('\n=== §8 · askAsync — the SAME guarantees for asynchronous providers ===');
{
  // ask() is synchronous and treats a Promise as a decline, which silently disables every real
  // provider. askAsync exists for those, and must hold every property ask holds.
  const aspy = (text, confidence) => { const calls = []; const fn = async p => { calls.push(p); return text === null ? null : { text, confidence }; }; fn.calls = calls; return fn; };

  const remote = aspy('leaked', 1);
  const r0 = await askAsync({ allow: [], providers: { T0: async () => null, T4: remote } }, 'confidential');
  ok(remote.calls.length === 0 && r0.ok === false, 'the consent guarantee holds asynchronously — a disallowed tier is never awaited, so nothing is serialised outward');

  const t2 = aspy('local', 0.9), t4 = aspy('frontier', 1);
  const r1 = await askAsync({ allow: ['T4'], providers: { T2: t2, T4: t4 } }, 'q');
  ok(r1.ok && r1.tier === 'T2' && t4.calls.length === 0, 'local-first holds: an answering local tier ends the descent and the permitted frontier tier is never called');

  const exact = await askAsync({ allow: [], providers: { T2: async () => ({ text: 'on the line', confidence: 0.5 }) } }, 'q', { threshold: 0.5 });
  ok(exact.ok === true, 'exactly at the threshold is accepted (pins c >= threshold in the async path)');

  const tie = await askAsync({ allow: [], providers: { T0: async () => ({ text: 'earlier', confidence: 0.4 }), T2: async () => ({ text: 'later', confidence: 0.4 }) } }, 'q', { threshold: 0.9 });
  ok(tie.best.text === 'earlier' && tie.best.tier === 'T0', 'an equal-confidence tie keeps the earlier tier as best (pins the strict >)');
  ok(tie.best !== null && tie.ok === false, 'a sub-threshold best is reported without being returned as the answer');

  const rejected = await askAsync({ allow: [], providers: { T0: async () => ({ text: '', confidence: 1 }), T2: async () => ({ confidence: 1 }) } }, 'q');
  ok(rejected.ok === false && rejected.declined.filter(d => d.why === 'declined').length === 2, 'an empty string and a missing text field are both declines, never hollow answers');

  const notFn = await askAsync({ allow: [], providers: { T0: 'not a function', T2: async () => ({ text: 'ok', confidence: 1 }) } }, 'q');
  ok(notFn.ok && notFn.tier === 'T2' && notFn.declined.some(d => d.id === 'T0' && d.why === 'unavailable'), 'a non-function provider is unavailable rather than invoked');

  const threwP = await askAsync({ allow: [], providers: { T0: async () => { throw new Error('x'); }, T2: async () => ({ text: 'recovered', confidence: 1 }) } }, 'q');
  ok(threwP.ok && threwP.declined.some(d => d.id === 'T0' && d.why === 'errored'), 'a rejecting provider is recorded as errored and the descent continues');

  const seen = aspy('ok', 1);
  await askAsync({ allow: [], providers: { T0: seen } }, null);
  ok(seen.calls[0] === '', 'a null prompt is normalised to empty text in the async path too, never the string "null"');

  let threw = false;
  try { await askAsync(null, 'q'); await askAsync({ providers: null, allow: null }, ''); await askAsync({}, null); }
  catch { threw = true; }
  ok(!threw, 'null cascades and null providers never raise in the async path');
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ cascade — local-first descent, and a request can never reach a tier the operator has not allowed · ${pass}/${pass} ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
