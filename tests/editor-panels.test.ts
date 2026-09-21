import { describe, it, expect } from 'vitest';
import { render } from 'lit';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import {
  DETAIL_SECTIONS, PANELS, PANEL_LABELS, SELECT_FIELDS, TOGGLE_FIELDS, changedKeys, shortLabel,
  type Panel,
} from '../src/editor-fields';
import { translations } from '../src/translations';
import type { HomeAssistant, WeatherAlertsCardConfig } from '../src/types';

// The regrouped editor: seven ha-expansion-panels, each declaring its header
// and a secondary naming its customised keys from the registry, with the
// matching rows marked inside; dependents hidden (never disabled) behind
// their master; the detail sections as one list selector.
// ha-expansion-panel is undefined in jsdom, so panel children stay ordinary
// light DOM and querySelector reaches them.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  hass: HomeAssistant;
  render(): unknown;
  addEventListener(type: string, listener: (ev: Event) => void): void;
};

type PanelEl = Element & { header?: string; secondary?: string; expanded?: boolean };
type Labelled = Element & { label?: string; value?: unknown; disabled?: unknown; selector?: { select?: { options?: { value: string; label: string }[] } } };

const en = translations.en;
const ORDER: Panel[] = ['source', 'filtering', 'appearance', 'details', 'behavior', 'dismissal', 'advanced'];

function base(extra: Partial<WeatherAlertsCardConfig> = {}): WeatherAlertsCardConfig {
  return { type: 'custom:weather-alerts-card', entity: 'sensor.nws_alerts', ...extra };
}

function makeEditor(config: WeatherAlertsCardConfig): { editor: EditorInternals; events: WeatherAlertsCardConfig[] } {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = config;
  editor.hass = {
    states: { 'sensor.nws_alerts': { state: '0', attributes: { Alerts: [] } } },
    locale: { language: 'en' },
  } as unknown as HomeAssistant;
  const events: WeatherAlertsCardConfig[] = [];
  editor.addEventListener('config-changed', (ev) => events.push((ev as CustomEvent).detail.config));
  return { editor, events };
}

function renderHost(editor: EditorInternals): HTMLElement {
  const host = document.createElement('div');
  render(editor.render(), host, { host: editor });
  return host;
}

/** Top-level panels, keyed by their registry panel id. */
function panels(host: HTMLElement): Record<Panel, PanelEl> {
  const top = [...host.querySelectorAll('.editor > ha-expansion-panel')] as PanelEl[];
  const byHeader = new Map(top.map(p => [p.header, p]));
  return Object.fromEntries(ORDER.map(id => [id, byHeader.get(en[PANEL_LABELS[id]])])) as Record<Panel, PanelEl>;
}

const formfieldLabels = (root: Element) => [...root.querySelectorAll('ha-formfield')].map(f => (f as Labelled).label);
const selectLabels = (root: Element) => [...root.querySelectorAll('ha-select')].map(s => (s as Labelled).label);
const sectionsList = (root: Element) =>
  ([...root.querySelectorAll('ha-selector')] as Labelled[]).find(s => s.label === 'Sections');

describe('panel layout', () => {
  it('renders the seven panels in order, Source open and the rest collapsed', () => {
    const host = renderHost(makeEditor(base()).editor);
    const top = [...host.querySelectorAll('.editor > ha-expansion-panel')] as PanelEl[];
    expect(top.map(p => p.header)).toEqual(ORDER.map(id => en[PANEL_LABELS[id]]));
    expect(top.map(p => p.expanded)).toEqual([true, false, false, false, false, false, false]);
    expect(top.every(p => p.hasAttribute('outlined'))).toBe(true);
  });

  it('keeps the preview tools above the panels', () => {
    const host = renderHost(makeEditor(base()).editor);
    const editor = host.querySelector('.editor')!;
    expect(editor.firstElementChild?.className).toBe('preview-tools');
    expect(host.querySelector('ha-expansion-panel .preview-tools')).toBeNull();
  });

  it('places every registry field in the panel the registry names', () => {
    const host = renderHost(makeEditor(base({ showGeometry: true, allowDismiss: true })).editor);
    const byPanel = panels(host);
    for (const f of TOGGLE_FIELDS) {
      const label = en[f.label];
      const panel = byPanel[f.panel];
      if ((DETAIL_SECTIONS as readonly string[]).includes(f.key)) {
        expect(sectionsList(panel)?.selector?.select?.options?.map(o => o.label.replace(/ •$/, '')), f.key).toContain(label);
      } else {
        expect(formfieldLabels(panel), f.key).toContain(label);
      }
    }
    for (const f of SELECT_FIELDS) {
      expect(selectLabels(byPanel[f.panel]), f.key).toContain(en[f.label]);
    }
  });

  it('moves the provider override, timezone, contrast, text and dedup keys to Advanced', () => {
    const byPanel = panels(renderHost(makeEditor(base()).editor));
    expect(selectLabels(byPanel.advanced)).toEqual(['Alert provider', 'Timezone', 'Enhance contrast']);
    expect(formfieldLabels(byPanel.advanced)).toEqual([
      'Reflow alert text (strip hard line breaks)', 'Deduplicate alerts', 'Deduplicate headlines',
    ]);
    expect(formfieldLabels(byPanel.source)).toEqual([]);
    expect(formfieldLabels(byPanel.appearance)).toContain('Show provider label');
  });

  it('nests the styling group inside Appearance as a non-outlined panel', () => {
    const byPanel = panels(renderHost(makeEditor(base({ progressFill: 'background', progressStyle: { active: 'striped' } })).editor));
    const nested = byPanel.appearance.querySelector('ha-expansion-panel') as PanelEl;
    expect(nested.header).toBe('Progress & icon styling');
    expect(nested.hasAttribute('outlined')).toBe(false);
    expect(nested.expanded).toBe(false);
    expect(nested.secondary).toBe('Progress fill · Progress bar decoration');
    expect(selectLabels(nested)).toContain('Progress fill');
  });
});

describe('panel header summaries', () => {
  it('shows no summary anywhere on a default card', () => {
    const byPanel = panels(renderHost(makeEditor(base()).editor));
    for (const id of ORDER) expect(byPanel[id].secondary, id).toBe('');
  });

  it('never summarises Source, even with every source key set', () => {
    const byPanel = panels(renderHost(makeEditor(base({ entities: ['a'], device: 'd', sources: ['s'], title: 'T' })).editor));
    expect(byPanel.source.secondary).toBe('');
  });

  it('names registry keys off their default and present bespoke keys, in panel order', () => {
    const cfg = base({
      zones: ['A'], minSeverity: 'severe',                       // filtering
      layout: 'compact', showProvider: true, progressStyle: { active: 'striped' }, // appearance
      showDetails: false, showGeometry: true,                    // details (hidden key still counts)
      tap_action: { action: 'none' }, hideNoAlerts: true,        // behavior
      allowDismiss: true,                                        // dismissal
    });
    const byPanel = panels(renderHost(makeEditor(cfg).editor));
    expect(byPanel.filtering.secondary).toBe('Zones · Minimum severity');
    expect(byPanel.appearance.secondary).toBe('Compact layout · Show provider label · Progress bar decoration');
    expect(byPanel.details.secondary).toBe('Show detail panel · Show area map');
    expect(byPanel.behavior.secondary).toBe('Tap action · Hide card when there are no active alerts');
    expect(byPanel.dismissal.secondary).toBe('Allow dismissing alerts');
    expect(byPanel.advanced.secondary).toBe('');
  });

  it('caps the list at three names and counts the rest', () => {
    const cfg = base({ provider: 'bom', deduplicate: false, timezone: 'browser', reformatText: false, enhanceContrast: 'off' });
    const byPanel = panels(renderHost(makeEditor(cfg).editor));
    expect(changedKeys(cfg, PANELS.advanced)).toHaveLength(5);
    expect(byPanel.advanced.secondary).toBe('Alert provider · Timezone · Reflow alert text +2 more');
  });

  it('strips a trailing parenthetical from a header name', () => {
    expect(shortLabel('Zones (optional)')).toBe('Zones');
    expect(shortLabel('Maximum distance (km)')).toBe('Maximum distance');
    expect(shortLabel('Reflow alert text (strip hard line breaks)')).toBe('Reflow alert text');
    expect(shortLabel('NWS (United States) feed')).toBe('NWS (United States) feed');
    const byPanel = panels(renderHost(makeEditor(base({ provider: 'nsw_rfs', maxDistanceKm: 20, eventCodes: ['X'] })).editor));
    expect(byPanel.filtering.secondary).toBe('Event codes · Maximum distance');
  });

  it('does not name a key stored explicitly at its default', () => {
    const byPanel = panels(renderHost(makeEditor(base({ showDetails: true, animations: true, sortOrder: 'default' })).editor));
    expect(byPanel.details.secondary).toBe('');
    expect(byPanel.appearance.secondary).toBe('');
    expect(byPanel.behavior.secondary).toBe('');
  });
});

describe('changed-row markers', () => {
  const markedLabels = (root: Element) =>
    [...root.querySelectorAll('.field.changed')].map(f => {
      const el = f.querySelector('ha-formfield, ha-select, ha-input, ha-textfield, ha-selector');
      return el?.label;
    });

  it('marks exactly the customised rows, registry and bespoke alike', () => {
    const cfg = base({
      provider: 'nsw_rfs', zones: ['A'], maxDistanceKm: 20, myLocationEntity: 'zone.work',
      layout: 'compact', progressStyle: { active: 'striped' },
      showGeometry: true, geometryStyle: 'map',
      tap_action: { action: 'none' }, hideNoAlerts: true, sortOrder: 'severity',
      allowDismiss: true, dismissTrigger: 'swipe',
      timezone: 'browser',
    });
    const host = renderHost(makeEditor(cfg).editor);
    expect(markedLabels(host).sort()).toEqual([
      'Zones (optional)', 'Maximum distance (km)', 'My location',
      'Compact layout', 'Active',
      'Area map style',
      'Tap action', 'Hide card when there are no active alerts', 'Sort order',
      'Allow dismissing alerts', 'Dismiss trigger',
      'Timezone', 'Alert provider',
    ].sort());
    // The unchanged phase selects beside the marked one carry the row but not the mark.
    expect(host.querySelectorAll('.phase-row .field').length).toBe(6);
    expect(host.querySelectorAll('.phase-row .field.changed').length).toBe(1);
  });

  it('marks nothing on a default card, and every row is still a .field', () => {
    const host = renderHost(makeEditor(base()).editor);
    expect(host.querySelectorAll('.field.changed')).toHaveLength(0);
    expect(host.querySelectorAll('.editor > ha-expansion-panel .content > ha-formfield, .editor > ha-expansion-panel .content > ha-select')).toHaveLength(0);
  });

  it('suffixes a customised section in the list options', () => {
    const list = sectionsList(renderHost(makeEditor(base({ showDescription: false, showGeometry: true })).editor))!;
    expect(list.selector?.select?.options?.map(o => o.label)).toEqual([
      'Show metadata', 'Show description •', 'Show instructions', 'Show source link', 'Show area map •',
    ]);
  });
});

describe('hide, not disable', () => {
  const disabledAnywhere = (host: HTMLElement) =>
    [...host.querySelectorAll('ha-switch, ha-select, ha-selector')].filter(el => (el as Labelled).disabled !== undefined);

  it('binds no disabled property on any control, whatever the masters say', () => {
    for (const cfg of [base(), base({ showDetails: false }), base({ allowDismiss: true }), base({ showDetails: false, allowDismiss: false })]) {
      expect(disabledAnywhere(renderHost(makeEditor(cfg).editor))).toEqual([]);
    }
  });

  it('removes the detail dependents while the detail panel is off, and restores them', () => {
    const off = panels(renderHost(makeEditor(base({ showDetails: false, showGeometry: true })).editor)).details;
    expect(formfieldLabels(off)).toEqual(['Show detail panel']);
    expect(sectionsList(off)).toBeUndefined();
    expect(selectLabels(off)).toEqual([]);

    const on = panels(renderHost(makeEditor(base({ showGeometry: true })).editor)).details;
    expect(formfieldLabels(on)).toEqual(['Show detail panel', 'Always expand details', 'Show my location on the map']);
    expect(sectionsList(on)).toBeDefined();
    expect(selectLabels(on)).toEqual(['Area map style']);
  });

  it('removes the dismissal dependents until dismissing is allowed', () => {
    const off = panels(renderHost(makeEditor(base({ showDismissUndo: false })).editor)).dismissal;
    expect(formfieldLabels(off)).toEqual(['Allow dismissing alerts']);
    expect(selectLabels(off)).toEqual([]);

    const on = panels(renderHost(makeEditor(base({ allowDismiss: true })).editor)).dismissal;
    expect(formfieldLabels(on)).toEqual(['Allow dismissing alerts', 'Show undo notification on dismiss']);
    expect(selectLabels(on)).toEqual(['Dismiss trigger', 'Button style']);

    const swipe = panels(renderHost(makeEditor(base({ allowDismiss: true, dismissTrigger: 'swipe' })).editor)).dismissal;
    expect(selectLabels(swipe)).toEqual(['Dismiss trigger']);
  });
});

describe('detail sections list', () => {
  const ALL_ON = ['showMetadata', 'showDescription', 'showInstructions', 'showSourceLink'];
  const change = (list: Element, value: unknown) =>
    list.dispatchEvent(new CustomEvent('value-changed', { detail: { value } }));

  it('offers the five sections in order and reflects the effective on-set', () => {
    const list = sectionsList(renderHost(makeEditor(base()).editor))!;
    expect(list.selector?.select).toMatchObject({ multiple: true, mode: 'list' });
    expect(list.selector?.select?.options?.map(o => o.value)).toEqual([...DETAIL_SECTIONS]);
    expect(list.value).toEqual(ALL_ON);

    const some = sectionsList(renderHost(makeEditor(base({ showDescription: false, showGeometry: true })).editor))!;
    expect(some.value).toEqual(['showMetadata', 'showInstructions', 'showSourceLink', 'showGeometry']);
  });

  it('unchecking a default-on section writes false for exactly that key, in one event', () => {
    const { editor, events } = makeEditor(base());
    change(sectionsList(renderHost(editor))!, ALL_ON.filter(k => k !== 'showMetadata'));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(base({ showMetadata: false }));
  });

  it('checking the default-off map section writes true; unchecking it deletes the key', () => {
    const { editor, events } = makeEditor(base());
    change(sectionsList(renderHost(editor))!, [...ALL_ON, 'showGeometry']);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(base({ showGeometry: true }));

    change(sectionsList(renderHost(editor))!, ALL_ON);
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual(base());
  });

  it('re-checking a section stored as false deletes the key rather than writing true', () => {
    const { editor, events } = makeEditor(base({ showSourceLink: false }));
    change(sectionsList(renderHost(editor))!, ALL_ON);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(base());
  });

  it('fires nothing when the set is unchanged, and treats a non-array as empty', () => {
    const { editor, events } = makeEditor(base({ showGeometry: true }));
    change(sectionsList(renderHost(editor))!, [...ALL_ON, 'showGeometry']);
    expect(events).toHaveLength(0);

    change(sectionsList(renderHost(editor))!, undefined);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(base({ showMetadata: false, showDescription: false, showInstructions: false, showSourceLink: false }));
  });
});

describe('default option suffix', () => {
  const optionsOf = (root: Element, label: string) => {
    const sel = ([...root.querySelectorAll('ha-select')] as Labelled[]).find(s => s.label === label)!;
    return [...sel.querySelectorAll('ha-dropdown-item')].map(i => (i.textContent || '').trim());
  };

  it('marks the default entry of every registry dropdown', () => {
    const host = renderHost(makeEditor(base({ progressFill: 'background' })).editor);
    expect(optionsOf(host, 'Progress fill')).toEqual(['Track (thin bar) (default)', 'Background wash']);
    expect(optionsOf(host, 'Enhance contrast')).toEqual(['Off', 'Subtle (default)', 'Strict (WCAG AA)']);
    expect(optionsOf(host, 'Alert provider')[0]).toBe('Auto-detect (default)');
  });

  it('leaves entries that already call themselves the default alone', () => {
    const host = renderHost(makeEditor(base()).editor);
    expect(optionsOf(host, 'Sort order')).toEqual(['Default', 'Onset time', 'Severity']);
    expect(optionsOf(host, 'Font size')[1]).toBe('Default');
    expect(optionsOf(host, 'Tap action')[0]).toBe('Inline expand (default)');
  });

  it('marks each phase select with its own default', () => {
    const host = renderHost(makeEditor(base()).editor);
    const phaseSelects = [...host.querySelectorAll('.phase-row ha-select')] as Labelled[];
    const items = phaseSelects.map(s => [...s.querySelectorAll('ha-dropdown-item')].map(i => (i.textContent || '').trim()));
    expect(items[0]).toContain('Striped (default)');   // preparation
    expect(items[1]).toContain('Shimmer (default)');   // active
    expect(items[2]).toContain('Pulse (default)');     // ongoing
    expect(items[3]).toContain('Dashed (default)');    // icon preparation
    expect(items[4]).toContain('Solid (default)');     // icon active
  });
});

describe('reset links', () => {
  const rows = (host: HTMLElement) =>
    [...host.querySelectorAll('.field.changed')].map(f => ({
      label: (f.querySelector('ha-formfield, ha-select, ha-input, ha-textfield, ha-selector'))?.label,
      link: f.querySelector(':scope > .reset-link'),
    }));
  const click = (el: HTMLElement | null | undefined) => el!.dispatchEvent(new Event('click'));

  it('renders none on a default card', () => {
    expect(renderHost(makeEditor(base()).editor).querySelectorAll('.reset-link')).toHaveLength(0);
  });

  it('renders one under every changed row, registry and bespoke alike', () => {
    const cfg = base({
      provider: 'nsw_rfs', zones: ['A'], maxDistanceKm: 20, myLocationEntity: 'zone.work',
      layout: 'compact', progressStyle: { active: 'striped' }, iconBorderStyle: { ongoing: 'dashed' },
      tap_action: { action: 'none' }, hideNoAlerts: true, timezone: 'browser',
    });
    const r = rows(renderHost(makeEditor(cfg).editor));
    expect(r.every(x => x.link !== null)).toBe(true);
    expect(r.map(x => x.label).sort()).toEqual([
      'Alert provider', 'Zones (optional)', 'Maximum distance (km)', 'My location',
      'Compact layout', 'Active', 'Ongoing', 'Tap action',
      'Hide card when there are no active alerts', 'Timezone',
    ].sort());
  });

  it('resets a registry key to its default in one event', () => {
    const { editor, events } = makeEditor(base({ layout: 'compact', colorTheme: 'nws' }));
    click(rows(renderHost(editor)).find(x => x.label === 'Compact layout')?.link);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(base({ colorTheme: 'nws' }));
  });

  it('deletes a bespoke key', () => {
    for (const [cfg, label, key] of [
      [base({ zones: ['A'] }), 'Zones (optional)', 'zones'],
      [base({ provider: 'nsw_rfs', maxDistanceKm: 20 }), 'Maximum distance (km)', 'maxDistanceKm'],
      [base({ tap_action: { action: 'navigate', navigation_path: '/x' } }), 'Tap action', 'tap_action'],
    ] as const) {
      const { editor, events } = makeEditor(cfg);
      click(rows(renderHost(editor)).find(x => x.label === label)?.link);
      expect(events, label).toHaveLength(1);
      expect(key in events[0], label).toBe(false);
    }
  });

  it('resets hideNoAlerts through the visibility sync', () => {
    const cfg = base({ hideNoAlerts: true, visibility: [{ condition: 'state', entity: 'sensor.nws_alerts', state_not: '0' }] });
    const { editor, events } = makeEditor(cfg);
    click(rows(renderHost(editor)).find(x => x.label === 'Hide card when there are no active alerts')?.link);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(base());
  });

  it('resets one phase and prunes the emptied styling object', () => {
    const { editor, events } = makeEditor(base({ progressStyle: { active: 'striped' } }));
    click(rows(renderHost(editor)).find(x => x.label === 'Active')?.link);
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(base());
  });

  it('activates from the keyboard', () => {
    const { editor, events } = makeEditor(base({ layout: 'compact' }));
    const link = rows(renderHost(editor))[0].link!;
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab' }));
    expect(events).toHaveLength(0);
    link.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(events).toHaveLength(1);
  });
});

describe('hidden-but-set dependents', () => {
  const alsoSet = (root: Element) =>
    [...root.querySelectorAll('.also-set')].map(el => (el.textContent || '').replace(/\s+/g, ' ').trim());

  it('renders nothing when no master hides a set key', () => {
    expect(alsoSet(renderHost(makeEditor(base()).editor))).toEqual([]);
    expect(alsoSet(renderHost(makeEditor(base({ showDetails: false, allowDismiss: false })).editor))).toEqual([]);
  });

  it('names the detail keys hidden under an off detail panel, and clears them in one event', () => {
    const { editor, events } = makeEditor(base({ showDetails: false, showGeometry: true, geometryStyle: 'map', showSourceLink: false }));
    const host = renderHost(editor);
    const byPanel = panels(host);
    expect(alsoSet(byPanel.details)).toEqual(['Also set: Show area map · Area map style · Show source link Reset to default']);
    (byPanel.details.querySelector('.also-set .reset-link') as HTMLElement).dispatchEvent(new Event('click'));
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual(base({ showDetails: false }));
  });

  it('names geometry keys set while the map is off', () => {
    const byPanel = panels(renderHost(makeEditor(base({ geometryStyle: 'map', showMyLocation: true })).editor));
    expect(alsoSet(byPanel.details)).toEqual(['Also set: Area map style · Show my location on the map Reset to default']);
  });

  it('names dismissal keys under an off master, and the button style under a swipe trigger', () => {
    const off = panels(renderHost(makeEditor(base({ dismissTrigger: 'swipe', showDismissUndo: false })).editor)).dismissal;
    expect(alsoSet(off)).toEqual(['Also set: Dismiss trigger · Show undo notification on dismiss Reset to default']);
    const swipe = panels(renderHost(makeEditor(base({ allowDismiss: true, dismissTrigger: 'swipe', dismissButtonStyle: 'labeled' })).editor)).dismissal;
    expect(alsoSet(swipe)).toEqual(['Also set: Button style Reset to default']);
  });
});
