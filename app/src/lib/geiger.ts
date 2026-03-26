import { getGeigerEnabled } from './settings'

const CLICK_FILES = [
  '/sfx/geiger1.wav',
  '/sfx/geiger2.wav',
  '/sfx/geiger3.wav',
  '/sfx/geiger4.wav',
  '/sfx/geiger5.wav',
  '/sfx/geiger6.wav',
]

/** Random delay between clicks (ms). */
const MIN_DELAY = 30
const MAX_DELAY = 120

/**
 * Geiger counter audio engine.
 * Plays random click SFX in a loop while coconut detections are active.
 */
export class GeigerEngine {
  private pools: HTMLAudioElement[][] = []
  private active = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor() {
    // Pre-create a pool of 2 Audio elements per click file for overlap
    this.pools = CLICK_FILES.map(src => [new Audio(src), new Audio(src)])
  }

  /** Call on each hitbox state change with current detection status. */
  update(coconutDetected: boolean): void {
    if (!getGeigerEnabled()) {
      this.stop()
      return
    }

    if (coconutDetected && !this.active) {
      this.active = true
      this.scheduleNext()
    } else if (!coconutDetected && this.active) {
      this.stop()
    }
  }

  private scheduleNext(): void {
    if (!this.active) return
    const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)
    this.timer = setTimeout(() => {
      this.playClick()
      this.scheduleNext()
    }, delay)
  }

  private playClick(): void {
    const poolIdx = Math.floor(Math.random() * this.pools.length)
    const pool = this.pools[poolIdx]
    // Pick the first element that's not currently playing, or reuse [0]
    const el = pool.find(a => a.paused || a.ended) ?? pool[0]
    el.currentTime = 0
    el.play().catch(() => {})
  }

  private stop(): void {
    this.active = false
    if (this.timer) {
      clearTimeout(this.timer)
      this.timer = null
    }
  }

  dispose(): void {
    this.stop()
    this.pools = []
  }
}
