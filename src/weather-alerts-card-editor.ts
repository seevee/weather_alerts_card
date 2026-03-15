import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, WeatherAlertsCardConfig, AlertSeverity } from './types';

@customElement('weather-alerts-card-editor')
export class WeatherAlertsCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: WeatherAlertsCardConfig;
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
      newConfig.provider = value as 'nws' | 'bom' | 'meteoalarm';
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

  protected render(): TemplateResult {
    if (!this.hass || !this._config) return html``;

    const zonesStr = this._config.zones ? this._config.zones.join(', ') : '';

    return html`
      <div class="editor">
        <ha-selector
          .hass=${this.hass}
          .selector=${{ entity: { domain: ['sensor', 'binary_sensor'] } }}
          .value=${this._config.entity}
          .label=${'Entity (required)'}
          .required=${true}
          @value-changed=${this._entityChanged}
        ></ha-selector>

        <ha-textfield
          .label=${'Title (optional)'}
          .value=${this._config.title || ''}
          @change=${this._titleChanged}
        ></ha-textfield>

        <ha-select
          .label=${'Alert provider'}
          .value=${this._config.provider || 'auto'}
          @selected=${this._providerChanged}
        >
          <ha-dropdown-item value="auto">Auto-detect</ha-dropdown-item>
          <ha-dropdown-item value="nws">NWS (United States)</ha-dropdown-item>
          <ha-dropdown-item value="bom">BoM (Australia)</ha-dropdown-item>
          <ha-dropdown-item value="meteoalarm">MeteoAlarm (Europe)</ha-dropdown-item>
        </ha-select>

        <ha-textfield
          .label=${'Zones (optional)'}
          .value=${zonesStr}
          .helper=${'Comma-separated zone codes, e.g. COC059, COZ039 (NWS) or NSW_FL049 (BoM)'}
          .helperPersistent=${true}
          @change=${this._zonesChanged}
        ></ha-textfield>

        <ha-select
          .label=${'Sort order'}
          .value=${this._config.sortOrder || 'default'}
          @selected=${this._sortOrderChanged}
        >
          <ha-dropdown-item value="default">Default</ha-dropdown-item>
          <ha-dropdown-item value="onset">Onset time</ha-dropdown-item>
          <ha-dropdown-item value="severity">Severity</ha-dropdown-item>
        </ha-select>

        <ha-select
          .label=${'Color theme'}
          .value=${this._config.colorTheme || 'severity'}
          @selected=${this._colorThemeChanged}
        >
          <ha-dropdown-item value="severity">Severity-based</ha-dropdown-item>
          <ha-dropdown-item value="nws">NWS Official</ha-dropdown-item>
        </ha-select>

        <ha-select
          .label=${'Minimum severity'}
          .value=${this._config.minSeverity || ''}
          @selected=${this._minSeverityChanged}
        >
          <ha-dropdown-item value="">All severities</ha-dropdown-item>
          <ha-dropdown-item value="minor">Minor or higher</ha-dropdown-item>
          <ha-dropdown-item value="moderate">Moderate or higher</ha-dropdown-item>
          <ha-dropdown-item value="severe">Severe or higher</ha-dropdown-item>
          <ha-dropdown-item value="extreme">Extreme only</ha-dropdown-item>
        </ha-select>

        <ha-formfield .label=${'Enable animations'}>
          <ha-switch
            .checked=${this._config.animations !== false}
            @change=${this._animationsChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield .label=${'Deduplicate alerts'}>
          <ha-switch
            .checked=${this._config.deduplicate !== false}
            @change=${this._deduplicateChanged}
          ></ha-switch>
        </ha-formfield>

        <ha-formfield .label=${'Compact layout'}>
          <ha-switch
            .checked=${this._config.layout === 'compact'}
            @change=${this._layoutChanged}
          ></ha-switch>
        </ha-formfield>
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
