import { LitElement, html, css, nothing, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import type { Connection } from 'home-assistant-js-websocket';
import { HomeAssistant, WeatherAlertsCardConfig, EntityRegistryDisplayEntry, DecoPhase, ProgressDecoration, IconBorderStyle, ProgressStyleConfig, IconBorderStyleConfig, ActionConfig, PROGRESS_DECO_DEFAULTS, ICON_BORDER_DEFAULTS } from './types';
import { BESPOKE_LABELS, DETAIL_SECTIONS, FIELDS, PANELS, PANEL_LABELS, Panel, SELECTS, STYLING_KEYS, TOGGLES, SelectKey, SimpleKey, SimpleValue, ToggleKey, changedKeys, effectiveValue, isChanged, isOn, shortLabel, withKey } from './editor-fields';
import { canHandleAny, ENTITY_NAME_PATTERNS, getAdapter, knownFeedSources, pointCapableProviders } from './adapters';
import { LengthUnit, displayToKm, kmToDisplay, normalizeColorConfig, toLengthUnit } from './utils';
import { configuredDevices, deviceEntityIds, resolveDeviceAlertEntities, subscribeEntityRegistry } from './registry';
import { t } from './localize';
import { scopeHashForConfig, loadDismissals, restoreAll, subscribeToDismissalChanges } from './dismissal';

@customElement('weather-alerts-card-editor')
export class WeatherAlertsCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: WeatherAlertsCardConfig;
  @state() private _showPreview = false;
  private _subscribedDismissalsScope = '';
  private _unsubscribeDismissals?: () => void;

  // Live entity-registry copy. `null` until the WS subscription delivers;
  // `_renderNoEntitiesHint` and the device-children exclusion in
  // `_getMatchingEntityIds` fall back to `hass.entities` while it is null.
  private _registryEntries: EntityRegistryDisplayEntry[] | null = null;
  private _unsubscribeRegistry?: () => void;
  private _subscribedRegistryConn?: Connection;

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unsubscribeDismissals?.();
    this._unsubscribeDismissals = undefined;
    this._subscribedDismissalsScope = '';
    this._teardownRegistrySubscription();
  }

  protected updated(changed: Map<string, unknown>): void {
    super.updated(changed);
    // Keep the dismissal-change subscription aligned with the editor's
    // current entity-set scope so dismiss/undo/restore-all events on any
    // card instance refresh the admin line immediately.
    const scope = this._currentScopeHash();
    if (scope !== this._subscribedDismissalsScope) {
      this._unsubscribeDismissals?.();
      this._unsubscribeDismissals = undefined;
      this._subscribedDismissalsScope = scope;
      if (scope) {
        this._unsubscribeDismissals = subscribeToDismissalChanges(
          scope,
          () => this.requestUpdate(),
        );
      }
    }
    if (this.isConnected) {
      this._maybeSubscribeRegistry();
    }
  }

  private _maybeSubscribeRegistry(): void {
    // Only device mode reads the entity registry (the hint and the entity
    // picker's device-children exclusion). Don't subscribe (and refetch the
    // whole registry on every update) for plain entity cards.
    if (configuredDevices(this._config).length === 0) {
      this._teardownRegistrySubscription();
      return;
    }
    const conn = this.hass?.connection;
    if (!conn || conn === this._subscribedRegistryConn) return;
    this._unsubscribeRegistry?.();
    this._unsubscribeRegistry = undefined;
    this._subscribedRegistryConn = conn;
    subscribeEntityRegistry(conn, (entries) => {
      this._registryEntries = entries;
      this.requestUpdate();
    }).then((unsub) => {
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

  private get _lang(): string {
    return this.hass?.locale?.language || 'en';
  }

  // HA 2026.02 swapped the MWC component system for WebAwesome: `ha-list-item`
  // became `ha-dropdown-item`, and `selected` moved its payload from the target
  // element to `ev.detail`. Emitting only the new form leaves every dropdown in
  // this editor inert on older cores (#239) — the items render as unknown
  // elements and nothing is selectable — so pick the shape from what is
  // actually registered rather than parsing a version string.
  private static _webAwesome?: boolean;

  private get _useWebAwesome(): boolean {
    if (WeatherAlertsCardEditor._webAwesome !== undefined) {
      return WeatherAlertsCardEditor._webAwesome;
    }
    const wa = !!customElements.get('ha-dropdown-item');
    const mwc = !!customElements.get('ha-list-item');
    // Cache only a definite answer. HA lazy-loads components, so on the first
    // render neither element may be defined yet; caching that guess would pin
    // the editor to the wrong system for the whole session. While it's still
    // ambiguous, assume current HA and re-check on the next render — `hass`
    // updates land continually, so the window is short.
    if (wa || mwc) {
      WeatherAlertsCardEditor._webAwesome = wa;
      return wa;
    }
    return true;
  }

  // MWC fires `selected` with `detail: { index }` — a detail object, but no
  // `value` — so this reads through to the target rather than testing `detail`
  // for existence.
  private _selectValue(ev: Event): string {
    const detail = (ev as CustomEvent).detail as { value?: string } | undefined;
    return detail?.value ?? (ev.target as HTMLSelectElement | null)?.value ?? '';
  }

  private _renderSelectItem(value: string, label: string): TemplateResult {
    return this._useWebAwesome
      ? html`<ha-dropdown-item value=${value}>${label}</ha-dropdown-item>`
      : html`<ha-list-item value=${value}>${label}</ha-list-item>`;
  }

  // The same swap took `ha-textfield` away: HA 2026.09 no longer defines it at
  // all, so on a current core every text field rendered as nothing. `ha-input`
  // (the WebAwesome wrapper `ha-selector-text` renders) is its replacement.
  // Detected on its own rather than through `_webAwesome`: the two elements
  // need not have changed hands in the same release. Same caching rule.
  private static _haInput?: boolean;

  private get _useHaInput(): boolean {
    if (WeatherAlertsCardEditor._haInput !== undefined) {
      return WeatherAlertsCardEditor._haInput;
    }
    const input = !!customElements.get('ha-input');
    const textfield = !!customElements.get('ha-textfield');
    if (input || textfield) {
      WeatherAlertsCardEditor._haInput = input;
      return input;
    }
    return true;
  }

  // One text field, whichever element this core registers. Both read back
  // through `ev.target.value` on `change`; only the helper differs (`.hint` on
  // ha-input, `.helper` + persistent on ha-textfield).
  private _renderTextField(o: {
    label: string;
    value: string;
    helper?: string;
    type?: 'number';
    min?: string;
    step?: string;
    changed?: boolean;
    onChange: (ev: Event) => void;
    onReset?: () => void;
  }): TemplateResult {
    return this._field(o.changed === true, this._useHaInput ? html`
        <ha-input
          .label=${o.label}
          .value=${o.value}
          .hint=${o.helper ?? ''}
          type=${ifDefined(o.type)}
          min=${ifDefined(o.min)}
          step=${ifDefined(o.step)}
          @change=${o.onChange}
        ></ha-input>
      ` : html`
        <ha-textfield
          .label=${o.label}
          .value=${o.value}
          .helper=${o.helper ?? ''}
          .helperPersistent=${o.helper !== undefined}
          type=${ifDefined(o.type)}
          min=${ifDefined(o.min)}
          step=${ifDefined(o.step)}
          @change=${o.onChange}
        ></ha-textfield>
      `, o.onReset);
  }

  public setConfig(config: WeatherAlertsCardConfig): void {
    // `colorTheme: eccc` implies providerColors; make it explicit so the
    // toggle reads on and the key rides along on the next write.
    this._config = normalizeColorConfig(config);
    this._showPreview = !!config._preview;
  }

  private _fireConfigChanged(newConfig: WeatherAlertsCardConfig): void {
    this._config = newConfig;
    const event = new CustomEvent('config-changed', {
      detail: { config: newConfig },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  private _cachedHass?: HomeAssistant;
  private _cachedConfigKey?: string;
  private _cachedEntityIds?: string[];

  private _getMatchingEntityIds(): string[] {
    // Cache is keyed on hass identity, the configured entity set AND the
    // configured device set: editing config while hass is unchanged must still
    // surface a newly configured entity, or drop a newly selected device's
    // children, from the list.
    const devices = configuredDevices(this._config);
    const configKey = [...this._getSelectedEntities(), ...devices.map(d => `device:${d}`)].join(',');
    if (this._cachedHass === this.hass && this._cachedConfigKey === configKey && this._cachedEntityIds) {
      return this._cachedEntityIds;
    }
    this._cachedHass = this.hass;
    this._cachedConfigKey = configKey;
    // A selected device's per-alert children pass canHandleAny too, so without
    // this they would churn through the entity list as alerts come and go —
    // and hand-picking one there only duplicates what the device already
    // collects. Keep them out; the device selector owns them.
    const deviceChildren = new Set<string>();
    for (const d of devices) {
      for (const id of deviceEntityIds(this.hass, d, this._registryEntries)) deviceChildren.add(id);
    }
    const ids: string[] = [];
    for (const [id, entity] of Object.entries(this.hass.states)) {
      // geo_location.* is admitted for per-incident providers (NSW RFS); the
      // canHandleAny test below keeps it provider-specific (no broad name pattern).
      if (!id.startsWith('sensor.') && !id.startsWith('binary_sensor.') && !id.startsWith('geo_location.')) continue;
      if (deviceChildren.has(id)) continue;
      if (ENTITY_NAME_PATTERNS.some(p => p.test(id)) || canHandleAny(entity.attributes)) {
        ids.push(id);
      }
    }
    // Always include currently configured entities so they remain visible
    if (this._config?.entity && !ids.includes(this._config.entity)) {
      ids.push(this._config.entity);
    }
    if (this._config?.entities) {
      for (const id of this._config.entities) {
        if (id && !ids.includes(id)) ids.push(id);
      }
    }
    this._cachedEntityIds = ids;
    return ids;
  }

  private _getSelectedEntities(): string[] {
    const result: string[] = [];
    if (this._config?.entity) result.push(this._config.entity);
    if (this._config?.entities) {
      for (const id of this._config.entities) {
        if (id && !result.includes(id)) result.push(id);
      }
    }
    return result;
  }

  /** True when all configured entities have zero active alerts (auto-preview will kick in).
   *  Returns false if no entities are configured, none resolve, or any are unavailable/unknown. */
  private _hasNoRealAlerts(): boolean {
    if (!this.hass || !this._config?.entity) return false;
    const allIds = this._getSelectedEntities();
    let resolvedCount = 0;
    for (const id of allIds) {
      const entity = this.hass.states[id];
      if (!entity) continue;
      // Unavailable/unknown means the data source is broken, not "zero alerts"
      if (entity.state === 'unknown' || entity.state === 'unavailable') return false;
      resolvedCount++;
      if (entity.state !== '0' && entity.state !== 'off') {
        return false;
      }
    }
    return resolvedCount > 0;
  }

  private _isEntityMismatch(): boolean {
    if (!this._config?.entity) return false;
    const stateObj = this.hass?.states[this._config.entity];
    if (!stateObj) return false;
    if (ENTITY_NAME_PATTERNS.some(p => p.test(this._config.entity))) return false;
    return !canHandleAny(stateObj.attributes);
  }

  private _renderEntityWarning(lang: string): TemplateResult | typeof nothing {
    if (!this._isEntityMismatch()) return nothing;
    return html`<ha-alert alert-type="warning">${t('editor.entity_warning', lang)}</ha-alert>`;
  }

  private _renderNoEntitiesHint(lang: string): TemplateResult | typeof nothing {
    // Device-mode. Two signals, aggregated over every configured device:
    //   - a device id the registry no longer knows (integration removed, entry
    //     recreated) warns by id, like a feed with no live entities does —
    //     otherwise it silently drops the card to preview, and with a list that
    //     is easy to miss. Only judged when the device registry is present.
    //   - the "no alerts yet" hint shows only when EVERY device resolves to
    //     zero, so one quiet device beside a busy one is not flagged.
    const devices = configuredDevices(this._config);
    if (devices.length > 0 && this.hass) {
      const registry = this.hass.devices;
      const missing = registry ? devices.filter(id => !registry[id]) : [];
      const warning = missing.length > 0
        ? html`<ha-alert alert-type="warning"
            >${t('editor.devices_missing_warning', lang, { ids: missing.join(', ') })}</ha-alert
          >`
        : nothing;
      const anyResolved = devices.some(
        id => resolveDeviceAlertEntities(this.hass, id, this._registryEntries).length > 0,
      );
      // Every device gone: the warning already says why nothing resolves.
      if (anyResolved || missing.length === devices.length) return warning;
      return html`${warning}<ha-alert alert-type="info">${t('editor.no_device_alerts_hint', lang)}</ha-alert>`;
    }
    const ids = this._getMatchingEntityIds();
    // The list always includes the configured entity as a fallback;
    // check whether any entry actually exists in HA
    if (ids.some(id => this.hass?.states[id])) return nothing;
    return html`<ha-alert alert-type="info">${t('editor.no_entities_hint', lang)} <a href="https://github.com/seevee/weather_alerts_card#supported-providers" target="_blank" rel="noopener">${t('editor.no_entities_hint_link', lang)}</a></ha-alert>`;
  }

  // Source-mode (per-incident feed providers, e.g. NSW RFS): the card collects
  // incidents automatically by feed `source`, so the entity picker is optional
  // and left empty. Surface how many incidents are currently matched so the
  // user sees the wiring is live even though they listed nothing.
  private _renderSourceHint(lang: string): TemplateResult | typeof nothing {
    const sources = this._config?.sources;
    if (!sources || sources.length === 0 || !this.hass) return nothing;
    const sourceSet = new Set(sources);
    // Which configured sources currently have at least one entity present?
    const present = new Set<string>();
    let count = 0;
    for (const s of Object.values(this.hass.states)) {
      const src = s.attributes?.source;
      if (typeof src === 'string' && sourceSet.has(src)) {
        present.add(src);
        count++;
      }
    }
    // A configured source with no live entities means the feed's integration
    // isn't installed (or is currently producing nothing). Warn — the checkbox
    // alone doesn't reveal that the data source is missing.
    const missing = sources.filter(s => !present.has(s));
    if (missing.length > 0) {
      const labels = knownFeedSources();
      const names = missing.map(s => {
        const match = labels.find(f => f.source === s);
        return match ? t(`editor.provider_${match.provider}`, lang) : s;
      });
      return html`<ha-alert alert-type="warning"
        >${t('editor.feeds_missing_warning', lang, { feeds: names.join(', ') })}</ha-alert
      >`;
    }
    return html`<ha-alert alert-type="info">${t('editor.source_hint', lang, { count })}</ha-alert>`;
  }

  private _entityChanged(ev: CustomEvent): void {
    const value = ev.detail.value;
    // ha-selector with multiple: true returns string[]
    const selected: string[] = Array.isArray(value) ? value : (value ? [value] : []);
    const newConfig: WeatherAlertsCardConfig = { ...this._config };

    // entity = first selected (backwards compat); entities = rest
    newConfig.entity = selected[0] || '';
    if (selected.length > 1) {
      newConfig.entities = selected.slice(1);
    } else {
      delete newConfig.entities;
    }

    if (newConfig.hideNoAlerts) {
      const visibility = this._syncMultiEntityVisibility(newConfig);
      if (visibility) {
        newConfig.visibility = visibility;
      } else {
        delete newConfig.visibility;
      }
    }
    this._fireConfigChanged(newConfig);
  }

  private _deviceChanged(ev: CustomEvent): void {
    const value = ev.detail.value;
    // ha-selector with multiple: true returns string[]
    const raw: unknown[] = Array.isArray(value) ? value : (value ? [value] : []);
    const selected: string[] = [];
    for (const v of raw) {
      if (typeof v === 'string' && v && !selected.includes(v)) selected.push(v);
    }
    const current = configuredDevices(this._config);
    if (selected.length === current.length && selected.every((id, i) => id === current[i])) return;
    const newConfig: WeatherAlertsCardConfig = { ...this._config };

    // Mirrors _entityChanged: device = first selected (a one-device config
    // stays byte-identical to before `devices` existed); devices = the rest.
    if (selected.length > 0) {
      newConfig.device = selected[0];
    } else {
      delete newConfig.device;
    }
    if (selected.length > 1) {
      newConfig.devices = selected.slice(1);
    } else {
      delete newConfig.devices;
    }
    this._fireConfigChanged(newConfig);
  }

  private _titleChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const title = target.value;
    if (title === (this._config.title || '')) return;
    const newConfig = { ...this._config };
    if (title) {
      newConfig.title = title;
    } else {
      delete newConfig.title;
    }
    this._fireConfigChanged(newConfig);
  }

  private _feedsChanged(ev: CustomEvent): void {
    const value = ev.detail.value;
    const selected: string[] = Array.isArray(value) ? value : (value ? [value] : []);
    const newConfig = { ...this._config };
    if (selected.length > 0) {
      newConfig.sources = selected;
    } else {
      delete newConfig.sources;
    }
    this._fireConfigChanged(newConfig);
  }

  private _myLocationEntityChanged(ev: CustomEvent): void {
    const raw = ev.detail?.value;
    const value = typeof raw === 'string' ? raw.trim() : '';
    if (value === (this._config.myLocationEntity ?? '')) return;
    const newConfig = { ...this._config };
    if (value) {
      newConfig.myLocationEntity = value;
    } else {
      delete newConfig.myLocationEntity;
    }
    this._fireConfigChanged(newConfig);
  }

  /** The reference-point picker matters wherever a reference point is used:
   *  the radius filter measures from it, and the mini-map can mark it. */
  private _showsMyLocationEntityControl(): boolean {
    return this._showsRadiusControl() || this._config?.showGeometry === true;
  }

  private _currentScopeHash(): string {
    // Must match the card's scope exactly (entity + entities + devices), or the
    // restore-all UI reads the wrong storage key. Notably, a device-mode CAP
    // card has no `entity`, so omitting `device` here yields an empty scope and
    // the dismissed-count/restore-all status never appears.
    return scopeHashForConfig(this._config);
  }

  private _getDismissedCount(): number {
    const scope = this._currentScopeHash();
    if (!scope) return 0;
    return loadDismissals(scope).size;
  }

  private _onRestoreAll = (): void => {
    const scope = this._currentScopeHash();
    if (!scope) return;
    restoreAll(scope);
    this.requestUpdate();
  };

  private _hideNoAlertsChanged(ev: Event): void {
    this._setHideNoAlerts((ev.target as HTMLInputElement).checked);
  }

  private _setHideNoAlerts(hide: boolean): void {
    if (hide === (this._config.hideNoAlerts === true)) return;
    const newConfig: WeatherAlertsCardConfig = { ...this._config };
    if (hide) {
      newConfig.hideNoAlerts = true;
    } else {
      delete newConfig.hideNoAlerts;
    }
    // Sync HA's native visibility conditions so the dashboard layout
    // fully removes the card (no residual gap) when there are no alerts.
    const visibility = this._syncMultiEntityVisibility(newConfig);
    if (visibility) {
      newConfig.visibility = visibility;
    } else {
      delete newConfig.visibility;
    }
    this._fireConfigChanged(newConfig);
  }

  private _buildEntityCondition(entity: string): Record<string, unknown> {
    // binary_sensor (MeteoAlarm) uses "on"/"off"; sensors use numeric count "0","1",...
    if (entity.startsWith('binary_sensor.')) {
      return { condition: 'state', entity, state: 'on' };
    }
    return { condition: 'state', entity, state_not: '0' };
  }

  private _isManagedCondition(
    c: Record<string, unknown>,
    managedIds: Set<string>,
  ): boolean {
    // Flat managed condition: scoped to current entity IDs so we don't disturb
    // unrelated user-authored state conditions.
    if (
      c.condition === 'state'
      && typeof c.entity === 'string'
      && managedIds.has(c.entity)
      && ('state_not' in c || 'state' in c)
    ) {
      return true;
    }
    // OR wrapper: matched by shape so stale wrappers (e.g. after entity
    // removal) are also cleaned up on the next sync.
    if (c.condition === 'or' && Array.isArray(c.conditions)) {
      const subs = c.conditions as Record<string, unknown>[];
      return subs.length > 0 && subs.every(sub =>
        sub.condition === 'state'
        && typeof sub.entity === 'string'
        && (
          ('state_not' in sub && sub.state_not === '0')
          || ('state' in sub && sub.state === 'on')
        ),
      );
    }
    return false;
  }

  /**
   * Rebuild visibility conditions for all configured entities (primary + extras).
   * HA combines top-level visibility conditions with AND, so for 2+ entities we
   * wrap per-entity state conditions in an `or` block — otherwise the card
   * would stay hidden unless every entity had alerts.
   */
  private _syncMultiEntityVisibility(
    config: WeatherAlertsCardConfig,
  ): Record<string, unknown>[] | undefined {
    const allIds = new Set<string>();
    if (config.entity) allIds.add(config.entity);
    if (config.entities) config.entities.forEach(id => allIds.add(id));

    const conditions = (config.visibility || []).filter(
      c => !this._isManagedCondition(c, allIds),
    );

    if (config.hideNoAlerts && allIds.size > 0) {
      const perEntity = [...allIds].map(id => this._buildEntityCondition(id));
      if (perEntity.length === 1) {
        conditions.push(perEntity[0]);
      } else {
        conditions.push({ condition: 'or', conditions: perEntity });
      }
    }

    return conditions.length > 0 ? conditions : undefined;
  }

  private _zonesChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const raw = target.value;
    const newConfig = { ...this._config };
    if (raw.trim()) {
      newConfig.zones = raw.split(',').map(z => z.trim()).filter(Boolean);
    } else {
      delete newConfig.zones;
    }
    this._fireConfigChanged(newConfig);
  }

  private _eventCodesChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const raw = target.value;
    const newConfig = { ...this._config };
    if (raw.trim()) {
      newConfig.eventCodes = raw.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    } else {
      delete newConfig.eventCodes;
    }
    this._fireConfigChanged(newConfig);
  }

  private _excludeEventCodesChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const raw = target.value;
    const newConfig = { ...this._config };
    if (raw.trim()) {
      newConfig.excludeEventCodes = raw.split(',').map(c => c.trim().toUpperCase()).filter(Boolean);
    } else {
      delete newConfig.excludeEventCodes;
    }
    this._fireConfigChanged(newConfig);
  }

  // Tap action. `tap_action` is *presence*-based in the card — `{action:'none'}`
  // is an inert row that still replaces the inline expand, which is a different
  // state from "unset". The 'default' sentinel deletes the key (mirrors
  // _writeKey); every other value spreads the existing object so
  // YAML-authored payloads (fire-dom-event `browser_mod`, service `data`,
  // `target`, …) survive an action switch untouched.
  private _tapActionChanged(ev: CustomEvent): void {
    const value = this._selectValue(ev) as string;
    if (value === (this._config.tap_action?.action ?? 'default')) return;
    const newConfig = { ...this._config };
    if (value === 'default') {
      delete newConfig.tap_action;
    } else {
      const next: ActionConfig = {
        ...(newConfig.tap_action ?? {}),
        action: value as ActionConfig['action'],
      };
      // Drop only the sub-keys the incoming action cannot use. Anything else,
      // including `entity` and unknown index-signature keys, is preserved.
      if (value !== 'navigate') delete next.navigation_path;
      if (value !== 'url') delete next.url_path;
      newConfig.tap_action = next;
    }
    this._fireConfigChanged(newConfig);
  }

  private _tapNavigationPathChanged(ev: Event): void {
    this._tapSubFieldChanged('navigation_path', (ev.target as HTMLInputElement).value);
  }

  private _tapUrlPathChanged(ev: Event): void {
    this._tapSubFieldChanged('url_path', (ev.target as HTMLInputElement).value);
  }

  // Shared by the two text sub-fields (mirrors _titleChanged): an empty value
  // clears just that key, never `tap_action` itself.
  private _tapSubFieldChanged(key: 'navigation_path' | 'url_path', value: string): void {
    const current = this._config.tap_action;
    if (!current) return;
    if (value === ((current[key] as string | undefined) || '')) return;
    const next: ActionConfig = { ...current };
    if (value) {
      next[key] = value;
    } else {
      delete next[key];
    }
    this._fireConfigChanged({ ...this._config, tap_action: next });
  }

  // Per-phase progress-bar decoration. On the phase default, delete the phase
  // key and prune an emptied progressStyle object so configs stay minimal
  // (mirrors _writeKey); otherwise write the chosen decoration.
  private _progressStyleChanged(phase: DecoPhase, ev: CustomEvent): void {
    this._setProgressStyle(phase, this._selectValue(ev) as ProgressDecoration);
  }

  private _setProgressStyle(phase: DecoPhase, value: ProgressDecoration): void {
    const current = this._config.progressStyle?.[phase] ?? PROGRESS_DECO_DEFAULTS[phase];
    if (value === current) return;
    const newConfig = { ...this._config };
    const progressStyle: ProgressStyleConfig = { ...(newConfig.progressStyle ?? {}) };
    if (value === PROGRESS_DECO_DEFAULTS[phase]) {
      delete progressStyle[phase];
    } else {
      progressStyle[phase] = value;
    }
    if (Object.keys(progressStyle).length === 0) {
      delete newConfig.progressStyle;
    } else {
      newConfig.progressStyle = progressStyle;
    }
    this._fireConfigChanged(newConfig);
  }

  // Per-phase icon-ring border style; same default-detection / pruning as
  // _progressStyleChanged.
  private _iconBorderStyleChanged(phase: DecoPhase, ev: CustomEvent): void {
    this._setIconBorderStyle(phase, this._selectValue(ev) as IconBorderStyle);
  }

  private _setIconBorderStyle(phase: DecoPhase, value: IconBorderStyle): void {
    const current = this._config.iconBorderStyle?.[phase] ?? ICON_BORDER_DEFAULTS[phase];
    if (value === current) return;
    const newConfig = { ...this._config };
    const iconBorderStyle: IconBorderStyleConfig = { ...(newConfig.iconBorderStyle ?? {}) };
    if (value === ICON_BORDER_DEFAULTS[phase]) {
      delete iconBorderStyle[phase];
    } else {
      iconBorderStyle[phase] = value;
    }
    if (Object.keys(iconBorderStyle).length === 0) {
      delete newConfig.iconBorderStyle;
    } else {
      newConfig.iconBorderStyle = iconBorderStyle;
    }
    this._fireConfigChanged(newConfig);
  }

  /** Display unit for the radius control. km is the fallback for any absent or
   *  unrecognised value, so the widget only switches to miles on a core that
   *  explicitly reports a US-customary length unit. The stored config value is
   *  always km regardless. */
  private _lengthUnit(): LengthUnit {
    return toLengthUnit(this.hass?.config?.unit_system?.length);
  }

  /** Whether to offer the radius control. A permanently inert field in front of
   *  the CAP/NWS majority is worse than a hidden one, and re-resolving devices
   *  + running adapters on every render to know for sure is too expensive — so
   *  gate on declared adapter capability across the ways an RFS-style setup is
   *  expressed, plus "already set" so a YAML-authored value is never orphaned.
   *  Only the *selected* entity ids are probed (no parseAlerts, no device or
   *  source re-resolution). The YAML key works either way. */
  private _showsRadiusControl(): boolean {
    if (this._config?.maxDistanceKm !== undefined) return true;
    const capable = pointCapableProviders();
    if (this._config?.provider && capable.has(this._config.provider)) return true;
    const selectedSources = new Set(this._config?.sources ?? []);
    if (knownFeedSources().some(f => selectedSources.has(f.source) && capable.has(f.provider))) return true;
    // The device selector admits cap_alerts devices only, so a configured
    // device is the CAP adapter by construction — no entity to sniff.
    if ((this._config?.device || (this._config?.devices?.length ?? 0) > 0) && capable.has('cap')) return true;
    for (const id of this._getSelectedEntities()) {
      const state = this.hass?.states[id];
      if (!state) continue;
      if (capable.has(getAdapter(this._config?.provider, state.attributes ?? {}).provider)) return true;
    }
    return false;
  }

  private _maxDistanceChanged(ev: Event): void {
    const raw = (ev.target as HTMLInputElement).value;
    const newConfig = { ...this._config };
    if (raw.trim() === '') {
      if (this._config.maxDistanceKm === undefined) return;
      delete newConfig.maxDistanceKm;
      this._fireConfigChanged(newConfig);
      return;
    }
    const n = Number(raw);
    // Never write an invalid radius, and never clobber the saved one with it.
    if (!Number.isFinite(n) || n <= 0) return;
    const km = displayToKm(n, this._lengthUnit());
    if (km === this._config.maxDistanceKm) return;
    newConfig.maxDistanceKm = km;
    this._fireConfigChanged(newConfig);
  }

  private _previewChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    this._showPreview = target.checked;
    const newConfig = { ...this._config };
    if (this._showPreview) {
      newConfig._preview = true;
    } else {
      delete newConfig._preview;
    }
    this._fireConfigChanged(newConfig);
  }

  // MWC's ha-select renders its menu inside the editor panel's stacking
  // context, so it needs both attributes to escape; WebAwesome's warns on
  // them. A false boolean binding removes the attribute outright.
  private get _legacyMenu(): boolean {
    return !this._useWebAwesome;
  }

  // Write core for every registry key: one `config-changed` when the config
  // identity changes, none otherwise (see `withKey`).
  private _writeKey(key: SimpleKey, value: SimpleValue): void {
    const next = withKey(this._config, key, value);
    if (next !== this._config) this._fireConfigChanged(next);
  }

  // Every control sits in a `.field` row; a customised one carries `changed`,
  // which draws the accent rule in the panel gutter. That is the in-panel
  // half of the header's list of names: open the panel and the rows to look
  // at are marked.
  // A changed row also carries a "Reset to default" link when the caller
  // knows how to reset it, so the rule says where to look and the link says
  // what to do.
  private _field(changed: boolean, control: TemplateResult, onReset?: () => void): TemplateResult {
    return html`
      <div class="field ${changed ? 'changed' : ''}">
        ${control}
        ${changed && onReset ? this._resetLink(onReset) : nothing}
      </div>
    `;
  }

  // Same text-link shape as "Restore all" in the dismissal status line.
  private _resetLink(onReset: () => void): TemplateResult {
    const activate = (ev: Event) => { ev.preventDefault(); onReset(); };
    return html`
      <a
        class="reset-link"
        role="button"
        tabindex="0"
        @click=${activate}
        @keydown=${(ev: KeyboardEvent) => { if (ev.key === 'Enter' || ev.key === ' ') activate(ev); }}
      >${t('editor.reset_default', this._lang)}</a>
    `;
  }

  // Reset core: registry keys go back through `withKey` to their default,
  // bespoke keys are deleted. One event for the lot, none when nothing
  // changed. `hideNoAlerts` is the exception (visibility sync) and resets
  // through `_setHideNoAlerts`.
  private _resetKeys(keys: readonly (keyof WeatherAlertsCardConfig)[]): void {
    let next = this._config;
    for (const key of keys) {
      if (key in FIELDS) {
        next = withKey(next, key as SimpleKey, FIELDS[key as SimpleKey].default);
      } else if (next[key] !== undefined) {
        next = { ...next };
        delete next[key];
      }
    }
    if (next !== this._config) this._fireConfigChanged(next);
  }

  // The keys a master hides while it is off are inert but still saved. Name
  // them under the master so the header's words have a row to land on, with
  // one link that clears them all.
  private _renderAlsoSet(keys: readonly (keyof WeatherAlertsCardConfig)[], lang: string): TemplateResult | typeof nothing {
    const hidden = changedKeys(this._config, keys);
    if (hidden.length === 0) return nothing;
    const names = hidden.map(k => this._keyLabel(k, lang)).join(' · ');
    return html`
      <div class="also-set">
        ${t('editor.also_set', lang, { names })}
        ${this._resetLink(() => this._resetKeys(hidden))}
      </div>
    `;
  }

  // Menu entry label, with the default one saying so. Labels whose key ends
  // in `_default` already name themselves ("Default", "Inline expand
  // (default)") and are left alone.
  private _optionLabel(labelKey: string, isDefault: boolean, lang: string): string {
    const label = t(labelKey, lang);
    return isDefault && !labelKey.endsWith('_default')
      ? t('editor.option_default', lang, { label })
      : label;
  }

  private _renderToggle(key: ToggleKey): TemplateResult {
    const field = TOGGLES[key];
    return this._field(isChanged(this._config, key), html`
      <ha-formfield .label=${t(field.label, this._lang)}>
        <ha-switch
          .checked=${isOn(this._config, field)}
          @change=${(ev: Event) => this._writeKey(key, (ev.target as HTMLInputElement).checked ? field.on : field.off)}
        ></ha-switch>
      </ha-formfield>
    `, () => this._resetKeys([key]));
  }

  private _renderSelect(key: SelectKey): TemplateResult {
    const field = SELECTS[key];
    const lang = this._lang;
    return this._field(isChanged(this._config, key), html`
      <ha-select
        .label=${t(field.label, lang)}
        .value=${effectiveValue(this._config, key)}
        @selected=${(ev: CustomEvent) => this._writeKey(key, this._selectValue(ev))}
        ?fixedMenuPosition=${this._legacyMenu}
        ?naturalMenuWidth=${this._legacyMenu}
      >
        ${field.options.map(o => this._renderSelectItem(o.value, this._optionLabel(o.label, o.value === field.default, lang)))}
      </ha-select>
    `, () => this._resetKeys([key]));
  }

  /** The header-ready name of a config key: the registry label, or the
   *  bespoke map's, minus any trailing parenthetical. */
  private _keyLabel(key: keyof WeatherAlertsCardConfig, lang: string): string {
    const labelKey = key in FIELDS ? FIELDS[key as SimpleKey].label : BESPOKE_LABELS[key];
    return shortLabel(labelKey ? t(labelKey, lang, { unit: '' }) : String(key));
  }

  // Collapsed-panel secondary line: the customised keys by name, up to three,
  // then "+n more". Empty when nothing is customised.
  private _changedSummary(keys: readonly (keyof WeatherAlertsCardConfig)[], lang: string): string {
    const changed = changedKeys(this._config, keys);
    if (changed.length === 0) return '';
    const shown = changed.slice(0, 3).map(k => this._keyLabel(k, lang));
    const more = changed.length - shown.length;
    return more > 0
      ? `${shown.join(' · ')} ${t('editor.panel_more', lang, { count: more })}`
      : shown.join(' · ');
  }

  // Each panel binds `.header` / `.secondary` as properties rather than
  // slotting a heading: ha-expansion-panel renders the secondary line as
  // fallback content *inside* the header slot, so a slotted header would drop
  // the count. `.expanded` is a constant per panel — Lit never re-commits an
  // unchanged binding — so the element owns its open/closed state across
  // re-renders and the editor tracks nothing. Source carries no summary: its
  // keys are the configuration, not a deviation from defaults.
  private _renderPanel(panel: Panel, expanded: boolean, lang: string, content: TemplateResult): TemplateResult {
    return html`
      <ha-expansion-panel
        outlined
        .expanded=${expanded}
        .header=${t(PANEL_LABELS[panel], lang)}
        .secondary=${panel === 'source' ? '' : this._changedSummary(PANELS[panel], lang)}
      >
        <div class="content">${content}</div>
      </ha-expansion-panel>
    `;
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) return html``;
    const lang = this._lang;
    // The preview switch is a tool, not a setting: it stays above the panels.
    return html`
      <div class="editor">
        ${this._renderPreviewTools(lang)}
        ${this._renderPanel('source', true, lang, this._renderSourceSection(lang))}
        ${this._renderPanel('filtering', false, lang, this._renderFilteringSection(lang))}
        ${this._renderPanel('appearance', false, lang, this._renderAppearanceSection(lang))}
        ${this._renderPanel('details', false, lang, this._renderDetailsSection(lang))}
        ${this._renderPanel('behavior', false, lang, this._renderBehaviorSection(lang))}
        ${this._renderPanel('dismissal', false, lang, this._renderDismissalSection(lang))}
        ${this._renderPanel('advanced', false, lang, this._renderAdvancedSection(lang))}
      </div>
    `;
  }

  private _renderPreviewTools(lang: string): TemplateResult {
    return html`
      <div class="preview-tools">
        <ha-formfield .label=${t('editor.show_preview', lang)}>
          <ha-switch
            .checked=${this._showPreview}
            @change=${this._previewChanged}
          ></ha-switch>
        </ha-formfield>
        ${this._hasNoRealAlerts() && !this._showPreview
          ? html`<div class="preview-nudge">${t('editor.preview_nudge', lang)}</div>`
          : html`<div class="preview-hint">${t('editor.preview_hint', lang)}</div>`}
      </div>
    `;
  }

  private _renderSourceSection(lang: string): TemplateResult {
    // Per-incident feeds a user can auto-collect (currently NSW RFS), labelled
    // by the provider that parses them. Independent of the provider override.
    // Only offer a feed whose integration is actually present in this HA — i.e.
    // at least one entity currently carries that `source` — so the option only
    // appears *because* the integration is installed, never implying the card
    // itself is the data source. A feed already saved in `sources` stays listed
    // even while quiet (empty fire feed) so its checkbox isn't lost.
    const presentSources = new Set<string>();
    for (const s of Object.values(this.hass.states)) {
      const src = s.attributes?.source;
      if (typeof src === 'string') presentSources.add(src);
    }
    const selectedSources = new Set(this._config.sources ?? []);
    const feedOptions = knownFeedSources()
      .filter(f => presentSources.has(f.source) || selectedSources.has(f.source))
      .map(f => ({
        value: f.source,
        label: t(`editor.provider_${f.provider}`, lang),
      }));

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{ entity: { multiple: true, include_entities: this._getMatchingEntityIds() } }}
        .value=${this._getSelectedEntities()}
        .label=${t('editor.entities', lang)}
        .required=${!configuredDevices(this._config).length && !this._config?.sources?.length}
        @value-changed=${this._entityChanged}
      ></ha-selector>
      ${this._renderEntityWarning(lang)}
      ${this._renderNoEntitiesHint(lang)}

      <ha-selector
        .hass=${this.hass}
        .selector=${{
          device: {
            multiple: true,
            // Every integration that publishes one alert per entity under a
            // device. cap_alerts is the general case; NINA is the built-in
            // one the docs already send users here for.
            filter: [{ integration: 'cap_alerts' }, { integration: 'nina' }],
          },
        }}
        .value=${configuredDevices(this._config)}
        .label=${t('editor.devices', lang)}
        .helper=${t('editor.devices_helper', lang)}
        .helperPersistent=${true}
        @value-changed=${this._deviceChanged}
      ></ha-selector>

      ${feedOptions.length > 0
        ? html`
            <ha-selector
              .hass=${this.hass}
              .selector=${{ select: { multiple: true, mode: 'list', options: feedOptions } }}
              .value=${this._config.sources || []}
              .label=${t('editor.feeds', lang)}
              .helper=${t('editor.feeds_helper', lang)}
              .helperPersistent=${true}
              @value-changed=${this._feedsChanged}
            ></ha-selector>
            ${this._renderSourceHint(lang)}
          `
        : nothing}

      ${this._renderTextField({
        label: t('editor.title', lang),
        value: this._config.title || '',
        onChange: this._titleChanged,
      })}
    `;
  }

  private _renderFilteringSection(lang: string): TemplateResult {
    const unit = this._lengthUnit();
    const zonesStr = this._config.zones ? this._config.zones.join(', ') : '';
    const eventCodesStr = this._config.eventCodes ? this._config.eventCodes.join(', ') : '';
    const excludeEventCodesStr = this._config.excludeEventCodes ? this._config.excludeEventCodes.join(', ') : '';

    return html`
      ${this._renderTextField({
        label: t('editor.zones', lang),
        changed: this._config.zones !== undefined,
        onReset: () => this._resetKeys(['zones']),
        value: zonesStr,
        helper: t('editor.zones_helper', lang),
        onChange: this._zonesChanged,
      })}
      ${this._renderTextField({
        label: t('editor.event_codes', lang),
        changed: this._config.eventCodes !== undefined,
        onReset: () => this._resetKeys(['eventCodes']),
        value: eventCodesStr,
        helper: t('editor.event_codes_helper', lang),
        onChange: this._eventCodesChanged,
      })}
      ${this._renderTextField({
        label: t('editor.exclude_event_codes', lang),
        changed: this._config.excludeEventCodes !== undefined,
        onReset: () => this._resetKeys(['excludeEventCodes']),
        value: excludeEventCodesStr,
        helper: t('editor.exclude_event_codes_helper', lang),
        onChange: this._excludeEventCodesChanged,
      })}

      ${this._renderSelect('minSeverity')}

      ${this._showsRadiusControl() ? this._renderTextField({
        type: 'number',
        min: '1',
        step: '1',
        label: t('editor.max_distance', lang, { unit }),
        changed: this._config.maxDistanceKm !== undefined,
        onReset: () => this._resetKeys(['maxDistanceKm']),
        value: this._config.maxDistanceKm !== undefined ? String(kmToDisplay(this._config.maxDistanceKm, unit)) : '',
        helper: t('editor.max_distance_helper', lang),
        onChange: this._maxDistanceChanged,
      }) : nothing}

      ${this._showsMyLocationEntityControl() ? this._field(this._config.myLocationEntity !== undefined, html`
        <ha-selector
          .hass=${this.hass}
          .selector=${{ entity: { domain: ['device_tracker', 'person', 'zone'] } }}
          .value=${this._config.myLocationEntity || ''}
          .label=${t('editor.my_location_entity', lang)}
          .required=${false}
          .helper=${t('editor.my_location_entity_helper', lang)}
          .helperPersistent=${true}
          @value-changed=${this._myLocationEntityChanged}
        ></ha-selector>
      `, () => this._resetKeys(['myLocationEntity'])) : nothing}
    `;
  }

  private _renderAppearanceSection(lang: string): TemplateResult {
    return html`
      ${this._renderToggle('layout')}
      ${this._renderSelect('colorTheme')}
      ${this._renderToggle('providerColors')}
      ${this._renderSelect('fontSize')}
      ${this._renderToggle('showProvider')}
      ${this._renderToggle('animations')}
      ${this._renderStylingGroup(lang)}
    `;
  }

  // Per-phase progress/icon styling: power-user knobs with good defaults, in a
  // nested (not outlined) panel so they cost one row until opened.
  private _renderStylingGroup(lang: string): TemplateResult {
    const legacyMenu = this._legacyMenu;
    return html`
      <ha-expansion-panel
        .expanded=${false}
        .header=${t('editor.styling_section', lang)}
        .secondary=${this._changedSummary(STYLING_KEYS, lang)}
      >
        <div class="content">
          ${this._renderSelect('progressFill')}

          <div class="sub-label">${t('editor.progress_style', lang)}</div>
          ${this._config.progressFill === 'background'
            ? html`<div class="preview-hint">${t('editor.progress_style_wash_note', lang)}</div>`
            : nothing}
          <div class="phase-row">
            ${(['preparation', 'active', 'ongoing'] as DecoPhase[]).map(phase => this._field(this._config.progressStyle?.[phase] !== undefined, html`
              <ha-select
                .label=${t('editor.progress_style_' + phase, lang)}
                .value=${this._config.progressStyle?.[phase] || PROGRESS_DECO_DEFAULTS[phase]}
                @selected=${(ev: CustomEvent) => this._progressStyleChanged(phase, ev)}
                ?fixedMenuPosition=${legacyMenu}
                ?naturalMenuWidth=${legacyMenu}
              >
                ${(['solid', 'striped', 'shimmer', 'pulse'] as ProgressDecoration[]).map(v =>
                  this._renderSelectItem(v, this._optionLabel('editor.deco_' + v, v === PROGRESS_DECO_DEFAULTS[phase], lang)))}
              </ha-select>
            `, () => this._setProgressStyle(phase, PROGRESS_DECO_DEFAULTS[phase])))}
          </div>

          <div class="sub-label">${t('editor.icon_border_style', lang)}</div>
          <div class="phase-row">
            ${(['preparation', 'active', 'ongoing'] as DecoPhase[]).map(phase => this._field(this._config.iconBorderStyle?.[phase] !== undefined, html`
              <ha-select
                .label=${t('editor.progress_style_' + phase, lang)}
                .value=${this._config.iconBorderStyle?.[phase] || ICON_BORDER_DEFAULTS[phase]}
                @selected=${(ev: CustomEvent) => this._iconBorderStyleChanged(phase, ev)}
                ?fixedMenuPosition=${legacyMenu}
                ?naturalMenuWidth=${legacyMenu}
              >
                ${(['dashed', 'solid'] as IconBorderStyle[]).map(v =>
                  this._renderSelectItem(v, this._optionLabel('editor.icon_border_' + v, v === ICON_BORDER_DEFAULTS[phase], lang)))}
              </ha-select>
            `, () => this._setIconBorderStyle(phase, ICON_BORDER_DEFAULTS[phase])))}
          </div>
        </div>
      </ha-expansion-panel>
    `;
  }

  // Dependents are hidden, not disabled, while the detail panel is off: a
  // saved-but-hidden key (e.g. `showGeometry: true` under `showDetails:
  // false`) keeps counting in the panel header and comes back when the master
  // is switched on.
  private _renderDetailsSection(lang: string): TemplateResult {
    if (this._config.showDetails === false) {
      return html`
        ${this._renderToggle('showDetails')}
        ${this._renderAlsoSet(PANELS.details.filter(k => k !== 'showDetails'), lang)}
      `;
    }
    // List options own their row markup, so a customised section is marked
    // in its label instead of with the gutter rule.
    const options = DETAIL_SECTIONS.map(key => ({
      value: key,
      label: t(TOGGLES[key].label, lang) + (isChanged(this._config, key) ? ' •' : ''),
    }));
    return html`
      ${this._renderToggle('showDetails')}
      ${this._renderToggle('expandDetails')}

      <ha-selector
        .hass=${this.hass}
        .selector=${{ select: { multiple: true, mode: 'list', options } }}
        .value=${DETAIL_SECTIONS.filter(key => isOn(this._config, TOGGLES[key]))}
        .label=${t('editor.detail_sections', lang)}
        @value-changed=${this._detailSectionsChanged}
      ></ha-selector>

      ${this._config.showGeometry === true ? html`
        ${this._renderSelect('geometryStyle')}
        ${this._renderToggle('showMyLocation')}
      ` : this._renderAlsoSet(['geometryStyle', 'showMyLocation'], lang)}
    `;
  }

  // One click on the sections list is one event: fold `withKey` over the five
  // keys, so a section switched off deletes or writes exactly its own key.
  private _detailSectionsChanged(ev: CustomEvent): void {
    const raw = ev.detail?.value;
    const selected = new Set<string>(Array.isArray(raw) ? raw : []);
    let next = this._config;
    for (const key of DETAIL_SECTIONS) next = withKey(next, key, selected.has(key));
    if (next !== this._config) this._fireConfigChanged(next);
  }

  private _renderBehaviorSection(lang: string): TemplateResult {
    return html`
      ${this._renderTapAction(lang)}

      ${this._renderSelect('sortOrder')}
      ${this._renderToggle('hideExpired')}

      ${this._field(this._config.hideNoAlerts !== undefined, html`
        <ha-formfield .label=${t('editor.hide_no_alerts', lang)}>
          <ha-switch
            .checked=${this._config.hideNoAlerts === true}
            @change=${this._hideNoAlertsChanged}
          ></ha-switch>
        </ha-formfield>
      `, () => this._setHideNoAlerts(false))}

      ${this._renderSelect('unavailableBehavior')}
      ${this._config.unavailableBehavior === 'hide'
        ? html`<ha-alert alert-type="warning">${t('editor.unavailable_hide_warning', lang)}</ha-alert>`
        : ''}
    `;
  }

  private _renderTapAction(lang: string): TemplateResult {
    const legacyMenu = this._legacyMenu;
    const action = this._config.tap_action?.action;
    return this._field(this._config.tap_action !== undefined, html`
      <ha-select
        .label=${t('editor.tap_action', lang)}
        .value=${action ?? 'default'}
        @selected=${this._tapActionChanged}
        ?fixedMenuPosition=${legacyMenu}
        ?naturalMenuWidth=${legacyMenu}
      >
        ${this._renderSelectItem('default', t('editor.tap_default', lang))}
        ${this._renderSelectItem('details', t('editor.tap_details', lang))}
        ${this._renderSelectItem('more-info', t('editor.tap_more_info', lang))}
        ${this._renderSelectItem('navigate', t('editor.tap_navigate', lang))}
        ${this._renderSelectItem('url', t('editor.tap_url', lang))}
        ${this._renderSelectItem('toggle', t('editor.tap_toggle', lang))}
        ${this._renderSelectItem('perform-action', t('editor.tap_perform_action', lang))}
        ${this._renderSelectItem('fire-dom-event', t('editor.tap_fire_dom_event', lang))}
        ${action === 'call-service'
          ? this._renderSelectItem('call-service', t('editor.tap_call_service', lang))
          : ''}
        ${this._renderSelectItem('none', t('editor.tap_none', lang))}
      </ha-select>
      <div class="helper-text">${t('editor.tap_action_helper', lang)}</div>
      ${action === 'navigate'
        ? this._renderTextField({
            label: t('editor.tap_navigation_path', lang),
            value: this._config.tap_action?.navigation_path || '',
            onChange: this._tapNavigationPathChanged,
          })
        : ''}
      ${action === 'url'
        ? this._renderTextField({
            label: t('editor.tap_url_path', lang),
            value: this._config.tap_action?.url_path || '',
            onChange: this._tapUrlPathChanged,
          })
        : ''}
      ${action === 'perform-action' || action === 'call-service' || action === 'fire-dom-event'
        ? html`<ha-alert alert-type="info">${t('editor.tap_yaml_managed', lang)}</ha-alert>`
        : ''}
      ${action === 'details' && this._config.expandDetails !== true
        ? html`<ha-alert alert-type="info">${t('editor.tap_details_expand_hint', lang)}</ha-alert>`
        : ''}
    `, () => this._resetKeys(['tap_action']));
  }

  private _renderDismissalSection(lang: string): TemplateResult {
    const allow = this._config.allowDismiss === true;
    return html`
      ${this._renderToggle('allowDismiss')}

      ${allow ? html`
        ${this._renderSelect('dismissTrigger')}
        ${this._config.dismissTrigger !== 'swipe'
          ? this._renderSelect('dismissButtonStyle')
          : this._renderAlsoSet(['dismissButtonStyle'], lang)}
        ${this._renderToggle('showDismissUndo')}
      ` : this._renderAlsoSet(PANELS.dismissal.filter(k => k !== 'allowDismiss'), lang)}

      ${this._renderDismissedStatus(lang)}
    `;
  }

  private _renderAdvancedSection(lang: string): TemplateResult {
    return html`
      ${this._renderSelect('provider')}
      ${this._renderSelect('timezone')}
      ${this._renderSelect('enhanceContrast')}
      ${this._renderToggle('reformatText')}
      ${this._renderToggle('deduplicate')}
      ${this._renderToggle('deduplicateHeadlines')}
    `;
  }

  private _renderDismissedStatus(lang: string): TemplateResult | typeof nothing {
    if (this._config.allowDismiss !== true) return nothing;
    const count = this._getDismissedCount();
    if (count === 0) return nothing;
    const key = count === 1 ? 'editor.dismissed_count_singular' : 'editor.dismissed_count';
    return html`
      <div class="dismissed-status">
        ${t(key, lang, { count })}
        <a class="restore-link" @click=${this._onRestoreAll} tabindex="0" role="button">
          ${t('editor.restore_all', lang)}
        </a>
      </div>
    `;
  }

  static styles = css`
    .editor {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 16px 0;
    }
    ha-expansion-panel {
      --expansion-panel-content-padding: 0;
    }
    /* Panel body: the ha-form expandable convention. */
    .content {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding: 12px;
    }
    /* A customised control: accent rule in the panel gutter, content edge
       unchanged. Position and shape, not a new color. */
    .field {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-left: -11px;
      padding-left: 8px;
      border-left: 3px solid transparent;
    }
    .field.changed {
      border-left-color: var(--primary-color);
    }
    /* Sub-heading inside the styling group. */
    .sub-label {
      font-size: 0.75rem;
      color: var(--secondary-text-color);
      margin-top: 4px;
    }
    /* Three phase selects on one row; wrap to stacked on a narrow panel. */
    .phase-row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .phase-row ha-select {
      flex: 1 1 110px;
      min-width: 110px;
    }
    .preview-hint,
    .preview-nudge {
      font-size: 0.8rem;
      color: var(--secondary-text-color);
      padding-left: 48px;
      margin-top: 4px;
    }
    .preview-hint {
      opacity: 0.7;
    }
    .dismissed-status {
      font-size: 0.85rem;
      color: var(--secondary-text-color);
      padding-left: 48px;
    }
    .helper-text {
      font-size: 0.8rem;
      color: var(--secondary-text-color);
      margin-top: 4px;
    }
    .restore-link,
    .reset-link {
      color: var(--primary-color);
      cursor: pointer;
      text-decoration: underline;
      margin-left: 4px;
    }
    .restore-link:hover,
    .reset-link:hover {
      text-decoration: none;
    }
    /* Under a changed row: pulled up into the row's gap, right-aligned. */
    .field > .reset-link {
      align-self: flex-end;
      font-size: 0.8rem;
      margin: -8px 0 0;
    }
    /* Hidden-but-set dependents named under their master switch. */
    .also-set {
      font-size: 0.8rem;
      color: var(--secondary-text-color);
      padding-left: 48px;
      margin-top: -8px;
    }
  `;
}

declare global {
  interface HTMLElementTagNameMap {
    'weather-alerts-card-editor': WeatherAlertsCardEditor;
  }
}
