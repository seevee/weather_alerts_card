import { LitElement, html, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import { HomeAssistant, NwsAlertsCardConfig, WeatherAlert, AlertProgress } from './types';
import {
  getWeatherIcon,
  getCertaintyIcon,
  computeAlertProgress,
  formatProgressTimestamp,
  formatLocalTimestamp,
  formatRelativeTime,
  sortAlerts,
  alertMatchesZones,
  getNwsEventColor,
  sanitizeAlertHtml,
} from './utils';
import { getAdapter } from './adapters';
import { cardStyles } from './styles';
import './nws-alerts-card-editor';

const PROVIDER_LABELS: Record<string, string> = {
  nws: 'NWS',
  bom: 'BoM',
  meteoalarm: 'MeteoAlarm',
};

@customElement('nws-alerts-card')
export class NwsAlertsCard extends LitElement {
  static styles = cardStyles;

  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: NwsAlertsCardConfig;
  @state() private _expandedAlerts: Map<string, boolean> = new Map();

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

  public setConfig(config: NwsAlertsCardConfig): void {
    if (!config.entity) {
      throw new Error('You need to define an entity');
    }
    this._config = config;
  }

  public getCardSize(): number {
    const alerts = this._getAlerts();
    const perAlert = this._isCompact ? 1 : 3;
    return Math.max(1, alerts.length * perAlert);
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement('nws-alerts-card-editor');
  }

  public static getStubConfig(): Record<string, unknown> {
    return { entity: 'sensor.nws_alerts_alerts' };
  }

  private _getAlerts(): WeatherAlert[] {
    if (!this.hass || !this._config) return [];
    const entity = this.hass.states[this._config.entity];
    if (!entity) return [];

    const adapter = getAdapter(this._config.provider, entity.attributes);
    let alerts = adapter.parseAlerts(entity.attributes);

    if (this._config.zones && this._config.zones.length > 0) {
      const zoneSet = new Set(this._config.zones.map(z => z.toUpperCase()));
      alerts = alerts.filter(a => alertMatchesZones(a, zoneSet));
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
    return { ...this.hass.locale, timeZone: this.hass.config?.time_zone };
  }

  private get _animationsEnabled(): boolean {
    if (this._config?.animations === true) return true;
    if (this._config?.animations === false) return false;
    return !this._motionQuery.matches; // undefined → respect OS prefers-reduced-motion
  }
  private get _isCompact(): boolean { return this._config?.layout === 'compact'; }
  private get _colorTheme(): 'severity' | 'nws' { return this._config?.colorTheme || 'severity'; }

  private _alertColorStyle(alert: WeatherAlert): string {
    if (this._colorTheme !== 'nws' || alert.provider !== 'nws') return '';
    const { color, rgb, textColor } = getNwsEventColor(alert.event);
    return `--color: ${color}; --color-rgb: ${rgb}; --badge-text: ${textColor};`;
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
    return `Open ${label} Source`;
  }

  protected render(): TemplateResult {
    if (!this._config || !this.hass) return html``;

    const entity = this.hass.states[this._config.entity];
    if (!entity) {
      return html`
        <ha-card .header=${this._config.title || ''}>
          <div class="error">
            Entity not found: ${this._config.entity}
          </div>
        </ha-card>
      `;
    }

    const stateVal = entity.state;
    if (stateVal === 'unavailable' || stateVal === 'unknown') {
      return html`
        <ha-card .header=${this._config.title || ''}>
          <div class="sensor-unavailable">
            <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
            Alert sensor is ${stateVal}.
          </div>
        </ha-card>
      `;
    }

    const alerts = this._getAlerts();
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

  private _renderNoAlerts(): TemplateResult {
    return html`
      <div class="no-alerts">
        <ha-icon icon="mdi:weather-sunny"></ha-icon><br>
        No active alerts.
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
    return html`
      <div class="alert-card ${className} ${phaseClass}" style=${this._alertColorStyle(alert)}>
        <div
          class="alert-header-row compact-row"
          @click=${() => this._toggleDetails(alert.id)}
        >
          <div class="icon-box">
            <ha-icon icon=${getWeatherIcon(alert.event)}></ha-icon>
          </div>
          <span class="alert-title">${alert.event}</span>
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
        <div class="badges-row" style="padding: 0 12px 8px;">
          ${this._renderBadgesRow(alert, progress)}
        </div>

        ${this._renderProgressSection(alert, progress)}

        <div class="alert-details-section">
          <div
            class="details-summary"
            @click=${() => this._toggleDetails(alert.id + '_details')}
          >
            <span>Read Details</span>
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
            <span>Read Details</span>
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

  private _renderBadgesRow(alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    return html`
      <span class="badge severity-badge">${alert.severity}</span>
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
      ${progress.isActive
        ? html`<span class="badge active-badge">Active</span>`
        : html`<span class="badge prep-badge">In Prep</span>`}
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

    return html`
      <div class="details-content">
        <div class="meta-grid">
          <div class="meta-item">
            <span class="meta-label">Issued</span>
            <span class="meta-value">${formatLocalTimestamp(progress.sentTs, this._locale)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Onset</span>
            <span class="meta-value">${formatLocalTimestamp(progress.onsetTs, this._locale)}</span>
            <span class="meta-relative">${formatRelativeTime(progress.onsetTs, progress.nowTs)}</span>
          </div>
          <div class="meta-item">
            <span class="meta-label">Expires</span>
            <span class="meta-value">${formatLocalTimestamp(progress.endsTs, this._locale)}</span>
            ${progress.hasEndTime
        ? html`<span class="meta-relative">${formatRelativeTime(progress.endsTs, progress.nowTs)}</span>`
        : nothing}
          </div>
        </div>

        ${this._renderTextBlock('Description', desc)}
        ${this._renderTextBlock('Instructions', instr)}

        ${alert.url ? html`
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

    const noAnim = !this._animationsEnabled;
    const fillStyle = isActive && !hasEndTime
      ? noAnim
        ? 'width: 100%; left: 0; opacity: 0.8;'
        : 'width: 100%; left: 0; animation: ongoing-pulse 5s infinite; opacity: 0.8;'
      : `width: ${100 - progressPct}%; left: ${progressPct}%;`;

    return html`
      <div class="progress-section">
        <div class="progress-labels">
          <div class="label-left">
            <span class="label-sub">${isActive ? 'Start' : 'Now'}</span><br>
            ${formatProgressTimestamp(isActive ? onsetTs : nowTs, this._locale)}
          </div>
          <div class="label-center">
            ${!hasEndTime
        ? html`<span style="color: var(--color);"><b>Ongoing</b></span>`
        : isActive
          ? html`expires <b>${formatRelativeTime(endsTs, nowTs)}</b>`
          : html`starts <b>${formatRelativeTime(onsetTs, nowTs)}</b>`}
          </div>
          <div class="label-right">
            <span class="label-sub">End</span><br>
            ${hasEndTime ? formatProgressTimestamp(endsTs, this._locale) : 'TBD'}
          </div>
        </div>
        <div class="progress-track">
          <div class="progress-fill" style=${fillStyle}></div>
        </div>
      </div>
    `;
  }
}

// Register with HA card picker
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const w = window as any;
w.customCards = w.customCards || [];
w.customCards.push({
  type: 'nws-alerts-card',
  name: 'NWS Alerts Card',
  description: 'A card for displaying weather alerts with severity indicators, progress bars, and expandable details. Supports NWS (US), BoM (Australia), and MeteoAlarm (Europe).',
});

declare global {
  interface HTMLElementTagNameMap {
    'nws-alerts-card': NwsAlertsCard;
  }
}
