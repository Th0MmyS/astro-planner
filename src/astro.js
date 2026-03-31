const DEG = Math.PI / 180
const RAD = 180 / Math.PI

/** Convert JS Date to Julian Date */
export function toJD(date) {
  return date.getTime() / 86400000 + 2440587.5
}

/** Greenwich Mean Sidereal Time in degrees from Julian Date */
export function gmst(jd) {
  const T = (jd - 2451545.0) / 36525.0
  let theta = 280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * T * T -
    T * T * T / 38710000.0
  return ((theta % 360) + 360) % 360
}

/** Local Sidereal Time in degrees */
export function lst(jd, lonDeg) {
  return ((gmst(jd) + lonDeg) % 360 + 360) % 360
}

/**
 * Compute altitude and azimuth of an object.
 * @param {number} raDeg - Right ascension in degrees
 * @param {number} decDeg - Declination in degrees
 * @param {number} latDeg - Observer latitude in degrees
 * @param {number} lonDeg - Observer longitude in degrees
 * @param {Date} date - Time of observation
 * @returns {{ alt: number, az: number }} altitude and azimuth in degrees
 */
export function altAz(raDeg, decDeg, latDeg, lonDeg, date) {
  const jd = toJD(date)
  const lsid = lst(jd, lonDeg)
  const ha = (lsid - raDeg) * DEG
  const dec = decDeg * DEG
  const lat = latDeg * DEG

  const sinAlt = Math.sin(dec) * Math.sin(lat) + Math.cos(dec) * Math.cos(lat) * Math.cos(ha)
  const alt = Math.asin(sinAlt)

  const cosAz = (Math.sin(dec) - Math.sin(alt) * Math.sin(lat)) / (Math.cos(alt) * Math.cos(lat))
  let az = Math.acos(Math.max(-1, Math.min(1, cosAz))) * RAD
  if (Math.sin(ha) > 0) az = 360 - az

  return { alt: alt * RAD, az }
}

/**
 * Compute altitude data for an object over the next 24 hours.
 * Returns array of { time: Date, alt: number, az: number } every 5 minutes.
 */
export function computeAltitudeTrack(raDeg, decDeg, latDeg, lonDeg, startDate) {
  const points = []
  const start = new Date(startDate)
  for (let m = 0; m <= 24 * 60; m += 5) {
    const t = new Date(start.getTime() + m * 60000)
    const { alt, az } = altAz(raDeg, decDeg, latDeg, lonDeg, t)
    points.push({ time: t, alt, az })
  }
  return points
}

/**
 * Find transit (maximum altitude) from a track.
 * Returns { time, alt, az, direction }
 */
export function findTransit(track) {
  let best = track[0]
  for (const p of track) {
    if (p.alt > best.alt) best = p
  }
  const direction = best.az <= 180 ? 'south' : 'north'
  return { time: best.time, alt: best.alt, az: best.az, direction }
}

/**
 * Find rise and set times (altitude crosses threshold, default 0).
 * Returns { rise: Date|null, set: Date|null }
 */
export function findRiseSet(track, horizonAltFn) {
  const getThreshold = horizonAltFn || (() => 0)
  let rise = null, set = null

  for (let i = 1; i < track.length; i++) {
    const prev = track[i - 1]
    const curr = track[i]
    const prevThresh = getThreshold(prev.az)
    const currThresh = getThreshold(curr.az)

    const prevAbove = prev.alt >= prevThresh
    const currAbove = curr.alt >= currThresh

    if (!prevAbove && currAbove && !rise) {
      rise = curr.time
    }
    if (prevAbove && !currAbove && !set) {
      set = curr.time
    }
  }

  return { rise, set }
}

/* ---- Sun position (simplified) ---- */

/**
 * Approximate sun RA/Dec in degrees for a given date.
 * Uses a simplified algorithm accurate to ~1 degree.
 */
export function sunPosition(date) {
  const jd = toJD(date)
  const n = jd - 2451545.0 // days from J2000

  // Mean longitude and mean anomaly
  const L = ((280.460 + 0.9856474 * n) % 360 + 360) % 360
  const g = ((357.528 + 0.9856003 * n) % 360 + 360) % 360
  const gRad = g * DEG

  // Ecliptic longitude
  const lambda = L + 1.915 * Math.sin(gRad) + 0.020 * Math.sin(2 * gRad)
  const lambdaRad = lambda * DEG

  // Obliquity of ecliptic
  const epsilon = 23.439 - 0.0000004 * n
  const epsilonRad = epsilon * DEG

  // RA and Dec
  const ra = Math.atan2(Math.cos(epsilonRad) * Math.sin(lambdaRad), Math.cos(lambdaRad)) * RAD
  const dec = Math.asin(Math.sin(epsilonRad) * Math.sin(lambdaRad)) * RAD

  return { ra: ((ra % 360) + 360) % 360, dec }
}

/**
 * Compute sun altitude at a given time and location.
 */
export function sunAltitude(latDeg, lonDeg, date) {
  const { ra, dec } = sunPosition(date)
  return altAz(ra, dec, latDeg, lonDeg, date).alt
}

/* ---- Moon position (simplified) ---- */

/**
 * Approximate moon RA/Dec in degrees for a given date.
 * Low-precision algorithm (~1° accuracy), sufficient for altitude plotting.
 */
export function moonPosition(date) {
  const jd = toJD(date)
  const T = (jd - 2451545.0) / 36525.0

  // Moon's mean longitude
  const L0 = ((218.3165 + 481267.8813 * T) % 360 + 360) % 360
  // Moon's mean anomaly
  const M = ((134.9634 + 477198.8676 * T) % 360 + 360) % 360
  // Moon's mean elongation
  const D = ((297.8502 + 445267.1115 * T) % 360 + 360) % 360
  // Sun's mean anomaly
  const Ms = ((357.5291 + 35999.0503 * T) % 360 + 360) % 360
  // Moon's argument of latitude
  const F = ((93.2720 + 483202.0175 * T) % 360 + 360) % 360

  const Mr = M * DEG
  const Dr = D * DEG
  const Msr = Ms * DEG
  const Fr = F * DEG

  // Ecliptic longitude
  const lambda = L0
    + 6.289 * Math.sin(Mr)
    - 1.274 * Math.sin(2 * Dr - Mr)
    + 0.658 * Math.sin(2 * Dr)
    + 0.214 * Math.sin(2 * Mr)
    - 0.186 * Math.sin(Msr)
    - 0.114 * Math.sin(2 * Fr)

  // Ecliptic latitude
  const beta = 5.128 * Math.sin(Fr)
    + 0.281 * Math.sin(Mr + Fr)
    + 0.078 * Math.sin(2 * Dr - Fr)

  const lambdaRad = lambda * DEG
  const betaRad = beta * DEG

  // Obliquity of ecliptic
  const epsilon = (23.439 - 0.0000004 * (jd - 2451545.0)) * DEG

  // Convert ecliptic to equatorial
  const sinRa = Math.sin(lambdaRad) * Math.cos(epsilon) - Math.tan(betaRad) * Math.sin(epsilon)
  const cosRa = Math.cos(lambdaRad)
  const ra = Math.atan2(sinRa, cosRa) * RAD

  const dec = Math.asin(
    Math.sin(betaRad) * Math.cos(epsilon) +
    Math.cos(betaRad) * Math.sin(epsilon) * Math.sin(lambdaRad)
  ) * RAD

  return { ra: ((ra % 360) + 360) % 360, dec }
}

/**
 * Compute moon altitude track over the next 24 hours.
 */
export function computeMoonTrack(latDeg, lonDeg, startDate) {
  const points = []
  const start = new Date(startDate)
  for (let m = 0; m <= 24 * 60; m += 5) {
    const t = new Date(start.getTime() + m * 60000)
    const { ra, dec } = moonPosition(t)
    const { alt, az } = altAz(ra, dec, latDeg, lonDeg, t)
    points.push({ time: t, alt, az })
  }
  return points
}

/**
 * Compute twilight boundaries for the next 24 hours.
 * Returns arrays of time ranges for civil, nautical, astronomical twilight, and night.
 * Each entry: { start: Date, end: Date }
 */
export function computeTwilightPeriods(latDeg, lonDeg, startDate) {
  const intervals = { day: [], civil: [], nautical: [], astro: [], night: [] }
  const step = 5 // minutes
  const start = new Date(startDate)

  let prevCategory = null
  let periodStart = null

  for (let m = 0; m <= 24 * 60; m += step) {
    const t = new Date(start.getTime() + m * 60000)
    const sunAlt = sunAltitude(latDeg, lonDeg, t)

    let category
    if (sunAlt > 0) category = 'day'
    else if (sunAlt > -6) category = 'civil'
    else if (sunAlt > -12) category = 'nautical'
    else if (sunAlt > -18) category = 'astro'
    else category = 'night'

    if (category !== prevCategory) {
      if (prevCategory && periodStart) {
        intervals[prevCategory].push({ start: periodStart, end: t })
      }
      periodStart = t
      prevCategory = category
    }
  }

  // Close the last period
  if (prevCategory && periodStart) {
    const end = new Date(start.getTime() + 24 * 60 * 60000)
    intervals[prevCategory].push({ start: periodStart, end })
  }

  return intervals
}
