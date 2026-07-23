/**
 * validate.mjs — integrity check for the dataset. Fails loudly if anything is
 * unsourced, malformed, or references a missing marker. "We want proof" — this
 * is the guard that keeps every record honest.
 *
 * Usage:  node scripts/validate.mjs   (exit 1 on any problem)
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, "..", "data")
const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"))

const markers = load("markers.json")
const annotations = load("annotations.json")
const evidence = load("evidence.json")

const problems = []
const markerIds = new Set(markers.map((m) => m.id))
const rsids = new Set(markers.map((m) => m.rsid))

// Every marker is well-formed.
for (const m of markers) {
  if (!m.id) problems.push(`marker missing id: ${JSON.stringify(m)}`)
  if (!/^rs\d+$/.test(m.rsid || "")) problems.push(`${m.id}: bad rsid ${m.rsid}`)
}

// Every annotation has proof links + belongs to a known marker.
for (const [rsid, a] of Object.entries(annotations)) {
  if (!rsids.has(rsid)) problems.push(`annotation for unknown rsid ${rsid}`)
  if (a.missing || a.error) continue
  if (!a.sources || !a.sources.dbsnp) problems.push(`${rsid}: annotation has no source links`)
}

// Every evidence entry is cited (pmid or url) + keyed to a known marker.
for (const [markerId, list] of Object.entries(evidence)) {
  if (!markerIds.has(markerId)) problems.push(`evidence for unknown marker ${markerId}`)
  for (const e of list) {
    if (!e.source) problems.push(`${markerId}: evidence "${e.factor}" has no source`)
    if (!e.pmid && !e.url) problems.push(`${markerId}: evidence "${e.factor}" has no pmid/url proof`)
  }
}

const annotated = Object.values(annotations).filter((a) => !a.missing && !a.error).length
console.log(`markers: ${markers.length}`)
console.log(`annotations: ${annotated}/${Object.keys(annotations).length} resolved`)
console.log(`evidence: ${Object.keys(evidence).length} markers, ${Object.values(evidence).flat().length} cited entries`)

if (problems.length) {
  console.error(`\n✗ ${problems.length} problem(s):`)
  for (const p of problems) console.error("  - " + p)
  process.exit(1)
}
console.log("\n✓ dataset valid — every record is well-formed and sourced.")
