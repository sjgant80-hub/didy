// didy.test.mjs — PROOF-OF-PLAY for the fall-os conductor (Didy). Zero tokens. Proves the ONE loop
// (EXPLORE→RESOLVE→VERIFY→BUILD→REMEMBER) routes every phase through the SHARED core, that registered
// organs are CALLED BY the loop (not run standalone), that it BUILDS only what an author collapses
// (grounded, never reflexive), and that the roads-not-taken are remembered into the shadow-index.
import { makeDidy, register, train, organsFor, conduct } from './conductor.mjs';
import { KAPPA } from './core.mjs';
import { recurring, shadowsOf } from './shadow.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };

console.log('\n=== §1 · REGISTER — organs plug into a phase; the loop will call them, never run them standalone ===');
{
  const c = makeDidy();
  ok(register(c, 'oracle', { phase: 'explore', generate: () => ({}) }).ok, 'an organ registers into a phase');
  ok(organsFor(c, 'explore').length === 1 && organsFor(c, 'verify').length === 0, 'organsFor returns the organs plugged into a given phase');
  ok(register(c, 'x', null).ok === false, 'a bad registration is rejected, not silently accepted');
  register(c, 'noPhase', { generate: () => ({}) });
  ok(organsFor(c, 'explore').some(o => o.name === 'noPhase'), 'an organ with no phase declared defaults to the explore phase (not undefined)');
  // Didy naming — a blank Didy ships with every fork; signing it with a prefix makes it <prefix>-didy (yours).
  ok(makeDidy().name === 'didy' && makeDidy().prefix === '', 'a fresh fork gets a BLANK "didy" — untrained, unsigned');
  ok(makeDidy('Kel').name === 'kel-didy' && makeDidy('kel!').name === 'kel-didy', 'signing a Didy with your prefix makes it <prefix>-didy — a new signed branch of the fold-tree (sanitised)');
  ok(typeof train === 'function' && train === register, 'you TRAIN a Didy by registering its organs (train ≡ register)');
}

console.log('\n=== §2 · GROUNDED — with NO author the loop explores + resolves but BUILDS NOTHING (never reflexive) ===');
{
  const c = makeDidy();
  const r = conduct(c, 'ship or wait', { n: 6 });      // no author
  ok(r.remembered === false && r.built === null && c.memory.length === 0, 'no author ⇒ nothing is built and nothing is remembered as a build — the OS never decides for you (COND-2)');
  ok(r.field.holds.length + r.field.roads.length === 6, 'yet it DID fork 6 branches through the shared core and resolve them at the κ-gate');
  ok(c.shadow.shadows.size > 0, 'and the roads-not-taken are still caught into the shadow-index — nothing evaporates');
}

console.log('\n=== §3 · AUTHORED BUILD — with an author the loop BUILDS a held branch, REMEMBERS + CACHES it ===');
{
  const c = makeDidy();
  const r = conduct(c, 'ship it', { n: 6, author: holds => holds[0] || null });
  ok(r.built && r.remembered && c.memory.length === 1 && c.memory[0].decision === 'ship it', 'an author collapses ⇒ the chosen branch is BUILT and REMEMBERED');
  ok(r.built.holds === true && r.built.score >= KAPPA, 'only a HELD branch (≥κ) is built — VERIFY (the κ-gate) gates the BUILD, never a clash');
  ok(c.cache.has('ship it'), 'the build is cached — build-once (run(S)==S) at the OS level');
  // the BUILT branch is taken, not a road; a HELD-but-not-built branch IS remembered as a road.
  const c2 = makeDidy();
  register(c2, 't', { phase: 'explore', generate: i => ({ label: 'opt-' + i, k: i }), score: v => (v.k < 2 ? 0.9 : 0.1) });   // opt-0, opt-1 hold
  const r2 = conduct(c2, 'pick', { n: 4, author: h => h[0] || null });   // builds opt-0 (holds[0])
  const cast2 = shadowsOf(c2.shadow, 'conduct:pick').map(e => e.branch);
  ok(!cast2.includes(r2.built.value.label) && cast2.includes('opt-1'), 'the BUILT branch is NOT remembered as a road (it was taken); a held-but-not-built branch IS — pins the built-exclusion');
  // an explore-organ can supply the author; the Didy uses it when none is passed.
  const c3 = makeDidy();
  register(c3, 'auto', { phase: 'explore', generate: i => ({ label: 'o' + i, theta: i * 137.5 }), score: v => (v.theta % 360) / 360, author: h => h[0] || null });
  ok(conduct(c3, 'via organ author').built, 'an explore-organ can supply the author — the Didy uses the organ\'s author when none is passed (organs drive VERIFY too)');
}

console.log('\n=== §4 · ORGANS ARE CALLED BY THE LOOP + every EXPLORE forks on the shared golden offset ===');
{
  const c = makeDidy();
  register(c, 'stances', { phase: 'explore', generate: (i, theta) => ({ label: 'STANCE-' + i, theta }), score: v => (v.theta % 360) / 360 });
  const r = conduct(c, 'a real decision', { author: h => h[0] || null });
  const all = [...r.field.holds, ...r.field.roads];
  ok(all.every(b => /^STANCE-/.test(b.value.label)), 'the registered explore-organ DRIVES the fork — the loop calls the organ (plug-in, not standalone)');
  const th = all.map(b => b.theta).sort((a, b) => a - b);
  let mg = 360; for (let i = 1; i < th.length; i++) mg = Math.min(mg, th[i] - th[i - 1]);
  ok(all.length === 6 && mg > 10, 'the branches diverge on the golden offset (min gap ≫ 0) — the shared core drives every explore');
}

console.log('\n=== §5 · THE κ-GATE IS THE SHARED ONE — one gate, upgraded once, everywhere (the fall-os leverage) ===');
{
  const c = makeDidy();
  register(c, 'edge', { phase: 'explore', generate: i => ({ label: 'b' + i, k: i }), score: v => (v.k === 0 ? KAPPA : (v.k === 1 ? KAPPA - 1e-6 : 0.95)) });
  const r = conduct(c, 'boundary', { n: 3 });
  const all = [...r.field.holds, ...r.field.roads];
  const b0 = all.find(b => b.value.label === 'b0'), b1 = all.find(b => b.value.label === 'b1');
  ok(b0.holds === true && b1.holds === false, 'a branch at EXACTLY κ holds, just-below clashes — the loop\'s RESOLVE is the core\'s κ-gate; improve it once and every organ improves');
}

console.log('\n=== §6 · REMEMBER → SHADOW — across real decisions, what the loop keeps NOT building recurs ===');
{
  const c = makeDidy();
  register(c, 'stances', { phase: 'explore', generate: i => ({ label: 'stance-' + i, theta: i * 137.5 }), score: v => (v.theta % 360) / 360 });
  for (const d of ['d-alpha', 'd-beta', 'd-gamma']) conduct(c, d, { author: h => h[0] || null });
  const rec = recurring(c.shadow, 3);
  ok(rec.length >= 1 && rec.every(e => e.times_shadowed === 3), 'a branch the loop forks toward but never builds across all 3 decisions surfaces at count 3 — the OS\'s own un-collapsed pattern points at the next build');
  ok(c.memory.length === 3, 'every authored build across the three decisions is remembered');
}

console.log('\n=== §7 · DETERMINISM + FUZZ ===');
{
  const run = () => { const c = makeDidy(); conduct(c, 'x', { author: h => h[0] || null }); return JSON.stringify(c.memory); };
  ok(run() === run(), 'the loop is deterministic — same decision, same build');
  let threw = false;
  try { const c = makeDidy(); conduct(c, ''); conduct(c, null); register(c, '', null); register(c, 'x', {}); organsFor(c, 'nope'); conduct(c, 'y', { n: 0 }); }
  catch { threw = true; }
  ok(!threw, 'blank/null decisions, bad registration, zero-branch loops never throw');
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ fall-os CONDUCTOR — one loop (explore→resolve→verify→build→remember) routing every phase through the shared core, organs called-by not run-standalone, grounded, roads remembered · ${pass}/${pass} · zero tokens ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
