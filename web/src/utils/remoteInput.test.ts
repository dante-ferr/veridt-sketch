import { describe, expect, it } from 'vitest'
import { formatRecordingClock, remoteKey, remotePoint } from './remoteInput'

const key = (value: string, mods: Partial<{ ctrlKey: boolean; metaKey: boolean; altKey: boolean }> = {}) => ({
  key: value,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
})

describe('remoteKey', () => {
  it('sends printable characters, accents included', () => {
    expect(remoteKey(key('a'))).toBe('a')
    expect(remoteKey(key('Á'))).toBe('Á')
    expect(remoteKey(key('ç'))).toBe('ç')
    expect(remoteKey(key(' '))).toBe(' ')
  })

  it('keeps named keys', () => {
    expect(remoteKey(key('Enter'))).toBe('Enter')
    expect(remoteKey(key('Backspace'))).toBe('Backspace')
    expect(remoteKey(key('ArrowDown'))).toBe('ArrowDown')
  })

  it('turns Ctrl/Cmd + letter into a shortcut', () => {
    expect(remoteKey(key('A', { ctrlKey: true }))).toBe('Control+a')
    expect(remoteKey(key('c', { metaKey: true }))).toBe('Control+c')
  })

  it('ignores modifiers and dead keys', () => {
    expect(remoteKey(key('Shift'))).toBeNull()
    expect(remoteKey(key('Dead'))).toBeNull()
  })
})

describe('remotePoint', () => {
  it('maps a click when the image fills the box', () => {
    expect(remotePoint({ x: 640, y: 360 }, { width: 1280, height: 720 })).toEqual({ x: 640, y: 360 })
  })

  it('accounts for the letterbox of object-fit: contain', () => {
    // 856×560 box: the 16:9 image is 856×481.5, centered with 39.25px bands
    expect(remotePoint({ x: 0, y: 39.25 }, { width: 856, height: 560 })).toEqual({ x: 0, y: 0 })
    expect(remotePoint({ x: 428, y: 280 }, { width: 856, height: 560 })).toEqual({ x: 640, y: 360 })
    expect(remotePoint({ x: 428, y: 10 }, { width: 856, height: 560 })).toBeNull()
  })
})

describe('formatRecordingClock', () => {
  it('shows elapsed time against the 15-minute limit', () => {
    const start = '2026-11-10T12:00:00.000Z'
    expect(formatRecordingClock(start, Date.parse(start) + 222_000)).toBe('03:42 / 15:00')
    expect(formatRecordingClock(start, Date.parse(start) + 20 * 60_000)).toBe('15:00 / 15:00')
    expect(formatRecordingClock(null, 0)).toBe('00:00 / 15:00')
  })
})
