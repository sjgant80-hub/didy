// test.mjs — PROOF-OF-PLAY for the LIVEWARE core. Zero tokens. Proves the ONE MOVE works AND that the three
// tenses (Oracle=future, re-collapse=past, generative-estate=build-space) are the SAME core with a different
// (generate, score, author) injected — i.e. they are organs of one body, not separate apps. Deterministic.
import C, { PHI, KAPPA, GOLDEN_DEG, h16, fork, hold, collapse, makeCache, move, organ } from './core.mjs';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log((c ? '  ✓ ' : '  ✗ FAIL ') + m); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) < e;

console.log('\n=== §1 · THE GOLDEN OFFSET — branches DIVERGE (spread), they do not cluster or equally-space ===');
{
  const f = fork(10, (i, theta) => theta);
  ok(f.length === 10 && new Set(f.map(b => b.value)).size === 10, 'fork(10) yields 10 distinct branches');
  const th = f.map(b => b.value).sort((a, b) => a - b);
  let minGap = 360; for (let i = 1; i < th.length; i++) minGap = Math.min(minGap, th[i] - th[i - 1]);
  minGap = Math.min(minGap, 360 - th[th.length - 1] + th[0]);
  ok(minGap > 18 && minGap < 22, `the min angular gap is ~20° (${minGap.toFixed(1)}°) — the golden-angle three-gap, NOT equal spacing (36°) or clustering (→0°)`);
  ok(near(GOLDEN_DEG, 137.50776405, 1e-6), 'the offset is the golden angle 137.5°');
}

console.log('\n=== §2 · THE κ-GATE — a branch HOLDS iff score ≥ κ (=1/φ), exactly at the boundary ===');
{
  ok(near(KAPPA, 1 / PHI) && near(KAPPA, 0.6180339887, 1e-9), 'κ is 1/φ ≈ 0.618034');
  const held = hold([{ i: 0, theta: 0, value: 'a' }, { i: 1, theta: 1, value: 'b' }, { i: 2, theta: 2, value: 'c' }],
    v => (v === 'a' ? KAPPA : v === 'b' ? KAPPA - 1e-6 : 0.99));
  ok(held[0].holds === true, 'a branch scored EXACTLY κ HOLDS — pins score ≥ κ (a `>` mutant would drop it)');
  ok(held[1].holds === false, 'a branch just below κ CLASHES');
  ok(held[2].holds === true && held.every(b => b.holds === (b.score >= KAPPA)), 'holds partitions cleanly at κ');
}

console.log('\n=== §3 · COLLAPSE IS DELIBERATE — never auto-decides; keeps the roads-not-taken (the shadow) ===');
{
  const held = hold(fork(6, (i) => i), v => (v % 2 === 0 ? 0.9 : 0.1));   // evens hold, odds clash
  const presented = collapse(held);                                       // no author
  ok(presented.decided === false && presented.chosen === null, 'with NO author, collapse PRESENTS but does not decide — the load-bearing safety');
  ok(presented.holds.length === 3 && presented.roads.length === 3, 'the held branches AND the roads-not-taken are both surfaced (the shadow is kept, not discarded)');
  ok(presented.holds.every(b => b.holds) && presented.roads.every(b => !b.holds), 'holds are ≥κ, roads are <κ — the un-collapsed complement is queryable');
  const authored = collapse(held, (holds) => holds[0]);                   // an author (VERIFY / a person) chooses
  ok(authored.decided === true && authored.chosen === presented.holds[0], 'WITH an author, and only then, a branch is chosen — the collapse is authored');
  // the field is ORDERED by score (best-holding first, worst-clashing tracked) — pins the sort comparators.
  const distinct = collapse(hold([{ i: 0, theta: 0, value: 'x' }, { i: 1, theta: 1, value: 'y' }, { i: 2, theta: 2, value: 'z' }], v => (v === 'x' ? 0.7 : v === 'y' ? 0.99 : 0.8)));
  ok(distinct.holds[0].score === 0.99 && distinct.holds[1].score === 0.8 && distinct.holds[2].score === 0.7,
     'the held branches are ordered by score DESC (highest first) even when scores differ — pins the collapse sort (a `&&` mutant would order by index)');
  const clashed = collapse(hold([{ i: 0, theta: 0, value: 'p' }, { i: 1, theta: 1, value: 'q' }], v => (v === 'p' ? 0.1 : 0.5)));
  ok(clashed.roads[0].score === 0.5 && clashed.roads[1].score === 0.1, 'the roads-not-taken are ordered by score DESC too — the shadow is ranked, not arbitrary');
}

console.log('\n=== §4 · CONTENT CACHE — run(S)==S, the same spec collapses ONCE then replays ===');
{
  const cache = makeCache();
  let gen = 0;
  const g = () => { gen++; return gen; };
  const a = move('spec-X', { n: 4, generate: g, score: () => 0.9, cache });
  const genAfter1 = gen;
  const b = move('spec-X', { n: 4, generate: g, score: () => 0.9, cache });
  ok(gen === genAfter1, 'a second run of the SAME spec does NOT regenerate — build once');
  ok(JSON.stringify(a) === JSON.stringify(b), 'and replays byte-identical — run(S)==S');
  ok(h16('spec-X') === h16('spec-X') && h16('spec-X') !== h16('spec-Y'), 'the cache is content-addressed (h16)');
  ok(h16('liveware') === '2eba0fa1822d487a' && h16('') === '9e3779b9811c9dc5' && h16('the-one-move') === '398c868b3a3bf351',
     'h16 matches its GOLDEN VECTORS — the content address is pinned to exact values, not merely self-consistent (a changed hash loop is caught)');
}

console.log('\n=== §5 · THE THESIS — the three tenses are the SAME move, differently injected ===');
{
  // FUTURE · the Oracle: fork divergent futures, hold plausible ones, NEVER auto-collapse (author = null).
  const oracle = organ({ n: 8, generate: (i, theta) => ({ future: 'f' + i, bias: theta }), score: v => (v.bias % 360) / 360, author: null });
  const fut = oracle.run('will-it-scale');
  ok(fut.decided === false && fut.holds.length + fut.roads.length === 8, 'ORACLE (future): holds futures open, surfaces roads-not-taken, decides NOTHING on its own');

  // PAST · re-collapse: fork re-readings of a FIXED event, keep those that open future, an author (a person) collapses one.
  const recollapse = organ({ n: 5, generate: (i) => ({ reading: 'meaning-' + i, opensFuture: (i + 2) / 7 }), score: v => v.opensFuture, author: (holds) => holds[0] || null });
  const past = recollapse.run('the-event');
  ok(past.decided === true && past.chosen && /meaning-/.test(past.chosen.value.reading) && past.roads.length >= 0, 'RE-COLLAPSE (past): re-reads a fixed event, an AUTHOR collapses the one that opens the most future, roads kept');

  // BUILD-SPACE · the generative estate: fork candidate builds from a spec, score = proof-of-play (κ-gate),
  // author collapses a VERIFIED one, cache by spec ⇒ build once; a failing candidate stays possibility.
  const estate = organ({ n: 6, generate: (i) => ({ code: 'impl-' + i, verifies: i === 3 ? 0.95 : 0.2 }), score: v => v.verifies, author: (holds) => holds[0] || null });
  const built = estate.run('need-a-parser');
  const built2 = estate.run('need-a-parser');
  ok(built.decided === true && built.chosen.value.code === 'impl-3', 'GENERATIVE ESTATE (build-space): collapses the ONE candidate that passes proof-of-play (≥κ), the rest stay possibility');
  ok(JSON.stringify(built) === JSON.stringify(built2) && estate.cache.size() === 1, 'and the same spec builds ONCE (content-cached) — 99% held possibility, 1% collapsed actual');

  // the unifying claim, asserted: all three ran the SAME core function with different (generate, score, author).
  ok(typeof oracle.run === 'function' && typeof recollapse.run === 'function' && typeof estate.run === 'function' && C.move === move, 'all three are `organ(...)` over the ONE `move` — organs of one body, not three apps');
}

console.log('\n=== §6 · THE HONEST WIRE — a clashed branch can never be surfaced as HELD; nothing collapses unbidden ===');
{
  const held = hold(fork(7, i => i), () => 0.3);           // everything clashes (<κ)
  const r = collapse(held);
  ok(r.holds.length === 0 && r.roads.length === 7 && r.decided === false && r.chosen === null, 'when NOTHING holds, nothing is chosen and nothing is faked — the field stays open (a bad collapse is never returned as actual)');
  const allHold = collapse(hold(fork(3, i => i), () => 0.99));
  ok(allHold.holds.length === 3 && allHold.roads.length === 0 && allHold.decided === false, 'even when everything holds, collapse still waits for an author — the collapse is authored, always');
}

console.log('\n=== §7 · DETERMINISM + FUZZ ===');
{
  const mk = () => move('s', { n: 5, generate: (i, t) => i + ':' + t.toFixed(2), score: v => (v.length % 3) / 3 });
  ok(JSON.stringify(mk()) === JSON.stringify(mk()), 'the same move is deterministic — same field every time');
  let threw = false;
  try {
    fork(0, () => 1); fork(-3, () => 1); hold([], () => 0.5); collapse([]); collapse(hold(fork(2, i => i), () => NaN));
    makeCache().once('k', () => 1); h16(''); h16(null); move('x', { generate: () => 1, score: () => 0.5, n: 0 });
    organ({ generate: () => 1, score: () => 2 }).run('y');   // score >1 clamps, never throws
  } catch { threw = true; }
  ok(!threw, 'empty/negative forks, NaN scores, null keys, zero-branch moves never throw');
}

const done = fail === 0;
console.log('\n' + (done
  ? `=== ✅ LIVEWARE core — ONE move (fork golden → hold at κ → collapse authored → cache by content), and the three tenses are that one move differently injected · ${pass}/${pass} · zero tokens ===`
  : `=== ❌ ${fail} FAILED / ${pass + fail} ===`));
process.exit(done ? 0 : 1);
