const measurements = [];
const MAX_MEASUREMENTS = 100;
const allowedAuditActions = new Set(['clinical_record_opened', 'research_project_opened', 'fhir_viewed']);

function record(type, value, metadata = {}) {
  const entry = {
    type,
    value: Number.isFinite(value) ? Math.round(value) : undefined,
    metadata,
    timestamp: Date.now(),
  };
  measurements.push(entry);
  if (measurements.length > MAX_MEASUREMENTS) measurements.shift();
  window.dispatchEvent(new CustomEvent('hu:telemetry', { detail: entry }));
}

export function reportApplicationError(kind = 'unknown') {
  record('javascript_error', 1, { kind });
}

export function reportAuditSignal(action) {
  if (!allowedAuditActions.has(action)) return;
  record('audit_signal', 1, { action });
}

export function startPerformanceMonitoring() {
  if (!('PerformanceObserver' in window)) return () => {};

  const observers = [];
  const observe = (type, callback) => {
    try {
      const observer = new PerformanceObserver((list) => list.getEntries().forEach(callback));
      observer.observe({ type, buffered: true });
      observers.push(observer);
    } catch {
      // Some browsers expose PerformanceObserver without supporting every entry type.
    }
  };

  observe('largest-contentful-paint', (entry) => record('lcp', entry.startTime));
  observe('layout-shift', (entry) => {
    if (!entry.hadRecentInput) record('layout_shift', entry.value);
  });
  observe('longtask', (entry) => record('long_task', entry.duration));

  return () => observers.forEach((observer) => observer.disconnect());
}

export function getTelemetrySnapshot() {
  return measurements.map((entry) => ({ ...entry }));
}
