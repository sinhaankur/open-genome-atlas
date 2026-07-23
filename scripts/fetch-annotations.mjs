/**
 * fetch-annotations.mjs — refresh data/annotations.json from open genomics APIs.
 *
 * For every rsID in data/markers.json, pull VALIDATED, cited annotations from
 * MyVariant.info (which aggregates dbSNP · ClinVar · gnomAD · CADD · snpEff) and
 * write them to data/annotations.json. Everything written is real, known, and
 * traceable — each record carries the primary source URLs as proof.
 *
 * Population frequencies describe how COMMON a variant is in reference cohorts.
 * They are NOT an ancestry/geography verdict about any individual.
 *
 * Usage:  node scripts/fetch-annotations.mjs
 * Deterministic + idempotent; re-run any time to refresh.
 */

import { readFileSync, writeFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")

const markers = JSON.parse(readFileSync(join(ROOT, "data/markers.json"), "utf8"))
const RSIDS = [...new Set(markers.map((m) => m.rsid))]

const COHORTS = [
  ["1000g", "1000 Genomes (global)"],
  ["gnomad", "gnomAD (global)"],
  ["topmed", "TOPMed (US)"],
  ["korean", "Korean"],
  ["tommo", "Japanese (ToMMo)"],
  ["vietnamese", "Vietnamese"],
  ["alspac", "UK (ALSPAC)"],
]

const FIELDS = [
  "dbsnp.gene.name",
  "dbsnp.gene.symbol",
  "dbsnp.alleles",
  "dbsnp.vartype",
  "dbsnp.chrom",
  "clinvar.rcv.clinical_significance",
  "clinvar.rcv.conditions.name",
  "cadd.consequence",
  "cadd.gene.genename",
  "snpeff.ann.genename",
  "snpeff.ann.putative_impact",
  "snpeff.ann.hgvs_p",
].join(",")

async function fetchOne(rsid) {
  const url = `https://myvariant.info/v1/query?q=dbsnp.rsid:${rsid}&fields=${FIELDS}&size=1`
  const res = await fetch(url, { headers: { accept: "application/json" } })
  if (!res.ok) throw new Error(`${rsid}: HTTP ${res.status}`)
  const json = await res.json()
  const hit = json?.hits?.[0]
  if (!hit) return { rsid, missing: true }

  const dbsnp = hit.dbsnp ?? {}
  const clinvar = hit.clinvar ?? {}
  const cadd = hit.cadd ?? {}
  const snpeff = hit.snpeff ?? {}
  const ann = Array.isArray(snpeff.ann) ? snpeff.ann[0] : snpeff.ann

  const gene =
    ann?.genename ||
    cadd?.gene?.genename ||
    dbsnp?.gene?.symbol ||
    (Array.isArray(dbsnp?.gene) ? dbsnp.gene[0]?.symbol : undefined) ||
    null
  const geneName =
    dbsnp?.gene?.name ||
    (Array.isArray(dbsnp?.gene) ? dbsnp.gene[0]?.name : undefined) ||
    null

  const consequence = cadd?.consequence
    ? String(Array.isArray(cadd.consequence) ? cadd.consequence[0] : cadd.consequence)
    : ann?.putative_impact
      ? `${ann.putative_impact} impact`
      : null
  const proteinChange = ann?.hgvs_p ?? null

  const rcv = clinvar.rcv ? (Array.isArray(clinvar.rcv) ? clinvar.rcv : [clinvar.rcv]) : []
  const clinvarEntries = []
  const seen = new Set()
  for (const r of rcv) {
    const sig = r?.clinical_significance
    const cond = r?.conditions?.name
    if (!sig || !cond) continue
    if (/uncertain|not provided|other\b/i.test(sig)) continue
    const key = `${sig}|${cond}`
    if (seen.has(key)) continue
    seen.add(key)
    clinvarEntries.push({ significance: sig, condition: cond })
  }

  const alleles = Array.isArray(dbsnp.alleles) ? dbsnp.alleles : []
  const freqs = []
  for (const [key, label] of COHORTS) {
    const withFreq = alleles.filter((a) => a?.freq && typeof a.freq[key] === "number")
    if (!withFreq.length) continue
    const minor = withFreq.reduce((lo, a) => {
      const g = a.freq["1000g"] ?? a.freq.gnomad ?? 1
      const glo = lo.freq["1000g"] ?? lo.freq.gnomad ?? 1
      return g < glo ? a : lo
    })
    freqs.push({ cohort: label, allele: minor.allele, freq: Number(minor.freq[key].toFixed(3)) })
  }

  return {
    rsid,
    gene,
    geneName,
    vartype: dbsnp.vartype ?? null,
    chrom: dbsnp.chrom ? String(dbsnp.chrom) : null,
    consequence,
    proteinChange,
    clinvar: clinvarEntries.slice(0, 6),
    freqs,
    sources: {
      dbsnp: `https://www.ncbi.nlm.nih.gov/snp/${rsid}`,
      clinvar: `https://www.ncbi.nlm.nih.gov/clinvar/?term=${rsid}`,
      gnomad: `https://gnomad.broadinstitute.org/variant/${rsid}?dataset=gnomad_r4`,
      ensembl: `https://www.ensembl.org/Homo_sapiens/Variation/Explore?v=${rsid}`,
      myvariant: `https://myvariant.info/v1/query?q=dbsnp.rsid:${rsid}`,
    },
  }
}

async function main() {
  console.log(`Fetching ${RSIDS.length} markers from MyVariant.info…`)
  const out = {}
  let ok = 0
  for (const rsid of RSIDS) {
    try {
      const rec = await fetchOne(rsid)
      out[rsid] = rec
      if (!rec.missing) ok++
      process.stdout.write(rec.missing ? "·" : "✓")
    } catch (e) {
      out[rsid] = { rsid, error: String(e.message) }
      process.stdout.write("✗")
    }
    await new Promise((r) => setTimeout(r, 120))
  }
  console.log(`\n${ok}/${RSIDS.length} annotated.`)
  writeFileSync(join(ROOT, "data/annotations.json"), JSON.stringify(out, null, 2) + "\n")
  console.log("Wrote data/annotations.json")
}

main()
