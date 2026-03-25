import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, WeatherAlertsCardConfig, AlertSeverity } from './types';
import { t } from './localize';

@customElement('weather-alerts-card-editor')
export class WeatherAlertsCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: WeatherAlertsCardConfig;
  @state() private _showPreview = false;
  private get _lang(): string {
    return this.hass?.locale?.language || 'en';
  }

  public setConfig(config: WeatherAlertsCardConfig): void {
    this._config = config;
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

  private _entityChanged(ev: CustomEvent): void {
    const entity = ev.detail.value as string;
    if (entity === this._config.entity) return;
    this._fireConfigChanged({ ...this._config, entity });
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

  private _providerChanged(ev: CustomEvent): void {
    const value = ev.detail.value as string;
    if (value === (this._config.provider || 'auto')) return;
    const newConfig = { ...this._config };
    if (value === 'auto') {
      delete newConfig.provider;
    } else {
      newConfig.provider = value as 'nws' | 'bom' | 'meteoalarm' | 'pirateweather';
    }
    this._fireConfigChanged(newConfig);
  }

  private _animationsChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const animations = target.checked;
    if (animations === (this._config.animations !== false)) return;
    const newConfig = { ...this._config };
    if (animations) {
      delete newConfig.animations;
    } else {
      newConfig.animations = false;
    }
    this._fireConfigChanged(newConfig);
  }

  private _deduplicateChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const deduplicate = target.checked;
    if (deduplicate === (this._config.deduplicate !== false)) return;
    const newConfig = { ...this._config };
    if (deduplicate) {
      delete newConfig.deduplicate;
    } else {
      newConfig.deduplicate = false;
    }
    this._fireConfigChanged(newConfig);
  }

  private _layoutChanged(ev: Event): void {
    const target = ev.target as HTMLInputElement;
    const compact = target.checked;
    if (compact === (this._config.layout === 'compact')) return;
    const newConfig = { ...this._config };
    if (compact) {
      newConfig.layout = 'compact';
    } else {
      delete newConfig.layout;
    }
    this._fireConfigChanged(newConfig);
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

  private _sortOrderChanged(ev: CustomEvent): void {
    const value = ev.detail.value as 'default' | 'onset' | 'severity';
    if (value === (this._config.sortOrder || 'default')) return;
    const newConfig = { ...this._config };
    if (value === 'default') {
      delete newConfig.sortOrder;
    } else {
      newConfig.sortOrder = value;
    }
    this._fireConfigChanged(newConfig);
  }

  private _colorThemeChanged(ev: CustomEvent): void {
    const value = ev.detail.value as 'severity' | 'nws';
    if (value === (this._config.colorTheme || 'severity')) return;
    const newConfig = { ...this._config };
    if (value === 'severity') {
      delete newConfig.colorTheme;
    } else {
      newConfig.colorTheme = value;
    }
    this._fireConfigChanged(newConfig);
  }

  private _timezoneChanged(ev: CustomEvent): void {
    const value = ev.detail.value as 'server' | 'browser';
    if (value === (this._config.timezone || 'server')) return;
    const newConfig = { ...this._config };
    if (value === 'server') {
      delete newConfig.timezone;
    } else {
      newConfig.timezone = value;
    }
    this._fireConfigChanged(newConfig);
  }

  private _minSeverityChanged(ev: CustomEvent): void {
    const value = ev.detail.value as AlertSeverity | '';
    if (value === (this._config.minSeverity || '')) return;
    const newConfig = { ...this._config };
    if (value) {
      newConfig.minSeverity = value as AlertSeverity;
    } else {
      delete newConfig.minSeverity;
    }
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

  protected render(): TemplateResult {
    if (!this.hass || !this._config) return html``;

    const lang = this._lang;
    const zonesStr = this._config.zones ? this._config.zones.join(', ') : '';
    const eventCodesStr = this._config.eventCodes ? this._config.eventCodes.join(', ') : '';

    return html`
      <div class="editor">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ entity: { domain: ['sensor', 'binary_sensor'] } }}
          .value=${this._config.entity}
          .label=${t('editor.entity', lang)}
          .required=${true}
          @value-changed=${this._entityChanged}
        ></ha-selector>

        <ha-textfield
          .label=${t('editor.title', lang)}
          .value=${this._config.title || ''}
          @change=${this._titleChanged}
        ></ha-textfield>

        <ha-select
          .label=${t('editor.provider', lang)}
          .value=${this._config.provider || 'auto'}
          @selected=${this._providerChanged}
        >
          <ha-dropdown-item value="auto">${t('editor.provider_auto', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="nws">${t('editor.provider_nws', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="bom">${t('editor.provider_bom', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="meteoalarm">${t('editor.provider_meteoalarm', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="pirateweather">${t('editor.provider_pirateweather', lang)}</ha-dropdown-item>
        </ha-select>

        <ha-textfield
          .label=${t('editor.zones', lang)}
          .value=${zonesStr}
          .helper=${t('editor.zones_helper', lang)}
          .helperPersistent=${true}
          @change=${this._zonesChanged}
        ></ha-textfield>

        <ha-textfield
          .label=${t('editor.event_codes', lang)}
          .value=${eventCodesStr}
          .helper=${t('editor.event_codes_helper', lang)}
          .helperPersistent=${true}
          @change=${this._eventCodesChanged}
        ></ha-textfield>

        <ha-select
          .label=${t('editor.sort_order', lang)}
          .value=${this._config.sortOrder || 'default'}
          @selected=${this._sortOrderChanged}
        >
          <ha-dropdown-item value="default">${t('editor.sort_default', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="onset">${t('editor.sort_onset', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="severity">${t('editor.sort_severity', lang)}</ha-dropdown-item>
        </ha-select>

        <ha-select
          .label=${t('editor.color_theme', lang)}
          .value=${this._config.colorTheme || 'severity'}
          @selected=${this._colorThemeChanged}
        >
          <ha-dropdown-item value="severity">${t('editor.color_severity', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="nws">${t('editor.color_nws', lang)}</ha-dropdown-item>
        </ha-select>

        <ha-select
          .label=${t('editor.timezone', lang)}
          .value=${this._config.timezone || 'server'}
          @selected=${this._timezoneChanged}
        >
          <ha-dropdown-item value="server">${t('editor.tz_server', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="browser">${t('editor.tz_browser', lang)}</ha-dropdown-item>
        </ha-select>

        <ha-select
          .label=${t('editor.min_severity', lang)}
          .value=${this._config.minSeverity || ''}
          @selected=${this._minSeverityChanged}
        >
          <ha-dropdown-item value="">${t('editor.severity_all', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="minor">${t('editor.severity_minor', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="moderate">${t('editor.severity_moderate', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="severe">${t('editor.severity_severe', lang)}</ha-dropdown-item>
          <ha-dropdown-item value="extreme">${t('editor.severity_extreme', lang)}</ha-dropdown-item>
        </ha-select>

        <ha-formfield .label=${t('editor.animations', lang)}>
          <ha-switch
            .checked=${this._config.animations !== false}
            @change=${this._animationsChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield .label=${t('editor.deduplicate', lang)}>
          <ha-switch
            .checked=${this._config.deduplicate !== false}
            @change=${this._deduplicateChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield .label=${t('editor.compact', lang)}>
          <ha-switch
            .checked=${this._config.layout === 'compact'}
            @change=${this._layoutChanged}
          ></ha-switch>
        </ha-formfield>

        <div class="preview-tools">
          <ha-formfield .label=${t('editor.show_preview', lang)}>
            <ha-switch
              .checked=${this._showPreview}
              @change=${this._previewChanged}
            ></ha-switch>
          </ha-formfield>
          <div class="preview-hint">${t('editor.preview_hint', lang)}</div>
        </div>
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
    .preview-tools {
      border-top: 1px solid var(--divider-color);
      padding-top: 16px;
      margin-top: 4px;
    }
    .preview-hint {
      font-size: 0.8rem;
      color: var(--secondary-text-color);
      padding-left: 48px;
      margin-top: 4px;
      opacity: 0.7;
    }
  `;
}

// Deprecated shim — removed in v3.0.0
class DeprecatedNwsAlertsCardEditor extends WeatherAlertsCardEditor {}
customElements.define('nws-alerts-card-editor', DeprecatedNwsAlertsCardEditor);

declare global {
  interface HTMLElementTagNameMap {
    'weather-alerts-card-editor': WeatherAlertsCardEditor;
    'nws-alerts-card-editor': DeprecatedNwsAlertsCardEditor;
  }
}
