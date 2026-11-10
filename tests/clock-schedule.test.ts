import { describe, it, expect } from 'vitest';

import { nextClockDelayMs, CLOCK_MIN_MS, CLOCK_MAX_MS } from '../src/utils';
import type { WeatherAlert } from '../src/types';

// The card clock's scheduler (#393): the delay to the next moment anything the
// card shows changes. Pure, so every case pins the clock.

// 2026-07-01T12:00:00Z, on a whole minute.
const NOW = Date.UTC(2026, 6, 1, 12, 0, 0) / 1000;

function alert(onsetTs: number, endsTs: number, id = 'a'): WeatherAlert {
  return {
    id, event: 'Test', severity: 'moderate', severityLabel: 'Moderate', certainty: '', urgency: '',
    sentTs: onsetTs, onsetTs, endsTs, description: '', instruction: '', url: '', headline: '',
    areaDesc: '', zones: [], eventCode: '', provider: 'nws', phase: '',
    severityInferred: false, certaintyInferred: false,
  };
}

// Delay in whole seconds, slack dropped.
const secs = (ms: number) => Math.floor(ms / 1000);

describe('nextClockDelayMs', () => {
  it('waits the full cap with no alerts', () => {
    expect(nextClockDelayMs([], NOW)).toBe(CLOCK_MAX_MS);
  });

  it('aims at the countdown rollover, phased from the alert, not the clock', () => {
    // Ends 30 min 20 s from now: "30m" turns "29m" in 20 s.
    expect(secs(nextClockDelayMs([alert(NOW - 3600, NOW + 1820)], NOW))).toBe(20);
    // Started 10 min 45 s ago: "10m ago" turns "11m ago" in 15 s.
    expect(secs(nextClockDelayMs([alert(NOW - 645, 0)], NOW))).toBe(15);
  });

  it('takes the earliest boundary across alerts', () => {
    const a = alert(NOW - 3600, NOW + 1820, 'a');
    const b = alert(NOW - 3600, NOW + 1807, 'b');
    expect(secs(nextClockDelayMs([a, b], NOW))).toBe(7);
  });

  it('aims at an onset or end inside the minute', () => {
    // Onset in 3.5 s: the phase flips then, and the tick snaps up to the
    // next whole second so every card on the page shares the wakeup.
    const ms = nextClockDelayMs([alert(NOW + 3.5, NOW + 7230)], NOW);
    expect(ms).toBeGreaterThanOrEqual(4000);
    expect(ms).toBeLessThan(4100);
  });

  it('switches to hour resolution past a day', () => {
    // Began two days ago, ends 2 d 5 h 30 min out: both texts change on the
    // hour, the nearer in 30 min, so the cap wins. No bar (barPx 0).
    const a = alert(NOW - 2 * 86400, NOW + 2 * 86400 + 5 * 3600 + 1800);
    expect(nextClockDelayMs([a], NOW + 0.5, { timeZone: 'UTC' })).toBe(CLOCK_MAX_MS);
  });

  it('ticks the wall minute while an alert is pending (its "Now 14:05" label)', () => {
    // Onset and end both on whole minutes, so only the wall clock is left.
    const pending = alert(NOW + 3 * 3600, NOW + 5 * 3600);
    expect(secs(nextClockDelayMs([pending], NOW + 25))).toBe(35);
  });

  it('aims at local midnight in the display zone', () => {
    // Ongoing (no end), started on a whole minute 30 s past the clock's
    // minute, so its own rollover is 30 s away; the date suffix flips first.
    const tz = 'America/Denver'; // UTC-6 in July: midnight is 06:00Z
    const now = Date.UTC(2026, 6, 2, 5, 59, 50) / 1000;
    const ongoing = alert(now - 3600 + 30, 0);
    expect(secs(nextClockDelayMs([ongoing], now, { timeZone: tz }))).toBe(10);
  });

  it('finds local midnight on a DST change day', () => {
    // US spring-forward, 2026-03-08: 02:00 EST jumps to 03:00 EDT, so the
    // next midnight is 04:00Z, not 05:00Z.
    const tz = 'America/New_York';
    const now = Date.UTC(2026, 2, 9, 3, 59, 52) / 1000;
    const ongoing = alert(now - 3600 + 30, 0);
    expect(secs(nextClockDelayMs([ongoing], now, { timeZone: tz }))).toBe(8);
    // The evening before the change, midnight is still EST: 05:00Z.
    const before = Date.UTC(2026, 2, 8, 4, 59, 52) / 1000;
    expect(secs(nextClockDelayMs([alert(before - 3600 + 30, 0)], before, { timeZone: tz }))).toBe(8);
  });

  it('steps the progress bar one pixel at a time', () => {
    // A 30-minute warning on a 600 px bar moves a pixel every 3 s.
    const a = alert(NOW - 600, NOW + 1200);
    // Half a second past the minute, so no text rollover is due for 59.5 s.
    expect(secs(nextClockDelayMs([a], NOW + 0.5, { barPx: 600 }))).toBe(3);
    // A pending alert's fill edge moves at span / (ends - now)^2: 1 h span,
    // 2 h to its end, 400 px bar → (7200^2 / 3600) / 400 = 36 s.
    const pending = alert(NOW + 3600, NOW + 7200);
    expect(secs(nextClockDelayMs([pending], NOW + 0.5, { barPx: 400 }))).toBe(36);
  });

  it('never steps the bar finer than the 0.1 % the fill is rounded to', () => {
    // 1000 s span on a 4000 px bar: 0.25 s a pixel, but 1 s per 0.1 %.
    const a = alert(NOW - 500, NOW + 500 + 0.5);
    expect(nextClockDelayMs([a], NOW, { barPx: 4000 })).toBeGreaterThanOrEqual(CLOCK_MIN_MS);
  });

  it('ignores the bar for expired and open-ended alerts', () => {
    const expired = alert(NOW - 7200, NOW - 3600 + 30);
    const open = alert(NOW - 3600 + 30, 0);
    // Both roll over in 30 s; a 1 px bar step would be far sooner if counted.
    expect(secs(nextClockDelayMs([expired, open], NOW, { barPx: 10_000 }))).toBe(30);
  });

  it('steps the timeline marker one lane pixel at a time', () => {
    const a = alert(NOW - 3600 + 30, NOW + 3 * 3600 + 30);
    // 6.75 h window over 810 px: 30 s a pixel, same as the rollovers.
    expect(secs(nextClockDelayMs([a], NOW + 10, { timeline: { spanS: 6.75 * 3600, lanePx: 1620 } }))).toBe(15);
    // Unmeasured lane: the 400 px guess, 60.75 s a pixel → the wall minute wins.
    expect(secs(nextClockDelayMs([a], NOW + 10, { timeline: { spanS: 6.75 * 3600, lanePx: 0 } }))).toBe(20);
  });

  it('floors at 1 s and caps at 60 s', () => {
    // Ends this instant: the next change is now, so the floor holds it to 1 s.
    expect(nextClockDelayMs([alert(NOW - 3600, NOW)], NOW)).toBe(CLOCK_MIN_MS);
    const far = alert(NOW - 30 * 86400, NOW + 30 * 86400);
    expect(nextClockDelayMs([far], NOW + 0.5)).toBeLessThanOrEqual(CLOCK_MAX_MS);
  });
});
