# open-genome-atlas

**Curated, cited per-variant notes built from open genomics APIs — for anyone building genomics tools.**

A small, honest, growing dataset that answers two questions for a set of common
DNA variants (SNPs):

1. **What does the variant actually do?** — the genetics itself: gene, molecular
   consequence, protein change, established ClinVar associations, and how common
   each allele is across reference cohorts. Pulled + validated from open APIs,
   every field linking its primary source as proof.
2. **What modulates it?** — curated, cited evidence for how **diet, lifestyle,
   and region** dial that effect up or down (e.g. FTO × physical activity,
   millets & glycaemic response, alcohol type & ALDH2).

> **DNA is the source of truth.** The variant's molecular effect is fixed and
> lives in the genetics. Diet, lifestyle, and geography are **context that
> modulates — never determines**. Population frequency tells you *how common* a
> variant is in a cohort; it is **not** an ancestry verdict about a person.

This is the open data layer behind the DNA explorer at
**[sinhaankur.com/dna](https://www.sinhaankur.com/dna)** — extracted so others
can reference it. It grows over time; adding a variant or a piece of evidence is
a one-object edit.

---

## What's in `data/`

| File | What it is | License |
|---|---|---|
| `markers.json` | The variant registry: `id`, `rsid`, `gene`, `category`, `title`, `about`. | CC0 |
| `annotations.json` | Per-rsID validated facts: `gene`, `consequence`, `proteinChange`, `clinvar[]`, `freqs[]`, `sources{}`. Auto-built from MyVariant.info (dbSNP · ClinVar · gnomAD · CADD · snpEff). | CC0 |
| `evidence.json` | Per-marker curated diet / lifestyle / region evidence, each with a `source` + `pmid`/`url`. | CC0 |

Everything is plain JSON. No build step, no network at read time.

### Example — `annotations.json["rs671"]` (ALDH2, the "alcohol flush")

```json
{
  "rsid": "rs671",
  "gene": "ALDH2",
  "geneName": "aldehyde dehydrogenase 2 family member",
  "vartype": "snv",
  "consequence": "NON_SYNONYMOUS",
  "proteinChange": "p.Glu504Lys",
  "clinvar": [
    { "significance": "risk factor", "condition": "ESOPHAGEAL CANCER, ALCOHOL-RELATED, SUSCEPTIBILITY TO" }
  ],
  "freqs": [
    { "cohort": "1000 Genomes (global)", "allele": "A", "freq": 0.034 },
    { "cohort": "Japanese (ToMMo)", "allele": "A", "freq": 0.194 }
  ],
  "sources": {
    "dbsnp": "https://www.ncbi.nlm.nih.gov/snp/rs671",
    "clinvar": "https://www.ncbi.nlm.nih.gov/clinvar/?term=rs671",
    "gnomad": "https://gnomad.broadinstitute.org/variant/rs671?dataset=gnomad_r4",
    "ensembl": "https://www.ensembl.org/Homo_sapiens/Variation/Explore?v=rs671"
  }
}
```

---

## Use it

**Just read the JSON** (any language):

```js
const anno = await fetch(
  "https://raw.githubusercontent.com/sinhaankur/open-genome-atlas/main/data/annotations.json"
).then((r) => r.json())
console.log(anno["rs671"].proteinChange) // "p.Glu504Lys"
```

**Or the tiny Node helper** (zero dependencies):

```js
import { getVariant } from "open-genome-atlas"

const v = getVariant("rs671")     // or getVariant("alcohol-flush")
v.marker      // registry entry
v.annotation  // validated genetics + sources
v.evidence    // cited diet/lifestyle/region notes
```

---

## Refresh / extend

```bash
node scripts/fetch-annotations.mjs   # re-pull annotations from open APIs
node scripts/validate.mjs            # fail loudly if any record is unsourced
```

- **Add a variant:** append to `data/markers.json`, then run `fetch`.
- **Add evidence:** add a `{ kind, factor, finding, source, pmid|url }` object
  under the marker id in `data/evidence.json`. Every entry must be cited —
  `validate.mjs` enforces it.

## Data sources

[dbSNP](https://www.ncbi.nlm.nih.gov/snp/) ·
[ClinVar](https://www.ncbi.nlm.nih.gov/clinvar/) ·
[gnomAD](https://gnomad.broadinstitute.org/) ·
[Ensembl](https://www.ensembl.org/) ·
[MyVariant.info](https://myvariant.info/) (aggregator) ·
[PubMed](https://pubmed.ncbi.nlm.nih.gov/) for the evidence literature.

## Not medical advice

These are associations and tendencies, compiled for **education**. A common
variant shifts odds at most; it never decides an outcome, and a consumer
genotyping chip can't assess serious clinical mutations. Talk to a clinician for
anything health-related.

## License

Code (`scripts/`, `src/`) — **MIT**. Data (`data/`) — **CC0 1.0** (public
domain). See [`LICENSE`](./LICENSE) and [`LICENSE-DATA`](./LICENSE-DATA).
