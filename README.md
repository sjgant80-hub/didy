# Didy

**▶ [Live — open Didy](https://sjgant80-hub.github.io/didy/)**

**📄 [Download the pitch deck (PDF)](https://www.ai-nativesolutions.com/fall-os-deck.pdf)** · **📄 [Download the prospectus (PDF)](https://www.ai-nativesolutions.com/fall-os-prospectus.pdf)**

*The trainable conductor of [fall-os](https://sjgant80-hub.github.io/fall-os/) — one control loop over your own models, local-first.*

---

A **Didy** is the conductor: the single control loop that turns a plain-language instruction into work
across everything you own. It ships **blank**; you train it by registering organs and sign it with your
own prefix, producing a `<prefix>-didy` — a named instance on the lineage.

## The guarantee

A request descends to the cheapest capable tier. T0–T2.5 run on hardware you own; T3–T4 leave the
machine and are consent-gated. **If you have not granted a tier, its provider is never invoked** — so
the prompt is never serialised outward. That is structural, not a policy: verified by spy providers
that record whether they were called at all.

If no permitted tier can answer, it returns an honest failure rather than silently escalating.

## Modules

| Module | Responsibility | Mutation gate |
|---|---|---|
| `cascade.mjs` | Local-first routing and the consent guarantee | 18/18 · clean |
| `conductor.mjs` | The five-phase loop, organ registry, grounded commitment | 17/17 · clean |
| `core.mjs` | Shared engine: expand, score, commit, cache | 10/12 · clean |
| `shadow.mjs` | The index of options not taken | 10/10 · clean |

```bash
node core.test.mjs && node shadow.test.mjs && node conductor.test.mjs && node cascade.test.mjs
node scripts/serve.mjs   # http://localhost:8280
```

Pure ES modules · zero runtime dependencies · mutation-gated in CI · the page imports the same source
the tests verify.

---

**Powered by Konomi architecture** · part of the [AI Native Solutions](https://www.ai-nativesolutions.com) estate.
