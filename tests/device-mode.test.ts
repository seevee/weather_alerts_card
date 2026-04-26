import { describe, it, expect } from 'vitest';
import { resolveDeviceAlertEntities } from '../src/weather-alerts-card';
import type { HomeAssistant, EntityRegistryDisplayEntry } from '../src/types';

const DEVICE = '79aa726d100270b5cdd732f51662d4d0';
const OTHER_DEVICE = 'aa11bb22cc33dd44ee55ff6677889900';

function entry(
  entity_id: string,
  device_id: string | null = DEVICE,
  overrides: Partial<EntityRegistryDisplayEntry> = {},
): EntityRegistryDisplayEntry {
  return { entity_id, device_id, platform: 'cap_alerts', ...overrides };
}

function capAlertAttrs(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    incident_platform_version: '1.0',
    id: 'urn:oid:2.49.0.1.276.0.abc',
    event: 'Frost',
    severity: 'Moderate',
    severity_normalized: 'moderate',
    sent: '2026-04-25T22:00:00+00:00',
    expires: '2026-04-26T07:00:00+00:00',
    ...extra,
  };
}

function makeHass(
  entities: EntityRegistryDisplayEntry[],
  states: Record<string, { state: string; attributes: Record<string, unknown> }>,
): HomeAssistant {
  const reg: Record<string, EntityRegistryDisplayEntry> = {};
  for (const e of entities) reg[e.entity_id] = e;
  return {
    states,
    locale: { language: 'en' },
    entities: reg,
  } as unknown as HomeAssistant;
}

describe('resolveDeviceAlertEntities', () => {
  it('returns matching per-alert entities under the device', () => {
    const ids = [
      'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06',
      'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_75f375fc',
    ];
    const hass = makeHass(
      ids.map(id => entry(id)),
      Object.fromEntries(ids.map(id => [id, { state: 'moderate', attributes: capAlertAttrs() }])),
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual(ids);
  });

  it('skips diagnostic siblings (count, last_updated) under the same device', () => {
    const alertId = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    const countId = 'sensor.cap_alerts_meteoalarm_germany_alert_count';
    const updatedId = 'sensor.cap_alerts_meteoalarm_germany_last_updated';
    const hass = makeHass(
      [entry(alertId), entry(countId), entry(updatedId)],
      {
        [alertId]: { state: 'moderate', attributes: capAlertAttrs() },
        [countId]: { state: '4', attributes: { friendly_name: 'Alert count' } },
        [updatedId]: { state: '2026-04-26T01:55:00+00:00', attributes: {} },
      },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([alertId]);
  });

  it('ignores entries from other devices', () => {
    const mineId = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_aaa';
    const otherId = 'sensor.cap_alerts_nws_county_cap_alert_tornado_bbb';
    const hass = makeHass(
      [entry(mineId, DEVICE), entry(otherId, OTHER_DEVICE)],
      {
        [mineId]: { state: 'moderate', attributes: capAlertAttrs() },
        [otherId]: { state: 'severe', attributes: capAlertAttrs() },
      },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([mineId]);
  });

  it('matches the real CAP Alerts entity_id format from a live install', () => {
    // Format observed in production: device slug prefixed by HA when
    // `_attr_has_entity_name` is True and `suggested_object_id` is set.
    const id = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    const hass = makeHass(
      [entry(id)],
      { [id]: { state: 'moderate', attributes: capAlertAttrs() } },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([id]);
  });

  it('returns [] when hass.entities is undefined', () => {
    const hass = { states: {}, locale: { language: 'en' } } as unknown as HomeAssistant;
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([]);
  });

  it('returns [] when registry has the entity but state is missing', () => {
    const id = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    const hass = makeHass([entry(id)], {});
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([]);
  });

  it('skips entries with null device_id', () => {
    const id = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    const hass = makeHass(
      [entry(id, null)],
      { [id]: { state: 'moderate', attributes: capAlertAttrs() } },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([]);
  });

  it('skips entries whose state attributes are not recognised by any adapter', () => {
    const id = 'sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06';
    // No incident_platform_version, no Alerts, no warnings — nothing matches.
    const hass = makeHass(
      [entry(id)],
      { [id]: { state: 'moderate', attributes: { friendly_name: 'Frost' } } },
    );
    expect(resolveDeviceAlertEntities(hass, DEVICE)).toEqual([]);
  });
});
