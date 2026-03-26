import { describe, it, expect } from 'vitest'
import { parseBundleTsv, type BundleMeta } from './bundle'

// -- Unit tests: TSV parsing --

describe('parseBundleTsv', () => {
  it('parses headers and product rows', () => {
    const tsv = [
      'base_url\thttps://world.openfoodfacts.org/product/',
      'updated_at\t2026-03-26T06:30:45Z',
      'count\t3',
      '---',
      '0039779002007\tOriginal Beef Jerky\t?',
      '0658686600016\tGrapeseed Oil\tn',
      '0901360272949\tBourbon, butter cookies\ty',
    ].join('\n')

    const { headers, products } = parseBundleTsv(tsv)

    expect(headers.base_url).toBe('https://world.openfoodfacts.org/product/')
    expect(headers.updated_at).toBe('2026-03-26T06:30:45Z')
    expect(headers.count).toBe('3')

    expect(products).toHaveLength(3)
    expect(products[0]).toEqual({ code: '0039779002007', name: 'Original Beef Jerky', coconut: '?' })
    expect(products[1]).toEqual({ code: '0658686600016', name: 'Grapeseed Oil', coconut: 'n' })
    expect(products[2]).toEqual({ code: '0901360272949', name: 'Bourbon, butter cookies', coconut: 'y' })
  })

  it('handles trailing newline', () => {
    const tsv = 'base_url\thttp://example.com/\n---\n123\tFoo\tn\n'
    const { products } = parseBundleTsv(tsv)
    expect(products).toHaveLength(1)
  })

  it('skips malformed rows', () => {
    const tsv = '---\n123\tFoo\tn\nbadline\n456\tBar\ty\n'
    const { products } = parseBundleTsv(tsv)
    expect(products).toHaveLength(2)
    expect(products[0].code).toBe('123')
    expect(products[1].code).toBe('456')
  })

  it('returns empty products for empty body', () => {
    const tsv = 'base_url\thttp://example.com/\n---\n'
    const { headers, products } = parseBundleTsv(tsv)
    expect(headers.base_url).toBe('http://example.com/')
    expect(products).toHaveLength(0)
  })
})

// -- Integration tests: live endpoints --

describe('live bundle endpoints', () => {
  it('GET /api/bundle/meta returns valid metadata', async () => {
    const res = await fetch('https://coconot.hecate.pink/api/bundle/meta')
    expect(res.ok).toBe(true)

    const meta: BundleMeta = await res.json()
    expect(meta.count).toBeTypeOf('number')
    expect(meta.count).toBeGreaterThan(0)
    expect(meta.size_bytes).toBeTypeOf('number')
    expect(meta.size_bytes).toBeGreaterThan(0)
    expect(meta.compressed_bytes).toBeTypeOf('number')
    expect(meta.compressed_bytes).toBeGreaterThan(0)
    expect(meta.compressed_bytes).toBeLessThan(meta.size_bytes)
    expect(meta.updated_at).toBeTypeOf('string')
    expect(new Date(meta.updated_at).getTime()).not.toBeNaN()
    expect(meta.base_url).toBeTypeOf('string')
    expect(meta.base_url).toContain('openfoodfacts.org')
  })

  it('GET /api/bundle returns valid TSV with matching count', async () => {
    // Fetch meta first for count comparison
    const metaRes = await fetch('https://coconot.hecate.pink/api/bundle/meta')
    const meta: BundleMeta = await metaRes.json()

    // Fetch bundle
    const res = await fetch('https://coconot.hecate.pink/api/bundle')
    expect(res.ok).toBe(true)

    const tsv = await res.text()
    const { headers, products } = parseBundleTsv(tsv)

    // Headers present
    expect(headers.base_url).toBe(meta.base_url)
    expect(headers.updated_at).toBeTruthy()
    expect(headers.count).toBe(String(meta.count))

    // Product count matches meta
    expect(products.length).toBe(meta.count)

    // Spot-check product shape
    const sample = products[0]
    expect(sample.code).toBeTypeOf('string')
    expect(sample.code.length).toBeGreaterThan(0)
    expect(sample.name).toBeTypeOf('string')
    expect(sample.name.length).toBeGreaterThan(0)
    expect(['y', 'n', '?']).toContain(sample.coconut)

    // All statuses are valid
    const validStatuses = new Set(['y', 'n', '?'])
    const invalidProducts = products.filter(p => !validStatuses.has(p.coconut))
    expect(invalidProducts).toHaveLength(0)
  }, 30_000) // generous timeout for ~17MB download

  it('bundle contains at least some coconut-positive products', async () => {
    const res = await fetch('https://coconot.hecate.pink/api/bundle')
    const tsv = await res.text()
    const { products } = parseBundleTsv(tsv)

    const coconutProducts = products.filter(p => p.coconut === 'y')
    expect(coconutProducts.length).toBeGreaterThan(0)

    // Sanity: coconut products should have names
    for (const p of coconutProducts.slice(0, 10)) {
      expect(p.name.length).toBeGreaterThan(0)
      expect(p.code.length).toBeGreaterThan(0)
    }
  }, 30_000)
})
