export function getApiHostLabel(apiBaseUrl: string) {
  const trimmed = apiBaseUrl.trim();
  if (!trimmed) {
    return "—";
  }

  try {
    return new URL(trimmed).host;
  } catch {
    return trimmed;
  }
}

export function hasBearerToken(value: string) {
  return value.trim() !== "";
}
