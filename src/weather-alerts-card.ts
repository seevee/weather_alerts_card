import { LitElement, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { HomeAssistant, WeatherAlertsCardConfig, WeatherAlert, AlertProgress, AlertProvider, ContrastMode, DismissalRecord } from './types';
import {
  loadDismissals,
  saveDismissals,
  dismissAlert,
  undoDismiss,
  applyDismissals,
  computeScopeHash,
  subscribeToDismissalChanges,
} from './dismissal';
import {
  getWeatherIcon,
  getCertaintyIcon,
  computeAlertProgress,
  formatProgressTimestamp,
  formatLocalTimestamp,
  formatRelativeTime,
  formatDuration,
  sortAlerts,
  alertMatchesZones,
  deduplicateAlerts,
  getNwsEventColor,
  getMeteoAlarmColor,
  resolveContrastMode,
  sanitizeAlertHtml,
  getDisplayHeadline,
  reflowAlertText,
} from './utils';
import { getAdapter, ENTITY_NAME_PATTERNS } from './adapters';
import { t } from './localize';
import { cardStyles } from './styles';
import './weather-alerts-card-editor';

/* eslint-disable no-console */
declare const __CARD_VERSION__: string;
const CARD_VERSION = __CARD_VERSION__;
console.info(
  `%c  WEATHER-ALERTS-CARD  %c  Version ${CARD_VERSION}  `,
  'color: white; background: #555; font-weight: bold;',
  'color: white; background: #007acc; font-weight: bold;',
);
/* eslint-enable no-console */

const PROVIDER_LABELS: Record<string, string> = {
  nws: 'NWS',
  bom: 'BoM',
  meteoalarm: 'MeteoAlarm',
  dwd: 'DWD',
  pirateweather: 'Pirate Weather',
};

const PROVIDER_SHORT: Record<string, string> = {
  nws: 'NWS',
  bom: 'BoM',
  meteoalarm: 'MA',
  dwd: 'DWD',
  pirateweather: 'PW',
};

// Entity name patterns are now in adapters/index.ts (ENTITY_NAME_PATTERNS)

function getPreviewAlerts(): WeatherAlert[] {
  const now = Date.now() / 1000;
  const HOUR = 3600;
  // Order, severity, and onset are chosen so that each sortOrder
  // option produces a visibly different arrangement:
  //   default:  Wind Watch → Heat Advisory → Frost Advisory  (array order)
  //   severity: Heat Advisory → Wind Watch → Frost Advisory   (moderate first)
  //   onset:    Frost Advisory → Heat Advisory → Wind Watch    (earliest onset first)
  return [
    {
      id: 'preview-1',
      event: 'Gentle Wind Watch',
      severity: 'minor',
      severityLabel: 'Minor',
      certainty: 'Possible',
      urgency: 'Future',
      sentTs: now - 1 * HOUR,
      onsetTs: now + 1 * HOUR,
      endsTs: now + 6 * HOUR,
      description: 'A gentle breeze may arrive later. This is sample data showing an upcoming alert.',
      instruction: '',
      url: '',
      headline: 'Gentle Wind Watch for Sampletown County',
      areaDesc: 'Sampletown County',
      zones: ['SAMPLE02'],
      eventCode: 'WIA',
      provider: 'nws' as AlertProvider,
      phase: '',
      severityInferred: true,
      certaintyInferred: false,
    },
    {
      id: 'preview-2',
      event: 'Sunshine Heat Advisory',
      severity: 'moderate',
      severityLabel: 'Moderate',
      certainty: 'Likely',
      urgency: 'Expected',
      sentTs: now - 2 * HOUR,
      onsetTs: now - 1 * HOUR,
      endsTs: now + 2 * HOUR,
      description: 'This is a sample alert demonstrating the card layout. No action required.',
      instruction: 'Enjoy the weather! This is placeholder data for the card preview.',
      url: '',
      headline: 'Sunshine Heat Advisory for Pleasantville',
      areaDesc: 'Pleasantville, USA',
      zones: ['SAMPLE01'],
      eventCode: 'HTA',
      provider: 'nws' as AlertProvider,
      phase: 'Update',
      severityInferred: false,
      certaintyInferred: false,
    },
    {
      id: 'preview-3',
      event: 'Frost Advisory',
      severity: 'minor',
      severityLabel: 'Minor',
      certainty: 'Likely',
      urgency: 'Expected',
      sentTs: now - 8 * HOUR,
      onsetTs: now - 6 * HOUR,
      endsTs: now - 2 * HOUR,
      description: 'A light frost occurred overnight. This is sample data showing an expired alert.',
      instruction: '',
      url: '',
      headline: 'Frost Advisory expired for Pleasantville',
      areaDesc: 'Pleasantville, USA',
      zones: ['SAMPLE01'],
      eventCode: 'FRA',
      provider: 'nws' as AlertProvider,
      phase: '',
      severityInferred: false,
      certaintyInferred: true,
    },
  ];
}

@customElement('weather-alerts-card')
export class WeatherAlertsCard extends LitElement {
  static styles = cardStyles;

  /** Editor-preview expanded state, keyed by entity ID. Survives element destruction/recreation. */
  private static _editorExpandedState: Map<string, Map<string, boolean>> = new Map();

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: WeatherAlertsCardConfig;
  @state() private _expandedAlerts: Map<string, boolean> = new Map();
  @state() private _forcePreview = false;
  @state() private _dismissals: Map<string, DismissalRecord> = new Map();
  private _dismissalsScope = '';
  private _unsubscribeDismissals?: () => void;

  private _motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private _onMotionChange = () => this.requestUpdate();

  connectedCallback() {
    super.connectedCallback();
    this._motionQuery.addEventListener('change', this._onMotionChange);
    // Re-prune stale records (30d TTL) on every mount.
    if (this._config) {
      this._dismissalsScope = '';
      this._reloadDismissalsIfScopeChanged();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._motionQuery.removeEventListener('change', this._onMotionChange);
    this._unsubscribeDismissals?.();
    this._unsubscribeDismissals = undefined;
    if (this._config?.entity) {
      WeatherAlertsCard._editorExpandedState.set(this._entityStateKey(), this._expandedAlerts);
    }
  }

  public setConfig(config: WeatherAlertsCardConfig): void {
    if (!config.entity && !(config.entities && config.entities.length > 0)) {
      throw new Error('You need to define an entity');
    }
    const { _preview, ...rest } = config;
    // If entity is missing but entities is set, default entity to entities[0]
    if (!rest.entity && rest.entities && rest.entities.length > 0) {
      rest.entity = rest.entities[0];
    }
    this._config = rest as WeatherAlertsCardConfig;
    this._forcePreview = !!_preview;
    const stateKey = this._entityStateKey();
    const saved = WeatherAlertsCard._editorExpandedState.get(stateKey);
    if (saved) {
      this._expandedAlerts = saved;
    }
    this._reloadDismissalsIfScopeChanged();
  }

  private get _scopeHash(): string {
    const entities = this._getAllEntities();
    if (entities.length === 0) return '';
    const [primary, ...extras] = entities;
    return computeScopeHash(primary, extras);
  }

  private _reloadDismissalsIfScopeChanged(): void {
    const scope = this._scopeHash;
    if (scope === this._dismissalsScope) return;
    this._dismissalsScope = scope;
    this._dismissals = scope ? loadDismissals(scope) : new Map();
    this._resubscribeDismissals();
  }

  private _resubscribeDismissals(): void {
    this._unsubscribeDismissals?.();
    this._unsubscribeDismissals = undefined;
    if (!this.isConnected || !this._dismissalsScope) return;
    this._unsubscribeDismissals = subscribeToDismissalChanges(
      this._dismissalsScope,
      () => {
        // Any card instance (or the editor) may have written — pick up the
        // canonical state from storage rather than trusting in-memory.
        this._dismissals = loadDismissals(this._dismissalsScope);
      },
    );
  }

  public getCardSize(): number {
    const alerts = this._getAlerts();
    const perAlert = this._isCompact ? 1 : 3;
    return Math.max(1, alerts.length * perAlert);
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement('weather-alerts-card-editor');
  }

  public static getStubConfig(hass?: HomeAssistant): Record<string, unknown> {
    if (hass) {
      // Find all matching alert entities, prefer one with active alerts
      const matches = Object.keys(hass.states).filter(id =>
        ENTITY_NAME_PATTERNS.some(pattern => pattern.test(id)),
      );
      const withAlerts = matches.find(id => {
        const s = hass.states[id];
        // sensor: state is alert count; binary_sensor: 'on' means active
        return (s.state !== '0' && s.state !== 'off' && s.state !== 'unknown' && s.state !== 'unavailable');
      });
      if (withAlerts) return { entity: withAlerts };
      // No entity has active alerts → fall through to hardcoded default
      // so the placeholder preview shows instead of "No active alerts"
    }
    return { entity: 'sensor.nws_alerts_alerts' };
  }

  private _getAllEntities(): string[] {
    if (!this._config) return [];
    const primary = this._config.entity;
    const extras = this._config.entities || [];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const id of [primary, ...extras]) {
      if (id && !seen.has(id)) {
        seen.add(id);
        result.push(id);
      }
    }
    return result;
  }

  private _entityStateKey(): string {
    return this._getAllEntities().sort().join(',');
  }

  private _multiProvider = false;

  private _getAlerts(): WeatherAlert[] {
    if (!this.hass || !this._config) return [];
    const allAlerts: WeatherAlert[] = [];
    const providerPriority: AlertProvider[] = [];
    const seenProviders = new Set<AlertProvider>();
    for (const entityId of this._getAllEntities()) {
      const entity = this.hass.states[entityId];
      if (!entity) continue;
      const adapter = getAdapter(this._config.provider, entity.attributes);
      if (!seenProviders.has(adapter.provider)) {
        seenProviders.add(adapter.provider);
        providerPriority.push(adapter.provider);
      }
      allAlerts.push(...adapter.parseAlerts(entity.attributes));
    }
    this._multiProvider = providerPriority.length > 1;
    let filtered = this._filterAndSort(allAlerts, { providerPriority });
    if (this._config.allowDismiss && !this._forcePreview && this._dismissals.size > 0) {
      const { visible, updatedMap } = applyDismissals(filtered, this._dismissals);
      if (updatedMap !== this._dismissals) {
        this._dismissals = updatedMap;
        if (this._dismissalsScope) saveDismissals(this._dismissalsScope, updatedMap);
      }
      filtered = visible;
    }
    return filtered;
  }

  private _onDismiss(alert: WeatherAlert): void {
    if (!this._dismissalsScope) return;
    const next = dismissAlert(this._dismissals, alert);
    this._dismissals = next;
    saveDismissals(this._dismissalsScope, next);
    if (this._config?.showDismissUndo !== false) {
      this._fireUndoToast(alert);
    }
  }

  private _onUndo(id: string): void {
    if (!this._dismissalsScope) return;
    const next = undoDismiss(this._dismissals, id);
    if (next === this._dismissals) return;
    this._dismissals = next;
    saveDismissals(this._dismissalsScope, next);
  }

  private _fireUndoToast(alert: WeatherAlert): void {
    const lang = this._lang;
    this.dispatchEvent(new CustomEvent('hass-notification', {
      detail: {
        message: t('card.dismissed_toast', lang, { event: alert.event }),
        duration: 4000,
        action: {
          text: t('card.dismissed_toast_undo', lang),
          action: () => this._onUndo(alert.id),
        },
      },
      bubbles: true,
      composed: true,
    }));
  }

  private _canDismiss(): boolean {
    return !!this._config?.allowDismiss && !this._forcePreview;
  }

  private _renderDismissButton(alert: WeatherAlert): TemplateResult | typeof nothing {
    if (!this._canDismiss()) return nothing;
    return html`
      <button
        type="button"
        class="dismiss-button"
        aria-label=${t('card.dismiss', this._lang)}
        title=${t('card.dismiss', this._lang)}
        @click=${(e: Event) => { e.stopPropagation(); this._onDismiss(alert); }}
      >
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
    `;
  }

  private _filterAndSort(alerts: WeatherAlert[], opts?: { skipZones?: boolean; providerPriority?: AlertProvider[] }): WeatherAlert[] {
    if (!this._config) return alerts;
    let result = alerts;

    if (this._config.deduplicate !== false) {
      result = deduplicateAlerts(result, opts?.providerPriority);
    }

    if (!opts?.skipZones && this._config.zones && this._config.zones.length > 0) {
      const zoneSet = new Set(this._config.zones.map(z => z.toUpperCase()));
      result = result.filter(a => alertMatchesZones(a, zoneSet));
    }

    if (this._config.eventCodes && this._config.eventCodes.length > 0) {
      const codeSet = new Set(this._config.eventCodes.map(c => c.toUpperCase()));
      result = result.filter(a => a.eventCode && codeSet.has(a.eventCode.toUpperCase()));
    }

    if (this._config.excludeEventCodes && this._config.excludeEventCodes.length > 0) {
      const excludeSet = new Set(this._config.excludeEventCodes.map(c => c.toUpperCase()));
      result = result.filter(a => !a.eventCode || !excludeSet.has(a.eventCode.toUpperCase()));
    }

    if (this._config.minSeverity) {
      const severityRank = {
        extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4,
      };
      const threshold = severityRank[this._config.minSeverity] ?? 4;
      result = result.filter(a => (severityRank[a.severity] ?? 4) <= threshold);
    }

    if (this._config.hideExpired !== false) {
      const nowTs = Date.now() / 1000;
      result = result.filter(a => a.endsTs === 0 || a.endsTs > nowTs);
    }

    return sortAlerts(result, this._config.sortOrder || 'default');
  }

  private get _locale() {
    if (!this.hass) {
      return { language: navigator.language || 'en', time_format: 'language' as const, date_format: 'language' as const, timeZone: undefined };
    }
    const timeZone = this._config?.timezone === 'browser'
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : this.hass.config?.time_zone;
    return { ...this.hass.locale, timeZone };
  }

  private get _lang(): string {
    return this.hass?.locale?.language || 'en';
  }

  private get _animationsEnabled(): boolean {
    if (this._config?.animations === true) return true;
    if (this._config?.animations === false) return false;
    return !this._motionQuery.matches; // undefined → respect OS prefers-reduced-motion
  }
  private get _isCompact(): boolean { return this._config?.layout === 'compact'; }
  private get _colorTheme(): 'severity' | 'nws' | 'meteoalarm' { return this._config?.colorTheme || 'severity'; }
  private get _fontScale(): number | undefined {
    switch (this._config?.fontSize) {
      case 'small': return 0.85;
      case 'large': return 1.2;
      case 'x-large': return 1.4;
      default: return undefined;
    }
  }
  private get _scaleStyle(): string {
    const scale = this._fontScale;
    return scale !== undefined ? `--wac-scale: ${scale}` : '';
  }

  private _scaledPx(base: number): number {
    const scale = this._fontScale;
    return scale !== undefined ? Math.round(base * scale) : base;
  }

  private get _contrastMode(): ContrastMode {
    return resolveContrastMode(this._config?.enhanceContrast);
  }

  private _alertColorStyle(alert: WeatherAlert): string {
    if (this._colorTheme === 'nws') {
      const { color, rgb, textColorLight, textColorDark } = getNwsEventColor(alert.event, this._contrastMode);
      return `--color: ${color}; --color-rgb: ${rgb}; --color-on-light: ${textColorLight}; --color-on-dark: ${textColorDark};`;
    }
    if (this._colorTheme === 'meteoalarm') {
      const { color, rgb, textColorLight, textColorDark } = getMeteoAlarmColor(alert.severity, this._contrastMode);
      return `--color: ${color}; --color-rgb: ${rgb}; --color-on-light: ${textColorLight}; --color-on-dark: ${textColorDark};`;
    }
    return '';
  }

  // Per-alert boost classes — only emitted for event-color themes (nws,
  // meteoalarm). Two tiers driven by _contrastMode: boost-{light,dark}
  // darkens icon/label text, progress-boost-{light,dark} darkens the
  // progress-bar fill at a stricter tier. Mode 'off' emits nothing.
  // Severity theme never gets classes: its colors are HA theme tokens
  // that the theme author has already tuned for their palette.
  private _alertBoostClasses(alert: WeatherAlert): string {
    const mode = this._contrastMode;
    if (mode === 'off') return '';
    let tags: {
      boostLight: boolean; boostDark: boolean;
      progressBoostLight: boolean; progressBoostDark: boolean;
    } | null = null;
    if (this._colorTheme === 'nws') {
      tags = getNwsEventColor(alert.event, mode);
    } else if (this._colorTheme === 'meteoalarm') {
      tags = getMeteoAlarmColor(alert.severity, mode);
    }
    if (!tags) return '';
    const classes: string[] = [];
    if (tags.boostLight) classes.push('boost-light');
    if (tags.boostDark) classes.push('boost-dark');
    if (tags.progressBoostLight) classes.push('progress-boost-light');
    if (tags.progressBoostDark) classes.push('progress-boost-dark');
    return classes.join(' ');
  }

  // Resolves to 'light' or 'dark' so CSS boost rules only activate on the
  // matching side. Prefers HA's authoritative darkMode; falls back to
  // prefers-color-scheme when HA hasn't reported one yet (e.g., initial
  // render before hass is attached).
  private get _themeMode(): 'light' | 'dark' {
    const hassDark = this.hass?.themes?.darkMode;
    if (typeof hassDark === 'boolean') return hassDark ? 'dark' : 'light';
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  private _normalizeText(text: string | undefined): string {
    return (text || '').replace(/\n{2,}/g, '\n\n').trim();
  }

  private _toggleDetails(alertId: string): void {
    const next = new Map(this._expandedAlerts);
    next.set(alertId, !next.get(alertId));
    this._expandedAlerts = next;
    if (this._config?.entity) {
      WeatherAlertsCard._editorExpandedState.set(this._entityStateKey(), next);
    }
  }

  private _sourceLinkLabel(alert: WeatherAlert): string {
    const label = PROVIDER_LABELS[alert.provider] || 'Alert';
    return t('card.open_source', this._lang, { provider: label });
  }

  protected render(): TemplateResult {
    if (!this._config) return html``;

    if (!this.hass) {
      return this._renderPreview();
    }

    const allEntityIds = this._getAllEntities();
    const resolvedEntities = allEntityIds.map(id => this.hass.states[id]).filter(Boolean);

    if (resolvedEntities.length === 0 || this._forcePreview) {
      return this._renderPreview();
    }

    // Show unavailable only if all resolved entities are unavailable/unknown
    const allUnavailable = resolvedEntities.every(e => e.state === 'unavailable' || e.state === 'unknown');
    if (allUnavailable) {
      const stateVal = resolvedEntities[0].state;
      return html`
        <ha-card .header=${this._config.title || ''}>
          <div class="sensor-unavailable">
            <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            ${t('card.sensor_unavailable', this._lang, { state: stateVal })}
          </div>
        </ha-card>
      `;
    }

    const alerts = this._getAlerts();

    if (alerts.length === 0 && this._config.hideNoAlerts) {
      this.style.display = 'none';
      return html``;
    }
    this.style.display = '';

    const animClass = this._animationsEnabled ? '' : 'no-animations';
    const layoutClass = this._isCompact ? 'compact' : '';

    return html`
      <ha-card .header=${this._config.title || ''} class="${animClass} ${layoutClass}" data-theme-mode=${this._themeMode} style=${this._scaleStyle}>
        ${alerts.length === 0
        ? this._renderNoAlerts()
        : alerts.map(alert => this._renderAlert(alert))}
      </ha-card>
    `;
  }

  private _renderPreview(): TemplateResult {
    const alerts = this._filterAndSort(getPreviewAlerts(), { skipZones: true });
    const animClass = this._animationsEnabled ? '' : 'no-animations';
    const layoutClass = this._isCompact ? 'compact' : '';

    return html`
      <ha-card .header=${this._config.title || ''} class="${animClass} ${layoutClass}" data-theme-mode=${this._themeMode} style=${this._scaleStyle}>
        <div class="preview-label">${t('card.preview', this._lang)}</div>
        ${alerts.map(alert => this._renderAlert(alert))}
      </ha-card>
    `;
  }

  private _renderNoAlerts(): TemplateResult {
    return html`
      <div class="no-alerts">
        <ha-icon icon="mdi:weather-sunny"></ha-icon><br>
        ${t('card.no_alerts', this._lang)}
      </div>
    `;
  }

  private _renderAlert(alert: WeatherAlert): TemplateResult {
    const className = `severity-${alert.severity}`;
    const progress = computeAlertProgress(alert);
    const phaseClass = progress.phaseText.toLowerCase();
    const expanded = this._expandedAlerts.get(alert.id) || false;

    if (this._isCompact) {
      return this._renderCompactAlert(alert, className, phaseClass, progress, expanded);
    }

    return this._renderFullAlert(alert, className, phaseClass, progress, expanded);
  }

  private _renderCompactAlert(
    alert: WeatherAlert, className: string, phaseClass: string,
    progress: AlertProgress, expanded: boolean,
  ): TemplateResult {
    const lang = this._lang;
    const isOngoing = progress.isActive && !progress.hasEndTime;
    const compactTimeLabel = progress.isExpired
      ? t('progress.compact_expired', lang, { time: formatDuration(progress.endsTs, progress.nowTs) })
      : isOngoing
        ? t('progress.compact_ongoing', lang)
        : progress.isActive
          ? t('progress.compact_active', lang, { time: formatDuration(progress.endsTs, progress.nowTs) })
          : t('progress.compact_prep', lang, { time: formatDuration(progress.onsetTs, progress.nowTs) });
    const ongoingClass = isOngoing ? 'ongoing' : '';
    const boostClasses = this._alertBoostClasses(alert);
    const progressStyle = isOngoing ? '' : `--progress: ${progress.progressPct}%;`;
    return html`
      <div class="alert-card ${className} ${phaseClass} ${ongoingClass} ${boostClasses}" style=${`${this._alertColorStyle(alert)} ${progressStyle}`}>
        <div
          class="alert-header-row compact-row"
          @click=${() => this._toggleDetails(alert.id)}
        >
          <div class="icon-box">
            <ha-icon icon=${getWeatherIcon(alert.iconHint || alert.event)}></ha-icon>
          </div>
          ${this._renderProviderHint(alert)}
          <span class="alert-title">${alert.event}</span>
          <span class="compact-time">${compactTimeLabel}</span>
          <ha-icon
            icon="mdi:chevron-down"
            class="compact-chevron ${expanded ? 'expanded' : ''}"
          ></ha-icon>
          ${this._renderDismissButton(alert)}
        </div>
        ${expanded ? this._renderExpandedContent(alert, progress) : nothing}
      </div>
    `;
  }

  private _renderExpandedContent(alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    return html`
      <div class="alert-expanded">
        ${this._renderHeadline(alert)}
        ${alert.areaDesc ? html`
          <div class="area-desc" title=${alert.areaDesc}>
            <ha-icon icon="mdi:map-marker"></ha-icon>
            <span class="area-desc-text">${alert.areaDesc}</span>
          </div>
        ` : nothing}
        <div class="badges-row" style="padding: 0 12px 8px;">
          ${this._renderBadgesRow(alert, progress)}
        </div>

        ${this._renderProgressSection(alert, progress)}

        ${this._config?.showDetails !== false ? (this._config?.expandDetails ? html`
        ${this._renderDetailsContent(alert, progress)}
        ` : html`
        <div class="alert-details-section">
          <div
            class="details-summary"
            @click=${() => this._toggleDetails(alert.id + '_details')}
          >
            <span>${t('card.read_details', this._lang)}</span>
            <ha-icon
              icon="mdi:chevron-down"
              class="chevron ${this._expandedAlerts.get(alert.id + '_details') ? 'expanded' : ''}"
            ></ha-icon>
          </div>
          ${this._expandedAlerts.get(alert.id + '_details')
          ? this._renderDetailsContent(alert, progress)
          : nothing}
        </div>
        `) : nothing}
      </div>
    `;
  }

  private _renderFullAlert(
    alert: WeatherAlert, className: string, phaseClass: string,
    progress: AlertProgress, expanded: boolean,
  ): TemplateResult {
    const boostClasses = this._alertBoostClasses(alert);
    return html`
      <div class="alert-card ${className} ${phaseClass} ${boostClasses}" style=${this._alertColorStyle(alert)}>
        <div class="alert-header-row">
          <div class="icon-box">
            <ha-icon icon=${getWeatherIcon(alert.iconHint || alert.event)}></ha-icon>
          </div>
          <div class="info-box">
            <div class="title-row">
              ${this._renderProviderHint(alert)}
              <span class="alert-title">${alert.event}</span>
            </div>
            ${this._renderHeadline(alert)}
            ${alert.areaDesc ? html`
              <div class="area-desc" title=${alert.areaDesc}>
                <ha-icon icon="mdi:map-marker"></ha-icon>
                <span class="area-desc-text">${alert.areaDesc}</span>
              </div>
            ` : nothing}
            <div class="badges-row">
              ${this._renderBadgesRow(alert, progress)}
            </div>
          </div>
          ${this._renderDismissButton(alert)}
        </div>

        ${this._renderProgressSection(alert, progress)}

        ${this._config?.showDetails !== false ? (this._config?.expandDetails ? html`
        ${this._renderDetailsContent(alert, progress)}
        ` : html`
        <div class="alert-details-section">
          <div
            class="details-summary"
            @click=${() => this._toggleDetails(alert.id)}
          >
            <span>${t('card.read_details', this._lang)}</span>
            <ha-icon
              icon="mdi:chevron-down"
              class="chevron ${expanded ? 'expanded' : ''}"
            ></ha-icon>
          </div>
          ${expanded ? this._renderDetailsContent(alert, progress) : nothing}
        </div>
        `) : nothing}
      </div>
    `;
  }

  private _renderProviderHint(alert: WeatherAlert): TemplateResult | typeof nothing {
    if (this._config?.showProvider !== true) return nothing;
    const code = PROVIDER_SHORT[alert.provider] || alert.provider.toUpperCase();
    return html`<span class="provider-hint">${code}</span>`;
  }

  private _renderHeadline(alert: WeatherAlert): TemplateResult | typeof nothing {
    const smart = (this._config?.deduplicateHeadlines ?? this._config?.headline) !== false;
    const text = getDisplayHeadline(alert, smart);
    if (!text) return nothing;
    return html`
      <div class="alert-headline" title=${alert.headline}>
        ${text}
      </div>
    `;
  }

  private _renderBadgesRow(alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    const severityText = t('badge.severity_' + alert.severity, this._lang);
    const certText = alert.certainty
      ? t('badge.certainty_' + alert.certainty.toLowerCase(), this._lang)
      : '';
    return html`
      <span class="badge severity-badge${alert.severityInferred ? ' badge-inferred' : ''}">${severityText}</span>
      ${alert.certainty ? html`
        <span class="badge certainty-badge${alert.certaintyInferred ? ' badge-inferred' : ''}">
          <ha-icon
            icon=${getCertaintyIcon(alert.certainty)}
            style="--mdc-icon-size: ${this._scaledPx(14)}px; width: ${this._scaledPx(14)}px; height: ${this._scaledPx(14)}px;"
          ></ha-icon>
          ${certText}
        </span>
      ` : nothing}
      ${alert.phase ? html`
        <span class="badge phase-badge">${alert.phase}</span>
      ` : nothing}
      ${alert.eventCode ? html`
        <span class="badge event-code-badge">${alert.eventCode}</span>
      ` : nothing}
      ${alert.mergedCount && alert.mergedCount > 1
        ? html`<span class="badge zones-badge">${t(
          alert.mergedCount === 1 ? 'card.zone_count_singular' : 'card.zones_count',
          this._lang, { count: alert.mergedCount },
        )}</span>`
        : nothing}
    `;
  }

  private _renderTextBlock(label: string, text: string): TemplateResult | typeof nothing {
    if (!text) return nothing;
    return html`
      <div class="text-block">
        <div class="text-label">${label}</div>
        <div class="text-body">${unsafeHTML(sanitizeAlertHtml(text))}</div>
      </div>
    `;
  }

  private _renderDetailsContent(alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    const reformat = this._config?.reformatText !== false;
    let desc = this._normalizeText(alert.description);
    let instr = this._normalizeText(alert.instruction);
    if (reformat) {
      desc = reflowAlertText(desc);
      instr = reflowAlertText(instr);
    }

    const lang = this._lang;

    return html`
      <div class="details-content">
        ${this._config?.showMetadata !== false ? html`
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">${t('detail.issued', lang)}</span>
            <span class="meta-value">${formatLocalTimestamp(progress.sentTs, this._locale, lang)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${t('detail.onset', lang)}</span>
            <span class="meta-value">${formatLocalTimestamp(progress.onsetTs, this._locale, lang)}</span>
            <span class="meta-relative">${formatRelativeTime(progress.onsetTs, progress.nowTs, lang)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">${progress.isExpired ? t('progress.expired_label', lang) : t('detail.expires', lang)}</span>
            <span class="meta-value">${formatLocalTimestamp(progress.endsTs, this._locale, lang)}</span>
            ${progress.hasEndTime
          ? html`<span class="meta-relative">${formatRelativeTime(progress.endsTs, progress.nowTs, lang)}</span>`
          : nothing}
          </div>
          ${alert.areaDesc ? html`
            <div class="meta-item" style="grid-column: 1 / -1;">
              <span class="meta-label">${t('detail.area', lang)}</span>
              <span class="meta-value">${alert.areaDesc}</span>
            </div>
          ` : nothing}
        </div>
        ` : nothing}

        ${this._config?.showDescription !== false ? this._renderTextBlock(t('detail.description', lang), desc) : nothing}
        ${this._config?.showInstructions !== false ? this._renderTextBlock(t('detail.instructions', lang), instr) : nothing}

        ${alert.url && this._config?.showSourceLink !== false ? html`
          <div class="footer-link">
            <a href=${alert.url} target="_blank" rel="noopener noreferrer">
              ${this._sourceLinkLabel(alert)}
              <ha-icon icon="mdi:open-in-new" style="width:${this._scaledPx(14)}px;"></ha-icon>
            </a>
          </div>
        ` : nothing}
      </div>
    `;
  }

  private _renderProgressSection(_alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    const { isActive, progressPct, hasEndTime, onsetTs, endsTs, nowTs } = progress;
    const lang = this._lang;

    const noAnim = !this._animationsEnabled;
    const fillStyle = progress.isExpired
      ? 'left: 0; right: 0;'
      : isActive && !hasEndTime
        ? noAnim
          ? 'width: 100%; left: 0; opacity: 0.8;'
          : 'width: 100%; left: 0; animation: ongoing-pulse 5s infinite; opacity: 0.8;'
        : `left: ${progressPct}%; right: 0;`;

    return html`
      <div class="progress-section">
        <div class="progress-labels">
          <div class="label-left">
            <span class="label-sub">${isActive ? t('progress.start', lang) : t('progress.now', lang)}</span>
            <span>${formatProgressTimestamp(isActive ? onsetTs : nowTs, this._locale, lang)}</span>
          </div>
          <div class="label-center">
            ${!hasEndTime
        ? html`<span class="label-sub">${t('progress.ongoing', lang)}</span>`
        : progress.isExpired
          ? html`<span class="label-sub">${t('progress.expired_label', lang)}</span><span>${formatDuration(endsTs, nowTs)}</span>`
          : isActive
            ? html`<span class="label-sub">${t('progress.expires_in_label', lang)}</span><span>${formatDuration(endsTs, nowTs)}</span>`
            : html`<span class="label-sub">${t('progress.starts_in_label', lang)}</span><span>${formatDuration(onsetTs, nowTs)}</span>`}
          </div>
          <div class="label-right">
            <span class="label-sub">${t('progress.end', lang)}</span>
            <span>${hasEndTime ? formatProgressTimestamp(endsTs, this._locale, lang) : t('progress.tbd', lang)}</span>
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style=${fillStyle}></div>
        </div>
      </div>
    `;
  }
}

// Deprecated shim — removed in v3.0.0
class DeprecatedNwsAlertsCard extends WeatherAlertsCard {
  connectedCallback() {
    super.connectedCallback();
    console.warn(
      'nws-alerts-card is deprecated and will be removed in v3.0. ' +
      'Update your dashboard YAML to use "custom:weather-alerts-card".',
    );
  }
}
customElements.define('nws-alerts-card', DeprecatedNwsAlertsCard);

// Register with HA card picker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;
w.customCards = w.customCards || [];
w.customCards.push({
  type: 'weather-alerts-card',
  name: 'Weather Alerts Card',
  preview: true,
  description: 'A card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US), BoM (Australia), and MeteoAlarm (Europe).',
});
w.customCards.push({
  type: 'nws-alerts-card',
  name: 'NWS Alerts Card (Deprecated)',
  description: 'Deprecated — use "Weather Alerts Card" instead. Will be removed in v3.0.',
});

declare global {
  interface HTMLElementTagNameMap {
    'weather-alerts-card': WeatherAlertsCard;
    'nws-alerts-card': DeprecatedNwsAlertsCard;
  }
}
