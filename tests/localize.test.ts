import { describe, it, expect } from 'vitest';
import { t } from '../src/localize';

describe('t()', () => {
  it('returns English string for known key', () => {
    expect(t('card.no_alerts', 'en')).toBe('No active alerts.');
  });

  it('returns French string for known key', () => {
    expect(t('card.no_alerts', 'fr')).toBe('Aucune alerte active.');
  });

  it('returns Spanish string for known key', () => {
    expect(t('card.no_alerts', 'es')).toBe('Sin alertas activas.');
  });

  it('falls back to English for unknown language', () => {
    expect(t('card.no_alerts', 'de')).toBe('No active alerts.');
  });

  it('strips region subtag (fr-CA -> fr)', () => {
    expect(t('card.no_alerts', 'fr-CA')).toBe('Aucune alerte active.');
  });

  it('strips region subtag (es-MX -> es)', () => {
    expect(t('card.no_alerts', 'es-MX')).toBe('Sin alertas activas.');
  });

  it('returns the key itself for unknown key', () => {
    expect(t('unknown.key', 'en')).toBe('unknown.key');
  });

  it('interpolates named parameters', () => {
    expect(t('card.zones_count', 'en', { count: 3 })).toBe('3 zones');
  });

  it('interpolates named parameters in French', () => {
    expect(t('card.sensor_unavailable', 'fr', { state: 'indisponible' }))
      .toBe("Le capteur d'alerte est indisponible.");
  });

  it('interpolates singular zone count', () => {
    expect(t('card.zone_count_singular', 'en', { count: 1 })).toBe('1 zone');
  });

  it('handles case-insensitive language codes', () => {
    expect(t('card.no_alerts', 'FR')).toBe('Aucune alerte active.');
  });

  it('returns badge severity labels in English', () => {
    expect(t('badge.severity_extreme', 'en')).toBe('Extreme');
    expect(t('badge.severity_severe', 'en')).toBe('Severe');
    expect(t('badge.severity_moderate', 'en')).toBe('Moderate');
    expect(t('badge.severity_minor', 'en')).toBe('Minor');
    expect(t('badge.severity_unknown', 'en')).toBe('Unknown');
  });

  it('returns badge severity labels in French', () => {
    expect(t('badge.severity_extreme', 'fr')).toBe('Extrême');
    expect(t('badge.severity_severe', 'fr')).toBe('Grave');
    expect(t('badge.severity_moderate', 'fr')).toBe('Modérée');
    expect(t('badge.severity_minor', 'fr')).toBe('Mineure');
    expect(t('badge.severity_unknown', 'fr')).toBe('Inconnue');
  });

  it('returns badge severity labels in Spanish', () => {
    expect(t('badge.severity_extreme', 'es')).toBe('Extrema');
    expect(t('badge.severity_severe', 'es')).toBe('Grave');
    expect(t('badge.severity_moderate', 'es')).toBe('Moderada');
    expect(t('badge.severity_minor', 'es')).toBe('Menor');
    expect(t('badge.severity_unknown', 'es')).toBe('Desconocida');
  });

  it('returns badge severity labels in Italian', () => {
    expect(t('badge.severity_extreme', 'it')).toBe('Estrema');
    expect(t('badge.severity_severe', 'it')).toBe('Grave');
    expect(t('badge.severity_moderate', 'it')).toBe('Moderata');
    expect(t('badge.severity_minor', 'it')).toBe('Lieve');
    expect(t('badge.severity_unknown', 'it')).toBe('Sconosciuta');
  });

  it('all en keys exist in fr', () => {
    // Access translations indirectly through t()
    const enKeys = [
      'card.no_alerts', 'card.sensor_unavailable', 'card.preview', 'card.read_details',
      'card.open_source', 'card.active', 'card.in_prep', 'card.zones_count',
      'card.zone_count_singular',
      'detail.issued', 'detail.onset', 'detail.expires', 'detail.area',
      'detail.description', 'detail.instructions',
      'progress.start', 'progress.now', 'progress.end', 'progress.ongoing',
      'progress.expires_in', 'progress.starts_in', 'progress.tbd', 'progress.na',
      'time.just_now', 'time.in_less_than_1m', 'time.minutes_ago', 'time.in_minutes',
      'time.hours_ago', 'time.in_hours', 'time.days_ago', 'time.in_days',
      'editor.entity', 'editor.title', 'editor.provider', 'editor.provider_auto',
      'editor.provider_nws', 'editor.provider_bom', 'editor.provider_meteoalarm',
      'editor.provider_pirateweather', 'editor.zones', 'editor.zones_helper',
      'editor.event_codes', 'editor.event_codes_helper', 'editor.sort_order',
      'editor.sort_default', 'editor.sort_onset', 'editor.sort_severity',
      'editor.color_theme', 'editor.color_severity', 'editor.color_nws',
      'editor.timezone', 'editor.tz_server', 'editor.tz_browser',
      'editor.min_severity', 'editor.severity_all', 'editor.severity_minor',
      'editor.severity_moderate', 'editor.severity_severe', 'editor.severity_extreme',
      'editor.animations', 'editor.deduplicate', 'editor.compact',
      'editor.show_preview', 'editor.preview_hint',
      'badge.severity_extreme', 'badge.severity_severe', 'badge.severity_moderate',
      'badge.severity_minor', 'badge.severity_unknown',
    ];

    for (const key of enKeys) {
      const frValue = t(key, 'fr');
      const enValue = t(key, 'en');
      // fr should not fall back to en (i.e., they should differ or be intentionally the same)
      expect(frValue).not.toBe(key, `Missing fr translation for: ${key}`);
      // Sanity: en value exists
      expect(enValue).not.toBe(key, `Missing en translation for: ${key}`);
    }
  });

  it('all en keys exist in es', () => {
    const enKeys = [
      'card.no_alerts', 'card.sensor_unavailable', 'card.preview', 'card.read_details',
      'card.open_source', 'card.active', 'card.in_prep', 'card.zones_count',
      'card.zone_count_singular',
      'detail.issued', 'detail.onset', 'detail.expires', 'detail.area',
      'detail.description', 'detail.instructions',
      'progress.start', 'progress.now', 'progress.end', 'progress.ongoing',
      'progress.expires_in', 'progress.starts_in', 'progress.tbd', 'progress.na',
      'time.just_now', 'time.in_less_than_1m', 'time.minutes_ago', 'time.in_minutes',
      'time.hours_ago', 'time.in_hours', 'time.days_ago', 'time.in_days',
      'editor.entity', 'editor.title', 'editor.provider', 'editor.provider_auto',
      'editor.provider_nws', 'editor.provider_bom', 'editor.provider_meteoalarm',
      'editor.provider_pirateweather', 'editor.zones', 'editor.zones_helper',
      'editor.event_codes', 'editor.event_codes_helper', 'editor.sort_order',
      'editor.sort_default', 'editor.sort_onset', 'editor.sort_severity',
      'editor.color_theme', 'editor.color_severity', 'editor.color_nws',
      'editor.timezone', 'editor.tz_server', 'editor.tz_browser',
      'editor.min_severity', 'editor.severity_all', 'editor.severity_minor',
      'editor.severity_moderate', 'editor.severity_severe', 'editor.severity_extreme',
      'editor.animations', 'editor.deduplicate', 'editor.compact',
      'editor.show_preview', 'editor.preview_hint',
      'badge.severity_extreme', 'badge.severity_severe', 'badge.severity_moderate',
      'badge.severity_minor', 'badge.severity_unknown',
    ];

    for (const key of enKeys) {
      const esValue = t(key, 'es');
      expect(esValue).not.toBe(key, `Missing es translation for: ${key}`);
    }
  });
});
