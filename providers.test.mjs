// providers.test.mjs — verification for the real provider adapters. Deterministic: every transport is
// a stub, so this suite makes no network call and passes with or without a local host running.
//
// The properties that matter: an unreachable backend DECLINES rather than throwing (so the cascade
// descends instead of failing), an empty answer is a decline rather than hollow text, and a remote
// adapter holds no privilege that could bypass consent.
import { builtinProvider, ollamaProvider, remoteProvider, probeOllama, providersFor, OLLAMA_DEFAULT } from './providers.mjs';
import { askAsync, stayedLocal } from './cascade.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const okRes = body => ({ ok: true, json: async () => body });
const errRes = () => ({ ok: false, json: async () => ({}) });
const boom = () => { throw new Error('connection refused'); };

console.log('\n=== §1 · T0 · deterministic answers, and declines everything else ===');
{
  const b = builtinProvider({ 'what is the threshold': 'the shared acceptance bar' });
  ok(b('what is the threshold').text === 'the shared acceptance bar' && b('what is the threshold').confidence === 1, 'a known question is answered with full confidence');
  ok(b('WHAT IS THE THRESHOLD').text === 'the shared acceptance bar', 'matching is case-insensitive');
  ok(b('something else') === null && b('') === null && b(null) === null, 'anything unknown, empty or null DECLINES rather than inventing an answer');
}

console.log('\n=== §2 · T2 · the local host answers, and its identity is inspectable ===');
{
  let seen = null;
  const f = async (url, init) => { seen = { url, body: JSON.parse(init.body) }; return okRes({ response: '  answered locally  ' }); };
  const p = ollamaProvider({ model: 'qwen2.5:14b', fetchImpl: f });
  const r = await p('a question');
  ok(r.text === 'answered locally' && r.confidence === 0.8, 'the local answer is returned, trimmed');
  ok(seen.url === `${OLLAMA_DEFAULT}/api/generate` && seen.body.model === 'qwen2.5:14b' && seen.body.stream === false, 'it calls the local generate endpoint with the configured model, non-streaming');
  ok(p.tier === 'T2' && p.model === 'qwen2.5:14b', 'the adapter reports which tier and model it serves, so a UI need not guess');
  const withSys = ollamaProvider({ fetchImpl: f });
  await withSys('q', { system: 'be terse' });
  ok(seen.body.system === 'be terse', 'a system instruction is passed through when supplied');
}

console.log('\n=== §3 · THE LOAD-BEARING PROPERTY — an unreachable host DECLINES, it never throws ===');
{
  const dead = ollamaProvider({ fetchImpl: boom });
  let threw = false; let r;
  try { r = await dead('q'); } catch { threw = true; }
  ok(!threw && r === null, 'a refused connection returns null instead of raising — the cascade can descend past a dead tier');
  ok(await ollamaProvider({ fetchImpl: async () => errRes() })('q') === null, 'a host that responds with an error status declines');
  ok(await ollamaProvider({ fetchImpl: async () => okRes({ response: '   ' }) })('q') === null, 'an empty answer is a decline, not hollow text');
  const noTransport = ollamaProvider({ fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  ok(await noTransport('q') === null, 'a transport that cannot connect declines rather than throwing');
}

console.log('\n=== §4 · A DEAD LOCAL TIER DOES NOT BREAK THE CASCADE ===');
{
  const providers = { T0: builtinProvider({ ping: 'pong' }), T2: ollamaProvider({ fetchImpl: boom }) };
  const r = await askAsync({ providers, allow: [] }, 'ping');
  ok(r.ok && r.tier === 'T0' && r.text === 'pong', 'with the local host down, a lower tier still answers — the system degrades rather than failing');
  const r2 = await askAsync({ providers, allow: [] }, 'something only a model could answer');
  ok(r2.ok === false && stayedLocal(r2), 'and when nothing local can answer it fails honestly without leaving the machine');
}

console.log('\n=== §5 · THE REMOTE ADAPTER HOLDS NO PRIVILEGE ===');
{
  const calls = [];
  const f = async (url, init) => { calls.push(url); return okRes({ choices: [{ message: { content: 'remote answer' } }] }); };
  const remote = remoteProvider({ url: 'https://example.invalid/v1/chat', apiKey: 'k', model: 'x', fetchImpl: f, tier: 'T4' });
  // wired in, but consent NOT granted → the cascade must never invoke it
  const r = await askAsync({ providers: { T0: () => null, T4: remote }, allow: [] }, 'confidential');
  ok(calls.length === 0, 'with consent withheld the remote adapter is never invoked — it cannot escalate itself, because the cascade gates before the provider');
  ok(r.ok === false, 'and the request fails honestly rather than silently going out');
  const r2 = await askAsync({ providers: { T0: () => null, T4: remote }, allow: ['T4'] }, 'confidential');
  ok(r2.ok && r2.tier === 'T4' && calls.length === 1, 'granted consent, it is invoked exactly once');
  ok(await remoteProvider({ fetchImpl: f })('q') === null, 'an unconfigured remote adapter declines instead of erroring');
}

console.log('\n=== §6 · PROBE — report what is actually there, never assume ===');
{
  const up = await probeOllama({ model: 'qwen2.5:14b', fetchImpl: async () => okRes({ models: [{ name: 'qwen2.5:14b' }, { name: 'llama3.2:1b' }] }) });
  ok(up.up === true && up.hasModel === true && up.models.length === 2, 'a reachable host reports its models and whether the wanted one is present');
  const missing = await probeOllama({ model: 'qwen2.5:14b', fetchImpl: async () => okRes({ models: [{ name: 'llama3.2:1b' }] }) });
  ok(missing.up === true && missing.hasModel === false, 'a host without the model is reported up but lacking it — not silently treated as ready');
  const down = await probeOllama({ fetchImpl: boom });
  ok(down.up === false && down.hasModel === false, 'an unreachable host reports down rather than raising');
}

console.log('\n=== §7 · ASSEMBLY — a tier is only offered when something can serve it ===');
{
  const only0 = providersFor({ builtin: builtinProvider({ a: 'b' }) });
  ok(Object.keys(only0).join(',') === 'T0', 'with only a builtin, only T0 is offered');
  const both = providersFor({ builtin: builtinProvider({}), ollama: ollamaProvider({ fetchImpl: async () => okRes({ response: 'x' }) }) });
  ok(Object.keys(both).sort().join(',') === 'T0,T2', 'a local host adds T2 and nothing else');
  const withRemote = providersFor({ ollama: ollamaProvider({}), remote: remoteProvider({ tier: 'T3' }) });
  ok('T3' in withRemote && !('T4' in withRemote), 'a remote adapter lands on the tier it declares');
  ok(Object.keys(providersFor({})).length === 0, 'with nothing available, no tier is claimed');
}


console.log('\n=== §8 · GUARD BOUNDARIES — each refusal condition pinned individually ===');
{
  // res.ok is checked SEPARATELY from res existing: a null response and a non-ok response are
  // different failures and both must decline (pins the || in "!res || !res.ok").
  ok(await ollamaProvider({ fetchImpl: async () => null })('q') === null, 'a transport returning nothing at all declines');
  ok(await ollamaProvider({ fetchImpl: async () => ({ ok: false, json: async () => ({ response: 'ignored' }) }) })('q') === null, 'a non-ok response declines even when a body is present');
  ok(await ollamaProvider({ fetchImpl: async () => ({ ok: true, json: async () => null }) })('q') === null, 'a null JSON body declines rather than raising (pins the j && guard)');
  ok(await ollamaProvider({ fetchImpl: async () => ({ ok: true, json: async () => ({ response: 42 }) }) })('q') === null, 'a non-string response field declines (pins the typeof check)');

  // the remote adapter needs BOTH a url and a key — each missing piece independently declines.
  const f = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) });
  ok(await remoteProvider({ apiKey: 'k', model: 'm', fetchImpl: f })('q') === null, 'a remote adapter with no url declines');
  ok(await remoteProvider({ url: 'https://x.invalid', model: 'm', fetchImpl: f })('q') === null, 'a remote adapter with no api key declines');
  ok((await remoteProvider({ url: 'https://x.invalid', apiKey: 'k', model: 'm', fetchImpl: f })('q')).text === 'x', 'with both present it answers');
  ok(await remoteProvider({ url: 'https://x.invalid', apiKey: 'k', fetchImpl: async () => null })('q') === null, 'a remote transport returning nothing declines');
  ok(await remoteProvider({ url: 'https://x.invalid', apiKey: 'k', fetchImpl: async () => ({ ok: false, json: async () => ({}) }) })('q') === null, 'a non-ok remote response declines');

  // probe: a non-ok tags response is "down", not "up with no models".
  ok((await probeOllama({ fetchImpl: async () => ({ ok: false, json: async () => ({}) }) })).up === false, 'a host answering with an error status is reported down, not up-with-zero-models');
  ok((await probeOllama({ fetchImpl: async () => null })).up === false, 'a transport returning nothing reports down');
  ok((await probeOllama({ fetchImpl: async () => ({ ok: true, json: async () => ({}) }) })).models.length === 0, 'a response with no models list yields an empty list rather than raising');

  // an explicitly-supplied transport is used in preference to any ambient one.
  let used = false;
  await ollamaProvider({ fetchImpl: async () => { used = true; return { ok: true, json: async () => ({ response: 'via injected' }) }; } })('q');
  ok(used === true, 'the injected transport is the one actually called — the adapter never silently reaches for an ambient global instead');
}


console.log("\n=== §9 · AMBIENT TRANSPORT — with no transport injected, the global one is used ===");
{
  // Each adapter falls back to the ambient fetch when none is injected. Stub the global so this is
  // deterministic and makes no real network call. A mutant that inverts the capability check yields
  // no transport at all, so every call would decline — these assertions catch that.
  const real = globalThis.fetch;
  let hits = 0;
  globalThis.fetch = async (url) => {
    hits++;
    if (String(url).endsWith("/api/tags")) return { ok: true, json: async () => ({ models: [{ name: "qwen2.5:14b" }] }) };
    if (String(url).includes("/api/generate")) return { ok: true, json: async () => ({ response: "ambient local" }) };
    return { ok: true, json: async () => ({ choices: [{ message: { content: "ambient remote" } }] }) };
  };
  try {
    const local = await ollamaProvider({})("q");
    ok(local && local.text === "ambient local", "the local adapter uses the ambient transport when none is injected");
    const rem = await remoteProvider({ url: "https://x.invalid", apiKey: "k" })("q");
    ok(rem && rem.text === "ambient remote", "the remote adapter uses the ambient transport when none is injected");
    const pr = await probeOllama({ model: "qwen2.5:14b" });
    ok(pr.up === true && pr.hasModel === true, "the probe uses the ambient transport when none is injected");
    ok(hits === 3, "all three went through the stub — no real network call was made");
  } finally { globalThis.fetch = real; }
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ providers — the local host is wired for real, an unreachable tier declines instead of breaking, and a remote adapter cannot bypass consent · ${pass}/${pass} ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
