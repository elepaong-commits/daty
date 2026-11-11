/** `1.2GB`, `340MB`, `12KB` (decimal units, like storage plans count them). */
export function formatBytes(bytes: number) {
  if (bytes >= 1e9) return `${(bytes / 1e9).toFixed(bytes >= 1e10 ? 0 : 1)}GB`
  if (bytes >= 1e6) return `${Math.round(bytes / 1e6)}MB`
  return `${Math.max(Math.round(bytes / 1e3), bytes > 0 ? 1 : 0)}KB`
}

/** `850m` or `2.4km`. */
export const formatDistance = (meters: number) => (meters < 1000 ? `${Math.round(meters / 10) * 10}m` : `${(meters / 1000).toFixed(meters < 10_000 ? 1 : 0)}km`)

/** Great-circle distance in meters. */
export function distanceBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (deg: number) => (deg * Math.PI) / 180
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}
