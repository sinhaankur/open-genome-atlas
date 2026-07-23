/**
 * open-genome-atlas — tiny, dependency-free lookup helpers over the dataset.
 *
 * The data is the product; this is just convenience. Load the JSON and query by
 * rsID or marker id. No network, no build step — import and use.
 *
 *   import { getMarker, getAnnotation, getEvidence, getVariant } from "open-genome-atlas"
 *   getVariant("rs671") // → { marker, annotation, evidence }
 */

import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA = join(__dirname, "..", "data")

const load = (f) => JSON.parse(readFileSync(join(DATA, f), "utf8"))

export const markers = load("markers.json")
export const annotations = load("annotations.json")
export const evidence = load("evidence.json")

const byRsid = new Map(markers.map((m) => [m.rsid, m]))
const byId = new Map(markers.map((m) => [m.id, m]))

/** Marker metadata by trait id (e.g. "lactose") or rsID (e.g. "rs4988235"). */
export function getMarker(key) {
  return byId.get(key) ?? byRsid.get(key) ?? null
}

/** Validated annotation (consequence, ClinVar, frequencies, sources) by rsID. */
export function getAnnotation(rsid) {
  return annotations[rsid] ?? null
}

/** Curated diet/lifestyle/region evidence by marker id. */
export function getEvidence(markerId) {
  return evidence[markerId] ?? []
}

/** Everything about one variant, by rsID or marker id. */
export function getVariant(key) {
  const marker = getMarker(key)
  if (!marker) return null
  return {
    marker,
    annotation: getAnnotation(marker.rsid),
    evidence: getEvidence(marker.id),
  }
}
