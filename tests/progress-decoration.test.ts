import { describe, it, expect } from 'vitest';

import '../src/weather-alerts-card';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

interface CardInternals extends HTMLElement {
  setConfig(config: WeatherAlertsCardConfig): void;
  hass: HomeAssistant;
  remove(): void;
}

const HOUR = 3600 * 1000;

// Four NWS alerts, one per temporal phase. Ongoing has no Ends/Expires (endsTs
// resolves to 0). Expired is in the past (needs hideExpired:false to render).
function phasedHass(): HomeAssistant {
  const now = Date.now();
  const iso = (ms: number) => new Date(ms).toISOString();
  const base = { Severity: 'Moderate', Description: 'x', Instruction: '', URL: '', Headline: '' };
  return {
    states: {
      'sensor.nws_alerts': {
        state: '4',
        attributes: {
          Alerts: [
            { ...base, ID: 'prep', Event: 'Prep Warning', Sent: iso(now - HOUR), Onset: iso(now + 2 * HOUR), Ends: iso(now + 4 * HOUR), Expires: iso(now + 4 * HOUR) },
            { ...base, ID: 'active', Event: 'Active Warning', Sent: iso(now - 2 * HOUR), Onset: iso(now - HOUR), Ends: iso(now + 2 * HOUR), Expires: iso(now + 2 * HOUR) },
            { ...base, ID: 'ongoing', Event: 'Ongoing Warning', Sent: iso(now - 2 * HOUR), Onset: iso(now - HOUR), Ends: '', Expires: '' },
            { ...base, ID: 'expired', Event: 'Expired Warning', Sent: iso(now - 4 * HOUR), Onset: iso(now - 3 * HOUR), Ends: iso(now - HOUR), Expires: iso(now - HOUR) },
          ],
        },
      },
    },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
}

async function mountCard(config: WeatherAlertsCardConfig, hass: HomeAssistant): Promise<{ card: CardInternals; cleanup: () => void }> {
  const card = document.createElement('weather-alerts-card') as unknown as CardInternals;
  card.setConfig(config);
  card.hass = hass;
  document.body.appendChild(card);
  await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
  return { card, cleanup: () => card.remove() };
}

// Map each rendered .alert-card's title → its DOMTokenList of classes.
function cardClassesByTitle(card: CardInternals): Record<string, DOMTokenList> {
  const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
  if (!root) throw new Error('no shadowRoot');
  const out: Record<string, DOMTokenList> = {};
  for (const el of root.querySelectorAll('.alert-card')) {
    const title = (el.querySelector('.alert-title')?.textContent || '').trim();
    out[title] = (el as HTMLElement).classList;
  }
  return out;
}

const BASE: WeatherAlertsCardConfig = { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', hideExpired: false };

describe('per-phase decoration class resolution', () => {
  it('emits the default decoration + icon-border class per phase, none for expired', async () => {
    const { card, cleanup } = await mountCard(BASE, phasedHass());
    const classes = cardClassesByTitle(card);

    // Preparation → striped fill, dashed ring
    expect(classes['Prep Warning'].contains('deco-striped')).toBe(true);
    expect(classes['Prep Warning'].contains('icon-border-dashed')).toBe(true);

    // Active → shimmer fill, solid ring
    expect(classes['Active Warning'].contains('deco-shimmer')).toBe(true);
    expect(classes['Active Warning'].contains('icon-border-solid')).toBe(true);

    // Ongoing → pulse fill, solid ring
    expect(classes['Ongoing Warning'].contains('deco-pulse')).toBe(true);
    expect(classes['Ongoing Warning'].contains('icon-border-solid')).toBe(true);

    // Expired → carries no deco-* / icon-border-* class
    const expired = Array.from(classes['Expired Warning']);
    expect(expired.some(c => c.startsWith('deco-'))).toBe(false);
    expect(expired.some(c => c.startsWith('icon-border-'))).toBe(false);

    cleanup();
  });

  it('honors progressStyle + iconBorderStyle overrides per phase', async () => {
    const { card, cleanup } = await mountCard({
      ...BASE,
      progressStyle: { preparation: 'shimmer', active: 'striped' },
      iconBorderStyle: { active: 'dashed', preparation: 'solid' },
    }, phasedHass());
    const classes = cardClassesByTitle(card);

    expect(classes['Prep Warning'].contains('deco-shimmer')).toBe(true);
    expect(classes['Prep Warning'].contains('icon-border-solid')).toBe(true);
    expect(classes['Active Warning'].contains('deco-striped')).toBe(true);
    expect(classes['Active Warning'].contains('icon-border-dashed')).toBe(true);
    // Ongoing untouched → defaults
    expect(classes['Ongoing Warning'].contains('deco-pulse')).toBe(true);

    cleanup();
  });
});

describe('progressFill: background root class + full-mode --progress', () => {
  function haCard(card: CardInternals): HTMLElement {
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot!;
    return root.querySelector('ha-card') as HTMLElement;
  }

  it('adds fill-mode-background to the ha-card only when opted in', async () => {
    const off = await mountCard(BASE, phasedHass());
    expect(haCard(off.card).classList.contains('fill-mode-background')).toBe(false);
    off.cleanup();

    const on = await mountCard({ ...BASE, progressFill: 'background' }, phasedHass());
    expect(haCard(on.card).classList.contains('fill-mode-background')).toBe(true);
    on.cleanup();
  });

  it('gives full-mode alerts a --progress style so the wash can position, ongoing pinned to 0%', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, progressFill: 'background' }, phasedHass());
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot!;
    const styleByTitle = (title: string) => {
      const el = Array.from(root.querySelectorAll('.alert-card'))
        .find(e => (e.querySelector('.alert-title')?.textContent || '').trim() === title);
      return (el as HTMLElement | undefined)?.getAttribute('style') || '';
    };
    expect(styleByTitle('Active Warning')).toContain('--progress:');
    // Ongoing fills full-width → --progress pinned to 0%.
    expect(styleByTitle('Ongoing Warning')).toContain('--progress: 0%');
    cleanup();
  });
});

describe('ongoing progress-fill regression', () => {
  it('no longer emits an inline animation on the ongoing fill (motion via deco-pulse)', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, expandDetails: true }, phasedHass());
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot!;
    // Locate the ongoing alert-card and read its progress-fill inline style.
    const ongoingCard = Array.from(root.querySelectorAll('.alert-card'))
      .find(el => (el.querySelector('.alert-title')?.textContent || '').trim() === 'Ongoing Warning');
    expect(ongoingCard).toBeTruthy();
    const fill = ongoingCard!.querySelector('.progress-fill') as HTMLElement;
    expect(fill).toBeTruthy();
    expect(fill.getAttribute('style') || '').not.toContain('animation');
    // But the card still carries deco-pulse, which supplies the motion in CSS.
    expect((ongoingCard as HTMLElement).classList.contains('deco-pulse')).toBe(true);
    cleanup();
  });
});

// #364: motion must stay on the compositor. These read the live animations the
// browser actually runs on the mounted card and check both which elements carry
// them and which properties they touch.
describe('compositor-only motion (#364)', () => {
  function severeHass(): HomeAssistant {
    const hass = phasedHass();
    const alerts = (hass.states['sensor.nws_alerts'].attributes as { Alerts: Array<{ ID: string; Severity: string }> }).Alerts;
    alerts.find(a => a.ID === 'prep')!.Severity = 'Severe';
    alerts.find(a => a.ID === 'ongoing')!.Severity = 'Extreme';
    return hass;
  }

  function shadow(card: CardInternals): ShadowRoot {
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!root) throw new Error('no shadowRoot');
    return root;
  }

  function animatedProperties(root: ShadowRoot): Set<string> {
    const props = new Set<string>();
    for (const anim of root.getAnimations()) {
      const effect = anim.effect as KeyframeEffect | null;
      for (const frame of effect?.getKeyframes() ?? []) {
        for (const key of Object.keys(frame)) {
          if (!['offset', 'computedOffset', 'easing', 'composite'].includes(key)) props.add(key);
        }
      }
    }
    return props;
  }

  for (const layout of ['default', 'compact'] as const) {
    it(`renders the pulse ring only on severe/extreme alerts (${layout})`, async () => {
      const { card, cleanup } = await mountCard({ ...BASE, layout, animations: true }, severeHass());
      try {
        const classes = cardClassesByTitle(card);
        const root = shadow(card);
        const withRing = [...root.querySelectorAll('.alert-card')]
          .filter(el => el.querySelector(':scope > .pulse-ring'))
          .map(el => (el.querySelector('.alert-title')?.textContent || '').trim());
        expect(withRing.sort()).toEqual(['Ongoing Warning', 'Prep Warning']);
        expect(classes['Prep Warning'].contains('severity-severe')).toBe(true);
      } finally {
        cleanup();
      }
    });

    it(`animates nothing but transform and opacity (${layout})`, async () => {
      const { card, cleanup } = await mountCard({ ...BASE, layout, animations: true }, severeHass());
      try {
        const root = shadow(card);
        const names = root.getAnimations().map(a => (a as CSSAnimation).animationName).sort();
        // prep: stripes + ring; active: shimmer; ongoing: pulse + ring; expired: nothing.
        expect(names).toEqual(['fill-shimmer', 'ongoing-pulse', 'pulse-ring', 'pulse-ring', 'stripe-march']);
        const props = [...animatedProperties(root)].sort();
        expect(props).toEqual(['opacity', 'transform']);
      } finally {
        cleanup();
      }
    });
  }

  it('runs no animations at all when animations: false', async () => {
    const { card, cleanup } = await mountCard({ ...BASE, layout: 'compact', animations: false }, severeHass());
    try {
      const root = shadow(card);
      expect(root.getAnimations()).toEqual([]);
      // The ring element is still in the DOM but display:none hides it.
      const ring = root.querySelector('.pulse-ring') as HTMLElement;
      expect(ring).not.toBeNull();
      expect(getComputedStyle(ring).display).toBe('none');
    } finally {
      cleanup();
    }
  });
});
