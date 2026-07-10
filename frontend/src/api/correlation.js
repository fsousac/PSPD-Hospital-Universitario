export function createCorrelationId() {
  if (crypto?.randomUUID) {
    return crypto.randomUUID();
  }
  return `hu-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

