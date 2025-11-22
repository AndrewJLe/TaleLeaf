// Lightweight telemetry abstraction (no-op by default / console fallback)
// Gated via featureFlags.telemetryBasic

import { featureFlags } from "../constants/featureFlags";

export interface TelemetryEvent {
  name: string;
  props?: Record<string, any>;
}

// In future wire to real provider (e.g., PostHog / Rudder / custom endpoint)
function dispatch(evt: TelemetryEvent) {
  if (!(featureFlags as any).telemetryBasic) return;
  try {
    // For now just log (could enqueue to /api/telemetry)
    // Keep minimal PII: do not include free-form text bodies.
    if (process.env.NODE_ENV !== "production") {
      console.debug("[telemetry]", evt.name, evt.props || {});
    }
    // Placeholder: network send could go here behind debounce
  } catch {
    /* swallow */
  }
}

export function track(name: string, props?: Record<string, any>) {
  dispatch({ name, props });
}

export function trackEntityDeleted(
  entityType: string,
  opts: { soft?: boolean } = {},
) {
  track("entity_deleted", { entityType, soft: !!opts.soft });
}

export function trackEntityRestored(entityType: string) {
  track("entity_restored", { entityType });
}
