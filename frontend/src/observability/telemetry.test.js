import { getTelemetrySnapshot, reportApplicationError, reportAuditSignal } from './telemetry.js';

describe('frontend telemetry', () => {
  it('records only the approved error category', () => {
    reportApplicationError('runtime');

    const entry = getTelemetrySnapshot().at(-1);
    expect(entry.type).toBe('javascript_error');
    expect(entry.metadata).toEqual({ kind: 'runtime' });
    expect(entry).not.toHaveProperty('url');
    expect(entry).not.toHaveProperty('message');
    expect(entry).not.toHaveProperty('stack');
  });

  it('accepts only allowlisted audit signals without resource identifiers', () => {
    reportAuditSignal('clinical_record_opened');
    reportAuditSignal('patient-P000001');

    const auditEntries = getTelemetrySnapshot().filter((entry) => entry.type === 'audit_signal');
    expect(auditEntries.at(-1).metadata).toEqual({ action: 'clinical_record_opened' });
    expect(JSON.stringify(auditEntries)).not.toContain('P000001');
  });
});
