const COCONOT_API = 'https://coconot.hecate.pink'

const IDB_NAME = 'coconot'
const IDB_STORE = 'bundle'
const IDB_KEY = 'tsv'
const LS_META = 'coconot:bundle:meta'
const LS_PREF = 'coconot:bundle:pref'

export interface BundleProduct {
  code: string
  name: string
  /** y = contains coconut, n = does not, ? = unknown */
  coconut: 'y' | 'n' | '?'
}

export interface BundleMeta {
  count: number
  size_bytes: number
  compressed_bytes: number
  updated_at: string
  base_url: string
}

export type BundlePref = 'always' | 'ask' | 'skip'

let cache: Map<string, BundleProduct> | null = null
let baseUrl: string = 'https://world.openfoodfacts.org/product/'

// -- IndexedDB helpers --

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(IDB_STORE)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function idbGet(key: string): Promise<string | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const req = tx.objectStore(IDB_STORE).get(key)
    req.onsuccess = () => resolve(req.result as string | undefined)
    req.onerror = () => reject(req.error)
  })
}

async function idbPut(key: string, value: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    tx.objectStore(IDB_STORE).put(value, key)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

// -- Fetch --

/** Fetch bundle metadata from the server. */
export async function fetchMeta(): Promise<BundleMeta> {
  const res = await fetch(`${COCONOT_API}/api/bundle/meta`)
  if (!res.ok) throw new Error(`Bundle meta: ${res.status}`)
  return res.json()
}

/**
 * Fetch the full bundle with progress reporting.
 * Streams the response and reports bytes received via onProgress.
 * Stores the raw TSV in indexedDB, builds the in-memory lookup map.
 */
export async function fetchBundle(
  onProgress?: (received: number, total: number) => void,
): Promise<Map<string, BundleProduct>> {
  // Server sends raw gzipped bytes as application/octet-stream (no Content-Encoding).
  // This avoids proxy interference — Content-Length matches bytes on the wire.
  // We decompress client-side with DecompressionStream.
  const res = await fetch(`${COCONOT_API}/api/bundle`)
  if (!res.ok) throw new Error(`Bundle fetch: ${res.status}`)

  const contentLength = parseInt(res.headers.get('content-length') || '0', 10)
  const reader = res.body?.getReader()

  let tsv: string
  if (reader && contentLength > 0) {
    // Read compressed bytes with progress tracking
    const chunks: Uint8Array[] = []
    let received = 0
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      chunks.push(value)
      received += value.length
      onProgress?.(received, contentLength)
    }
    const merged = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }

    // Decompress gzip client-side
    const decompressed = new Blob([merged]).stream().pipeThrough(new DecompressionStream('gzip'))
    tsv = await new Response(decompressed).text()
  } else {
    // Fallback: server sent uncompressed (or no content-length)
    tsv = await res.text()
  }

  const { headers, products } = parseBundleTsv(tsv)
  if (headers.base_url) baseUrl = headers.base_url
  await idbPut(IDB_KEY, tsv)
  cache = buildMap(products)
  return cache
}

// -- TSV parsing --

/**
 * Parse TSV bundle format:
 *   key\tvalue header lines, then ---, then sku\tname\tstatus rows.
 */
export function parseBundleTsv(tsv: string): { headers: Record<string, string>; products: BundleProduct[] } {
  const lines = tsv.split('\n')
  const headers: Record<string, string> = {}
  let i = 0

  // Parse header section until ---
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (line === '---') { i++; break }
    const tab = line.indexOf('\t')
    if (tab > 0) headers[line.slice(0, tab)] = line.slice(tab + 1)
  }

  // Parse product rows
  const products: BundleProduct[] = []
  for (; i < lines.length; i++) {
    const line = lines[i]
    if (!line) continue
    const tab1 = line.indexOf('\t')
    if (tab1 < 0) continue
    const tab2 = line.indexOf('\t', tab1 + 1)
    if (tab2 < 0) continue
    const code = line.slice(0, tab1)
    const name = line.slice(tab1 + 1, tab2)
    const status = line.slice(tab2 + 1) as 'y' | 'n' | '?'
    products.push({ code, name, coconut: status })
  }

  return { headers, products }
}

// -- Cache access --

/** Load bundle from indexedDB into memory if not already cached. */
export async function loadBundle(): Promise<Map<string, BundleProduct> | null> {
  if (cache) return cache
  const tsv = await idbGet(IDB_KEY)
  if (!tsv) return null
  try {
    const { headers, products } = parseBundleTsv(tsv)
    if (headers.base_url) baseUrl = headers.base_url
    cache = buildMap(products)
    return cache
  } catch {
    return null
  }
}

/** Look up a barcode in the cached bundle (sync — must call loadBundle first). */
export function lookupBarcode(code: string): BundleProduct | undefined {
  if (!cache) return undefined
  // Try exact match first, then zero-padded to 13 digits (UPC-A → EAN-13)
  return cache.get(code) ?? cache.get(code.padStart(13, '0'))
}

/** Get the base URL for product pages (from bundle header). */
export function getBaseUrl(): string {
  return baseUrl
}

/** Get/set the cached meta (for comparing updated_at). Small, stays in localStorage. */
export function getCachedMeta(): BundleMeta | null {
  const raw = localStorage.getItem(LS_META)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export function setCachedMeta(meta: BundleMeta): void {
  localStorage.setItem(LS_META, JSON.stringify(meta))
}

/** Get/set user preference for bundle downloads. */
export function getPref(): BundlePref {
  return (localStorage.getItem(LS_PREF) as BundlePref) || 'ask'
}

export function setPref(pref: BundlePref): void {
  localStorage.setItem(LS_PREF, pref)
}

function buildMap(products: BundleProduct[]): Map<string, BundleProduct> {
  const map = new Map<string, BundleProduct>()
  for (const p of products) map.set(p.code, p)
  return map
}
