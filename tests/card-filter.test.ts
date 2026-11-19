import { describe, it, expect, vi } from 'vitest';

import '../src/weather-alerts-card';
import { resetActionDetails } from '../src/action-details';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

interface CardInternals extends HTMLElement {
  setConfig(config: WeatherAlertsCardConfig): void;
  hass: HomeAssistant;
  remove(): void;
}

function nwsAlert(event: string, severity: string) {
  const now = Date.now();
  return {
    ID: `${event}-${severity}`,
    Event: event,
    Severity: severity,
    Sent: new Date(now - 2 * 3600 * 1000).toISOString(),
    Onset: new Date(now - 1 * 3600 * 1000).toISOString(),
    Ends: new Date(now + 3 * 3600 * 1000).toISOString(),
    Expires: new Date(now + 3 * 3600 * 1000).toISOString(),
    Description: 'd',
    Instruction: '',
    URL: '',
    Headline: '',
  };
}

function makeHass(alerts: Record<string, unknown>[]): HomeAssistant {
  return {
    states: { 'sensor.nws_alerts': { state: String(alerts.length), attributes: { Alerts: alerts } } },
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

function alertTitles(card: CardInternals): string[] {
  const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
  if (!root) throw new Error('no shadowRoot');
  return [...root.querySelectorAll('.alert-title')].map(el => (el.textContent || '').trim());
}

describe('minSeverity filter', () => {
  it('keeps unknown-severity alerts but drops below-threshold classified ones', async () => {
    const hass = makeHass([
      nwsAlert('Mystery Alert', ''),            // → severity 'unknown'
      nwsAlert('Small Craft Advisory', 'Minor'), // → 'minor'
      nwsAlert('Tornado Warning', 'Extreme'),    // → 'extreme'
    ]);
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', minSeverity: 'severe' },
      hass,
    );
    const titles = alertTitles(card);
    // 'extreme' passes the floor; 'unknown' is never silently dropped; 'minor'
    // is below 'severe' and is filtered.
    expect(titles).toContain('Tornado Warning');
    expect(titles).toContain('Mystery Alert');
    expect(titles).not.toContain('Small Craft Advisory');
    cleanup();
  });
});

describe('hideTestAlerts', () => {
  const config: WeatherAlertsCardConfig = { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts' };
  const test = { ...nwsAlert('Tsunami Warning', 'Extreme'), NWSCode: 'TSW', Status: 'Test' };

  it.each([undefined, false])('keeps test alerts with the setting %s', async hideTestAlerts => {
    const options = hideTestAlerts === undefined ? config : { ...config, hideTestAlerts };
    const { card, cleanup } = await mountCard(options, makeHass([test]));
    expect(alertTitles(card)).toEqual(['Tsunami Warning']);
    cleanup();
  });

  it('hides the card when no qualifying alerts remain and shows it again on a real warning', async () => {
    const minor = nwsAlert('Small Craft Advisory', 'Minor');
    const { card, cleanup } = await mountCard(
      { ...config, hideTestAlerts: true, minSeverity: 'severe', hideNoAlerts: true },
      makeHass([test, minor]),
    );
    expect(card.style.display).toBe('none');
    expect(alertTitles(card)).toEqual([]);

    card.hass = makeHass([test, minor, { ...nwsAlert('Tornado Warning', 'Severe'), Status: 'Actual' }]);
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
    expect(card.style.display).toBe('');
    expect(alertTitles(card)).toEqual(['Tornado Warning']);
    cleanup();
  });

  it('removes NWS tests before cross-provider dedup without filtering CAP Alerts', async () => {
    const hass = makeHass([test]);
    hass.states['sensor.cap_alert_tsunami'] = {
      state: 'on',
      attributes: {
        incident_platform_version: '1.0', id: 'cap-tsunami', event: test.Event,
        severity: 'Extreme', ends: test.Ends, status: 'Test',
      },
    };
    const { card, cleanup } = await mountCard({
      ...config, entities: ['sensor.cap_alert_tsunami'], showProvider: true, hideTestAlerts: true,
    }, hass);
    expect(alertTitles(card)).toEqual(['Tsunami Warning']);
    expect(card.shadowRoot?.querySelector('.provider-hint')?.textContent?.trim()).toBe('CAP');
    cleanup();
  });
});

describe('degraded badge (#201)', () => {
  const root = (card: CardInternals): ShadowRoot => {
    const r = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!r) throw new Error('no shadowRoot');
    return r;
  };
  // Availability caption, wherever it currently lives: the in-flow strip (alerts
  // present, 'message') or the empty-state caveat (no alerts to anchor to).
  const availabilityText = (card: CardInternals): string =>
    (root(card).querySelector('.degraded-badge, .no-alerts-caveat')?.textContent || '').trim();

  // A cap_alerts per-alert sensor can report state "unknown" while its
  // attributes carry a fully valid alert. It must render the alert and NOT be
  // counted as a broken data source.
  function capUnknownStateHass(): HomeAssistant {
    return {
      states: {
        'sensor.cap_alerts_beach_hazards': {
          state: 'unknown',
          attributes: {
            incident_platform_version: '1.0',
            id: 'fefdc9427295',
            event: 'Beach Hazards Statement',
            severity: 'Moderate',
            certainty: 'Likely',
            urgency: 'Expected',
            description: 'High wave action and dangerous swimming conditions.',
            headline: 'Beach Hazards Statement',
          },
        },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }

  it('renders a CAP alert whose sensor sits at state "unknown" and shows no badge', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.cap_alerts_beach_hazards' },
      capUnknownStateHass(),
    );
    expect(alertTitles(card)).toContain('Beach Hazards Statement');
    // The unknown-with-valid-alert sensor is not broken → no degraded badge.
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    cleanup();
  });

  // A single broken sensor with empty attrs — the reporter's scenario (#187).
  function brokenSensorHass(): HomeAssistant {
    return {
      states: { 'sensor.nws_alerts': { state: 'unavailable', attributes: {} } },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }

  // NINA on HA 2026.11+: the slot is `on` with a live warning, but core left
  // only `id` on it (#403). Must read as a dark source, not an all-clear.
  function strippedNinaHass(state: string): HomeAssistant {
    const attributes = state === 'on'
      ? { id: 'mow.DE-XX-XX-SE000-20261115-00-000', device_class: 'safety', friendly_name: 'xxxx Warnung 1' }
      : { device_class: 'safety', friendly_name: 'xxxx Warnung 1' };
    return {
      states: { 'binary_sensor.region_warnung_1': { state, attributes } },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }

  it('an occupied NINA slot stripped to `id` gets the caveat, with or without provider: nina', async () => {
    for (const provider of [undefined, 'nina'] as const) {
      const { card, cleanup } = await mountCard(
        { type: 'custom:weather-alerts-card', entity: 'binary_sensor.region_warnung_1', ...(provider ? { provider } : {}) },
        strippedNinaHass('on'),
      );
      expect(root(card).querySelector('.no-alerts-caveat')?.textContent).toContain('xxxx Warnung 1');
      cleanup();
    }
  });

  it('shows the warning once nina.get_details answers', async () => {
    resetActionDetails();
    const hass = strippedNinaHass('on');
    const send = vi.fn().mockResolvedValue({
      response: {
        'binary_sensor.region_warnung_1': {
          headline: 'Schaden an der Trinkwasserversorgung',
          description: 'Bitte kochen Sie das Leitungswasser ab.',
          sender: 'Leitstelle',
          severity: 'Minor',
          recommended_actions: 'Wasser abkochen.',
          affected_areas: 'Stadt xxxx',
          web: '',
          id: 'mow.DE-XX-XX-SE000-20261115-00-000',
          sent: new Date(Date.now() - 3600_000).toISOString(),
          start: '',
          expires: '',
        },
      },
    });
    (hass as unknown as { connection: unknown }).connection = { sendMessagePromise: send };
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'binary_sensor.region_warnung_1' },
      hass,
    );
    await new Promise((r) => setTimeout(r, 0));
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
    expect(alertTitles(card)).toEqual(['Schaden an der Trinkwasserversorgung']);
    expect(root(card).querySelector('.no-alerts-caveat')).toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    cleanup();
    resetActionDetails();
  });

  // Core `environment_canada`: a count sensor with titles only (#205).
  function coreEcccHass(answer: 'records' | 'fails'): HomeAssistant {
    const id = 'sensor.region_advisories';
    const send = vi.fn().mockImplementation((m: Record<string, unknown>) => {
      if (m['type'] === 'config/entity_registry/get') return Promise.resolve({ config_entry_id: 'entry1', translation_key: 'advisories' });
      if (answer === 'fails') return Promise.reject(new Error('not connected'));
      return Promise.resolve({ response: { advisories: [{
        title: 'Fog Advisory',
        date: new Date(Date.now() - 3600_000).toISOString(),
        alert_colour_level: 'yellow',
        expiry_time: new Date(Date.now() + 6 * 3600_000).toISOString(),
        text: 'Near-zero visibility in fog.',
        area: 'Region near Somewhere',
        status: 'continued',
        confidence: 'High',
        impact: 'Moderate',
        alert_code: 'FGA',
      }] } });
    });
    return {
      states: { [id]: { state: '1', attributes: { alert_1: 'Fog Advisory', alert_time_1: 'x', attribution: 'Data provided by Environment Canada', friendly_name: 'Region Advisories' } } },
      entities: { [id]: { entity_id: id, platform: 'environment_canada' } },
      connection: { sendMessagePromise: send },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }
  const afterFetch = async (card: CardInternals): Promise<void> => {
    for (let i = 0; i < 3; i++) await new Promise((r) => setTimeout(r, 0));
    await (card as unknown as { updateComplete: Promise<void> }).updateComplete;
  };

  it('shows a core Environment Canada alert once get_alerts answers', async () => {
    resetActionDetails();
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.region_advisories' },
      coreEcccHass('records'),
    );
    await afterFetch(card);
    expect(alertTitles(card)).toEqual(['Fog Advisory']);
    expect(root(card).querySelector('.no-alerts-caveat')).toBeNull();
    cleanup();
    resetActionDetails();
  });

  it('names the core sensor as unavailable while get_alerts fails, never an all-clear', async () => {
    resetActionDetails();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.region_advisories' },
      coreEcccHass('fails'),
    );
    await afterFetch(card);
    expect(alertTitles(card)).toEqual([]);
    expect(root(card).querySelector('.no-alerts-caveat')?.textContent).toContain('Region Advisories');
    cleanup();
    warn.mockRestore();
    resetActionDetails();
  });

  it('an idle NINA slot is still a plain all-clear', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'binary_sensor.region_warnung_1' },
      strippedNinaHass('off'),
    );
    expect(root(card).querySelector('.no-alerts')).not.toBeNull();
    expect(root(card).querySelector('.no-alerts-caveat')).toBeNull();
    cleanup();
  });

  it('all-broken + default (message), 0 alerts → qualified empty state, no strip/dot', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts' },
      brokenSensorHass(),
    );
    // No alerts to anchor to → the caveat lives in the empty state, not a strip.
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    expect(root(card).querySelector('.degraded-dot')).toBeNull();
    expect(root(card).querySelector('.no-alerts')).not.toBeNull();
    expect(root(card).querySelector('.no-alerts-caveat')).not.toBeNull();
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    cleanup();
  });

  it('all-broken + compact, 0 alerts → same qualified empty state (no dot)', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', unavailableBehavior: 'compact' },
      brokenSensorHass(),
    );
    // With no alerts, 'compact' collapses to the same caveat empty state as
    // 'message' — an overlay dot has no host to annotate.
    expect(root(card).querySelector('.degraded-dot')).toBeNull();
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    const caveat = root(card).querySelector('.no-alerts-caveat');
    expect(caveat).not.toBeNull();
    // The accessible caption is still present.
    expect(caveat!.textContent?.trim()).toBeTruthy();
    cleanup();
  });

  it('all-broken + hide alone does NOT hide the card (needs hideNoAlerts too)', async () => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', unavailableBehavior: 'hide' },
      brokenSensorHass(),
    );
    // Badge suppressed, but hideNoAlerts is off → the empty state shows.
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    expect(root(card).querySelector('.no-alerts')).not.toBeNull();
    cleanup();
  });

  it('all-broken + hide + hideNoAlerts fully hides the card', async () => {
    const { card, cleanup } = await mountCard(
      {
        type: 'custom:weather-alerts-card',
        entity: 'sensor.nws_alerts',
        unavailableBehavior: 'hide',
        hideNoAlerts: true,
      },
      brokenSensorHass(),
    );
    expect((card as unknown as HTMLElement).style.display).toBe('none');
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    cleanup();
  });

  // Partial breakage: one source down, one quiet. The working source must never
  // be masked, and the badge must warn a source is dark.
  function partialHass(): HomeAssistant {
    return {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: {} },
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }
  const partialConfig = (extra: Partial<WeatherAlertsCardConfig>): WeatherAlertsCardConfig => ({
    type: 'custom:weather-alerts-card',
    entity: 'sensor.nws_broken',
    entities: ['sensor.nws_quiet'],
    ...extra,
  });

  it('partial (0 alerts) + default → qualified empty state, card visible', async () => {
    const { card, cleanup } = await mountCard(partialConfig({}), partialHass());
    // The all-clear is qualified by the caveat, never a bare strip with no host.
    expect(root(card).querySelector('.no-alerts-caveat')).not.toBeNull();
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    cleanup();
  });

  it('partial + hideNoAlerts still surfaces the caveat (breakage overrides the hide)', async () => {
    const { card, cleanup } = await mountCard(partialConfig({ hideNoAlerts: true }), partialHass());
    expect(root(card).querySelector('.no-alerts-caveat')).not.toBeNull();
    expect((card as unknown as HTMLElement).style.display).not.toBe('none');
    cleanup();
  });

  it('partial + hide restores prior behavior (no badge, all-clear shown)', async () => {
    const { card, cleanup } = await mountCard(partialConfig({ unavailableBehavior: 'hide' }), partialHass());
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    expect(root(card).querySelector('.no-alerts')).not.toBeNull();
    cleanup();
  });

  it('partial + hide + hideNoAlerts hides the card', async () => {
    const { card, cleanup } = await mountCard(
      partialConfig({ unavailableBehavior: 'hide', hideNoAlerts: true }),
      partialHass(),
    );
    expect((card as unknown as HTMLElement).style.display).toBe('none');
    cleanup();
  });

  // With alerts to anchor to, the availability signal takes its anchored form.
  function brokenPlusActiveHass(): HomeAssistant {
    return {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: {} },
        'sensor.nws_active': { state: '1', attributes: { Alerts: [nwsAlert('Tornado Warning', 'Extreme')] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
  }

  it('partial + active alert + message → strip above the rendered alert (no dot)', async () => {
    const { card, cleanup } = await mountCard(
      partialConfig({ entity: 'sensor.nws_broken', entities: ['sensor.nws_active'] }),
      brokenPlusActiveHass(),
    );
    expect(root(card).querySelector('.degraded-badge')).not.toBeNull();
    expect(root(card).querySelector('.degraded-dot')).toBeNull();
    expect(alertTitles(card)).toContain('Tornado Warning');
    cleanup();
  });

  it('partial + active alert + compact → corner dot over the alert (no strip)', async () => {
    const { card, cleanup } = await mountCard(
      partialConfig({ entity: 'sensor.nws_broken', entities: ['sensor.nws_active'], unavailableBehavior: 'compact' }),
      brokenPlusActiveHass(),
    );
    const dot = root(card).querySelector('.degraded-dot');
    expect(dot).not.toBeNull();
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    // The dot annotates real content, not the empty state.
    expect(root(card).querySelector('.no-alerts')).toBeNull();
    expect(alertTitles(card)).toContain('Tornado Warning');
    // Accessible caption rides on the dot.
    expect(dot!.getAttribute('aria-label')).toBeTruthy();
    cleanup();
  });

  it('row 4 (all up, 0 alerts) shows no badge and the normal empty state', async () => {
    const hass = {
      states: {
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
        'sensor.nws_quiet_2': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity: 'sensor.nws_quiet', entities: ['sensor.nws_quiet_2'] },
      hass,
    );
    expect(root(card).querySelector('.degraded-badge')).toBeNull();
    expect(root(card).querySelector('.no-alerts')).not.toBeNull();
    cleanup();
  });

  it('names the broken source by friendly_name, else the entity id', async () => {
    const named = {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: { friendly_name: 'NWS Boulder' } },
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const r1 = await mountCard(partialConfig({}), named);
    expect(availabilityText(r1.card)).toContain('NWS Boulder');
    r1.cleanup();

    // Empty attrs (#187) → fall back to the entity id.
    const r2 = await mountCard(partialConfig({}), partialHass());
    expect(availabilityText(r2.card)).toContain('sensor.nws_broken');
    r2.cleanup();
  });

  it('counts broken sources when more than one is down', async () => {
    const hass = {
      states: {
        'sensor.nws_broken': { state: 'unavailable', attributes: {} },
        'sensor.dwd_broken': { state: 'unknown', attributes: {} },
        'sensor.nws_quiet': { state: '0', attributes: { Alerts: [] } },
      },
      locale: { language: 'en' },
    } as unknown as HomeAssistant;
    const { card, cleanup } = await mountCard(
      partialConfig({ entities: ['sensor.dwd_broken', 'sensor.nws_quiet'] }),
      hass,
    );
    expect(availabilityText(card)).toContain('2');
    cleanup();
  });
});

describe('provider label on a cross-provider duplicate (#234)', () => {
  const BODY = 'Es treten Sturmböen mit Geschwindigkeiten bis 80 km/h aus südwestlicher Richtung auf.';
  const iso = (hours: number): string => new Date(Date.now() + hours * 3600 * 1000).toISOString();
  const states = {
    'sensor.dwd_current': {
      state: '2',
      attributes: {
        warning_count: 1,
        region_name: 'Märkischer Kreis',
        warning_1: {
          start_time: iso(5), end_time: iso(17), event: 'STURMBÖEN', event_code: 52,
          headline: 'Amtliche WARNUNG vor STURMBÖEN', description: BODY, instruction: '',
          level: 2, color: '#fb8c00',
        },
      },
    },
    'binary_sensor.nina_warning_1': {
      state: 'on',
      attributes: {
        id: 'dwd.relay.1', headline: 'Amtliche WARNUNG vor STURMBÖEN', description: BODY,
        sender: 'Deutscher Wetterdienst', severity: 'Moderate', recommended_actions: '',
        affected_areas: 'Stadt Medebach', web: '', sent: iso(-7), start: iso(-7), expires: iso(18),
      },
    },
  };
  const hass = { states, locale: { language: 'en' } } as unknown as HomeAssistant;
  const hints = (card: CardInternals): string[] => {
    const root = (card as unknown as { shadowRoot: ShadowRoot | null }).shadowRoot;
    if (!root) throw new Error('no shadowRoot');
    return [...root.querySelectorAll('.provider-hint')].map(el => (el.textContent || '').trim());
  };

  it.each([
    ['DWD listed first', 'sensor.dwd_current', 'binary_sensor.nina_warning_1'],
    ['NINA listed first', 'binary_sensor.nina_warning_1', 'sensor.dwd_current'],
  ])('shows one DWD row labeled with both providers, %s', async (_name, entity, extra) => {
    const { card, cleanup } = await mountCard(
      { type: 'custom:weather-alerts-card', entity, entities: [extra], showProvider: true },
      hass,
    );
    expect(alertTitles(card)).toEqual(['STURMBÖEN']);
    expect(hints(card)).toEqual(['DWD + NINA']);
    cleanup();
  });

  it('counts the other providers in the narrow timeline gutter, with the list as tooltip', async () => {
    const { card, cleanup } = await mountCard(
      {
        type: 'custom:weather-alerts-card', entity: 'binary_sensor.nina_warning_1',
        entities: ['sensor.dwd_current'], showProvider: true, layout: 'timeline',
      },
      hass,
    );
    const root = (card as unknown as { shadowRoot: ShadowRoot }).shadowRoot;
    const hint = root.querySelector('.timeline-row .provider-hint');
    expect((hint?.textContent || '').trim()).toBe('DWD +1');
    expect(hint?.getAttribute('title')).toBe('DWD + NINA');
    cleanup();
  });

  it('shows both rows, each with its own label, when deduplicate is off', async () => {
    const { card, cleanup } = await mountCard(
      {
        type: 'custom:weather-alerts-card', entity: 'sensor.dwd_current',
        entities: ['binary_sensor.nina_warning_1'], showProvider: true, deduplicate: false,
      },
      hass,
    );
    expect(hints(card)).toEqual(['DWD', 'NINA']);
    cleanup();
  });
});
