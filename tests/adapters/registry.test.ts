import { describe, it, expect } from 'vitest';
import { getAdapter } from '../../src/adapters';

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

  it('defaults to NWS when attributes are ambiguous', () => {
    const adapter = getAdapter(undefined, {});
    expect(adapter.provider).toBe('nws');
  });
});
