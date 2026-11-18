// The request URL can contain the container bind address behind a reverse proxy.
// Use the configured public origin, never untrusted forwarded-host headers.
export function publicOrigin(requestUrl: string): string {
  return new URL(process.env.CL2_BASE_URL || requestUrl).origin;
}

export function publicRedirect(path: string, requestUrl: string): URL {
  const origin = publicOrigin(requestUrl);
  const target = new URL(path, origin);
  // URL parsing normalizes whitespace and slashes; check after normalization.
  return target.origin === origin ? target : new URL('/', origin);
}
