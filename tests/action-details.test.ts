import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  ACTION_RETRY_MS,
  actionAttributes,
  actionDetailKey,
  requestActionDetails,
  resetActionDetails,
  subscribeActionDetails,
} from '../src/action-details';
import { NinaAdapter } from '../src/adapters/nina';
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
