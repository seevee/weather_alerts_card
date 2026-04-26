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
    expect(t('card.no_alerts', 'ja')).toBe('No active alerts.');
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

  it('returns badge certainty labels in English', () => {
    expect(t('badge.certainty_observed', 'en')).toBe('Observed');
    expect(t('badge.certainty_likely', 'en')).toBe('Likely');
    expect(t('badge.certainty_possible', 'en')).toBe('Possible');
    expect(t('badge.certainty_unlikely', 'en')).toBe('Unlikely');
    expect(t('badge.certainty_unknown', 'en')).toBe('Unknown');
  });

  it('returns badge severity labels in French', () => {
    expect(t('badge.severity_extreme', 'fr')).toBe('Extrême');
    expect(t('badge.severity_severe', 'fr')).toBe('Grave');
    expect(t('badge.severity_moderate', 'fr')).toBe('Modérée');
    expect(t('badge.severity_minor', 'fr')).toBe('Mineure');
    expect(t('badge.severity_unknown', 'fr')).toBe('Inconnue');
  });

  it('returns badge certainty labels in French', () => {
    expect(t('badge.certainty_observed', 'fr')).toBe('Observée');
    expect(t('badge.certainty_likely', 'fr')).toBe('Probable');
    expect(t('badge.certainty_possible', 'fr')).toBe('Possible');
    expect(t('badge.certainty_unlikely', 'fr')).toBe('Improbable');
    expect(t('badge.certainty_unknown', 'fr')).toBe('Inconnue');
  });

  it('returns badge severity labels in Spanish', () => {
    expect(t('badge.severity_extreme', 'es')).toBe('Extrema');
    expect(t('badge.severity_severe', 'es')).toBe('Grave');
    expect(t('badge.severity_moderate', 'es')).toBe('Moderada');
    expect(t('badge.severity_minor', 'es')).toBe('Menor');
    expect(t('badge.severity_unknown', 'es')).toBe('Desconocida');
  });

  it('returns badge certainty labels in Spanish', () => {
    expect(t('badge.certainty_observed', 'es')).toBe('Observada');
    expect(t('badge.certainty_likely', 'es')).toBe('Probable');
    expect(t('badge.certainty_possible', 'es')).toBe('Posible');
    expect(t('badge.certainty_unlikely', 'es')).toBe('Improbable');
    expect(t('badge.certainty_unknown', 'es')).toBe('Desconocida');
  });

  it('returns Italian string for known key', () => {
    expect(t('card.no_alerts', 'it')).toBe('Nessuna allerta attiva.');
  });

  it('strips region subtag (it-IT -> it)', () => {
    expect(t('card.no_alerts', 'it-IT')).toBe('Nessuna allerta attiva.');
  });

  it('returns badge severity labels in Italian', () => {
    expect(t('badge.severity_extreme', 'it')).toBe('Estrema');
    expect(t('badge.severity_severe', 'it')).toBe('Grave');
    expect(t('badge.severity_moderate', 'it')).toBe('Moderata');
    expect(t('badge.severity_minor', 'it')).toBe('Lieve');
    expect(t('badge.severity_unknown', 'it')).toBe('Sconosciuta');
  });

  it('returns badge certainty labels in Italian', () => {
    expect(t('badge.certainty_observed', 'it')).toBe('Osservata');
    expect(t('badge.certainty_likely', 'it')).toBe('Probabile');
    expect(t('badge.certainty_possible', 'it')).toBe('Possibile');
    expect(t('badge.certainty_unlikely', 'it')).toBe('Improbabile');
    expect(t('badge.certainty_unknown', 'it')).toBe('Sconosciuta');
  });

  it('returns German string for known key', () => {
    expect(t('card.no_alerts', 'de')).toBe('Keine aktiven Warnungen.');
  });

  it('strips region subtag (de-DE -> de)', () => {
    expect(t('card.no_alerts', 'de-DE')).toBe('Keine aktiven Warnungen.');
  });

  it('returns badge severity labels in German', () => {
    expect(t('badge.severity_extreme', 'de')).toBe('Extrem');
    expect(t('badge.severity_severe', 'de')).toBe('Schwer');
    expect(t('badge.severity_moderate', 'de')).toBe('Mäßig');
    expect(t('badge.severity_minor', 'de')).toBe('Gering');
    expect(t('badge.severity_unknown', 'de')).toBe('Unbekannt');
  });

  it('returns badge certainty labels in German', () => {
    expect(t('badge.certainty_observed', 'de')).toBe('Beobachtet');
    expect(t('badge.certainty_likely', 'de')).toBe('Wahrscheinlich');
    expect(t('badge.certainty_possible', 'de')).toBe('Möglich');
    expect(t('badge.certainty_unlikely', 'de')).toBe('Unwahrscheinlich');
    expect(t('badge.certainty_unknown', 'de')).toBe('Unbekannt');
  });

  it('all en keys exist in fr', () => {
    // Access translations indirectly through t()
    const enKeys = [
      'card.no_alerts', 'card.sensor_unavailable', 'card.preview', 'card.read_details',
      'card.open_source', 'card.zones_count',
      'card.zone_count_singular',
      'detail.issued', 'detail.onset', 'detail.expires', 'detail.area',
      'detail.description', 'detail.instructions',
      'progress.start', 'progress.now', 'progress.end', 'progress.ongoing',
      'progress.tbd', 'progress.na',
      'time.just_now', 'time.in_less_than_1m', 'time.minutes_ago', 'time.in_minutes',
      'time.hours_ago', 'time.in_hours', 'time.days_ago', 'time.in_days',
      'editor.entities', 'editor.title', 'editor.provider', 'editor.provider_auto',
      'editor.provider_nws', 'editor.provider_bom', 'editor.provider_meteoalarm',
      'editor.provider_pirateweather', 'editor.provider_cap',
      'editor.device', 'editor.device_helper',
      'editor.zones', 'editor.zones_helper',
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
      'badge.certainty_observed', 'badge.certainty_likely', 'badge.certainty_possible',
      'badge.certainty_unlikely', 'badge.certainty_unknown',
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
      'card.open_source', 'card.zones_count',
      'card.zone_count_singular',
      'detail.issued', 'detail.onset', 'detail.expires', 'detail.area',
      'detail.description', 'detail.instructions',
      'progress.start', 'progress.now', 'progress.end', 'progress.ongoing',
      'progress.tbd', 'progress.na',
      'time.just_now', 'time.in_less_than_1m', 'time.minutes_ago', 'time.in_minutes',
      'time.hours_ago', 'time.in_hours', 'time.days_ago', 'time.in_days',
      'editor.entities', 'editor.title', 'editor.provider', 'editor.provider_auto',
      'editor.provider_nws', 'editor.provider_bom', 'editor.provider_meteoalarm',
      'editor.provider_pirateweather', 'editor.provider_cap',
      'editor.device', 'editor.device_helper',
      'editor.zones', 'editor.zones_helper',
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
      'badge.certainty_observed', 'badge.certainty_likely', 'badge.certainty_possible',
      'badge.certainty_unlikely', 'badge.certainty_unknown',
    ];

    for (const key of enKeys) {
      const esValue = t(key, 'es');
      expect(esValue).not.toBe(key, `Missing es translation for: ${key}`);
    }
  });

  it('all en keys exist in it', () => {
    const enKeys = [
      'card.no_alerts', 'card.sensor_unavailable', 'card.preview', 'card.read_details',
      'card.open_source', 'card.zones_count',
      'card.zone_count_singular',
      'detail.issued', 'detail.onset', 'detail.expires', 'detail.area',
      'detail.description', 'detail.instructions',
      'progress.start', 'progress.now', 'progress.end', 'progress.ongoing',
      'progress.tbd', 'progress.na',
      'time.just_now', 'time.in_less_than_1m', 'time.minutes_ago', 'time.in_minutes',
      'time.hours_ago', 'time.in_hours', 'time.days_ago', 'time.in_days',
      'editor.entities', 'editor.title', 'editor.provider', 'editor.provider_auto',
      'editor.provider_nws', 'editor.provider_bom', 'editor.provider_meteoalarm',
      'editor.provider_pirateweather', 'editor.provider_cap',
      'editor.device', 'editor.device_helper',
      'editor.zones', 'editor.zones_helper',
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
      'badge.certainty_observed', 'badge.certainty_likely', 'badge.certainty_possible',
      'badge.certainty_unlikely', 'badge.certainty_unknown',
    ];

    for (const key of enKeys) {
      const itValue = t(key, 'it');
      expect(itValue).not.toBe(key, `Missing it translation for: ${key}`);
    }
  });

  it('all en keys exist in de', () => {
    const enKeys = [
      'card.no_alerts', 'card.sensor_unavailable', 'card.preview', 'card.read_details',
      'card.open_source', 'card.zones_count',
      'card.zone_count_singular',
      'detail.issued', 'detail.onset', 'detail.expires', 'detail.area',
      'detail.description', 'detail.instructions',
      'progress.start', 'progress.now', 'progress.end', 'progress.ongoing',
      'progress.tbd', 'progress.na',
      'time.just_now', 'time.in_less_than_1m', 'time.minutes_ago', 'time.in_minutes',
      'time.hours_ago', 'time.in_hours', 'time.days_ago', 'time.in_days',
      'editor.entities', 'editor.title', 'editor.provider', 'editor.provider_auto',
      'editor.provider_nws', 'editor.provider_bom', 'editor.provider_meteoalarm',
      'editor.provider_pirateweather', 'editor.provider_cap',
      'editor.device', 'editor.device_helper',
      'editor.zones', 'editor.zones_helper',
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
      'badge.certainty_observed', 'badge.certainty_likely', 'badge.certainty_possible',
      'badge.certainty_unlikely', 'badge.certainty_unknown',
    ];

    for (const key of enKeys) {
      const deValue = t(key, 'de');
      expect(deValue).not.toBe(key, `Missing de translation for: ${key}`);
    }
  });
});
