import { getGeigerEnabled } from './settings'

const CLICK_FILES = [
  '/sfx/geiger1.wav',
  '/sfx/geiger2.wav',
  '/sfx/geiger3.wav',
  '/sfx/geiger4.wav',
  '/sfx/geiger5.wav',
  '/sfx/geiger6.wav',
]

const MAX_DELAY = 400

/**
 * Geiger counter audio engine.
 * Plays random click SFX while coconut detections are active.
 * Next click schedules after the current clip is at least halfway played.
 */
export class GeigerEngine {
  private pools: HTMLAudioElement[][] = []
  private active = false
  private timer: ReturnType<typeof setTimeout> | null = null

  constructor() {
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
    el.play().catch(() => {})

    // Schedule next after at least half the clip duration + random delay
    const halfDuration = (el.duration && isFinite(el.duration))
      ? (el.duration * 1000) / 2
      : 50
    const delay = halfDuration + Math.random() * MAX_DELAY
    this.timer = setTimeout(() => this.playAndSchedule(), delay)
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
