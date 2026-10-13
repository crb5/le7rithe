export const DEFAULT_TRUST_PROXY_HOPS = 3;

export function trustProxyHops(value = process.env.TRUST_PROXY_HOPS): number {
  if (value === undefined) return DEFAULT_TRUST_PROXY_HOPS;
  const normalized = value.trim();
  if (!/^[0-5]$/.test(normalized)) {
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 5.");
  }
  return Number(normalized);
}
