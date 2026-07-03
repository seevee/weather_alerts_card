import { LitElement, html, svg, nothing, TemplateResult, PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { unsafeHTML } from 'lit/directives/unsafe-html.js';
import type { Connection } from 'home-assistant-js-websocket';
import { HomeAssistant, WeatherAlertsCardConfig, WeatherAlert, AlertProgress, AlertProvider, ContrastMode, DismissalRecord, EntityRegistryDisplayEntry } from './types';
import {
  resolveDeviceAlertEntities,
  deviceHasAnyEntity,
  subscribeEntityRegistry,
} from './registry';
// Re-export for existing test imports.
export { resolveDeviceAlertEntities, subscribeEntityRegistry } from './registry';
import {
  loadDismissals,
  saveDismissals,
  dismissAlert,
  undoDismiss,
  applyDismissals,
  configuredScopeTokens,
  scopeHashForConfig,
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
  getEcccColor,
  resolveContrastMode,
  sanitizeAlertHtml,
  getDisplayHeadline,
  reflowAlertText,
} from './utils';
import { getAdapter, ENTITY_NAME_PATTERNS } from './adapters';
import {
  fetchGeometry,
  buildGeometrySvg,
  buildGeometryMap,
  DEFAULT_TILE_URL,
  DEFAULT_TILE_URL_DARK,
  DEFAULT_TILE_ATTRIBUTION,
  GeoJsonGeometry,
} from './geometry';
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
  meteoswiss: 'MeteoSwiss',
  eccc: 'Environment Canada',
  pirateweather: 'Pirate Weather',
  cap: 'CAP',
};

const PROVIDER_SHORT: Record<string, string> = {
  nws: 'NWS',
  bom: 'BoM',
  meteoalarm: 'MA',
  dwd: 'DWD',
  meteoswiss: 'MS',
  eccc: 'EC',
  pirateweather: 'PW',
  cap: 'CAP',
};

// Entity name patterns are now in adapters/index.ts (ENTITY_NAME_PATTERNS).
// Registry helpers (resolveDeviceAlertEntities, deviceHasAnyEntity,
// subscribeEntityRegistry) live in ./registry and are re-exported above.

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

  // Pointer-drag-to-dismiss gesture state (plain fields — requestUpdate() called manually).
  // Unifies touch swipe and mouse drag via Pointer Events; setPointerCapture takes
  // over after lock so drags that leave the card still resolve to this element.
  private _swipeState: { id: string; offset: number; locked: boolean; cardWidth: number } | null = null;
  private _swipeStartX = 0;
  private _swipeStartY = 0;
  private _swipeCurrentDx = 0;
  private _swipeRAF: number | null = null;
  private _swipePointerId: number | null = null;
  private _swipeExitTimeout: number | null = null;
  private _swipeJustDragged = false;
  @state() private _swipeExiting: string | null = null;

  // Live entity-registry copy. `null` until the WS subscription delivers;
  // resolution helpers fall back to `hass.entities` while it is null.
  private _registryEntries: EntityRegistryDisplayEntry[] | null = null;
  private _unsubscribeRegistry?: () => void;
  private _subscribedRegistryConn?: Connection;

  // cap_alerts geometry mini-map (opt-in via showGeometry). Cache maps a
  // geometry_ref → fetched geometry (or `null` for 404/eviction, cached to
  // avoid refetch storms). In-flight set dedupes concurrent fetches. Cache is
  // cleared on connection swap (the backing store is per-connection ephemeral).
  @state() private _geometryCache = new Map<string, GeoJsonGeometry | null>();
  private _geometryInFlight = new Set<string>();
  private _geometryConn?: Connection;

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
    this._maybeSubscribeRegistry();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._motionQuery.removeEventListener('change', this._onMotionChange);
    this._unsubscribeDismissals?.();
    this._unsubscribeDismissals = undefined;
    this._teardownRegistrySubscription();
    // Drop any in-flight geometry fetches; the cache may persist for a quick
    // remount (connection-swap detection re-validates it on next fetch).
    this._geometryInFlight.clear();
    if (this._swipeRAF !== null) {
      cancelAnimationFrame(this._swipeRAF);
      this._swipeRAF = null;
    }
    if (this._swipeExitTimeout !== null) {
      clearTimeout(this._swipeExitTimeout);
      this._swipeExitTimeout = null;
    }
    this._swipeState = null;
    this._swipeExiting = null;
    if (this._config?.entity || this._config?.device) {
      WeatherAlertsCard._editorExpandedState.set(this._entityStateKey(), this._expandedAlerts);
    }
  }

  protected updated(changed: PropertyValues): void {
    super.updated(changed);
    // `hass` is set as a property after the element mounts, so the WS
    // connection typically becomes available here rather than in
    // connectedCallback. Subscribe lazily and re-subscribe if the
    // connection object swaps (e.g., after a reconnect).
    if ((changed.has('hass') || changed.has('_config')) && this.isConnected) {
      this._maybeSubscribeRegistry();
      this._maybeFetchGeometry();
    }
  }

  private _maybeSubscribeRegistry(): void {
    // Only device mode reads the entity registry (to resolve per-alert child
    // sensors under a device). A plain entity/entities card never touches
    // _registryEntries, so subscribing would refetch the entire registry on
    // every entity_registry_updated event for nothing. Gate it.
    if (!this._config?.device) {
      this._teardownRegistrySubscription();
      return;
    }
    const conn = this.hass?.connection;
    if (!conn || conn === this._subscribedRegistryConn) return;
    // New (or first) connection — drop any prior subscription.
    this._unsubscribeRegistry?.();
    this._unsubscribeRegistry = undefined;
    this._subscribedRegistryConn = conn;
    subscribeEntityRegistry(conn, (entries) => {
      this._registryEntries = entries;
      this.requestUpdate();
    }).then((unsub) => {
      // The connection (or our own state) may have changed while the
      // subscribe round-trip was in flight; honour that by tearing the
      // freshly-acquired subscription down rather than retaining it.
      if (this._subscribedRegistryConn !== conn) {
        unsub();
        return;
      }
      this._unsubscribeRegistry = unsub;
    }).catch(() => {
      if (this._subscribedRegistryConn === conn) {
        this._subscribedRegistryConn = undefined;
      }
    });
  }

  private _teardownRegistrySubscription(): void {
    this._unsubscribeRegistry?.();
    this._unsubscribeRegistry = undefined;
    this._subscribedRegistryConn = undefined;
  }

  // Out-of-band geometry fetch orchestration. Opt-in (showGeometry) so the
  // default config — and every non-cap provider — incurs zero network. Mirrors
  // the registry subscription's connection-swap + in-flight discipline. Runs
  // from updated(); never from render/_getAlerts/getCardSize (render purity).
  private _maybeFetchGeometry(): void {
    if (this._config?.showGeometry !== true) return;
    const conn = this.hass?.connection;
    if (!conn) return;

    // Connection swap (e.g. reconnect): the geometry store is per-connection
    // and ephemeral, so drop everything and refetch against the new socket.
    if (conn !== this._geometryConn) {
      this._geometryCache = new Map();
      this._geometryInFlight.clear();
      this._geometryConn = conn;
    }

    // Collect the refs of currently-filtered alerts.
    const refs = new Set<string>();
    for (const alert of this._getAlerts(false)) {
      if (alert.geometryRef) refs.add(alert.geometryRef);
    }

    // Prune cache/in-flight entries whose alert is no longer present.
    for (const ref of [...this._geometryCache.keys()]) {
      if (!refs.has(ref)) this._geometryCache.delete(ref);
    }
    for (const ref of [...this._geometryInFlight]) {
      if (!refs.has(ref)) this._geometryInFlight.delete(ref);
    }

    // Fetch each new ref exactly once. Results (geometry or null) are cached so
    // a 404 doesn't refetch on every state update.
    for (const ref of refs) {
      if (this._geometryCache.has(ref) || this._geometryInFlight.has(ref)) continue;
      this._geometryInFlight.add(ref);
      fetchGeometry(conn, ref).then((result) => {
        // Drop the result if the connection swapped mid-flight.
        if (conn !== this._geometryConn) return;
        this._geometryInFlight.delete(ref);
        this._geometryCache.set(ref, result);
        this.requestUpdate();
      }).catch(() => {
        // fetchGeometry never rejects, but stay defensive.
        if (conn === this._geometryConn) this._geometryInFlight.delete(ref);
      });
    }
  }

  public setConfig(config: WeatherAlertsCardConfig): void {
    const hasEntity = !!config.entity || !!config.entities?.length;
    if (!hasEntity && !config.device) {
      throw new Error('You need to define an entity or device');
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
    // Hash the *configured* sources (entity + device id), not the resolved
    // entity list — device-mode alerts come and go, and the dismissal scope
    // must stay stable across that churn. Shared with the editor so both
    // agree on the storage key (see scopeHashForConfig).
    return scopeHashForConfig(this._config);
  }

  private _configuredScopeTokens(): string[] {
    return configuredScopeTokens(this._config);
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
    // Pass reconcile=false: this is a layout-measurement call from HA's
    // masonry engine and must not trigger localStorage writes or reactive
    // state mutations as a side effect.
    const alerts = this._getAlerts(false);
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
    if (this._config.device && this.hass) {
      for (const id of resolveDeviceAlertEntities(this.hass, this._config.device, this._registryEntries)) {
        if (!seen.has(id)) {
          seen.add(id);
          result.push(id);
        }
      }
    }
    return result;
  }

  private _entityStateKey(): string {
    return [...this._configuredScopeTokens()].sort().join(',');
  }

  private _deviceHasAnyEntity(deviceId: string): boolean {
    if (!this.hass) return false;
    return deviceHasAnyEntity(this.hass, deviceId, this._registryEntries);
  }

  // Set when applyDismissals produces a changed map during render; persisted
  // out-of-band by _scheduleDismissalReconcile so render() stays free of
  // localStorage writes and reactive-state mutation.
  private _pendingDismissals: Map<string, DismissalRecord> | null = null;
  private _dismissalReconcileScheduled = false;

  private _getAlerts(reconcile = true): WeatherAlert[] {
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
    let filtered = this._filterAndSort(allAlerts, { providerPriority });
    if (this._config.allowDismiss && !this._forcePreview && this._dismissals.size > 0) {
      const { visible, updatedMap } = applyDismissals(filtered, this._dismissals);
      // applyDismissals can change the map (un-dismiss on signature shift,
      // renew lastSeenAt). Defer the write/state-mutation out of the render &
      // measurement path so we never mutate reactive state during render() or
      // touch localStorage from getCardSize().
      if (reconcile && updatedMap !== this._dismissals) {
        this._scheduleDismissalReconcile(updatedMap);
      }
      filtered = visible;
    }
    return filtered;
  }

  private _scheduleDismissalReconcile(updatedMap: Map<string, DismissalRecord>): void {
    // Each render recomputes updatedMap against the unchanged this._dismissals,
    // so the latest snapshot is always the one to persist. Coalesce repeated
    // renders into a single microtask write.
    this._pendingDismissals = updatedMap;
    if (this._dismissalReconcileScheduled) return;
    this._dismissalReconcileScheduled = true;
    queueMicrotask(() => {
      this._dismissalReconcileScheduled = false;
      const next = this._pendingDismissals;
      this._pendingDismissals = null;
      if (!next || !this._dismissalsScope) return;
      this._dismissals = next;
      saveDismissals(this._dismissalsScope, next);
    });
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

  private _swipeEnabled(): boolean {
    return this._canDismiss()
      && (this._config?.dismissTrigger === 'swipe' || this._config?.dismissTrigger === 'both');
  }

  private _onSwipePointerDown(alert: WeatherAlert, e: PointerEvent): void {
    if (!this._swipeEnabled()) return;
    if (this._swipeState) return;
    // Primary button only — ignores right/middle click and pen barrel buttons.
    if (e.button !== 0) return;
    this._swipePointerId = e.pointerId;
    this._swipeStartX = e.clientX;
    this._swipeStartY = e.clientY;
    this._swipeCurrentDx = 0;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    this._swipeState = { id: alert.id, offset: 0, locked: false, cardWidth: rect.width };
  }

  private _onSwipePointerMove(alert: WeatherAlert, e: PointerEvent): void {
    if (!this._swipeState || this._swipeState.id !== alert.id) return;
    if (e.pointerId !== this._swipePointerId) return;

    const dx = e.clientX - this._swipeStartX;
    const dy = e.clientY - this._swipeStartY;

    if (!this._swipeState.locked) {
      if (Math.abs(dy) - Math.abs(dx) > 12) {
        this._swipeState = null;
        return;
      }
      if (dx >= 0) {
        this._swipeState = null;
        return;
      }
      // Capture so the gesture survives the pointer leaving the card; the
      // rAF below schedules the lock-class + offset DOM update together on
      // the next frame — no separate requestUpdate() needed here.
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      this._swipeState = { ...this._swipeState, locked: true };
    }

    this._swipeCurrentDx = Math.min(0, dx);

    if (this._swipeRAF !== null) return;
    this._swipeRAF = requestAnimationFrame(() => {
      this._swipeRAF = null;
      if (!this._swipeState || this._swipeState.id !== alert.id) return;
      this._swipeState = { ...this._swipeState, offset: this._swipeCurrentDx };
      this.requestUpdate();
    });
  }

  private _onSwipePointerUp(alert: WeatherAlert, e: PointerEvent): void {
    if (!this._swipeState || this._swipeState.id !== alert.id) return;
    if (e.pointerId !== this._swipePointerId) return;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    if (this._swipeRAF !== null) {
      cancelAnimationFrame(this._swipeRAF);
      this._swipeRAF = null;
    }
    const { offset, cardWidth, locked } = this._swipeState;
    this._swipeState = null;
    this._swipePointerId = null;
    if (locked) {
      // Suppress the synthesized click that follows a mouse drag, so the
      // header's @click=_toggleDetails doesn't fire after a swipe. Auto-clears
      // next tick in case the browser doesn't fire a click at all.
      this._swipeJustDragged = true;
      setTimeout(() => { this._swipeJustDragged = false; }, 0);
    }
    if (locked && offset <= -(cardWidth * 0.4)) {
      this._swipeExiting = alert.id;
      const delay = this._motionQuery.matches ? 0 : 200;
      this._swipeExitTimeout = window.setTimeout(() => {
        this._swipeExitTimeout = null;
        this._swipeExiting = null;
        this._onDismiss(alert);
      }, delay);
    } else {
      this.requestUpdate();
    }
  }

  private _onSwipePointerCancel(alert: WeatherAlert, e: PointerEvent): void {
    if (!this._swipeState || this._swipeState.id !== alert.id) return;
    if (e.pointerId !== this._swipePointerId) return;
    const target = e.currentTarget as HTMLElement;
    if (target.hasPointerCapture(e.pointerId)) target.releasePointerCapture(e.pointerId);
    if (this._swipeRAF !== null) {
      cancelAnimationFrame(this._swipeRAF);
      this._swipeRAF = null;
    }
    this._swipeState = null;
    this._swipePointerId = null;
    this.requestUpdate();
  }

  private _swipeCardStyle(alert: WeatherAlert, baseStyle: string): string {
    if (this._swipeExiting === alert.id) return baseStyle;
    if (this._swipeState?.id === alert.id) {
      const { offset, cardWidth } = this._swipeState;
      const opacity = Math.max(0, 1 + offset / cardWidth).toFixed(2);
      return `${baseStyle} transform: translateX(${offset}px); opacity: ${opacity};`;
    }
    return baseStyle;
  }

  private _swipeCardClass(alert: WeatherAlert): string {
    const classes: string[] = [];
    if (this._swipeEnabled()) classes.push('swipe-enabled');
    if (this._swipeExiting === alert.id) classes.push('swipe-exit');
    else if (this._swipeState?.id === alert.id && this._swipeState.locked) classes.push('swiping');
    return classes.join(' ');
  }

  private _isLabeledDismissActive(): boolean {
    return this._canDismiss()
      && this._config?.dismissTrigger !== 'swipe'
      && this._config?.dismissButtonStyle === 'labeled'
      && !this._isCompact;
  }

  private _renderDismissButton(alert: WeatherAlert): TemplateResult | typeof nothing {
    if (!this._canDismiss()) return nothing;
    if (this._config?.dismissTrigger === 'swipe') return nothing;
    if (this._isLabeledDismissActive()) {
      return html`
        <button
          type="button"
          class="dismiss-button labeled"
          aria-label=${t('card.dismiss', this._lang)}
          title=${t('card.dismiss', this._lang)}
          @click=${(e: Event) => { e.stopPropagation(); this._onDismiss(alert); }}
        >
          <ha-icon icon="mdi:close"></ha-icon>
          <span>${t('card.dismiss', this._lang)}</span>
        </button>
      `;
    }
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
      // 'unknown' means the provider couldn't classify the alert, not that
      // it's low-priority. Never silently drop it via the severity floor —
      // suppressing an unclassified weather alert is a safety hazard. Users
      // who truly want it gone can use eventCode/zone filters instead.
      result = result.filter(a => a.severity === 'unknown' || (severityRank[a.severity] ?? 4) <= threshold);
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
  private get _colorTheme(): 'severity' | 'nws' | 'meteoalarm' | 'eccc' { return this._config?.colorTheme || 'severity'; }
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
    if (this._colorTheme === 'eccc') {
      const { color, rgb, textColorLight, textColorDark } = getEcccColor(alert, this._contrastMode);
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
    } else if (this._colorTheme === 'eccc') {
      tags = getEcccColor(alert, mode);
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
    // A click synthesized at the end of a successful pointer drag would
    // otherwise toggle the alert that was just swiped — swallow it.
    if (this._swipeJustDragged) {
      this._swipeJustDragged = false;
      return;
    }
    const next = new Map(this._expandedAlerts);
    next.set(alertId, !next.get(alertId));
    this._expandedAlerts = next;
    if (this._config?.entity || this._config?.device) {
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

    // Device mode: if the device is registered (even when no per-alert
    // children currently exist), treat zero-resolved as "no active alerts"
    // rather than falling back to preview.
    const deviceLinked = !!this._config.device && this._deviceHasAnyEntity(this._config.device);
    if ((resolvedEntities.length === 0 && !deviceLinked) || this._forcePreview) {
      return this._renderPreview();
    }

    // Show unavailable only if every resolved entity is unavailable/unknown
    // AND carries no parseable alert. CAP per-alert sensors can report state
    // "unknown" while their attributes hold a fully valid alert (e.g. an NWS
    // Beach Hazards Statement) — those must still render, not be dropped as a
    // broken data source.
    const allUnavailable = resolvedEntities.length > 0
      && resolvedEntities.every(e =>
        (e.state === 'unavailable' || e.state === 'unknown')
        && getAdapter(this._config!.provider, e.attributes).parseAlerts(e.attributes).length === 0);
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
    const swipeClass = this._swipeCardClass(alert);
    const cardStyle = this._swipeCardStyle(alert, `${this._alertColorStyle(alert)} ${progressStyle}`);
    return html`
      <div
        class="alert-card ${className} ${phaseClass} ${ongoingClass} ${boostClasses} ${swipeClass}"
        style=${cardStyle}
        @pointerdown=${(e: PointerEvent) => this._onSwipePointerDown(alert, e)}
        @pointermove=${(e: PointerEvent) => this._onSwipePointerMove(alert, e)}
        @pointerup=${(e: PointerEvent) => this._onSwipePointerUp(alert, e)}
        @pointercancel=${(e: PointerEvent) => this._onSwipePointerCancel(alert, e)}
      >
        <div
          class="alert-header-row compact-row"
          @click=${() => this._toggleDetails(alert.id)}
        >
          <div class="icon-box">
            <ha-icon icon=${alert.providerIcon ?? getWeatherIcon(alert.iconHint || alert.event)}></ha-icon>
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
    const swipeClass = this._swipeCardClass(alert);
    const cardStyle = this._swipeCardStyle(alert, this._alertColorStyle(alert));
    return html`
      <div
        class="alert-card ${className} ${phaseClass} ${boostClasses} ${swipeClass}"
        style=${cardStyle}
        @pointerdown=${(e: PointerEvent) => this._onSwipePointerDown(alert, e)}
        @pointermove=${(e: PointerEvent) => this._onSwipePointerMove(alert, e)}
        @pointerup=${(e: PointerEvent) => this._onSwipePointerUp(alert, e)}
        @pointercancel=${(e: PointerEvent) => this._onSwipePointerCancel(alert, e)}
      >
        <div class="alert-header-row">
          <div class="icon-box">
            <ha-icon icon=${alert.providerIcon ?? getWeatherIcon(alert.iconHint || alert.event)}></ha-icon>
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
    const smart = this._config?.deduplicateHeadlines !== false;
    const text = getDisplayHeadline(alert, smart);
    if (!text) return nothing;
    return html`
      <div class="alert-headline" title=${alert.headline}>
        ${text}
      </div>
    `;
  }

  private _renderBadgesRow(alert: WeatherAlert, progress: AlertProgress): TemplateResult {
    const severityText = alert.severityBadgeLabel
      ?? t('badge.severity_' + alert.severity, this._lang);
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
      ${alert.eventCode && alert.eventCode.trim().toLowerCase() !== alert.event.trim().toLowerCase() ? html`
        <span class="badge event-code-badge">${alert.eventCode}</span>
      ` : nothing}
      ${alert.mergedCount && alert.mergedCount > 1
        ? html`<span class="badge zones-badge">${t(
          'card.zones_count', this._lang, { count: alert.mergedCount },
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

        ${this._config?.showGeometry === true ? this._renderGeometry(alert) : nothing}

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

  // Inline SVG mini-map of the affected area (cap_alerts geometry). bbox draws
  // an immediate frame with zero network; the polygon overlays once the
  // out-of-band fetch lands. Reads cache only — purity preserved. The severity
  // color flows in via the inherited --color custom property.
  private _renderGeometry(alert: WeatherAlert): TemplateResult | typeof nothing {
    if (this._config?.showGeometry !== true || !alert.bbox) return nothing;
    const geometry = alert.geometryRef ? this._geometryCache.get(alert.geometryRef) : undefined;
    if (this._config?.geometryStyle === 'map') {
      return this._renderGeometryMap(alert, geometry ?? undefined);
    }
    const { viewBox, polygonPaths } = buildGeometrySvg(alert.bbox, geometry ?? undefined);
    return html`
      <svg
        class="alert-geometry"
        viewBox=${viewBox}
        preserveAspectRatio="xMidYMid meet"
        role="img"
        aria-label=${alert.areaDesc || t('detail.area', this._lang)}
      >
        <rect class="geometry-frame" x="0" y="0" width="100%" height="100%"></rect>
        ${polygonPaths.map(d => svg`<path class="geometry-shape" d=${d}></path>`)}
      </svg>
    `;
  }

  // 'map' style: OSM raster tiles (browser-loaded <image>) behind the polygon.
  // Tiles/polygon share the Web-Mercator tile space so they align; the polygon
  // gets a white casing for legibility over busy tiles. Tile failure / offline
  // leaves the frame + polygon visible. The attribution lives in an HTML overlay
  // (CSS-positioned) rather than the SVG so it doesn't scale with the viewBox.
  private _renderGeometryMap(
    alert: WeatherAlert,
    geometry?: GeoJsonGeometry,
  ): TemplateResult {
    // Default basemap follows the card's theme (CARTO light/dark, matching HA's
    // own map). A user override opts out of theme-switching and OSM-credit
    // assumptions, so default its attribution to the generic OSM credit.
    const override = this._config?.geometryTileUrl;
    const tileUrl = override
      || (this._themeMode === 'dark' ? DEFAULT_TILE_URL_DARK : DEFAULT_TILE_URL);
    const attribution = this._config?.geometryTileAttribution
      ?? (override ? '© OpenStreetMap' : DEFAULT_TILE_ATTRIBUTION);
    const { viewBox, aspect, tiles, polygonPaths } = buildGeometryMap(
      alert.bbox as [number, number, number, number],
      geometry,
      { tileUrl, attribution },
    );
    const label = alert.areaDesc || t('detail.area', this._lang);
    return html`
      <div class="alert-geometry-map" style="aspect-ratio: ${aspect};">
        <svg
          class="alert-geometry map"
          viewBox=${viewBox}
          preserveAspectRatio="xMidYMid meet"
          role="img"
          aria-label=${label}
        >
          ${tiles.map(tile => svg`<image
            href=${tile.href}
            x=${tile.x}
            y=${tile.y}
            width=${tile.size}
            height=${tile.size}
          ></image>`)}
          <rect class="geometry-frame" x="0" y="0" width="100%" height="100%"></rect>
          ${polygonPaths.map(d => svg`<path class="geometry-shape-casing" d=${d}></path>`)}
          ${polygonPaths.map(d => svg`<path class="geometry-shape" d=${d}></path>`)}
        </svg>
        <span class="geometry-attrib">${attribution}</span>
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

declare global {
  interface HTMLElementTagNameMap {
    'weather-alerts-card': WeatherAlertsCard;
  }
}
