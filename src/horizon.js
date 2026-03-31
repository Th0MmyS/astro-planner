/**
 * Parse a NINA/Stellarium horizon file.
 * Expected format: lines of "azimuth altitude" (degrees), space or tab separated.
 * Lines starting with # are comments. Blank lines are skipped.
 * Returns sorted array of { az, alt } pairs.
 */
export function parseHorizonFile(text) {
  const points = []

  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line || line.startsWith('#') || line.startsWith('//')) continue

    const parts = line.split(/[\s,;]+/)
    if (parts.length < 2) continue

    const az = parseFloat(parts[0])
    const alt = parseFloat(parts[1])
    if (isNaN(az) || isNaN(alt)) continue

    points.push({ az, alt })
  }

  points.sort((a, b) => a.az - b.az)
  return points
}

/**
 * Get the horizon altitude at a given azimuth via linear interpolation.
 * If no horizon data, returns 0.
 */
export function horizonAltAt(horizonPoints, azimuth) {
  if (!horizonPoints || horizonPoints.length === 0) return 0

  // Normalize azimuth to [0, 360)
  let az = ((azimuth % 360) + 360) % 360

  // Find bracketing points
  const n = horizonPoints.length

  // If az is before first point or after last, wrap around
  if (az <= horizonPoints[0].az || az >= horizonPoints[n - 1].az) {
    const p0 = horizonPoints[n - 1]
    const p1 = horizonPoints[0]
    const span = (p1.az + 360) - p0.az
    const t = span === 0 ? 0 : (((az < p0.az ? az + 360 : az) - p0.az) / span)
    return p0.alt + t * (p1.alt - p0.alt)
  }

  // Binary search for the bracket
  let lo = 0, hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (horizonPoints[mid].az <= az) lo = mid
    else hi = mid
  }

  const p0 = horizonPoints[lo]
  const p1 = horizonPoints[hi]
  const t = (p1.az - p0.az) === 0 ? 0 : (az - p0.az) / (p1.az - p0.az)
  return p0.alt + t * (p1.alt - p0.alt)
}
