import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ACTION_REFRESH_MS,
  ACTION_RETRY_MS,
  actionAttributes,
  actionDetailKey,
  requestActionDetails,
  resetActionDetails,
  subscribeActionDetails,
} from '../src/action-details';
import { NinaAdapter } from '../src/adapters/nina';
import { EcccAdapter } from '../src/adapters/eccc';
import type { HassEntity, HomeAssistant } from '../src/types';

// NINA on HA 2026.11+: the slot carries `id` alone and the warning comes from
// `nina.get_details` (#403). The response uses the old attribute names.
const SLOT = 'binary_sensor.region_warnung_1';
const ID = 'mow.DE-XX-XX-SE000-20261115-00-000';
const DETAILS = {
  headline: 'Schaden an der Trinkwasserversorgung',
  description: 'Bitte kochen Sie das Leitungswasser ab.',
  sender: 'Leitstelle',
  severity: 'Minor',
  recommended_actions: 'Wasser abkochen.',
  affected_areas: 'Stadt xxxx',
  web: '',
  id: ID,
  sent: '2026-11-15T10:00:00+01:00',
  start: '',
  expires: '',
};

const stripped = (id = ID): HassEntity => ({ state: 'on', attributes: { id, device_class: 'safety' } });
const idle = (): HassEntity => ({ state: 'off', attributes: { device_class: 'safety' } });

type Send = (msg: Record<string, unknown>) => Promise<unknown>;
function makeHass(entity: HassEntity, send?: Send, platform = 'nina'): HomeAssistant {
  return {
    states: { [SLOT]: entity },
    entities: { [SLOT]: { entity_id: SLOT, platform } },
    ...(send ? { connection: { sendMessagePromise: send } } : {}),
  } as unknown as HomeAssistant;
}
const settle = (): Promise<void> => new Promise((r) => setTimeout(r, 0));
// Whether the slot's current warning has its details in hand.
const answered = (): boolean => 'headline' in actionAttributes(SLOT, stripped());

describe('action details', () => {
  beforeEach(() => resetActionDetails());

  it('leaves every ordinary entity alone', () => {
    const e: HassEntity = { state: '2', attributes: { Alerts: [] } };
    expect(actionDetailKey(e)).toBeNull();
    expect(actionAttributes('sensor.nws', e)).toBe(e.attributes);
    expect(actionDetailKey(idle())).toBeNull();
  });

  it('asks nina.get_details once and lays the answer over the slot', async () => {
    const send = vi.fn<Send>().mockResolvedValue({ response: { [SLOT]: DETAILS } });
    const hass = makeHass(stripped(), send);
    const woke = vi.fn();
    subscribeActionDetails(woke);

    expect(answered()).toBe(false);
    requestActionDetails(hass, [SLOT]);
    requestActionDetails(hass, [SLOT]); // in flight: no second call
    await settle();

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith({
      type: 'call_service',
      domain: 'nina',
      service: 'get_details',
      target: { entity_id: [SLOT] },
      return_response: true,
    });
    expect(woke).toHaveBeenCalledTimes(1);
    expect(answered()).toBe(true);

    const [alert] = new NinaAdapter().parseAlerts(actionAttributes(SLOT, stripped()));
    expect(alert?.headline).toBe(DETAILS.headline);
    expect(alert?.instruction).toBe(DETAILS.recommended_actions);

    requestActionDetails(hass, [SLOT]); // answered: still one call
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('asks again when the slot holds a different warning', async () => {
    const send = vi.fn<Send>().mockResolvedValue({ response: { [SLOT]: DETAILS } });
    requestActionDetails(makeHass(stripped(), send), [SLOT]);
    await settle();

    const next = stripped('mow.other');
    // The old answer is not shown for the new warning.
    expect(actionAttributes(SLOT, next)).toBe(next.attributes);
    requestActionDetails(makeHass(next, send), [SLOT]);
    await settle();
    expect(send).toHaveBeenCalledTimes(2);
  });

  it('asks again once the answer is a refresh window old, and shows the revision', async () => {
    const revised = { ...DETAILS, expires: '2026-11-15T18:00:00+01:00' };
    const send = vi.fn<Send>()
      .mockResolvedValueOnce({ response: { [SLOT]: DETAILS } })
      .mockResolvedValueOnce({ response: { [SLOT]: revised } });
    const hass = makeHass(stripped(), send);

    requestActionDetails(hass, [SLOT]);
    await settle();
    requestActionDetails(hass, [SLOT], Date.now() + ACTION_REFRESH_MS - 1000);
    expect(send).toHaveBeenCalledTimes(1);

    requestActionDetails(hass, [SLOT], Date.now() + ACTION_REFRESH_MS + 1000);
    expect(send).toHaveBeenCalledTimes(2);
    // The old answer serves while the new one is in flight.
    expect(actionAttributes(SLOT, stripped())['expires']).toBe('');
    await settle();
    expect(actionAttributes(SLOT, stripped())['expires']).toBe(revised.expires);
  });

  it('keeps the old answer when a refresh fails, and retries on the failure window', async () => {
    const send = vi.fn<Send>()
      .mockResolvedValueOnce({ response: { [SLOT]: DETAILS } })
      .mockRejectedValue(new Error('nope'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hass = makeHass(stripped(), send);

    requestActionDetails(hass, [SLOT]);
    await settle();
    const later = Date.now() + ACTION_REFRESH_MS + 1000;
    // The failure is stamped from the real clock: move it to `later` too.
    const clock = vi.spyOn(Date, 'now').mockReturnValue(later);
    requestActionDetails(hass, [SLOT], later);
    await settle();
    clock.mockRestore();
    expect(send).toHaveBeenCalledTimes(2);
    expect(answered()).toBe(true);

    requestActionDetails(hass, [SLOT], later + 1000);
    expect(send).toHaveBeenCalledTimes(2);
    requestActionDetails(hass, [SLOT], later + ACTION_RETRY_MS + 5000);
    expect(send).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('holds a failure for the retry window, then asks again', async () => {
    const send = vi.fn<Send>().mockRejectedValue(new Error('nope'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const hass = makeHass(stripped(), send);
    const t0 = 1_000_000;

    requestActionDetails(hass, [SLOT], t0);
    await settle();
    expect(answered()).toBe(false);

    requestActionDetails(hass, [SLOT], Date.now() + ACTION_RETRY_MS - 1000);
    expect(send).toHaveBeenCalledTimes(1);
    requestActionDetails(hass, [SLOT], Date.now() + ACTION_RETRY_MS + 1000);
    expect(send).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('settles as a failure without a connection, and wakes the card', async () => {
    const woke = vi.fn();
    subscribeActionDetails(woke);
    requestActionDetails(makeHass(stripped()), [SLOT]);
    await settle();
    expect(woke).toHaveBeenCalledTimes(1);
    expect(answered()).toBe(false);
  });

  it('counts a response with no entry for the slot as a failure', async () => {
    const send = vi.fn<Send>().mockResolvedValue({ response: {} });
    requestActionDetails(makeHass(stripped(), send), [SLOT]);
    await settle();
    expect(answered()).toBe(false);
    // Inside the retry window: not asked again.
    requestActionDetails(makeHass(stripped(), send), [SLOT]);
    expect(send).toHaveBeenCalledTimes(1);
  });

  it('never sends another integration\'s entity to nina.get_details', async () => {
    const send = vi.fn<Send>().mockResolvedValue({ response: {} });
    requestActionDetails(makeHass(stripped(), send, 'template'), [SLOT]);
    await settle();
    expect(send).not.toHaveBeenCalled();
  });

  it('drops the answer once the slot empties', async () => {
    const send = vi.fn<Send>().mockResolvedValue({ response: { [SLOT]: DETAILS } });
    requestActionDetails(makeHass(stripped(), send), [SLOT]);
    await settle();
    requestActionDetails(makeHass(idle(), send), [SLOT]);
    // The same warning id coming back is asked for afresh.
    expect(answered()).toBe(false);
  });
});

// Core `environment_canada`: count sensors with titles only, records behind
// `get_alerts`. Shapes below are from a live core 2026.11.1 install.
describe('action details: core Environment Canada', () => {
  const ADVISORIES = 'sensor.region_advisories';
  const WARNINGS = 'sensor.region_warnings';
  const ENTRY = '01M7GKZC1SMATCW96NJKHE5FM9';
  const ATTRIBUTION = 'Data provided by Environment Canada';
  const RECORD = {
    title: 'Fog Advisory',
    date: '2026-11-15T21:45:35.440Z',
    alert_colour_level: 'yellow',
    expiry_time: '2026-11-16T13:45:35.440Z',
    text: 'Near-zero visibility in fog continues over some areas.',
    area: 'Region near Somewhere',
    status: 'continued',
    confidence: 'High',
    impact: 'Moderate',
    alert_code: 'FGA',
  };
  const counting = (title = 'Fog Advisory'): HassEntity => ({
    state: '1',
    attributes: { location: 'Region', station: 'Region', alert_1: title, alert_time_1: RECORD.date, attribution: ATTRIBUTION },
  });
  const quiet = (): HassEntity => ({ state: '0', attributes: { attribution: ATTRIBUTION } });

  type Message = Record<string, unknown>;
  function makeEccc(states: Record<string, HassEntity>, response: unknown): { hass: HomeAssistant; send: ReturnType<typeof vi.fn<(m: Message) => Promise<unknown>>> } {
    const send = vi.fn<(m: Message) => Promise<unknown>>().mockImplementation((m) => {
      if (m['type'] === 'config/entity_registry/get') {
        const id = String(m['entity_id']);
        return Promise.resolve({ config_entry_id: ENTRY, translation_key: id.split('_').pop() });
      }
      return Promise.resolve({ response });
    });
    const entities = Object.fromEntries(Object.keys(states).map(id => [id, { entity_id: id, platform: 'environment_canada' }]));
    return { hass: { states, entities, connection: { sendMessagePromise: send } } as unknown as HomeAssistant, send };
  }
  const calls = (send: { mock: { calls: Message[][] } }, type: string): Message[] =>
    send.mock.calls.map(c => c[0]).filter(m => m['type'] === type);

  beforeEach(() => resetActionDetails());

  it('keys a count sensor on its titles and leaves a quiet one and the fork alone', () => {
    expect(actionDetailKey(counting())).toBe(`eccc:Fog Advisory@${RECORD.date}`);
    expect(actionDetailKey(counting('Snowfall Warning'))).not.toBe(actionDetailKey(counting()));
    expect(actionDetailKey(quiet())).toBeNull();
    // The HACS fork publishes the records on the entity: nothing to fetch.
    expect(actionDetailKey({ state: '1', attributes: { alerts: [RECORD], attribution: ATTRIBUTION } })).toBeNull();
  });

  it('fetches by config entry and hands each sensor its own list', async () => {
    const states = { [ADVISORIES]: counting(), [WARNINGS]: counting('Snowfall Warning') };
    const { hass, send } = makeEccc(states, {
      warnings: [{ ...RECORD, title: 'Snowfall Warning', alert_colour_level: 'orange' }],
      watches: [],
      advisories: [RECORD],
      statements: [],
      endings: [],
    });
    requestActionDetails(hass, [ADVISORIES, WARNINGS]);
    await settle();
    await settle();

    // Two registry lookups, one action call for the one config entry.
    expect(calls(send, 'config/entity_registry/get')).toHaveLength(2);
    expect(calls(send, 'call_service')).toEqual([{
      type: 'call_service',
      domain: 'environment_canada',
      service: 'get_alerts',
      service_data: { config_entry_id: ENTRY },
      return_response: true,
    }]);

    const adapter = new EcccAdapter();
    const [advisory] = adapter.parseAlerts(actionAttributes(ADVISORIES, states[ADVISORIES]));
    expect(advisory?.event).toBe('Fog Advisory');
    expect(advisory?.description).toContain('Near-zero visibility');
    expect(advisory?.areaDesc).toBe('Region near Somewhere');
    expect(advisory?.endsTs).toBe(Date.parse(RECORD.expiry_time) / 1000);
    const warnings = adapter.parseAlerts(actionAttributes(WARNINGS, states[WARNINGS]));
    expect(warnings.map(a => a.event)).toEqual(['Snowfall Warning']);

    requestActionDetails(hass, [ADVISORIES, WARNINGS]); // answered: nothing more is sent
    expect(send).toHaveBeenCalledTimes(3);
  });

  it('asks again when the titles change', async () => {
    const { hass, send } = makeEccc({ [ADVISORIES]: counting() }, { advisories: [RECORD] });
    requestActionDetails(hass, [ADVISORIES]);
    await settle();
    await settle();
    const next = counting('Freezing Rain Advisory');
    expect(actionAttributes(ADVISORIES, next)).toBe(next.attributes);
    requestActionDetails({ ...hass, states: { [ADVISORIES]: next } }, [ADVISORIES]);
    await settle();
    await settle();
    expect(calls(send, 'call_service')).toHaveLength(2);
  });

  it('counts a failed action as a failure and leaves the sensor unparsed', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { hass, send } = makeEccc({ [ADVISORIES]: counting() }, null);
    send.mockImplementation((m) => (m['type'] === 'config/entity_registry/get'
      ? Promise.resolve({ config_entry_id: ENTRY, translation_key: 'advisories' })
      : Promise.reject(new Error('not connected'))));
    requestActionDetails(hass, [ADVISORIES]);
    await settle();
    await settle();
    expect('alerts' in actionAttributes(ADVISORIES, counting())).toBe(false);
    // Inside the retry window: not asked again.
    requestActionDetails(hass, [ADVISORIES]);
    expect(calls(send, 'call_service')).toHaveLength(1);
    warn.mockRestore();
  });

  it('skips a sensor the registry cannot place', async () => {
    const { hass, send } = makeEccc({ [ADVISORIES]: counting() }, { advisories: [RECORD] });
    send.mockImplementation(() => Promise.resolve({ config_entry_id: null, translation_key: 'advisories' }));
    requestActionDetails(hass, [ADVISORIES]);
    await settle();
    await settle();
    expect(calls(send, 'call_service')).toHaveLength(0);
    expect('alerts' in actionAttributes(ADVISORIES, counting())).toBe(false);
  });
});

