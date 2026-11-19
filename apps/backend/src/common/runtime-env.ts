export function isProductionEnv(nodeEnv: string | undefined): boolean {
  return nodeEnv === 'production';
}

/** Parses an optional boolean env flag; returns `fallback` when unset or unrecognized. */
export function parseBooleanEnv(
  value: string | undefined,
  fallback: boolean,
): boolean {
  if (value === undefined) return fallback;
  const normalized = value.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  return fallback;
}
