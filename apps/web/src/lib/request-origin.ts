/** Browsers control Origin and Host; never accept a forwarded host from the caller. */
export function isSameOrigin(
  origin: string | null,
  host: string | null,
  protocol: string,
): boolean {
  if (!origin || !host) return false;
  try {
    const url = new URL(origin);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.protocol === protocol &&
      url.host === host
    );
  } catch {
    return false;
  }
}
