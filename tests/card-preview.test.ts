import { describe, it, expect } from 'vitest';
import '../src/weather-alerts-card';
import { WeatherAlertsCard } from '../src/weather-alerts-card';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

// Sample data is an editor tool. HA's `hui-card` wrapper tells the card where
// it is: `preview` true in the edit dialog and dashboard edit mode, false on a
// dashboard, never set by the card picker. These pin that sample data reaches
// only the first and the last, whatever the saved config carries.

type Flags = { preview?: boolean; editMode?: boolean };
type Mounted = { card: HTMLElement; cleanup: () => void };

const CAP_ID = 'sensor.cap_alerts_eccc_cap_alert_frost_aaa';

function capAlertAttrs(): Record<string, unknown> {
  const now = Date.now();
  return {
    incident_platform_version: '1.0',
    id: 'urn:oid:2.49.0.1.124.0.abc',
    event: 'Frost',
    severity: 'Moderate',
    severity_normalized: 'moderate',
    sent: new Date(now - 60 * 60 * 1000).toISOString(),
    expires: new Date(now + 3 * 60 * 60 * 1000).toISOString(),
  };
}

function makeHass(states: Record<string, { state: string; attributes: Record<string, unknown> }> = {}): HomeAssistant {
  return { states, locale: { language: 'en' }, entities: {} } as unknown as HomeAssistant;
}

const liveCap = () => makeHass({ [CAP_ID]: { state: 'moderate', attributes: capAlertAttrs() } });

async function mount(config: Partial<WeatherAlertsCardConfig>, hass: HomeAssistant, flags: Flags = {}): Promise<Mounted> {
  const card = document.createElement('weather-alerts-card') as unknown as HTMLElement & {
    setConfig(c: WeatherAlertsCardConfig): void;
    hass: HomeAssistant;
    updateComplete: Promise<void>;
  } & Flags;
  card.setConfig({ type: 'custom:weather-alerts-card', ...config } as WeatherAlertsCardConfig);
  card.hass = hass;
  if (flags.preview !== undefined) card.preview = flags.preview;
  if (flags.editMode !== undefined) card.editMode = flags.editMode;
  document.body.appendChild(card);
  await card.updateComplete;
  return { card, cleanup: () => card.remove() };
}

const has = (card: HTMLElement, sel: string) => !!card.shadowRoot?.querySelector(sel);
const text = (card: HTMLElement, sel: string) => card.shadowRoot?.querySelector(sel)?.textContent ?? '';

describe('a saved _preview key', () => {
  it('is inert on a dashboard: a live alert shows, not sample data', async () => {
    // The regression the review reproduced: switch on, Save, dashboard stuck on samples.
    const { card, cleanup } = await mount({ entity: CAP_ID, _preview: true }, liveCap(), { preview: false });
    expect(has(card, '.preview-label')).toBe(false);
    expect(has(card, '.alert-card')).toBe(true);
    cleanup();
  });

  it('is inert where nothing flags the card (a wrapper that skips hui-card)', async () => {
    const { card, cleanup } = await mount({ entity: CAP_ID, _preview: true }, liveCap());
    expect(has(card, '.preview-label')).toBe(false);
    cleanup();
  });

  it('shows sample data in the editor', async () => {
    const { card, cleanup } = await mount({ entity: CAP_ID, _preview: true }, liveCap(), { preview: true });
    expect(has(card, '.preview-label')).toBe(true);
    cleanup();
  });

  it('shows sample data under the older editMode flag', async () => {
    const { card, cleanup } = await mount({ entity: CAP_ID, _preview: true }, liveCap(), { editMode: true });
    expect(has(card, '.preview-label')).toBe(true);
    cleanup();
  });

  it('follows the flag when HA flips it (leaving edit mode)', async () => {
    const { card, cleanup } = await mount({ entity: CAP_ID, _preview: true }, liveCap(), { preview: true });
    expect(has(card, '.preview-label')).toBe(true);
    const el = card as HTMLElement & Flags & { updateComplete: Promise<void> };
    el.preview = false;
    await el.updateComplete;
    expect(has(card, '.preview-label')).toBe(false);
    expect(has(card, '.alert-card')).toBe(true);
    cleanup();
  });
});

describe('nothing resolves', () => {
  it('a missing entity on a dashboard is a named dark source, not sample data', async () => {
    const { card, cleanup } = await mount({ entity: 'sensor.typo_alerts' }, makeHass(), { preview: false });
    expect(has(card, '.preview-label')).toBe(false);
    expect(has(card, '.no-alerts')).toBe(true);
    expect(text(card, '.no-alerts-caveat')).toContain('sensor.typo_alerts');
    cleanup();
  });

  it('a missing entity stays visible under hideNoAlerts', async () => {
    const { card, cleanup } = await mount({ entity: 'sensor.typo_alerts', hideNoAlerts: true }, makeHass(), { preview: false });
    expect(card.style.display).not.toBe('none');
    expect(has(card, '.no-alerts-caveat')).toBe(true);
    cleanup();
  });

  it('unavailableBehavior: hide drops the caveat, and hideNoAlerts then hides the card', async () => {
    const { card, cleanup } = await mount(
      { entity: 'sensor.typo_alerts', hideNoAlerts: true, unavailableBehavior: 'hide' },
      makeHass(),
      { preview: false },
    );
    expect(card.style.display).toBe('none');
    cleanup();
  });

  it('a missing entity in the editor shows sample data', async () => {
    const { card, cleanup } = await mount({ entity: 'sensor.typo_alerts' }, makeHass(), { preview: true });
    expect(has(card, '.preview-label')).toBe(true);
    cleanup();
  });

  it('a feed with no incidents is an all-clear', async () => {
    // NSW RFS and INMET publish nothing on a quiet day; that is the normal state.
    const { card, cleanup } = await mount({ sources: ['nsw_rural_fire_service_feed'] }, makeHass(), { preview: false });
    expect(has(card, '.preview-label')).toBe(false);
    expect(has(card, '.no-alerts')).toBe(true);
    expect(has(card, '.no-alerts-caveat')).toBe(false);
    cleanup();
  });

  it('a feed with no incidents honours hideNoAlerts', async () => {
    const { card, cleanup } = await mount(
      { sources: ['nsw_rural_fire_service_feed'], hideNoAlerts: true },
      makeHass(),
      { preview: false },
    );
    expect(card.style.display).toBe('none');
    cleanup();
  });
});

describe('the card picker', () => {
  it('renders the fallback stub as sample data', async () => {
    const stub = WeatherAlertsCard.getStubConfig(makeHass()) as Partial<WeatherAlertsCardConfig>;
    const { card, cleanup } = await mount(stub, makeHass());
    expect(has(card, '.preview-label')).toBe(true);
    cleanup();
  });

  it('a saved fallback stub on a dashboard reports its missing entity', async () => {
    const stub = WeatherAlertsCard.getStubConfig(makeHass()) as Partial<WeatherAlertsCardConfig>;
    const { card, cleanup } = await mount(stub, makeHass(), { preview: false });
    expect(has(card, '.preview-label')).toBe(false);
    expect(has(card, '.no-alerts-caveat')).toBe(true);
    cleanup();
  });
});
