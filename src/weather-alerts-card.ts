import { LitElement, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { HomeAssistant, WeatherAlertsCardConfig, WeatherAlert, AlertProgress, AlertProvider } from './types';
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
  sanitizeAlertHtml,
  getDisplayHeadline,
} from './utils';
import { getAdapter, ENTITY_NAME_PATTERNS } from './adapters';
import { t } from './localize';
import { cardStyles } from './styles';
import './weather-alerts-card-editor';

/* eslint-disable no-console */
const CARD_VERSION = '2.0.0-alpha.1';
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
};

// Entity name patterns are now in adapters/index.ts (ENTITY_NAME_PATTERNS)

function getPreviewAlerts(): WeatherAlert[] {
  const now = Date.now() / 1000;
  const HOUR = 3600;
  return [
    {
      id: 'preview-1',
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
    },
    {
      id: 'preview-2',
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
    },
  ];
}

@customElement('weather-alerts-card')
export class WeatherAlertsCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: WeatherAlertsCardConfig;
  @state() private _expandedAlerts: Map<string, boolean> = new Map();
  @state() private _forcePreview = false;

  private _motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  private _onMotionChange = () => this.requestUpdate();

  connectedCallback() {
    super.connectedCallback();
    this._motionQuery.addEventListener('change', this._onMotionChange);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._motionQuery.removeEventListener('change', this._onMotionChange);
  }

  public setConfig(config: WeatherAlertsCardConfig): void {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    const { _preview, ...rest } = config;
    this._config = rest as WeatherAlertsCardConfig;
    this._forcePreview = !!_preview;
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

  private _getAlerts(): WeatherAlert[] {
    if (!this.hass || !this._config) return [];
    const entity = this.hass.states[this._config.entity];
    if (!entity) return [];

    const adapter = getAdapter(this._config.provider, entity.attributes);
    let alerts = adapter.parseAlerts(entity.attributes);

    if (this._config.deduplicate !== false) {
      alerts = deduplicateAlerts(alerts);
    }

    if (this._config.zones && this._config.zones.length > 0) {
      const zoneSet = new Set(this._config.zones.map(z => z.toUpperCase()));
      alerts = alerts.filter(a => alertMatchesZones(a, zoneSet));
    }

    if (this._config.eventCodes && this._config.eventCodes.length > 0) {
      const codeSet = new Set(this._config.eventCodes.map(c => c.toUpperCase()));
      alerts = alerts.filter(a => a.eventCode && codeSet.has(a.eventCode.toUpperCase()));
    }

    if (this._config.excludeEventCodes && this._config.excludeEventCodes.length > 0) {
      const excludeSet = new Set(this._config.excludeEventCodes.map(c => c.toUpperCase()));
      alerts = alerts.filter(a => !a.eventCode || !excludeSet.has(a.eventCode.toUpperCase()));
    }

    if (this._config.minSeverity) {
      const severityRank = {
        extreme: 0, severe: 1, moderate: 2, minor: 3, unknown: 4,
      };
      const threshold = severityRank[this._config.minSeverity] ?? 4;
      alerts = alerts.filter(a => (severityRank[a.severity] ?? 4) <= threshold);
    }

    return sortAlerts(alerts, this._config.sortOrder || 'default');
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

  private _alertColorStyle(alert: WeatherAlert): string {
    if (this._colorTheme === 'nws') {
      const { color, rgb } = getNwsEventColor(alert.event);
      return `--color: ${color}; --color-rgb: ${rgb};`;
    }
    if (this._colorTheme === 'meteoalarm') {
      const { color, rgb } = getMeteoAlarmColor(alert.severity);
      return `--color: ${color}; --color-rgb: ${rgb};`;
    }
    return '';
  }
  private _normalizeText(text: string | undefined): string {
    return (text || '').replace(/\n{2,}/g, '\n\n').trim();
  }

  private _toggleDetails(alertId: string): void {
    const next = new Map(this._expandedAlerts);
    next.set(alertId, !next.get(alertId));
    this._expandedAlerts = next;
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

    const entity = this.hass.states[this._config.entity];
    const isPreview = !entity || this._forcePreview;

    if (isPreview) {
      return this._renderPreview();
    }

    const stateVal = entity.state;
    if (stateVal === 'unavailable' || stateVal === 'unknown') {
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
      return html``;
    }

    const animClass = this._animationsEnabled ? '' : 'no-animations';
    const layoutClass = this._isCompact ? 'compact' : '';

    return html`
      <ha-card .header=${this._config.title || ''} class="${animClass} ${layoutClass}">
        ${alerts.length === 0
        ? this._renderNoAlerts()
        : alerts.map(alert => this._renderAlert(alert))}
      </ha-card>
    `;
  }

  private _renderPreview(): TemplateResult {
    const alerts = getPreviewAlerts();
    const animClass = this._animationsEnabled ? '' : 'no-animations';
    const layoutClass = this._isCompact ? 'compact' : '';

    return html`
      <ha-card .header=${this._config.title || ''} class="${animClass} ${layoutClass}">
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
    const compactTimeLabel = isOngoing
      ? t('progress.compact_ongoing', lang)
      : progress.isActive
        ? t('progress.compact_active', lang, { time: formatDuration(progress.endsTs, progress.nowTs) })
        : t('progress.compact_prep', lang, { time: formatDuration(progress.onsetTs, progress.nowTs) });
    const ongoingClass = isOngoing ? 'ongoing' : '';
    const progressStyle = isOngoing ? '' : `--progress: ${progress.progressPct}%;`;
    return html`
      <div class="alert-card ${className} ${phaseClass} ${ongoingClass}" style=${`${this._alertColorStyle(alert)} ${progressStyle}`}>
        <div
          class="alert-header-row compact-row"
          @click=${() => this._toggleDetails(alert.id)}
        >
          <div class="icon-box">
            <ha-icon icon=${getWeatherIcon(alert.event)}></ha-icon>
          </div>
          <span class="alert-title">${alert.event}</span>
          <span class="compact-time">${compactTimeLabel}</span>
          <ha-icon
            icon="mdi:chevron-down"
            class="compact-chevron ${expanded ? 'expanded' : ''}"
          ></ha-icon>
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
      </div>
    `;
  }

  private _renderFullAlert(
    alert: WeatherAlert, className: string, phaseClass: string,
    progress: AlertProgress, expanded: boolean,
  ): TemplateResult {
    return html`
      <div class="alert-card ${className} ${phaseClass}" style=${this._alertColorStyle(alert)}>
        <div class="alert-header-row">
          <div class="icon-box">
            <ha-icon icon=${getWeatherIcon(alert.event)}></ha-icon>
          </div>
          <div class="info-box">
            <div class="title-row">
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
        </div>

        ${this._renderProgressSection(alert, progress)}

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
      </div>
    `;
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
    return html`
      <span class="badge severity-badge">${alert.severityLabel}</span>
      ${alert.certainty ? html`
        <span class="badge certainty-badge">
          <ha-icon
            icon=${getCertaintyIcon(alert.certainty)}
            style="--mdc-icon-size: 14px; width: 14px; height: 14px;"
          ></ha-icon>
          ${alert.certainty}
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
    const desc = this._normalizeText(alert.description);
    const instr = this._normalizeText(alert.instruction);

    const lang = this._lang;

    return html`
      <div class="details-content">
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
            <span class="meta-label">${t('detail.expires', lang)}</span>
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

        ${this._renderTextBlock(t('detail.description', lang), desc)}
        ${this._renderTextBlock(t('detail.instructions', lang), instr)}

        ${alert.url && this._config?.showSourceLink !== false ? html`
          <div class="footer-link">
            <a href=${alert.url} target="_blank" rel="noopener noreferrer">
              ${this._sourceLinkLabel(alert)}
              <ha-icon icon="mdi:open-in-new" style="width:14px;"></ha-icon>
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
    const fillStyle = isActive && !hasEndTime
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
