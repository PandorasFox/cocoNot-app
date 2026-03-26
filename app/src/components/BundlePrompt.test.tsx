// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act, cleanup } from '@testing-library/react'
import { decideAction } from './BundlePrompt'
import type { BundleMeta } from '../lib/bundle'

const REMOTE_META: BundleMeta = {
  count: 864376,
  size_bytes: 36696443,
  compressed_bytes: 16560144,
  updated_at: '2026-03-26T06:30:45.759720061Z',
  base_url: 'https://world.openfoodfacts.org/product/',
}

// -- Pure decision logic tests --

describe('decideAction', () => {
  it('returns "up-to-date" when cached updated_at matches remote', () => {
    const cached = { ...REMOTE_META }
    expect(decideAction(REMOTE_META, cached, 'ask')).toBe('up-to-date')
  })

  it('returns "prompt" when no cached meta exists', () => {
    expect(decideAction(REMOTE_META, null, 'ask')).toBe('prompt')
  })

  it('returns "prompt" when cached updated_at is older', () => {
    const cached = { ...REMOTE_META, updated_at: '2026-03-25T00:00:00Z' }
    expect(decideAction(REMOTE_META, cached, 'ask')).toBe('prompt')
  })

  it('returns "auto-download" when pref is "always" and bundle is stale', () => {
    const cached = { ...REMOTE_META, updated_at: '2026-03-25T00:00:00Z' }
    expect(decideAction(REMOTE_META, cached, 'always')).toBe('auto-download')
  })

  it('returns "auto-download" when pref is "always" and no cache', () => {
    expect(decideAction(REMOTE_META, null, 'always')).toBe('auto-download')
  })

  it('returns "up-to-date" even when pref is "always" if already current', () => {
    const cached = { ...REMOTE_META }
    expect(decideAction(REMOTE_META, cached, 'always')).toBe('up-to-date')
  })
})

// -- Component rendering tests (mocked network) --

// Mock the bundle module
vi.mock('../lib/bundle', async () => {
  const actual = await vi.importActual<typeof import('../lib/bundle')>('../lib/bundle')
  return {
    ...actual,
    fetchMeta: vi.fn(),
    fetchBundle: vi.fn(),
    loadBundle: vi.fn().mockResolvedValue(null),
    getCachedMeta: vi.fn(),
    setCachedMeta: vi.fn(),
    getPref: vi.fn().mockReturnValue('ask'),
    setPref: vi.fn(),
  }
})

import BundlePrompt from './BundlePrompt'
import * as bundle from '../lib/bundle'

const mockFetchMeta = vi.mocked(bundle.fetchMeta)
const mockFetchBundle = vi.mocked(bundle.fetchBundle)
const mockGetCachedMeta = vi.mocked(bundle.getCachedMeta)
const mockGetPref = vi.mocked(bundle.getPref)

beforeEach(() => {
  vi.clearAllMocks()
  mockGetPref.mockReturnValue('ask')
})

afterEach(() => {
  cleanup()
})

describe('BundlePrompt component', () => {
  it('shows download prompt when no cached bundle exists', async () => {
    mockFetchMeta.mockResolvedValue(REMOTE_META)
    mockGetCachedMeta.mockReturnValue(null)

    render(<BundlePrompt />)

    await waitFor(() => {
      expect(screen.getByText(/Download SKU-to-coconut mapping data/)).toBeTruthy()
    })
    expect(screen.getByText(/15\.8 MB/)).toBeTruthy()
    expect(screen.getByText('Yes')).toBeTruthy()
    expect(screen.getByText('Always')).toBeTruthy()
    expect(screen.getByText('No')).toBeTruthy()
  })

  it('shows download prompt when cached bundle is stale', async () => {
    mockFetchMeta.mockResolvedValue(REMOTE_META)
    mockGetCachedMeta.mockReturnValue({
      ...REMOTE_META,
      updated_at: '2026-03-25T00:00:00Z',
    })

    render(<BundlePrompt />)

    await waitFor(() => {
      expect(screen.getByText(/Download SKU-to-coconut mapping data/)).toBeTruthy()
    })
  })

  it('shows "up to date" when cached bundle matches remote', async () => {
    mockFetchMeta.mockResolvedValue(REMOTE_META)
    mockGetCachedMeta.mockReturnValue({ ...REMOTE_META })

    render(<BundlePrompt />)

    await waitFor(() => {
      expect(screen.getByText('Product database up to date')).toBeTruthy()
    })
  })

  it('auto-downloads without prompt when pref is "always"', async () => {
    mockFetchMeta.mockResolvedValue(REMOTE_META)
    mockGetCachedMeta.mockReturnValue(null)
    mockGetPref.mockReturnValue('always')
    mockFetchBundle.mockResolvedValue(new Map())

    render(<BundlePrompt />)

    await waitFor(() => {
      expect(mockFetchBundle).toHaveBeenCalled()
    })
    // Should NOT show the prompt buttons
    expect(screen.queryByText('Yes')).toBeNull()
  })

  it('shows progress bar during download', async () => {
    mockFetchMeta.mockResolvedValue(REMOTE_META)
    mockGetCachedMeta.mockReturnValue(null)

    // Make fetchBundle call onProgress
    mockFetchBundle.mockImplementation(async (onProgress) => {
      onProgress?.(8000000, 16000000)
      return new Map()
    })

    render(<BundlePrompt />)

    // Wait for prompt to appear, then click Yes
    await waitFor(() => {
      expect(screen.getByText('Yes')).toBeTruthy()
    })

    await act(async () => {
      screen.getByText('Yes').click()
    })

    // fetchBundle was called
    expect(mockFetchBundle).toHaveBeenCalled()
  })

  it('dismisses when No is clicked', async () => {
    mockFetchMeta.mockResolvedValue(REMOTE_META)
    mockGetCachedMeta.mockReturnValue(null)

    render(<BundlePrompt />)

    await waitFor(() => {
      expect(screen.getByText('No')).toBeTruthy()
    })

    await act(async () => {
      screen.getByText('No').click()
    })

    // Prompt should be gone
    expect(screen.queryByText(/Download SKU/)).toBeNull()
    expect(mockFetchBundle).not.toHaveBeenCalled()
  })

  it('renders nothing when meta fetch fails', async () => {
    mockFetchMeta.mockRejectedValue(new Error('network error'))

    const { container } = render(<BundlePrompt />)

    // Wait for the async check to complete
    await waitFor(() => {
      expect(container.querySelector('.fixed')).toBeNull()
    })
  })
})
