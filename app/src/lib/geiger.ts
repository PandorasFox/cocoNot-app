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
const MIN_DELAY = 200
const MAX_DELAY = 600

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
      this.playAndSchedule()
    } else if (!coconutDetected && this.active) {
      this.stop()
    }
  }

  private playAndSchedule(): void {
    if (!this.active) return
    const poolIdx = Math.floor(Math.random() * this.pools.length)
    const pool = this.pools[poolIdx]
    const el = pool.find(a => a.paused || a.ended) ?? pool[0]
    el.currentTime = 0

    // Wait for clip to finish, then delay, then next
    const onDone = () => {
      el.removeEventListener('ended', onDone)
      if (!this.active) return
      const delay = MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY)
      this.timer = setTimeout(() => this.playAndSchedule(), delay)
    }
    el.addEventListener('ended', onDone)
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
