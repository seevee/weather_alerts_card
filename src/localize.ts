type TranslationMap = Record<string, string>;

const en: TranslationMap = {
  // Card UI
  'card.no_alerts': 'No active alerts.',
  'card.sensor_unavailable': 'Alert sensor is {state}.',
  'card.preview': 'Preview',
  'card.read_details': 'Read Details',
  'card.open_source': 'Open {provider} Source',
  'card.active': 'Active',
  'card.in_prep': 'In Prep',
  'card.zones_count': '{count} zones',
  'card.zone_count_singular': '{count} zone',

  // Detail labels
  'detail.issued': 'Issued',
  'detail.onset': 'Onset',
  'detail.expires': 'Expires',
  'detail.area': 'Area',
  'detail.description': 'Description',
  'detail.instructions': 'Instructions',

  // Progress bar
  'progress.start': 'Start',
  'progress.now': 'Now',
  'progress.end': 'End',
  'progress.ongoing': 'Ongoing',
  'progress.expires_in': 'expires {time}',
  'progress.starts_in': 'starts {time}',
  'progress.expires_in_label': 'Expires in',
  'progress.starts_in_label': 'Starts in',
  'progress.tbd': 'TBD',
  'progress.na': 'N/A',

  // Relative time
  'time.just_now': 'just now',
  'time.in_less_than_1m': 'in <1m',
  'time.minutes_ago': '{m}m ago',
  'time.in_minutes': 'in {m}m',
  'time.hours_ago': '{dur} ago',
  'time.in_hours': 'in {dur}',
  'time.days_ago': '{d}d ago',
  'time.in_days': 'in {d}d',

  // Editor
  'editor.entity': 'Entity (required)',
  'editor.title': 'Title (optional)',
  'editor.provider': 'Alert provider',
  'editor.provider_auto': 'Auto-detect',
  'editor.provider_nws': 'NWS (United States)',
  'editor.provider_bom': 'BoM (Australia)',
  'editor.provider_meteoalarm': 'MeteoAlarm (Europe)',
  'editor.provider_pirateweather': 'PirateWeather',
  'editor.zones': 'Zones (optional)',
  'editor.zones_helper': 'Comma-separated zone codes, e.g. COC059, COZ039 (NWS) or NSW_FL049 (BoM)',
  'editor.event_codes': 'Event codes (optional)',
  'editor.event_codes_helper': 'Comma-separated NWS event codes, e.g. TOW, SVW, FFW',
  'editor.exclude_event_codes': 'Exclude event codes (optional)',
  'editor.exclude_event_codes_helper': 'Comma-separated NWS event codes to hide, e.g. SCY, SCW',
  'editor.sort_order': 'Sort order',
  'editor.sort_default': 'Default',
  'editor.sort_onset': 'Onset time',
  'editor.sort_severity': 'Severity',
  'editor.color_theme': 'Color theme',
  'editor.color_severity': 'Severity-based',
  'editor.color_nws': 'NWS Official',
  'editor.color_meteoalarm': 'MeteoAlarm Awareness',
  'editor.timezone': 'Timezone',
  'editor.tz_server': 'Server (Home Assistant)',
  'editor.tz_browser': 'Browser (local device)',
  'editor.min_severity': 'Minimum severity',
  'editor.severity_all': 'All severities',
  'editor.severity_minor': 'Minor or higher',
  'editor.severity_moderate': 'Moderate or higher',
  'editor.severity_severe': 'Severe or higher',
  'editor.severity_extreme': 'Extreme only',
  'editor.animations': 'Enable animations',
  'editor.deduplicate': 'Deduplicate alerts',
  'editor.deduplicate_headlines': 'Deduplicate headlines',
  'editor.show_source_link': 'Show source link',
  'editor.compact': 'Compact layout',
  'editor.show_preview': 'Show sample data',
  'editor.preview_hint': 'Preview card layout with placeholder alerts',
  'editor.entity_warning': 'Selected entity does not appear to contain weather alert data.',
};

const fr: TranslationMap = {
  // Card UI
  'card.no_alerts': 'Aucune alerte active.',
  'card.sensor_unavailable': 'Le capteur d\'alerte est {state}.',
  'card.preview': 'Apercu',
  'card.read_details': 'Lire les details',
  'card.open_source': 'Ouvrir la source {provider}',
  'card.active': 'Actif',
  'card.in_prep': 'En prep.',
  'card.zones_count': '{count} zones',
  'card.zone_count_singular': '{count} zone',

  // Detail labels
  'detail.issued': 'Emis',
  'detail.onset': 'Debut',
  'detail.expires': 'Expire',
  'detail.area': 'Zone',
  'detail.description': 'Description',
  'detail.instructions': 'Instructions',

  // Progress bar
  'progress.start': 'Debut',
  'progress.now': 'Maint.',
  'progress.end': 'Fin',
  'progress.ongoing': 'En cours',
  'progress.expires_in': 'expire {time}',
  'progress.starts_in': 'commence {time}',
  'progress.expires_in_label': 'Expire dans',
  'progress.starts_in_label': 'Commence dans',
  'progress.tbd': 'Ind.',
  'progress.na': 'N/D',

  // Relative time
  'time.just_now': 'a l\'instant',
  'time.in_less_than_1m': 'dans <1m',
  'time.minutes_ago': 'il y a {m}m',
  'time.in_minutes': 'dans {m}m',
  'time.hours_ago': 'il y a {dur}',
  'time.in_hours': 'dans {dur}',
  'time.days_ago': 'il y a {d}j',
  'time.in_days': 'dans {d}j',

  // Editor
  'editor.entity': 'Entite (requis)',
  'editor.title': 'Titre (optionnel)',
  'editor.provider': 'Fournisseur d\'alertes',
  'editor.provider_auto': 'Detection auto',
  'editor.provider_nws': 'NWS (Etats-Unis)',
  'editor.provider_bom': 'BoM (Australie)',
  'editor.provider_meteoalarm': 'MeteoAlarm (Europe)',
  'editor.provider_pirateweather': 'PirateWeather',
  'editor.zones': 'Zones (optionnel)',
  'editor.zones_helper': 'Codes de zone separes par des virgules, ex. COC059, COZ039 (NWS) ou NSW_FL049 (BoM)',
  'editor.event_codes': 'Codes d\'evenement (optionnel)',
  'editor.event_codes_helper': 'Codes d\'evenement NWS separes par des virgules, ex. TOW, SVW, FFW',
  'editor.exclude_event_codes': 'Exclure codes d\'evenement (optionnel)',
  'editor.exclude_event_codes_helper': 'Codes d\'evenement NWS a masquer, ex. SCY, SCW',
  'editor.sort_order': 'Ordre de tri',
  'editor.sort_default': 'Par defaut',
  'editor.sort_onset': 'Heure de debut',
  'editor.sort_severity': 'Gravite',
  'editor.color_theme': 'Theme de couleur',
  'editor.color_severity': 'Base sur la gravite',
  'editor.color_nws': 'NWS officiel',
  'editor.color_meteoalarm': 'MeteoAlarm Vigilance',
  'editor.timezone': 'Fuseau horaire',
  'editor.tz_server': 'Serveur (Home Assistant)',
  'editor.tz_browser': 'Navigateur (appareil local)',
  'editor.min_severity': 'Gravite minimale',
  'editor.severity_all': 'Toutes les gravites',
  'editor.severity_minor': 'Mineure ou plus',
  'editor.severity_moderate': 'Moderee ou plus',
  'editor.severity_severe': 'Grave ou plus',
  'editor.severity_extreme': 'Extreme uniquement',
  'editor.animations': 'Activer les animations',
  'editor.deduplicate': 'Dedupliquer les alertes',
  'editor.deduplicate_headlines': 'Dédupliquer les titres',
  'editor.show_source_link': 'Afficher le lien source',
  'editor.compact': 'Disposition compacte',
  'editor.show_preview': 'Afficher les donnees exemples',
  'editor.preview_hint': 'Apercu de la disposition avec des alertes fictives',
  'editor.entity_warning': 'L\'entite selectionnee ne semble pas contenir de donnees d\'alerte meteo.',
};

const es: TranslationMap = {
  // Card UI
  'card.no_alerts': 'Sin alertas activas.',
  'card.sensor_unavailable': 'El sensor de alertas esta {state}.',
  'card.preview': 'Vista previa',
  'card.read_details': 'Leer detalles',
  'card.open_source': 'Abrir fuente {provider}',
  'card.active': 'Activo',
  'card.in_prep': 'En prep.',
  'card.zones_count': '{count} zonas',
  'card.zone_count_singular': '{count} zona',

  // Detail labels
  'detail.issued': 'Emitido',
  'detail.onset': 'Inicio',
  'detail.expires': 'Expira',
  'detail.area': 'Area',
  'detail.description': 'Descripcion',
  'detail.instructions': 'Instrucciones',

  // Progress bar
  'progress.start': 'Inicio',
  'progress.now': 'Ahora',
  'progress.end': 'Fin',
  'progress.ongoing': 'En curso',
  'progress.expires_in': 'expira {time}',
  'progress.starts_in': 'comienza {time}',
  'progress.expires_in_label': 'Expira en',
  'progress.starts_in_label': 'Comienza en',
  'progress.tbd': 'Pend.',
  'progress.na': 'N/D',

  // Relative time
  'time.just_now': 'ahora mismo',
  'time.in_less_than_1m': 'en <1m',
  'time.minutes_ago': 'hace {m}m',
  'time.in_minutes': 'en {m}m',
  'time.hours_ago': 'hace {dur}',
  'time.in_hours': 'en {dur}',
  'time.days_ago': 'hace {d}d',
  'time.in_days': 'en {d}d',

  // Editor
  'editor.entity': 'Entidad (requerido)',
  'editor.title': 'Titulo (opcional)',
  'editor.provider': 'Proveedor de alertas',
  'editor.provider_auto': 'Deteccion auto',
  'editor.provider_nws': 'NWS (Estados Unidos)',
  'editor.provider_bom': 'BoM (Australia)',
  'editor.provider_meteoalarm': 'MeteoAlarm (Europa)',
  'editor.provider_pirateweather': 'PirateWeather',
  'editor.zones': 'Zonas (opcional)',
  'editor.zones_helper': 'Codigos de zona separados por comas, ej. COC059, COZ039 (NWS) o NSW_FL049 (BoM)',
  'editor.event_codes': 'Codigos de evento (opcional)',
  'editor.event_codes_helper': 'Codigos de evento NWS separados por comas, ej. TOW, SVW, FFW',
  'editor.exclude_event_codes': 'Excluir codigos de evento (opcional)',
  'editor.exclude_event_codes_helper': 'Codigos de evento NWS a ocultar, ej. SCY, SCW',
  'editor.sort_order': 'Orden',
  'editor.sort_default': 'Predeterminado',
  'editor.sort_onset': 'Hora de inicio',
  'editor.sort_severity': 'Gravedad',
  'editor.color_theme': 'Tema de color',
  'editor.color_severity': 'Basado en gravedad',
  'editor.color_nws': 'NWS oficial',
  'editor.color_meteoalarm': 'MeteoAlarm Conciencia',
  'editor.timezone': 'Zona horaria',
  'editor.tz_server': 'Servidor (Home Assistant)',
  'editor.tz_browser': 'Navegador (dispositivo local)',
  'editor.min_severity': 'Gravedad minima',
  'editor.severity_all': 'Todas las gravedades',
  'editor.severity_minor': 'Menor o superior',
  'editor.severity_moderate': 'Moderada o superior',
  'editor.severity_severe': 'Grave o superior',
  'editor.severity_extreme': 'Solo extrema',
  'editor.animations': 'Activar animaciones',
  'editor.deduplicate': 'Deduplicar alertas',
  'editor.deduplicate_headlines': 'Deduplicar titulares',
  'editor.show_source_link': 'Mostrar enlace de fuente',
  'editor.compact': 'Disposicion compacta',
  'editor.show_preview': 'Mostrar datos de ejemplo',
  'editor.preview_hint': 'Vista previa con alertas de ejemplo',
  'editor.entity_warning': 'La entidad seleccionada no parece contener datos de alerta meteorologica.',
};

const translations: Record<string, TranslationMap> = { en, fr, es };

export function t(key: string, lang: string, params?: Record<string, string | number>): string {
  const baseLang = lang.split('-')[0].toLowerCase();
  const map = translations[baseLang] || translations.en;
  let value = map[key] ?? translations.en[key] ?? key;

  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v));
    }
  }

  return value;
}
