// shadow.test.mjs — PROOF-OF-PLAY for the SHADOW-INDEX. Zero tokens. Proves it CATCHES the roads-not-taken a
// real collapse() throws away, content-addresses them so the same branch forked-toward across DIFFERENT decisions
// dedupes and counts up, and that the recurrence detector surfaces the branch you keep circling as the next-build
// signal — the whole value. Plus the honest wire: it invents nothing, and only DISTINCT decisions raise the count.
import { h16, fork, hold, collapse } from './core.mjs';
import { makeIndex, describe, cast, castShadow, recurring, ranked, shadowsOf, twinsOf, resurrect } from './shadow.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const road = label => ({ value: { label } });

console.log('\n=== §1 · CAST + CONTENT-ADDRESS — the same branch from different decisions DEDUPES and counts up ===');
{
  const idx = makeIndex();
  cast(idx, 'faster sync', 'decision-A');
  cast(idx, 'faster sync', 'decision-B');
  ok(idx.shadows.size === 1, 'the same branch cast from two decisions is ONE content-addressed entry (dedupe)');
  ok(idx.shadows.get(h16('faster sync')).times_shadowed === 2, 'and its recurrence count is 2 (two distinct decisions forked toward it)');
  cast(idx, 'a different road', 'decision-A');
  ok(idx.shadows.size === 2 && idx.shadows.get(h16('a different road')).times_shadowed === 1, 'a distinct branch is its own entry');
  // describe() addresses a branch stably — a label wins, a value without one falls back to JSON, and null is SAFE.
  ok(describe('plain') === 'plain' && describe(road('L')) === 'L', 'describe: a string is itself; a branch\'s label is its address');
  ok(describe({ value: { a: 1 } }) === JSON.stringify({ a: 1 }), 'describe: a branch with no label addresses by its value\'s JSON — not the string "undefined"');
  ok(describe(null) === 'null' && (() => { try { cast(makeIndex(), null, 'd'); return true; } catch { return false; } })(), 'describe(null) is safe — returns "null", never throws (the collector handles a null branch)');
}

console.log('\n=== §2 · THE HOOK — castShadow catches every road-not-taken from a REAL core collapse() ===');
{
  const idx = makeIndex();
  const col = collapse(hold(fork(5, i => ({ label: 'branch-' + i })), b => (b.label === 'branch-0' ? 0.9 : 0.1)));  // one holds, four clash
  const cast_ = castShadow(idx, col, 'real-decision');
  ok(col.holds.length === 1 && col.roads.length === 4, 'the collapse held 1 and cast 4 roads-not-taken');
  ok(cast_.length === 4 && idx.shadows.size === 4, 'castShadow caught all 4 un-collapsed branches — nothing evaporates');
  ok(cast_[0].related.length === 3, 'the co-cast shadows are recorded as siblings (the un-collapsed neighbourhood of that decision)');
}

console.log('\n=== §3 · THE RECURRENCE DETECTOR — the branch circled 3× across 3 unrelated decisions is THE signal ===');
{
  const idx = makeIndex();
  // three UNRELATED decisions; each forks toward "notes that dream overnight" (+ a distinct one-off road) and builds neither
  castShadow(idx, { roads: [road('notes that dream overnight'), road('a bigger cache')] }, 'memory-organ');
  castShadow(idx, { roads: [road('notes that dream overnight'), road('faster verify')] }, 'the-loop');
  castShadow(idx, { roads: [road('notes that dream overnight'), road('dark mode')] }, 'ux-pass');
  const rec = recurring(idx, 3);
  ok(rec.length === 1 && rec[0].branch === 'notes that dream overnight' && rec[0].times_shadowed === 3,
     'the branch forked-toward 3× surfaces as THE recurrence signal — the estate\'s own un-collapsed pattern points at the next build');
  ok(rec[0].contexts.length === 3 && rec[0].contexts.includes('memory-organ') && rec[0].contexts.includes('ux-pass'),
     'and it names the 3 DIFFERENT decisions that circled it — the pattern memory alone would never connect across time');
  ok(ranked(idx).length === 4 && recurring(idx, 3).every(e => e.branch !== 'dark mode' && e.branch !== 'a bigger cache'),
     'the one-off roads are KEPT (still queryable) but NOT flagged — only the recurring branch is the signal');
  // ranking is by COUNT desc, not by name — names chosen so alphabetical order ≠ count order, pinning the sort.
  const idx2 = makeIndex();
  for (const d of ['d1', 'd2', 'd3', 'd4']) cast(idx2, 'zebra', d);   // circled 4×
  for (const d of ['d1', 'd2']) cast(idx2, 'apple', d);               // circled 2×
  cast(idx2, 'mango', 'd1');                                          // once
  const r = ranked(idx2);
  ok(r[0].branch === 'zebra' && r[0].times_shadowed === 4 && r[1].branch === 'apple' && r[2].branch === 'mango',
     'ranked orders by recurrence count DESC (zebra 4 > apple 2 > mango 1), NOT alphabetically — pins the rank comparator');
  const rec2 = recurring(idx2, 2);
  ok(rec2.length === 2 && rec2[0].branch === 'zebra' && rec2[1].branch === 'apple', 'recurring(≥2) returns both patterns, most-circled first — pins the recurrence comparator');
}

console.log('\n=== §4 · QUERY — mine the shadow (what did I nearly build · the twin · resurrect it) ===');
{
  const idx = makeIndex();
  castShadow(idx, { roads: [road('notes that dream overnight'), road('a bigger cache')] }, 'memory-organ');
  castShadow(idx, { roads: [road('notes that dream overnight'), road('faster verify')] }, 'the-loop');
  castShadow(idx, { roads: [road('notes that dream overnight'), road('dark mode')] }, 'ux-pass');
  ok(shadowsOf(idx, 'memory-organ').some(e => e.branch === 'a bigger cache'), '"what did I nearly build HERE" returns the shadows a decision cast');
  ok(twinsOf(idx, road('a bigger cache')).some(e => e.branch === 'notes that dream overnight'), '"the un-collapsed twin of X" returns its sibling shadows');
  const top = recurring(idx, 3)[0], res = resurrect(idx, top.id);
  ok(res && res.spec === 'notes that dream overnight' && res.forked_toward === 3, 'resurrect promotes a shadow back to a live spec (verbatim) to hand to the generative estate — the road stays walkable');
}

console.log('\n=== §5 · THE HONEST WIRE — it invents nothing, and only DISTINCT decisions raise the count ===');
{
  const idx = makeIndex();
  cast(idx, 'x', 'd1'); cast(idx, 'x', 'd1'); cast(idx, 'x', 'd1');   // same decision, three times
  ok(idx.shadows.get(h16('x')).times_shadowed === 1, 'the SAME decision re-casting a branch does NOT inflate recurrence — only distinct decisions count (the signal can\'t be gamed)');
  ok(resurrect(idx, h16('x')).spec === 'x', 'resurrect returns exactly what was stored — the collector generates nothing (zero myth, zero new content)');
  ok(recurring(idx, 3).length === 0, 'one branch in one decision is not a pattern — it stays a passing thought, not a signal');
}

console.log('\n=== §6 · DETERMINISM + FUZZ ===');
{
  const build = () => { const i = makeIndex(); cast(i, 'a', 'd1'); cast(i, 'a', 'd2'); cast(i, 'b', 'd1'); return JSON.stringify(ranked(i)); };
  ok(build() === build(), 'deterministic — the same casts give the same ranking every time');
  let threw = false;
  try { castShadow(makeIndex(), null, 'd'); castShadow(makeIndex(), {}, 'd'); cast(makeIndex(), { value: {} }, ''); recurring(makeIndex()); twinsOf(makeIndex(), 'nope'); resurrect(makeIndex(), 'nope'); shadowsOf(makeIndex(), null); ranked(makeIndex()); }
  catch { threw = true; }
  ok(!threw, 'null collapse / empty roads / missing shadows / blank decisions never throw');
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ SHADOW-INDEX — catches the roads-not-taken every collapse throws away, dedupes them by content, and the recurrence detector surfaces the branch you keep circling as the next build · ${pass}/${pass} · zero tokens ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
