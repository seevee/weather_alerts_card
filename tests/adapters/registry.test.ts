import { describe, it, expect } from 'vitest';
import { getAdapter, canHandleAny, ENTITY_NAME_PATTERNS } from '../../src/adapters';

describe('getAdapter', () => {
  it('returns NWS adapter for explicit nws provider', () => {
    const adapter = getAdapter('nws', {});
    expect(adapter.provider).toBe('nws');
  });

  it('returns BoM adapter for explicit bom provider', () => {
    const adapter = getAdapter('bom', {});
    expect(adapter.provider).toBe('bom');
  });

  it('auto-detects NWS from Alerts attribute', () => {
    const adapter = getAdapter(undefined, {
      Alerts: [{ Event: 'Tornado Warning', Severity: 'Extreme' }],
    });
    expect(adapter.provider).toBe('nws');
  });

  it('auto-detects BoM from warnings attribute', () => {
    const adapter = getAdapter(undefined, {
      warnings: [{ warning_group_type: 'major', issue_time: '2026-03-06T10:00:00Z' }],
    });
    expect(adapter.provider).toBe('bom');
  });

  it('returns MeteoAlarm adapter for explicit meteoalarm provider', () => {
    const adapter = getAdapter('meteoalarm', {});
    expect(adapter.provider).toBe('meteoalarm');
  });

  it('auto-detects MeteoAlarm from attribution', () => {
    const adapter = getAdapter(undefined, {
      attribution: 'Information provided by MeteoAlarm',
      awareness_level: '3; orange; Severe',
      awareness_type: '1; Wind',
      event: 'Wind warning',
    });
    expect(adapter.provider).toBe('meteoalarm');
  });

  it('returns PirateWeather adapter for explicit pirateweather provider', () => {
    const adapter = getAdapter('pirateweather', {});
    expect(adapter.provider).toBe('pirateweather');
  });

  it('auto-detects PirateWeather from attribution', () => {
    const adapter = getAdapter(undefined, {
      attribution: 'Data provided by Pirate Weather',
      title: 'Wind Advisory',
      severity: 'Moderate',
    });
    expect(adapter.provider).toBe('pirateweather');
  });

  it('returns DWD adapter for explicit dwd provider', () => {
    const adapter = getAdapter('dwd', {});
    expect(adapter.provider).toBe('dwd');
  });

  it('returns CAP adapter for explicit cap provider', () => {
    const adapter = getAdapter('cap', {});
    expect(adapter.provider).toBe('cap');
  });

  it('auto-detects CAP from incident_platform_version', () => {
    const adapter = getAdapter(undefined, {
      incident_platform_version: '1.0',
      id: 'urn:oid:abc',
      event: 'Tornado Warning',
      severity: 'Severe',
      severity_normalized: 'severe',
    });
    expect(adapter.provider).toBe('cap');
  });

  it('auto-detects DWD from warning_count and region_name', () => {
    const adapter = getAdapter(undefined, {
      warning_count: 1,
      region_name: 'Stadt Hamburg',
      region_id: '813073047',
      warning_1: {
        headline: 'Amtliche WARNUNG vor WINDBÖEN',
        level: 1,
        color: '#FFFF00',
        event: 'WINDBÖEN',
        event_code: 31,
        start_time: '2026-04-01T08:00:00+02:00',
        end_time: '2026-04-01T18:00:00+02:00',
      },
    });
    expect(adapter.provider).toBe('dwd');
  });

  it('defaults to NWS when attributes are ambiguous', () => {
    const adapter = getAdapter(undefined, {});
    expect(adapter.provider).toBe('nws');
  });
});

describe('canHandleAny', () => {
  it('returns true for NWS attributes with alerts', () => {
    expect(canHandleAny({ Alerts: [{ Event: 'Tornado Warning', Severity: 'Extreme' }] })).toBe(true);
  });

  it('returns true for empty NWS Alerts array', () => {
    expect(canHandleAny({ Alerts: [] })).toBe(true);
  });

  it('returns true for BoM attributes', () => {
    expect(canHandleAny({
      warnings: [{ warning_group_type: 'major', issue_time: '2026-03-06T10:00:00Z' }],
    })).toBe(true);
  });

  it('returns true for MeteoAlarm attributes', () => {
    expect(canHandleAny({
      awareness_level: '3; orange; Severe',
      awareness_type: '1; Wind',
    })).toBe(true);
  });

  it('returns true for PirateWeather attributes', () => {
    expect(canHandleAny({ attribution: 'Data provided by Pirate Weather' })).toBe(true);
  });

  it('returns true for CAP Alerts attributes', () => {
    expect(canHandleAny({
      incident_platform_version: '1.0',
      id: 'urn:oid:abc',
    })).toBe(true);
  });

  it('returns false for unrelated attributes', () => {
    expect(canHandleAny({ temperature: 72, humidity: 45 })).toBe(false);
  });
});

describe('ENTITY_NAME_PATTERNS', () => {
  const matches = (id: string) => ENTITY_NAME_PATTERNS.some(p => p.test(id));

  it('matches NWS alert entity names', () => {
    expect(matches('sensor.nws_alerts')).toBe(true);
    expect(matches('sensor.nws_alerts_alerts')).toBe(true);
  });

  it('matches warning entity names', () => {
    expect(matches('sensor.bom_brisbane_warnings')).toBe(true);
  });

  it('matches MeteoAlarm binary sensor', () => {
    expect(matches('binary_sensor.meteoalarm_wind')).toBe(true);
  });

  it('does not match unrelated sensors', () => {
    expect(matches('sensor.temperature')).toBe(false);
    expect(matches('sensor.nws_forecast')).toBe(false);
  });

  it('matches DWD weather warnings entity', () => {
    expect(matches('sensor.dwd_weather_warnings_hamburg_current')).toBe(true);
  });

  it('matches CAP Alerts per-alert entity (device-slug prefixed form)', () => {
    expect(matches('sensor.cap_alerts_meteoalarm_germany_cap_alert_frost_ccd3fb06')).toBe(true);
    expect(matches('sensor.cap_alerts_nws_pkz730_cap_alert_tornado_warning_a1b2c3d4')).toBe(true);
  });

  it('matches CAP Alerts per-alert entity (bare suggested-object-id form)', () => {
    expect(matches('sensor.cap_alert_tornado_warning_a1b2c3d4')).toBe(true);
  });

  it('does not match CAP Alerts diagnostic entities', () => {
    expect(matches('sensor.cap_alerts_meteoalarm_germany_alert_count')).toBe(false);
    expect(matches('sensor.cap_alerts_meteoalarm_germany_last_updated')).toBe(false);
    expect(matches('sensor.cap_alerts_count')).toBe(false);
    expect(matches('sensor.cap_alerts_last_updated')).toBe(false);
  });

  it('does not match metadata entities with alert in the middle', () => {
    expect(matches('sensor.nws_alerts_last_updated')).toBe(false);
  });
});
