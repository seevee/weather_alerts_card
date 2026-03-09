import { LitElement, html, css, TemplateResult } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { HomeAssistant, NwsAlertsCardConfig } from './types';

@customElement('nws-alerts-card-editor')
export class NwsAlertsCardEditor extends LitElement {
  @property({ attribute: false }) public hass!: HomeAssistant;
  @state() private _config!: NwsAlertsCardConfig;
  public setConfig(config: NwsAlertsCardConfig): void {
    this._config = config;
  }

  private _fireConfigChanged(newConfig: NwsAlertsCardConfig): void {
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
    const value = (ev.target as HTMLSelectElement).value as string;
    if (value === (this._config.provider || 'auto')) return;
    const newConfig = { ...this._config };
    if (value === 'auto') {
      delete newConfig.provider;
    } else {
      newConfig.provider = value as 'nws' | 'bom';
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
    const value = (ev.target as HTMLSelectElement).value as 'default' | 'onset' | 'severity';
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
    const value = (ev.target as HTMLSelectElement).value as 'severity' | 'nws';
    if (value === (this._config.colorTheme || 'severity')) return;
    const newConfig = { ...this._config };
    if (value === 'severity') {
      delete newConfig.colorTheme;
    } else {
      newConfig.colorTheme = value;
    }
    this._fireConfigChanged(newConfig);
  }

  protected render(): TemplateResult {
    if (!this.hass || !this._config) return html``;

    const zonesStr = this._config.zones ? this._config.zones.join(', ') : '';

    return html`
      <div class="editor" @closed=${(ev: Event) => ev.stopPropagation()}>
        <ha-selector
          .hass=${this.hass}
          .selector=${{ entity: { domain: 'sensor' } }}
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
          fixedMenuPosition
          naturalMenuWidth
        >
          <ha-list-item value="auto">Auto-detect</ha-list-item>
          <ha-list-item value="nws">NWS (United States)</ha-list-item>
          <ha-list-item value="bom">BoM (Australia)</ha-list-item>
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
          fixedMenuPosition
          naturalMenuWidth
        >
          <ha-list-item value="default">Default</ha-list-item>
          <ha-list-item value="onset">Onset time</ha-list-item>
          <ha-list-item value="severity">Severity</ha-list-item>
        </ha-select>

        <ha-select
          .label=${'Color theme'}
          .value=${this._config.colorTheme || 'severity'}
          @selected=${this._colorThemeChanged}
          fixedMenuPosition
          naturalMenuWidth
        >
          <ha-list-item value="severity">Severity-based</ha-list-item>
          <ha-list-item value="nws">NWS Official</ha-list-item>
        </ha-select>

        <ha-formfield .label=${'Enable animations'}>
          <ha-switch
            .checked=${this._config.animations !== false}
            @change=${this._animationsChanged}
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

declare global {
  interface HTMLElementTagNameMap {
    'nws-alerts-card-editor': NwsAlertsCardEditor;
  }
}
