const TAP_URL = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync'
const CACHE_KEY = 'astro_catalog'
const CACHE_VERSION_KEY = 'astro_catalog_version'
const CACHE_VERSION = '3'

// Well-known common names, keyed by normalized id (lowercase, no spaces)
const COMMON_NAMES = {
  'm1': 'Crab Nebula', 'm8': 'Lagoon Nebula', 'm11': 'Wild Duck Cluster',
  'm13': 'Hercules Cluster', 'm16': 'Eagle Nebula', 'm17': 'Omega Nebula',
  'm20': 'Trifid Nebula', 'm22': 'Sagittarius Cluster', 'm27': 'Dumbbell Nebula',
  'm31': 'Andromeda Galaxy', 'm33': 'Triangulum Galaxy', 'm42': 'Orion Nebula',
  'm43': 'De Mairan\'s Nebula', 'm44': 'Beehive Cluster', 'm45': 'Pleiades',
  'm51': 'Whirlpool Galaxy', 'm57': 'Ring Nebula', 'm63': 'Sunflower Galaxy',
  'm64': 'Black Eye Galaxy', 'm74': 'Phantom Galaxy', 'm78': 'Casper the Ghost Nebula',
  'm81': 'Bode\'s Galaxy', 'm82': 'Cigar Galaxy', 'm83': 'Southern Pinwheel Galaxy',
  'm87': 'Virgo A', 'm97': 'Owl Nebula', 'm101': 'Pinwheel Galaxy',
  'm104': 'Sombrero Galaxy', 'm106': 'Starfish Galaxy', 'm110': 'Edward Young Star',
  'ngc253': 'Sculptor Galaxy', 'ngc281': 'Pacman Nebula',
  'ngc457': 'Owl Cluster', 'ngc869': 'Double Cluster', 'ngc884': 'Double Cluster',
  'ngc1499': 'California Nebula', 'ngc1952': 'Crab Nebula',
  'ngc1976': 'Orion Nebula', 'ngc2024': 'Flame Nebula', 'ngc2070': 'Tarantula Nebula',
  'ngc2237': 'Rosette Nebula', 'ngc2244': 'Rosette Cluster',
  'ngc2264': 'Cone Nebula', 'ngc2392': 'Eskimo Nebula',
  'ngc3372': 'Carina Nebula', 'ngc4565': 'Needle Galaxy',
  'ngc4631': 'Whale Galaxy', 'ngc4656': 'Hockey Stick Galaxy',
  'ngc5128': 'Centaurus A', 'ngc5139': 'Omega Centauri',
  'ngc5907': 'Splinter Galaxy', 'ngc6334': 'Cat\'s Paw Nebula',
  'ngc6523': 'Lagoon Nebula', 'ngc6543': 'Cat\'s Eye Nebula',
  'ngc6611': 'Eagle Nebula', 'ngc6720': 'Ring Nebula',
  'ngc6826': 'Blinking Nebula', 'ngc6888': 'Crescent Nebula',
  'ngc6960': 'Western Veil Nebula', 'ngc6992': 'Eastern Veil Nebula',
  'ngc7000': 'North America Nebula', 'ngc7009': 'Saturn Nebula',
  'ngc7023': 'Iris Nebula', 'ngc7293': 'Helix Nebula',
  'ngc7331': 'Deer Lick Galaxy', 'ngc7380': 'Wizard Nebula',
  'ngc7635': 'Bubble Nebula', 'ngc7662': 'Blue Snowball Nebula',
  'ngc7822': 'Ced 214', 'ic434': 'Horsehead Nebula',
  'ic1396': 'Elephant\'s Trunk Nebula', 'ic1805': 'Heart Nebula',
  'ic1848': 'Soul Nebula', 'ic2118': 'Witch Head Nebula',
  'ic2177': 'Seagull Nebula', 'ic2602': 'Southern Pleiades',
  'ic4604': 'Rho Ophiuchi', 'ic5070': 'Pelican Nebula',
  'ic5146': 'Cocoon Nebula',
}

// Caldwell objects mapped to their NGC/IC identifiers
const CALDWELL_MAP = {
  'C 1': 'NGC 188', 'C 2': 'NGC 40', 'C 3': 'NGC 4236', 'C 4': 'NGC 7023',
  'C 5': 'IC 342', 'C 6': 'NGC 6543', 'C 7': 'NGC 2403', 'C 8': 'NGC 559',
  'C 9': 'NGC 225', 'C 10': 'NGC 663', 'C 11': 'NGC 7635', 'C 12': 'NGC 6946',
  'C 13': 'NGC 457', 'C 14': 'NGC 869', 'C 15': 'NGC 6826', 'C 16': 'NGC 7243',
  'C 17': 'NGC 147', 'C 18': 'NGC 185', 'C 19': 'IC 5146', 'C 20': 'NGC 7000',
  'C 21': 'NGC 4449', 'C 22': 'NGC 7662', 'C 23': 'NGC 891', 'C 24': 'NGC 1275',
  'C 25': 'NGC 2419', 'C 26': 'NGC 4244', 'C 27': 'NGC 6888', 'C 28': 'NGC 752',
  'C 29': 'NGC 5005', 'C 30': 'NGC 7331', 'C 31': 'IC 405', 'C 32': 'NGC 4631',
  'C 33': 'NGC 6992', 'C 34': 'NGC 6960', 'C 35': 'NGC 4889', 'C 36': 'NGC 4559',
  'C 37': 'NGC 6885', 'C 38': 'NGC 4565', 'C 39': 'NGC 2392', 'C 40': 'NGC 3626',
  'C 41': 'NGC 3532', 'C 42': 'NGC 7006', 'C 43': 'NGC 7814', 'C 44': 'NGC 7479',
  'C 45': 'NGC 5248', 'C 46': 'NGC 2261', 'C 47': 'NGC 6934', 'C 48': 'NGC 2775',
  'C 49': 'NGC 2237', 'C 50': 'NGC 2244', 'C 51': 'IC 1613', 'C 52': 'NGC 4697',
  'C 53': 'NGC 3115', 'C 54': 'NGC 2506', 'C 55': 'NGC 7009', 'C 56': 'NGC 246',
  'C 57': 'NGC 6822', 'C 58': 'NGC 2360', 'C 59': 'NGC 3242', 'C 60': 'NGC 4038',
  'C 61': 'NGC 4039', 'C 62': 'NGC 247', 'C 63': 'NGC 7293', 'C 64': 'NGC 2362',
  'C 65': 'NGC 253', 'C 66': 'NGC 5694', 'C 67': 'NGC 1097', 'C 68': 'NGC 6729',
  'C 69': 'NGC 6302', 'C 70': 'NGC 300', 'C 71': 'NGC 2477', 'C 72': 'NGC 55',
  'C 73': 'NGC 1851', 'C 74': 'NGC 3132', 'C 75': 'NGC 6124', 'C 76': 'NGC 6231',
  'C 77': 'NGC 5128', 'C 78': 'NGC 6541', 'C 79': 'NGC 3201', 'C 80': 'NGC 5139',
  'C 81': 'NGC 6352', 'C 82': 'NGC 6193', 'C 83': 'NGC 4945', 'C 84': 'NGC 5286',
  'C 85': 'IC 2391', 'C 86': 'NGC 6397', 'C 87': 'NGC 1261', 'C 88': 'NGC 5823',
  'C 89': 'NGC 6087', 'C 90': 'NGC 2867', 'C 91': 'NGC 3532', 'C 92': 'NGC 3372',
  'C 93': 'NGC 6752', 'C 94': 'NGC 4755', 'C 95': 'NGC 6025', 'C 96': 'NGC 2516',
  'C 97': 'NGC 3766', 'C 98': 'NGC 4609', 'C 99': 'NGC 3532', 'C 100': 'IC 2944',
  'C 101': 'NGC 6744', 'C 102': 'IC 2602', 'C 103': 'NGC 2070', 'C 104': 'NGC 362',
  'C 105': 'NGC 4833', 'C 106': 'NGC 104', 'C 107': 'NGC 6101', 'C 108': 'NGC 4372',
  'C 109': 'NGC 3195',
}

// Reverse map: NGC/IC id -> Caldwell id
const REVERSE_CALDWELL = {}
for (const [c, ngc] of Object.entries(CALDWELL_MAP)) {
  REVERSE_CALDWELL[ngc] = c
}

/**
 * Fetch Messier + NGC + IC catalog from SIMBAD TAP, with localStorage caching.
 * Also fetches common names for objects.
 * Returns array of { id, ra, dec, name, caldwell }
 */
/**
 * Enrich catalog entries with hardcoded common names where missing.
 */
export function enrichWithNames(catalog) {
  for (const obj of catalog) {
    if (!obj.name) {
      const key = obj.id.toLowerCase().replace(/\s+/g, '')
      obj.name = COMMON_NAMES[key] || null
    }
    if (!obj.caldwell) {
      obj.caldwell = REVERSE_CALDWELL[obj.id] || null
    }
  }
  return catalog
}

export async function fetchCatalog(onProgress) {
  // Check cache
  if (localStorage.getItem(CACHE_VERSION_KEY) === CACHE_VERSION) {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY))
      if (cached && cached.length > 0) {
        if (onProgress) onProgress('Loaded from cache')
        return enrichWithNames(cached)
      }
    } catch {}
  }

  const results = []

  // Fetch Messier
  if (onProgress) onProgress('Fetching Messier catalog...')
  const messier = await queryTAPRetry(
    `SELECT TOP 200 id, ra, dec, main_id FROM ident JOIN basic ON oidref = oid WHERE id LIKE 'M %' AND ra IS NOT NULL AND dec IS NOT NULL`
  )
  results.push(...messier)

  // Fetch NGC in batches (with delay to avoid rate limiting)
  for (let q = 0; q < 4; q++) {
    const raLo = q * 90
    const raHi = (q + 1) * 90
    if (onProgress) onProgress(`Fetching NGC catalog (${q + 1}/4)...`)
    await delay(500)
    const batch = await queryTAPRetry(
      `SELECT TOP 2500 id, ra, dec, main_id FROM ident JOIN basic ON oidref = oid WHERE id LIKE 'NGC %' AND ra IS NOT NULL AND dec IS NOT NULL AND ra >= ${raLo} AND ra < ${raHi}`
    )
    results.push(...batch)
  }

  // Fetch IC in batches
  for (let q = 0; q < 4; q++) {
    const raLo = q * 90
    const raHi = (q + 1) * 90
    if (onProgress) onProgress(`Fetching IC catalog (${q + 1}/4)...`)
    await delay(500)
    const batch = await queryTAPRetry(
      `SELECT TOP 2500 id, ra, dec, main_id FROM ident JOIN basic ON oidref = oid WHERE id LIKE 'IC %' AND ra IS NOT NULL AND dec IS NOT NULL AND ra >= ${raLo} AND ra < ${raHi}`
    )
    results.push(...batch)
  }

  // Now fetch common names for all objects via main_id
  // Collect unique main_ids
  const mainIds = new Set(results.map(r => r.mainId).filter(Boolean))

  // Fetch common names (NAME * identifiers) in batches
  if (onProgress) onProgress('Fetching common names...')
  const nameMap = await fetchCommonNames(mainIds, onProgress)

  // Deduplicate by id and enrich with names
  const seen = new Set()
  const deduped = []
  for (const obj of results) {
    const key = obj.id.trim()
    if (!seen.has(key)) {
      seen.add(key)
      const normalizedKey = key.toLowerCase().replace(/\s+/g, '')
      const commonName = nameMap.get(obj.mainId) || COMMON_NAMES[normalizedKey] || null
      const caldwell = REVERSE_CALDWELL[key] || null
      deduped.push({ id: key, ra: obj.ra, dec: obj.dec, name: commonName, caldwell })
    }
  }

  // Sort naturally
  deduped.sort((a, b) => {
    const prefixOrder = { 'M': 0, 'C': 1, 'N': 2, 'I': 3 }
    const aP = prefixOrder[a.id[0]] ?? 9
    const bP = prefixOrder[b.id[0]] ?? 9
    if (aP !== bP) return aP - bP
    const aNum = parseInt(a.id.replace(/^(M|NGC|IC)\s*/, ''))
    const bNum = parseInt(b.id.replace(/^(M|NGC|IC)\s*/, ''))
    return aNum - bNum
  })

  // Cache - use try/catch in case localStorage is full
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(deduped))
    localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION)
  } catch {
    // If too big, try storing without names to save space
    try {
      const slim = deduped.map(({ id, ra, dec, caldwell }) => ({ id, ra, dec, caldwell }))
      localStorage.setItem(CACHE_KEY, JSON.stringify(slim))
      localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION)
    } catch {}
  }

  if (onProgress) onProgress(`Loaded ${deduped.length} objects`)
  return deduped
}

async function fetchCommonNames(mainIds, onProgress) {
  const nameMap = new Map()
  const idArray = [...mainIds]

  // Batch into groups to avoid overly long queries
  const batchSize = 200
  for (let i = 0; i < idArray.length; i += batchSize) {
    const batch = idArray.slice(i, i + batchSize)
    const escaped = batch.map(id => `'${id.replace(/'/g, "''")}'`).join(',')

    try {
      const rows = await queryTAPRaw(
        `SELECT main_id, id FROM ident WHERE main_id IN (${escaped}) AND id LIKE 'NAME %'`
      )
      for (const [mainId, nameId] of rows) {
        // Strip "NAME " prefix
        const name = nameId.replace(/^NAME\s+/, '')
        // Keep the shortest/most common name
        if (!nameMap.has(mainId) || name.length < nameMap.get(mainId).length) {
          nameMap.set(mainId, name)
        }
      }
    } catch {}

    if (onProgress && i % 1000 === 0 && i > 0) {
      onProgress(`Fetching names... (${i}/${idArray.length})`)
    }
  }

  return nameMap
}

function delay(ms) {
  return new Promise(r => setTimeout(r, ms))
}

async function queryTAPRetry(query, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      return await queryTAP(query)
    } catch (e) {
      if (i === retries - 1) throw e
      await delay(2000 * (i + 1)) // backoff: 2s, 4s, 6s
    }
  }
}

async function queryTAP(query) {
  const body = new URLSearchParams({
    request: 'doQuery',
    lang: 'adql',
    format: 'json',
    query,
  })

  const res = await fetch(TAP_URL, { method: 'POST', body })
  if (!res.ok) throw new Error(`TAP query failed: ${res.status}`)

  const json = await res.json()
  if (!json.data) return []

  return json.data.map(([id, ra, dec, mainId]) => ({ id: id.trim(), ra, dec, mainId }))
}

async function queryTAPRaw(query) {
  const body = new URLSearchParams({
    request: 'doQuery',
    lang: 'adql',
    format: 'json',
    query,
  })

  const res = await fetch(TAP_URL, { method: 'POST', body })
  if (!res.ok) return []

  const json = await res.json()
  return json.data || []
}

/**
 * Clear the catalog cache (useful if data seems stale).
 */
export function clearCatalogCache() {
  localStorage.removeItem(CACHE_KEY)
  localStorage.removeItem(CACHE_VERSION_KEY)
}
