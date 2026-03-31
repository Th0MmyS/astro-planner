const TAP_URL = 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync'

/**
 * Resolve a SIMBAD identifier to RA/Dec.
 * Returns { name, ra, dec } (degrees) or null if not found.
 */
export async function resolveSimbad(identifier) {
  const cleaned = identifier.trim()
  if (!cleaned) return null

  const query = `SELECT TOP 1 main_id, ra, dec FROM basic JOIN ident ON oid = oidref WHERE id = '${cleaned.replace(/'/g, "''")}'`

  const params = new URLSearchParams({
    request: 'doQuery',
    lang: 'adql',
    format: 'json',
    query,
  })

  const res = await fetch(`${TAP_URL}?${params}`)
  if (!res.ok) return null

  const json = await res.json()
  const rows = json.data
  if (!rows || rows.length === 0) return null

  const [name, ra, dec] = rows[0]
  if (ra == null || dec == null) return null

  return { name, ra, dec }
}
