import { describe, it, expect } from 'vitest';
import { WeatherAlertsCardEditor } from '../src/weather-alerts-card-editor';
import type { WeatherAlertsCardConfig, ProgressDecoration, IconBorderStyle } from '../src/types';

// Reach into the private per-phase handlers; this suite pins the default
// detection + key-pruning contract (mirrors _fontSizeChanged) and that each
// change emits config-changed.
type EditorInternals = {
  _config: WeatherAlertsCardConfig;
  _progressStyleChanged(phase: 'preparation' | 'active' | 'ongoing', ev: CustomEvent): void;
  _iconBorderStyleChanged(phase: 'preparation' | 'active' | 'ongoing', ev: CustomEvent): void;
};

function makeEditor(config: Partial<WeatherAlertsCardConfig> = {}): {
  editor: EditorInternals;
  events: WeatherAlertsCardConfig[];
} {
  const editor = new WeatherAlertsCardEditor() as unknown as EditorInternals;
  editor._config = { entity: 'sensor.nws_alerts', ...config } as WeatherAlertsCardConfig;
  const events: WeatherAlertsCardConfig[] = [];
  (editor as unknown as HTMLElement).addEventListener('config-changed', (e) => {
    events.push((e as CustomEvent).detail.config);
  });
  return { editor, events };
}

function sel(value: string): CustomEvent {
  return new CustomEvent('selected', { detail: { value } });
}

describe('_progressStyleChanged', () => {
  it('writes a non-default decoration and emits config-changed', () => {
    const { editor, events } = makeEditor();
    editor._progressStyleChanged('active', sel('striped' as ProgressDecoration));
    expect(editor._config.progressStyle).toEqual({ active: 'striped' });
    expect(events).toHaveLength(1);
    expect(events[0].progressStyle).toEqual({ active: 'striped' });
  });

  it('deletes the phase key and prunes an emptied progressStyle on returning to default', () => {
    const { editor } = makeEditor({ progressStyle: { active: 'striped' } });
    editor._progressStyleChanged('active', sel('shimmer')); // shimmer is the active default
    expect(editor._config.progressStyle).toBeUndefined();
  });

  it('keeps other phases when one returns to its default', () => {
    const { editor } = makeEditor({ progressStyle: { active: 'striped', preparation: 'pulse' } });
    editor._progressStyleChanged('active', sel('shimmer'));
    expect(editor._config.progressStyle).toEqual({ preparation: 'pulse' });
  });

  it('is a no-op when the value is unchanged (no event)', () => {
    const { editor, events } = makeEditor();
    editor._progressStyleChanged('ongoing', sel('pulse')); // pulse is the ongoing default
    expect(events).toHaveLength(0);
    expect(editor._config.progressStyle).toBeUndefined();
  });
});

describe('_iconBorderStyleChanged', () => {
  it('round-trips a non-default value then prunes on return to default', () => {
    const { editor, events } = makeEditor();
    editor._iconBorderStyleChanged('preparation', sel('solid' as IconBorderStyle));
    expect(editor._config.iconBorderStyle).toEqual({ preparation: 'solid' });
    expect(events).toHaveLength(1);

    editor._iconBorderStyleChanged('preparation', sel('dashed')); // preparation default
    expect(editor._config.iconBorderStyle).toBeUndefined();
    expect(events).toHaveLength(2);
  });

  it('writes active: dashed (non-default) without touching progressStyle', () => {
    const { editor } = makeEditor();
    editor._iconBorderStyleChanged('active', sel('dashed'));
    expect(editor._config.iconBorderStyle).toEqual({ active: 'dashed' });
    expect(editor._config.progressStyle).toBeUndefined();
  });
});
