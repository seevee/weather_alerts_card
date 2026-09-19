import { describe, it, expect, beforeAll } from 'vitest';

// jsdom lacks matchMedia; the card touches it during construction, so polyfill
// before the card module loads (mirrors source-mode.test.ts).
beforeAll(() => {
  if (!window.matchMedia) {
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: () => ({
        matches: false, media: '', onchange: null,
        addEventListener: () => {}, removeEventListener: () => {},
        addListener: () => {}, removeListener: () => {}, dispatchEvent: () => false,
      }),
    });
  }
});

import { WeatherAlertsCard } from '../src/weather-alerts-card';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { WeatherAlert, WeatherAlertsCardConfig } from '../src/types';

type CardInternals = {
  setConfig(config: WeatherAlertsCardConfig): void;
  _alertColorStyle(alert: WeatherAlert): string;
  _alertBoostClasses(alert: WeatherAlert): string;
};

function makeCard(config: Partial<WeatherAlertsCardConfig>): CardInternals {
  const card = new WeatherAlertsCard() as unknown as CardInternals;
  card.setConfig({ type: 'custom:weather-alerts-card', entity: 'sensor.alerts', ...config } as WeatherAlertsCardConfig);
  return card;
}

function makeAlert(overrides: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    id: 'a1', event: 'Test', severity: 'severe', certainty: '', urgency: '',
    sentTs: 0, onsetTs: 0, endsTs: 0, description: '', instruction: '', url: '',
    headline: '', areaDesc: '', zones: [], eventCode: '', provider: 'eccc', phase: '',
    severityInferred: false, certaintyInferred: false,
    ...overrides,
  };
}

const colorOf = (style: string) => /--color: (#[0-9a-f]{6});/i.exec(style)?.[1];

// Two axes: `colorTheme` is the ladder every alert is painted from, and
// `providerColors` lets an alert carrying its issuer's published color win.
describe('colorTheme ladders', () => {
  it("'severity' emits no inline color, so the severity-* classes paint it", () => {
    const card = makeCard({});
    expect(card._alertColorStyle(makeAlert())).toBe('');
    expect(card._alertBoostClasses(makeAlert())).toBe('');
  });

  it("'nws' paints an NWS-shaped event from the event table", () => {
    expect(colorOf(makeCard({ colorTheme: 'nws' })._alertColorStyle(makeAlert({ event: 'Tornado Warning' })))).toBe('#FF0000');
  });

  it("'nws' drops to the severity ladder for an event it does not know, not to grey", () => {
    const card = makeCard({ colorTheme: 'nws' });
    expect(card._alertColorStyle(makeAlert({ event: 'Chuvas Intensas', provider: 'inmet' }))).toBe('');
    expect(card._alertBoostClasses(makeAlert({ event: 'Chuvas Intensas', provider: 'inmet' }))).toBe('');
  });

  it("'meteoalarm' and 'eccc' paint by tier from their agency palettes", () => {
    expect(colorOf(makeCard({ colorTheme: 'meteoalarm' })._alertColorStyle(makeAlert({ severity: 'severe' })))).toBe('#FF9900');
    expect(colorOf(makeCard({ colorTheme: 'eccc' })._alertColorStyle(makeAlert({ severity: 'severe', provider: 'nws' })))).toBe('#FF9500');
  });
});

describe('providerColors override', () => {
  it('is off by default: a published color is ignored', () => {
    expect(makeCard({})._alertColorStyle(makeAlert({ colorHint: '#F96602' }))).toBe('');
    expect(colorOf(makeCard({ colorTheme: 'meteoalarm' })._alertColorStyle(makeAlert({ colorHint: '#F96602' })))).toBe('#FF9900');
  });

  it('paints an alert in its published hex over any ladder', () => {
    const alert = makeAlert({ colorHint: '#F96602', event: 'Tornado Warning' });
    for (const colorTheme of ['severity', 'nws', 'meteoalarm', 'eccc'] as const) {
      const style = makeCard({ colorTheme, providerColors: true })._alertColorStyle(alert);
      expect(style, colorTheme).toContain('--color: #f96602;');
      expect(style, colorTheme).toContain('--color-rgb: 249, 102, 2;');
    }
  });

  it('leaves an alert with no published color to the ladder', () => {
    expect(makeCard({ providerColors: true })._alertColorStyle(makeAlert())).toBe('');
    expect(colorOf(makeCard({ colorTheme: 'nws', providerColors: true })._alertColorStyle(makeAlert({ event: 'Tornado Warning' })))).toBe('#FF0000');
  });

  it('still emits contrast-boost classes for a hard hex', () => {
    // Pure yellow on a light card fails the text tier, so the boost class fires.
    expect(makeCard({ providerColors: true })._alertBoostClasses(makeAlert({ colorHint: '#FFFF00' }))).toContain('boost-light');
  });
});

// `colorTheme: eccc` predates the toggle and always meant "ECCC's ladder, each
// ECCC alert in the color ECCC published for it". That has to keep rendering
// pixel-for-pixel, and the editor has to show the toggle on for it.
describe("legacy 'eccc' configs", () => {
  it('imply providerColors on', () => {
    const card = makeCard({ colorTheme: 'eccc' });
    // An ECCC alert whose derived tier (severe → orange) disagrees with its published color (yellow).
    expect(colorOf(card._alertColorStyle(makeAlert({ severity: 'severe', colorHint: '#FFFF00' })))).toBe('#ffff00');
    // A foreign alert on the same card still gets the ECCC ladder.
    expect(colorOf(card._alertColorStyle(makeAlert({ severity: 'severe', provider: 'nws' })))).toBe('#FF9500');
  });

  it('respect an explicit providerColors: false', () => {
    const card = makeCard({ colorTheme: 'eccc', providerColors: false });
    expect(colorOf(card._alertColorStyle(makeAlert({ severity: 'severe', colorHint: '#FFFF00' })))).toBe('#FF9500');
  });

  it('are shown in the editor with the toggle on, without rewriting an explicit false', () => {
    type EditorInternals = { setConfig(c: WeatherAlertsCardConfig): void; _config: WeatherAlertsCardConfig };
    const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
    editor.setConfig({ type: 'custom:weather-alerts-card', entity: 'sensor.alerts', colorTheme: 'eccc' } as WeatherAlertsCardConfig);
    expect(editor._config.providerColors).toBe(true);
    editor.setConfig({ type: 'custom:weather-alerts-card', entity: 'sensor.alerts', colorTheme: 'eccc', providerColors: false } as WeatherAlertsCardConfig);
    expect(editor._config.providerColors).toBe(false);
  });
});
