// Dependency-free Home-Assistant action dispatcher for the card's `tap_action`.
//
// A deliberate hand-roll (no `custom-card-helpers`): that library pulls a large,
// non-tree-shakeable runtime tree into a bundle we keep lean. The pieces the card
// actually needs (fire the standard HA DOM events / service calls) are small and
// implemented here. See plans/tap-action.md, Design Decision D1.

import type { ActionConfig, HomeAssistant } from './types';

// Dispatch a composed, bubbling CustomEvent from `node` — the same shape HA's
// own frontend uses so browser_mod / Bubble Card / the more-info dialog listen.
export function fireEvent<T>(
  node: EventTarget,
  type: string,
  detail?: T,
): void {
  node.dispatchEvent(
    new CustomEvent(type, {
      detail,
      bubbles: true,
      composed: true,
    }),
  );
}

// Presence — not truthiness — is the trigger: any `tap_action` (including
// `{ action: 'none' }`) replaces the inline expand affordance.
export function hasTapAction(
  config: { tap_action?: ActionConfig } | undefined | null,
): boolean {
  return config?.tap_action !== undefined;
}

// Translate an ActionConfig into the standard HA DOM events / service calls.
// `defaultEntity` is the already-resolved per-alert fallback entity (see the
// card's _onCardAction); the dispatcher only knows `action.entity ?? defaultEntity`.
export function handleTapAction(
  node: EventTarget,
  hass: HomeAssistant | undefined,
  action: ActionConfig,
  defaultEntity?: string,
): void {
  switch (action.action) {
    case 'more-info': {
      const entityId = action.entity ?? defaultEntity;
      if (!entityId) return;
      fireEvent(node, 'hass-more-info', { entityId });
      break;
    }
    case 'navigate': {
      const path = action.navigation_path;
      if (!path) return;
      const replace = action.navigation_replace === true;
      if (replace) {
        history.replaceState(null, '', path);
      } else {
        history.pushState(null, '', path);
      }
      fireEvent(window, 'location-changed', { replace });
      break;
    }
    case 'url': {
      if (!action.url_path) return;
      window.open(action.url_path);
      break;
    }
    case 'toggle': {
      const entityId = action.entity ?? defaultEntity;
      if (!entityId || !hass?.callService) return;
      hass.callService('homeassistant', 'toggle', { entity_id: entityId });
      break;
    }
    case 'call-service':
    case 'perform-action': {
      const service = action.perform_action ?? action.service;
      if (!service || !hass?.callService) return;
      const idx = service.indexOf('.');
      if (idx < 0) return;
      const domain = service.slice(0, idx);
      const serviceName = service.slice(idx + 1);
      hass.callService(
        domain,
        serviceName,
        action.data ?? action.service_data,
        action.target,
      );
      break;
    }
    case 'fire-dom-event': {
      fireEvent(node, 'll-custom', action);
      break;
    }
    // 'none' and any unknown action → no-op.
    default:
      break;
  }
}
