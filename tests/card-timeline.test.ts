import { describe, it, expect, beforeEach } from 'vitest';

import { WeatherAlertsCard } from '../src/weather-alerts-card';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';
import { PROGRESS_DECO_DEFAULTS } from '../src/types';

// layout: 'timeline' — one shared axis, one lane per alert, the detail pop-up
// as the overlay. Runs in Chromium: real layout (the bars are positioned by
// percentage), real animations, real <dialog>.

interface CardInternals extends HTMLElement {
  setConfig(config: WeatherAlertsCardConfig): void;
  hass: HomeAssistant;
  shadowRoot: ShadowRoot | null;
  remove(): void;
  getCardSize(): number;
  updateComplete: Promise<void>;
  _detailPopupAlertId: string | null;
  _timelineTimer: ReturnType<typeof setInterval> | null;
}

const HOUR = 3600 * 1000;

// Four NWS alerts, one per temporal phase (mirrors progress-decoration), plus
// a three-day watch that outruns every fixed horizon.
function phasedHass(): HomeAssistant {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const base = { Severity: 'Moderate', Description: 'x', Instruction: '', URL: '', Headline: '' };
  return {
    states: {
      'sensor.nws_alerts': {
        state: '5',
        attributes: {
          Alerts: [
            { ...base, ID: 'prep', Event: 'Prep Warning', Sent: iso(now - HOUR), Onset: iso(now + 2 * HOUR), Ends: iso(now + 4 * HOUR), Expires: iso(now + 4 * HOUR) },
            { ...base, ID: 'active', Event: 'Active Warning', Sent: iso(now - 2 * HOUR), Onset: iso(now - HOUR), Ends: iso(now + 2 * HOUR), Expires: iso(now + 2 * HOUR) },
            { ...base, ID: 'ongoing', Event: 'Ongoing Warning', Sent: iso(now - 2 * HOUR), Onset: iso(now - HOUR), Ends: '', Expires: '' },
            { ...base, ID: 'expired', Event: 'Expired Warning', Sent: iso(now - 4 * HOUR), Onset: iso(now - 3 * HOUR), Ends: iso(now - HOUR), Expires: iso(now - HOUR) },
            { ...base, ID: 'watch', Event: 'Long Watch', Severity: 'Severe', Sent: iso(now - 30 * HOUR), Onset: iso(now - 24 * HOUR), Ends: iso(now + 72 * HOUR), Expires: iso(now + 72 * HOUR), Description: 'Three days of it.' },
          ],
        },
      },
    },
    locale: { language: 'en' },
    config: { time_zone: 'UTC' },
  } as unknown as HomeAssistant;
}

const BASE: WeatherAlertsCardConfig = {
  type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', layout: 'timeline', hideExpired: false,
};

async function mountCard(config: WeatherAlertsCardConfig, hass: HomeAssistant): Promise<{ card: CardInternals; cleanup: () => void }> {
  const card = document.createElement('weather-alerts-card') as unknown as CardInternals;
  card.setConfig(config);
  card.hass = hass;
  document.body.appendChild(card);
  await card.updateComplete;
  return { card, cleanup: () => card.remove() };
}

function root(card: CardInternals): ShadowRoot {
  if (!card.shadowRoot) throw new Error('no shadowRoot');
  return card.shadowRoot;
}

function rowByTitle(card: CardInternals, title: string): HTMLElement {
  const row = [...root(card).querySelectorAll<HTMLElement>('.timeline-row')]
    .find(el => (el.querySelector('.alert-title')?.textContent || '').trim() === title);
  if (!row) throw new Error(`no row ${title}`);
  return row;
}

const bar = (row: HTMLElement) => row.querySelector<HTMLElement>('.timeline-bar')!;
// Two frames: lets the lane's ResizeObserver report so the tick budget is the
// measured one rather than the phone-width guess the first render uses.
const settle = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
const pct = (v: string) => parseFloat(v);

beforeEach(() => {
  (WeatherAlertsCard as unknown as { _editorExpandedState: Map<string, unknown> })._editorExpandedState.clear();
});

describe('timeline structure', () => {
  it('renders the axis once and one row per alert, with no row-layout chrome', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      const r = root(card);
      expect(r.querySelector('ha-card')!.classList.contains('timeline')).toBe(true);
      expect(r.querySelectorAll('.timeline-body')).toHaveLength(1);
      expect(r.querySelectorAll('.timeline-axis')).toHaveLength(1);
      expect(r.querySelectorAll('.timeline-row')).toHaveLength(5);
      expect(r.querySelectorAll('.timeline-row.alert-card')).toHaveLength(5);
      expect(r.querySelector('.compact-row')).toBeNull();
      expect(r.querySelector('.progress-section')).toBeNull();
      expect(r.querySelector('.alert-header-row')).toBeNull();
      // A wide, measured lane: the phone-width budget (the viewport here, and
      // the first render's guess) is four labels, and a day step over the
      // auto window lands three or four midnights depending on the time of day.
      card.style.width = '900px';
      await settle();
      await card.updateComplete;
      const ticks = r.querySelectorAll('.timeline-tick');
      expect(ticks.length).toBeGreaterThanOrEqual(4);
      expect(ticks.length).toBeLessThanOrEqual(8);
      // A tick drops its text only to make room for an edge-hung neighbour.
      for (const t of ticks) {
        if (!t.classList.contains('quiet')) expect(t.textContent.trim()).not.toBe('');
      }
      for (const q of [...ticks].filter(t => t.classList.contains('quiet'))) {
        expect(q.classList.contains('minor') || q.nextElementSibling?.classList.contains('edge') === true).toBe(true);
      }
      // A tick under the now head is not rendered at all: the head is the mark.
      const nowPct = 100 / 9;
      for (const t of ticks) expect(Math.abs(pct((t as HTMLElement).style.left) - nowPct)).toBeGreaterThan(3);
      const now = r.querySelector<HTMLElement>('.timeline-body')!.style.getPropertyValue('--wac-tl-now');
      expect(pct(now)).toBeCloseTo(100 / 9, 1);
      // The one-phrase time state is visible text under the name, not hover-only.
      expect(rowByTitle(card, 'Active Warning').querySelector('.timeline-time')!.textContent.trim()).toMatch(/^for /);
      expect(rowByTitle(card, 'Ongoing Warning').querySelector('.timeline-time')!.textContent.trim()).toBe('ongoing');
      // No header: the axis starts at content-area padding, not flush with the edge.
      expect(r.querySelector('.timeline-body')!.classList.contains('headed')).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('places each phase where the window math says, in the auto window', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      const nowPct = 100 / 9;
      const prep = bar(rowByTitle(card, 'Prep Warning'));
      expect(pct(prep.style.left)).toBeGreaterThan(nowPct);
      expect(prep.classList.contains('clip-start')).toBe(false);
      expect(rowByTitle(card, 'Prep Warning').classList.contains('preparation')).toBe(true);

      const active = bar(rowByTitle(card, 'Active Warning'));
      expect(pct(active.style.left)).toBeLessThan(nowPct);
      expect(pct(active.style.left) + pct(active.style.width)).toBeGreaterThan(nowPct);

      const ongoing = bar(rowByTitle(card, 'Ongoing Warning'));
      expect(ongoing.classList.contains('open-end')).toBe(true);
      expect(ongoing.classList.contains('clip-end')).toBe(false);
      expect(pct(ongoing.style.left) + pct(ongoing.style.width)).toBeCloseTo(100, 3);
      expect(rowByTitle(card, 'Ongoing Warning').classList.contains('ongoing')).toBe(true);
      // The fade is the open end's only sign: no glyph shares the arrowhead's slot.
      expect(rowByTitle(card, 'Ongoing Warning').querySelector('.timeline-clip')).toBeNull();
      expect(root(card).querySelector('.timeline-open-tail')).toBeNull();
      // Arrowheads never live inside the bar, whose open-end mask would fade them.
      expect(root(card).querySelector('.timeline-bar .timeline-clip')).toBeNull();

      // Auto fits the three-day watch with a pad, so its cap sits inside the axis …
      const watch = bar(rowByTitle(card, 'Long Watch'));
      expect(watch.classList.contains('clip-end')).toBe(false);
      expect(pct(watch.style.left) + pct(watch.style.width)).toBeLessThan(100);
      expect(pct(watch.style.left) + pct(watch.style.width)).toBeGreaterThan(95);
      // … but its onset a day ago is before the lead, so its start is cut.
      expect(watch.classList.contains('clip-start')).toBe(true);
      expect(rowByTitle(card, 'Long Watch').querySelector('.timeline-lane > .timeline-clip.start')).not.toBeNull();
      expect(pct(watch.style.left)).toBe(0);

      const expiredRow = rowByTitle(card, 'Expired Warning');
      expect(expiredRow.classList.contains('expired')).toBe(true);
      expect(getComputedStyle(expiredRow).opacity).toBe('0.6');
    } finally {
      cleanup();
    }
  });

  it('keeps the start arrowhead on an open-ended alert that began before the window', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, timelineHorizon: '6h', animations: true }, (() => {
      const hass = phasedHass();
      const alerts = (hass.states['sensor.nws_alerts'].attributes as { Alerts: Array<Record<string, string>> }).Alerts;
      alerts.find(a => a.ID === 'ongoing')!.Onset = new Date(Date.now() - 30 * HOUR).toISOString();
      return hass;
    })());
    try {
      const row = rowByTitle(card, 'Ongoing Warning');
      const b = bar(row);
      expect(b.classList.contains('open-end')).toBe(true);
      expect(b.classList.contains('clip-start')).toBe(true);
      const arrow = row.querySelector<HTMLElement>('.timeline-lane > .timeline-clip.start')!;
      expect(arrow).not.toBeNull();
      // Visible: it sits outside the masked bar, just past the lane's left edge.
      const lane = row.querySelector('.timeline-lane')!.getBoundingClientRect();
      // The arrow is a border in the severity color, which resolves through an
      // HA theme token the test page does not define; supply it, as HA would.
      card.style.setProperty('--warning-color', '#ff9800');
      const rect = arrow.getBoundingClientRect();
      expect(rect.width).toBeGreaterThan(0);
      expect(rect.right).toBeLessThanOrEqual(lane.left + 1);
      // The arrowhead breathes with the bar: same keyframes, same period, and
      // the two animations began on the same frame, so they never drift apart.
      expect(getComputedStyle(arrow).animationName).toBe('ongoing-pulse');
      const anims = row.querySelector('.timeline-lane')!.getAnimations({ subtree: true }) as CSSAnimation[];
      expect(anims.map(a => a.animationName)).toEqual(['ongoing-pulse', 'ongoing-pulse']);
      expect(anims[0].startTime).toBe(anims[1].startTime);
    } finally {
      cleanup();
    }
  });

  it('clips the long watch at the end under a fixed 6 h horizon', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, timelineHorizon: '6h' }, phasedHass());
    try {
      const watch = bar(rowByTitle(card, 'Long Watch'));
      expect(watch.classList.contains('clip-end')).toBe(true);
      expect(rowByTitle(card, 'Long Watch').querySelector('.timeline-lane > .timeline-clip.end')).not.toBeNull();
      expect(pct(watch.style.left) + pct(watch.style.width)).toBeCloseTo(100, 3);
      // 4h ahead still fits inside 6h.
      expect(bar(rowByTitle(card, 'Prep Warning')).classList.contains('clip-end')).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('collapses an alert entirely outside the window to a chevron at its edge', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, timelineHorizon: '6h', hideExpired: false }, (() => {
      const hass = phasedHass();
      const alerts = (hass.states['sensor.nws_alerts'].attributes as { Alerts: Array<Record<string, string>> }).Alerts;
      const now = Date.now();
      const iso = (ms: number) => new Date(ms).toISOString();
      alerts.find(a => a.ID === 'expired')!.Ends = iso(now - 2 * HOUR);
      alerts.find(a => a.ID === 'expired')!.Expires = iso(now - 2 * HOUR);
      alerts.find(a => a.ID === 'prep')!.Onset = iso(now + 20 * HOUR);
      alerts.find(a => a.ID === 'prep')!.Ends = iso(now + 22 * HOUR);
      alerts.find(a => a.ID === 'prep')!.Expires = iso(now + 22 * HOUR);
      return hass;
    })());
    try {
      // 6h horizon: lead is 45 min, so an alert that ended 2 h ago is off-axis.
      const past = bar(rowByTitle(card, 'Expired Warning'));
      expect(past.classList.contains('off-axis')).toBe(true);
      expect(past.classList.contains('off-start')).toBe(true);
      expect(rowByTitle(card, 'Expired Warning').querySelector('.timeline-lane > .timeline-clip.start')).not.toBeNull();
      const future = bar(rowByTitle(card, 'Prep Warning'));
      expect(future.classList.contains('off-end')).toBe(true);
      expect(rowByTitle(card, 'Prep Warning').querySelector('.timeline-lane > .timeline-clip.end')).not.toBeNull();
      // The arrowhead is all that renders: the bar itself is gone.
      expect(getComputedStyle(future).display).toBe('none');
    } finally {
      cleanup();
    }
  });

  it('fits the tick count to the lane it measures', async () => {
    const wide = await mountCard(BASE, phasedHass());
    try {
      wide.card.style.width = '900px';
      await settle();
      await wide.card.updateComplete;
      const wideTicks = root(wide.card).querySelectorAll('.timeline-tick').length;
      wide.card.style.width = '320px';
      await settle();
      await wide.card.updateComplete;
      const narrowTicks = root(wide.card).querySelectorAll('.timeline-tick').length;
      expect(wideTicks).toBeGreaterThan(narrowTicks);
      // A phone-width lane (~170px) has room for about three labels; the
      // auto window here (a three-day watch) steps to two days, so the day
      // marks between the labels come back as minor ticks.
      const narrowLabels = root(wide.card).querySelectorAll('.timeline-tick:not(.quiet)').length;
      expect(narrowLabels).toBeLessThanOrEqual(3);
      expect(narrowLabels).toBeGreaterThanOrEqual(1);
      expect(narrowTicks).toBeLessThanOrEqual(4);
      expect(narrowTicks).toBeGreaterThanOrEqual(2);
      expect(root(wide.card).querySelector('.timeline-tick.minor.quiet')).not.toBeNull();
    } finally {
      wide.cleanup();
    }
  });

  it('renders the timeline in preview mode too', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, _preview: true }, phasedHass());
    try {
      expect(root(card).querySelector('.preview-label')).not.toBeNull();
      expect(root(card).querySelector('.timeline-body')).not.toBeNull();
      expect(root(card).querySelectorAll('.timeline-row').length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  it('sizes the card as one unit for the axis plus 36px rows', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      expect(card.getCardSize()).toBe(1 + Math.ceil((5 * 36) / 50));
      card.setConfig({ ...BASE, hideExpired: true });
      await card.updateComplete;
      expect(card.getCardSize()).toBe(1 + Math.ceil((4 * 36) / 50));
    } finally {
      cleanup();
    }
  });
});

describe('timeline row action', () => {
  const dialog = (card: CardInternals) => root(card).querySelector<HTMLDialogElement>('dialog.detail-dialog');

  it('opens the detail pop-up on tap with no tap_action configured', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      const row = rowByTitle(card, 'Long Watch');
      expect(row.getAttribute('role')).toBe('button');
      expect(row.getAttribute('tabindex')).toBe('0');
      expect(row.classList.contains('tappable')).toBe(true);
      expect(dialog(card)).toBeNull();
      row.click();
      await card.updateComplete;
      expect(card._detailPopupAlertId).toBe('watch');
      const d = dialog(card)!;
      expect(d).not.toBeNull();
      expect(d.querySelector('.alert-title')!.textContent.trim()).toBe('Long Watch');
      expect(d.textContent).toContain('Three days of it.');
    } finally {
      cleanup();
    }
  });

  it('opens it from the keyboard too', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      rowByTitle(card, 'Active Warning').dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
      await card.updateComplete;
      expect(card._detailPopupAlertId).toBe('active');
    } finally {
      cleanup();
    }
  });

  it('keeps the full view\'s progress decoration in the pop-up', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      const row = rowByTitle(card, 'Prep Warning');
      // The timeline bar has a fixed pattern, so the row carries no deco class …
      expect([...row.classList].some(c => c.startsWith('deco-'))).toBe(false);
      row.click();
      await card.updateComplete;
      // … but the pop-up is the full view and keeps the configured one.
      const inner = dialog(card)!.querySelector('.alert-card')!;
      expect(inner.classList.contains(`deco-${PROGRESS_DECO_DEFAULTS.preparation}`)).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('marks the body as headed under a card title', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, title: 'Alerts' }, phasedHass());
    try {
      expect(root(card).querySelector('.timeline-body')!.classList.contains('headed')).toBe(true);
    } finally {
      cleanup();
    }
  });

  it('leaves the row inert under tap_action: none', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, tap_action: { action: 'none' } }, phasedHass());
    try {
      const row = rowByTitle(card, 'Active Warning');
      expect(row.getAttribute('role')).toBeNull();
      // No role, so no aria-label either (prohibited on a plain div); the
      // visible name and time label are the text.
      expect(row.getAttribute('aria-label')).toBeNull();
      expect(row.querySelector('.timeline-time')).not.toBeNull();
      expect(row.classList.contains('tappable')).toBe(false);
      row.click();
      await card.updateComplete;
      expect(card._detailPopupAlertId).toBeNull();
      expect(dialog(card)).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('fires a configured tap_action instead of the pop-up', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, tap_action: { action: 'more-info' } }, phasedHass());
    try {
      const seen: string[] = [];
      card.addEventListener('hass-more-info', (e: Event) => seen.push((e as CustomEvent<{ entityId: string }>).detail.entityId));
      rowByTitle(card, 'Active Warning').click();
      await card.updateComplete;
      expect(seen).toEqual(['sensor.nws_alerts']);
      expect(dialog(card)).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe('timeline dismissal', () => {
  it('renders the button for every trigger and never arms swipe', async () => {
    for (const dismissTrigger of ['button', 'swipe', 'both'] as const) {
      const { card, cleanup } = await mountCard({ ...BASE, allowDismiss: true, dismissTrigger }, phasedHass());
      try {
        const r = root(card);
        expect(r.querySelector('.timeline-body')!.classList.contains('dismissable')).toBe(true);
        expect(r.querySelector('.timeline-axis .timeline-dismiss-spacer')).not.toBeNull();
        expect(r.querySelectorAll('.timeline-row > .dismiss-button'), dismissTrigger).toHaveLength(5);
        expect(r.querySelector('.swipe-enabled')).toBeNull();
      } finally {
        cleanup();
      }
    }
  });

  it('is icon-only even under dismissButtonStyle: labeled', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, allowDismiss: true, dismissButtonStyle: 'labeled' }, phasedHass());
    try {
      const buttons = root(card).querySelectorAll('.dismiss-button');
      expect(buttons).toHaveLength(5);
      for (const b of buttons) expect(b.classList.contains('labeled')).toBe(false);
    } finally {
      cleanup();
    }
  });

  it('dismisses from the keyboard on the button, instead of opening the pop-up', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, allowDismiss: true, showDismissUndo: false }, phasedHass());
    try {
      const btn = rowByTitle(card, 'Active Warning').querySelector<HTMLButtonElement>('.dismiss-button')!;
      btn.focus();
      // Enter on a focused button is the button's to activate; the row's
      // keydown handler must not preventDefault it into a pop-up.
      const keydown = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      btn.dispatchEvent(keydown);
      await card.updateComplete;
      // Checked before the dismissal: a dismissed alert clears a stale pop-up
      // id on its own, which would hide an intercept here.
      expect(card._detailPopupAlertId).toBeNull();
      expect(keydown.defaultPrevented).toBe(false);
      // Chromium synthesises the click only for a trusted key press, so the
      // click stands in for the activation the un-prevented keydown allows.
      btn.click();
      await card.updateComplete;
      expect(root(card).querySelectorAll('.timeline-row')).toHaveLength(4);
      expect(() => rowByTitle(card, 'Active Warning')).toThrow();
    } finally {
      cleanup();
      localStorage.clear();
    }
  });

  it('has no dismiss column when dismissal is off', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      expect(root(card).querySelector('.timeline-body')!.classList.contains('dismissable')).toBe(false);
      expect(root(card).querySelector('.timeline-dismiss-spacer')).toBeNull();
      expect(root(card).querySelector('.dismiss-button')).toBeNull();
    } finally {
      cleanup();
    }
  });
});

describe('timeline minute tick', () => {
  it('arms a timer for the timeline only, and clears it on layout change and disconnect', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      expect(card._timelineTimer).not.toBeNull();
      card.setConfig({ ...BASE, layout: 'compact' });
      await card.updateComplete;
      expect(card._timelineTimer).toBeNull();
      card.setConfig(BASE);
      await card.updateComplete;
      expect(card._timelineTimer).not.toBeNull();
      card.remove();
      expect(card._timelineTimer).toBeNull();
    } finally {
      cleanup();
    }
  });

  it('never arms it for the full or compact layouts', async () => {
    for (const layout of ['default', 'compact'] as const) {
      const { card, cleanup } = await mountCard({ ...BASE, layout }, phasedHass());
      try {
        expect(card._timelineTimer, layout).toBeNull();
      } finally {
        cleanup();
      }
    }
  });
});

describe('timeline accessibility and motion', () => {
  it('names each row, hides the lane, labels the now marker', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    try {
      expect(rowByTitle(card, 'Active Warning').getAttribute('aria-label')).toMatch(/^Active Warning: for /);
      expect(rowByTitle(card, 'Prep Warning').getAttribute('aria-label')).toMatch(/^Prep Warning: in /);
      expect(rowByTitle(card, 'Ongoing Warning').getAttribute('aria-label')).toBe('Ongoing Warning: ongoing');
      expect(rowByTitle(card, 'Expired Warning').getAttribute('aria-label')).toMatch(/^Expired Warning: expired .* ago$/);
      for (const lane of root(card).querySelectorAll('.timeline-row .timeline-lane')) {
        expect(lane.getAttribute('aria-hidden')).toBe('true');
      }
      expect(root(card).querySelector('.timeline-now-head')!.getAttribute('aria-label')).toBe('Now');
      expect(bar(rowByTitle(card, 'Ongoing Warning')).getAttribute('title')).toContain('Ongoing');
    } finally {
      cleanup();
    }
  });

  it('runs no animation at all when animations are off', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, animations: false }, phasedHass());
    try {
      expect(root(card).getAnimations()).toEqual([]);
      const ongoing = bar(rowByTitle(card, 'Ongoing Warning'));
      expect(getComputedStyle(ongoing).animationName).toBe('none');
    } finally {
      cleanup();
    }
  });
});
