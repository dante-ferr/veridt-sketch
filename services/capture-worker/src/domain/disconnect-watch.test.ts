import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DisconnectWatch } from './disconnect-watch'

describe('DisconnectWatch', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('expires when no screen connects within the grace period', () => {
    const onExpire = vi.fn()
    new DisconnectWatch(30_000, onExpire)
    vi.advanceTimersByTime(29_999)
    expect(onExpire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('does not expire while a screen is connected', () => {
    const onExpire = vi.fn()
    const watch = new DisconnectWatch(30_000, onExpire)
    watch.connected()
    vi.advanceTimersByTime(15 * 60_000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('survives a quick reconnect, like an F5', () => {
    const onExpire = vi.fn()
    const watch = new DisconnectWatch(30_000, onExpire)
    watch.connected()
    watch.disconnected()
    vi.advanceTimersByTime(2_000)
    watch.connected()
    vi.advanceTimersByTime(60_000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('expires once the last of several screens has been gone for the grace period', () => {
    const onExpire = vi.fn()
    const watch = new DisconnectWatch(30_000, onExpire)
    watch.connected()
    watch.connected()
    watch.disconnected()
    vi.advanceTimersByTime(60_000)
    expect(onExpire).not.toHaveBeenCalled()
    watch.disconnected()
    vi.advanceTimersByTime(30_000)
    expect(onExpire).toHaveBeenCalledTimes(1)
  })

  it('never fires after stop', () => {
    const onExpire = vi.fn()
    const watch = new DisconnectWatch(30_000, onExpire)
    watch.stop()
    vi.advanceTimersByTime(60_000)
    expect(onExpire).not.toHaveBeenCalled()
  })
})
