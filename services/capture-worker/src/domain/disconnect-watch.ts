export type Timers = {
  set: (run: () => void, ms: number) => unknown
  clear: (handle: unknown) => void
}

/**
 * Counts the screens connected to a video session and calls `onExpire` once when
 * none has been connected for `graceMs` (ADR-005: a lost connection interrupts the
 * capture). A reconnect inside the grace period, such as an F5, cancels the countdown.
 * The countdown also runs from creation, until the first screen connects.
 */
export class DisconnectWatch {
  private connections = 0
  private handle: unknown = null
  private stopped = false

  constructor(
    private readonly graceMs: number,
    private readonly onExpire: () => void,
    private readonly timers: Timers = { set: (run, ms) => setTimeout(run, ms), clear: (handle) => clearTimeout(handle as NodeJS.Timeout) },
  ) {
    this.arm()
  }

  connected(): void {
    if (this.stopped) return
    this.connections += 1
    this.disarm()
  }

  disconnected(): void {
    if (this.stopped) return
    this.connections = Math.max(0, this.connections - 1)
    if (this.connections === 0) this.arm()
  }

  /** The session ended (concluded, cancelled, failed): never fire. */
  stop(): void {
    this.stopped = true
    this.disarm()
  }

  private arm(): void {
    this.disarm()
    this.handle = this.timers.set(() => {
      this.handle = null
      if (this.stopped || this.connections > 0) return
      this.stopped = true
      this.onExpire()
    }, this.graceMs)
  }

  private disarm(): void {
    if (this.handle !== null) this.timers.clear(this.handle)
    this.handle = null
  }
}
