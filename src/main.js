import './style.css'
import { parseHorizonFile, horizonAltAt } from './horizon.js'
import { computeAltitudeTrack, findTransit, findRiseSet, computeTwilightPeriods, computeMoonTrack, altAz, sunAltitude, moonPosition, angularSeparation } from './astro.js'
import { renderChart, buildInfoHTML } from './chart.js'
import { fetchCatalog, enrichWithNames } from './catalog.js'
import { t, getLang, setLang, getAvailableLanguages } from './i18n.js'

// --- Language selector ---
const langSelect = document.getElementById('lang-select')
for (const lang of getAvailableLanguages()) {
  const opt = document.createElement('option')
  opt.value = lang.code
  opt.textContent = `${lang.flag} ${lang.label}`
  if (lang.code === getLang()) opt.selected = true
  langSelect.appendChild(opt)
}

langSelect.addEventListener('change', () => {
  setLang(langSelect.value)
  applyTranslations()
  // Re-render chart if visible
  if (resolvedObject && lat != null && lon != null) generateChart()
})

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.dataset.i18n)
  })
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.dataset.i18nPlaceholder)
  })
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle)
  })
  // Update fetch button if catalog loaded
  if (cachedCatalog) {
    fetchBtnText.textContent = `${t('catalogLoaded')} (${cachedCatalog.length})`
  }
}

// State
let resolvedObject = null
let horizonPoints = null
let lat = null
let lon = null

// DOM elements
const simbadInput = document.getElementById('simbad-input')
const simbadStatus = document.getElementById('simbad-status')
const simbadName = document.getElementById('simbad-name')
const horizonFile = document.getElementById('horizon-file')
const horizonStatus = document.getElementById('horizon-status')
const latInput = document.getElementById('lat-input')
const lonInput = document.getElementById('lon-input')
const geoBtn = document.getElementById('geo-btn')
const okBtn = document.getElementById('ok-btn')
const chartSection = document.getElementById('chart-section')
const canvas = document.getElementById('altitude-chart')
const infoBar = document.getElementById('info-bar')
const statsPanel = document.getElementById('stats-panel')
const showMoonCheckbox = document.getElementById('show-moon')
const minAltInput = document.getElementById('min-alt-input')

showMoonCheckbox.addEventListener('change', () => {
  if (resolvedObject && lat != null && lon != null) generateChart()
})

minAltInput.addEventListener('input', () => {
  if (resolvedObject && lat != null && lon != null) generateChart()
})

// --- Object history ---
const HISTORY_KEY = 'astro_object_history'
const MAX_HISTORY = 5

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] }
  catch { return [] }
}

function addToHistory(identifier) {
  let history = getHistory().filter(h => h.toLowerCase() !== identifier.toLowerCase())
  history.unshift(identifier)
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

// --- Autocomplete from cached catalog ---
const autocompleteList = document.getElementById('autocomplete-list')
let cachedCatalog = null
let activeAutocompleteIndex = -1

// Load catalog cache on startup
const fetchCatalogBtn = document.getElementById('fetch-catalog-btn')
const fetchBtnText = document.getElementById('fetch-btn-text')
const fetchSpinner = document.getElementById('fetch-spinner')

try {
  const cached = localStorage.getItem('astro_catalog')
  if (cached) {
    cachedCatalog = enrichWithNames(JSON.parse(cached))
    fetchBtnText.textContent = `${t('catalogLoaded')} (${cachedCatalog.length})`
  }
} catch {}

fetchCatalogBtn.addEventListener('click', async () => {
  fetchCatalogBtn.disabled = true
  fetchSpinner.classList.remove('hidden')
  fetchBtnText.textContent = 'Loading...'

  try {
    cachedCatalog = await fetchCatalog((msg) => {
      fetchBtnText.textContent = msg
    })
    fetchBtnText.textContent = `${t('catalogLoaded')} (${cachedCatalog.length})`
  } catch (e) {
    fetchBtnText.textContent = `Error: ${e.message}`
  } finally {
    fetchSpinner.classList.add('hidden')
    fetchCatalogBtn.disabled = false
  }
})

function showAutocomplete(query) {
  autocompleteList.innerHTML = ''
  autocompleteList.classList.add('hidden')
  activeAutocompleteIndex = -1

  if (!query || query.length < 1) return

  const q = query.toLowerCase().replace(/\s+/g, '')
  const matches = []

  // Search history first
  for (const h of getHistory()) {
    if (h.toLowerCase().replace(/\s+/g, '').includes(q)) {
      matches.push({ id: h, source: 'recent' })
    }
  }

  // Search catalog by id, common name, or caldwell designation
  if (cachedCatalog) {
    for (const obj of cachedCatalog) {
      if (matches.length >= 10) break
      if (matches.some(m => m.id === obj.id)) continue
      const normalized = obj.id.toLowerCase().replace(/\s+/g, '')
      const nameLower = obj.name ? obj.name.toLowerCase().replace(/\s+/g, '') : ''
      const caldwellLower = obj.caldwell ? obj.caldwell.toLowerCase().replace(/\s+/g, '') : ''
      if (normalized.includes(q) || nameLower.includes(q) || caldwellLower.includes(q)) {
        matches.push({ id: obj.id, ra: obj.ra, dec: obj.dec, name: obj.name, source: 'catalog' })
      }
    }
  }

  if (matches.length === 0) return

  autocompleteList.classList.remove('hidden')
  for (const match of matches) {
    const li = document.createElement('li')
    li.textContent = match.id
    if (match.name) {
      const hint = document.createElement('span')
      hint.className = 'match-hint'
      hint.textContent = match.name
      li.appendChild(hint)
    } else if (match.source === 'recent') {
      const hint = document.createElement('span')
      hint.className = 'match-hint'
      hint.textContent = t('recent')
      li.appendChild(hint)
    }
    li.addEventListener('mousedown', (e) => {
      e.preventDefault()
      selectAutocomplete(match)
    })
    autocompleteList.appendChild(li)
  }
}

function selectAutocomplete(match) {
  simbadInput.value = match.id
  autocompleteList.classList.add('hidden')

  if (match.ra != null && match.dec != null) {
    resolvedObject = { name: match.id, ra: match.ra, dec: match.dec }
    simbadStatus.textContent = '\u2713'
    simbadStatus.className = 'status-icon valid'
    simbadName.textContent = `${match.id} (${match.ra.toFixed(4)}°, ${match.dec.toFixed(4)}°)`
    addToHistory(match.id)
    updateOkButton()
  } else {
    // History item without coords — try catalog lookup
    const catalogMatch = findCatalogMatch(match.id)
    if (catalogMatch) {
      resolvedObject = { name: catalogMatch.id, ra: catalogMatch.ra, dec: catalogMatch.dec }
      simbadStatus.textContent = '\u2713'
      simbadStatus.className = 'status-icon valid'
      simbadName.textContent = `${catalogMatch.id} (${catalogMatch.ra.toFixed(4)}°, ${catalogMatch.dec.toFixed(4)}°)`
      updateOkButton()
    }
  }
}

simbadInput.addEventListener('focus', () => {
  if (simbadInput.value.trim()) showAutocomplete(simbadInput.value.trim())
})

simbadInput.addEventListener('blur', () => {
  // Small delay so mousedown on list item fires first
  setTimeout(() => autocompleteList.classList.add('hidden'), 150)
})

simbadInput.addEventListener('keydown', (e) => {
  const items = autocompleteList.querySelectorAll('li')
  if (!items.length) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeAutocompleteIndex = Math.min(activeAutocompleteIndex + 1, items.length - 1)
    updateAutocompleteActive(items)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeAutocompleteIndex = Math.max(activeAutocompleteIndex - 1, 0)
    updateAutocompleteActive(items)
  } else if (e.key === 'Enter' && activeAutocompleteIndex >= 0) {
    e.preventDefault()
    items[activeAutocompleteIndex].dispatchEvent(new MouseEvent('mousedown'))
  }
})

function updateAutocompleteActive(items) {
  items.forEach((li, i) => li.classList.toggle('active', i === activeAutocompleteIndex))
}

// --- Catalog-based input validation ---
simbadInput.addEventListener('input', () => {
  resolvedObject = null
  updateOkButton()

  const value = simbadInput.value.trim()
  showAutocomplete(value)

  if (!value) {
    simbadStatus.textContent = ''
    simbadStatus.className = 'status-icon'
    simbadName.textContent = ''
    return
  }

  // Resolve from cached catalog only
  const catalogMatch = findCatalogMatch(value)
  if (catalogMatch) {
    resolvedObject = { name: catalogMatch.id, ra: catalogMatch.ra, dec: catalogMatch.dec }
    simbadStatus.textContent = '\u2713'
    simbadStatus.className = 'status-icon valid'
    simbadName.textContent = `${catalogMatch.id}${catalogMatch.name ? ' — ' + catalogMatch.name : ''} (${catalogMatch.ra.toFixed(4)}°, ${catalogMatch.dec.toFixed(4)}°)`
    addToHistory(catalogMatch.id)
    updateOkButton()
  } else if (cachedCatalog) {
    simbadStatus.textContent = '\u2717'
    simbadStatus.className = 'status-icon invalid'
    simbadName.textContent = t('notFoundCatalog')
  } else {
    simbadStatus.textContent = '\u2717'
    simbadStatus.className = 'status-icon invalid'
    simbadName.textContent = t('loadCatalogFirst')
  }
})

/** Try to find a match in the cached catalog by id, common name, or partial match. */
function findCatalogMatch(query) {
  if (!cachedCatalog) return null
  const q = query.toLowerCase().replace(/\s+/g, '')
  if (!q) return null

  for (const obj of cachedCatalog) {
    const id = obj.id.toLowerCase().replace(/\s+/g, '')
    const name = obj.name ? obj.name.toLowerCase().replace(/\s+/g, '') : ''
    const caldwell = obj.caldwell ? obj.caldwell.toLowerCase().replace(/\s+/g, '') : ''

    // Exact match on id, name, or caldwell
    if (id === q || name === q || caldwell === q) return obj
  }

  // Partial match (3+ chars)
  if (q.length >= 3) {
    for (const obj of cachedCatalog) {
      const id = obj.id.toLowerCase().replace(/\s+/g, '')
      const name = obj.name ? obj.name.toLowerCase().replace(/\s+/g, '') : ''
      if (id.includes(q) || name.includes(q)) return obj
    }
  }

  return null
}

// --- Horizon file ---
horizonFile.addEventListener('change', (e) => {
  const file = e.target.files[0]
  if (!file) {
    horizonPoints = null
    horizonStatus.textContent = ''
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    horizonPoints = parseHorizonFile(reader.result)
    horizonStatus.textContent = `${horizonPoints.length} ${t('pointsLoaded')}`
    if (resolvedObject && lat != null && lon != null) generateChart()
  }
  reader.readAsText(file)
})

// --- Location ---
function setLocation(latitude, longitude) {
  lat = latitude
  lon = longitude
  latInput.value = latitude.toFixed(4)
  lonInput.value = longitude.toFixed(4)
  localStorage.setItem('astro_lat', latitude)
  localStorage.setItem('astro_lon', longitude)
  updateOkButton()
}

latInput.addEventListener('change', () => {
  lat = parseFloat(latInput.value)
  lon = parseFloat(lonInput.value)
  if (!isNaN(lat) && !isNaN(lon)) {
    localStorage.setItem('astro_lat', lat)
    localStorage.setItem('astro_lon', lon)
  }
  updateOkButton()
})

lonInput.addEventListener('change', () => {
  lat = parseFloat(latInput.value)
  lon = parseFloat(lonInput.value)
  if (!isNaN(lat) && !isNaN(lon)) {
    localStorage.setItem('astro_lat', lat)
    localStorage.setItem('astro_lon', lon)
  }
  updateOkButton()
})

geoBtn.addEventListener('click', requestGeolocation)

function requestGeolocation() {
  if (!navigator.geolocation) return
  navigator.geolocation.getCurrentPosition(
    (pos) => setLocation(pos.coords.latitude, pos.coords.longitude),
    () => {} // silently fail
  )
}

// Restore from localStorage or request geolocation
const savedLat = localStorage.getItem('astro_lat')
const savedLon = localStorage.getItem('astro_lon')
if (savedLat && savedLon) {
  setLocation(parseFloat(savedLat), parseFloat(savedLon))
} else {
  requestGeolocation()
}

// Apply translations on startup
applyTranslations()

// --- OK button ---
function updateOkButton() {
  okBtn.disabled = !(resolvedObject && lat != null && lon != null && !isNaN(lat) && !isNaN(lon))
}

okBtn.addEventListener('click', () => {
  if (!resolvedObject || lat == null || lon == null) return
  generateChart()
})

// --- Generate chart ---
function generateChart() {
  const now = new Date()
  const { ra, dec } = resolvedObject

  // Compute altitude track
  const track = computeAltitudeTrack(ra, dec, lat, lon, now)

  // Compute twilight periods
  const twilight = computeTwilightPeriods(lat, lon, now)

  // Compute moon track
  const moonTrack = showMoonCheckbox.checked ? computeMoonTrack(lat, lon, now) : null

  // Find transit and rise/set
  const transit = findTransit(track)
  const horizonFn = horizonPoints ? (az) => horizonAltAt(horizonPoints, az) : null
  const riseSet = findRiseSet(track, horizonFn)

  // Compute stats
  const horizonThreshold = horizonFn || (() => 0)
  const userMinAlt = parseFloat(minAltInput.value) || 0

  // Visible time during astronomical night (sun < -18°) and above horizon + min altitude
  let astroNightMinutes = 0
  // Visible time during any night (sun < 0°) and above horizon
  let nightVisibleMinutes = 0
  for (let i = 0; i < track.length; i++) {
    const p = track[i]
    const threshold = Math.max(horizonThreshold(p.az), userMinAlt)
    const aboveHorizon = p.alt > horizonThreshold(p.az)
    const aboveMinAlt = p.alt > threshold

    const inAstroNight = twilight.night.some(
      n => p.time >= n.start && p.time < n.end
    )
    if (inAstroNight && aboveMinAlt) {
      astroNightMinutes += 5
    }

    const inNight = !twilight.day.some(
      d => p.time >= d.start && p.time < d.end
    )
    if (inNight && aboveHorizon) {
      nightVisibleMinutes += 5
    }
  }

  const astroHours = Math.floor(astroNightMinutes / 60)
  const astroMins = astroNightMinutes % 60
  const nightHours = Math.floor(nightVisibleMinutes / 60)
  const nightMins = nightVisibleMinutes % 60

  // Min/max altitude
  let minAlt = Infinity, maxAlt = -Infinity
  for (const p of track) {
    if (p.alt < minAlt) minAlt = p.alt
    if (p.alt > maxAlt) maxAlt = p.alt
  }

  // Time until object becomes visible in astro night
  let timeUntilVisible = null
  for (const p of track) {
    const threshold = Math.max(horizonThreshold(p.az), userMinAlt)
    const inAstroNight = twilight.night.some(n => p.time >= n.start && p.time < n.end)
    if (inAstroNight && p.alt > threshold) {
      const diffMs = p.time.getTime() - now.getTime()
      if (diffMs > 0) {
        timeUntilVisible = diffMs
      } else {
        timeUntilVisible = 0 // already visible
      }
      break
    }
  }

  let visibleInText
  if (timeUntilVisible === null) {
    visibleInText = t('never')
  } else if (timeUntilVisible === 0) {
    visibleInText = t('now')
  } else {
    const mins = Math.round(timeUntilVisible / 60000)
    const h = Math.floor(mins / 60)
    const m = mins % 60
    visibleInText = `${h}h ${m.toString().padStart(2, '0')}m`
  }

  // Moon angular distance over time
  const moonDistData = track.map(p => {
    const moonPos = moonPosition(p.time)
    return angularSeparation(ra, dec, moonPos.ra, moonPos.dec)
  })

  const moonDistNow = moonDistData[0]

  // Min moon distance during astro night
  let moonDistMin = Infinity
  for (let i = 0; i < track.length; i++) {
    const inAstroNight = twilight.night.some(n => track[i].time >= n.start && track[i].time < n.end)
    if (inAstroNight && moonDistData[i] < moonDistMin) {
      moonDistMin = moonDistData[i]
    }
  }
  if (moonDistMin === Infinity) moonDistMin = moonDistNow

  // Color code: green >30°, amber 15-30°, red <15°
  function moonDistClass(deg) {
    if (deg >= 30) return 'moon-safe'
    if (deg >= 15) return 'moon-warn'
    return 'moon-danger'
  }

  // Render
  chartSection.classList.remove('hidden')
  renderChart(canvas, track, twilight, transit, riseSet, horizonPoints, horizonFn, now, lat, moonTrack, userMinAlt, twilight.night)
  infoBar.innerHTML = buildInfoHTML(transit, riseSet, {
    transit: t('transit'), rise: t('rise'), set: t('set'),
    south: t('south'), north: t('north'),
  })

  statsPanel.innerHTML = `
    <div class="stat-item stat-primary">
      <span class="stat-label">${t('theoreticalIntegration')}</span>
      <span class="stat-value">${astroHours}h ${astroMins.toString().padStart(2, '0')}m</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">${t('startsIn')}</span>
      <span class="stat-value highlight">${visibleInText}</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">${t('aboveHorizonNight')}</span>
      <span class="stat-value highlight">${nightHours}h ${nightMins.toString().padStart(2, '0')}m</span>
    </div>
  `

  // --- 7-day forecast ---
  const weeklyForecast = document.getElementById('weekly-forecast')
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const days = []

  for (let d = 0; d < 7; d++) {
    // Day 0 uses the same start time as the main chart (now)
    // Other days start from noon
    const dayStart = d === 0 ? new Date(now) : (() => {
      const ds = new Date(now)
      ds.setDate(ds.getDate() + d)
      ds.setHours(12, 0, 0, 0)
      return ds
    })()

    const dayTrack = d === 0 ? track : computeAltitudeTrack(ra, dec, lat, lon, dayStart)
    const dayTwilight = d === 0 ? twilight : computeTwilightPeriods(lat, lon, dayStart)

    let dayAstroMin = 0
    for (const p of dayTrack) {
      const threshold = Math.max(horizonThreshold(p.az), userMinAlt)
      const inAstro = dayTwilight.night.some(n => p.time >= n.start && p.time < n.end)
      if (inAstro && p.alt > threshold) dayAstroMin += 5
    }

    const date = new Date(dayStart)
    days.push({
      label: d === 0 ? t('today') : dayNames[date.getDay()],
      date: date.toLocaleDateString([], { month: 'short', day: 'numeric' }),
      minutes: dayAstroMin,
    })
  }

  const maxMinutes = Math.max(...days.map(d => d.minutes), 1)

  weeklyForecast.innerHTML = `
    <h3>${t('weeklyTitle')}</h3>
    <div class="weekly-days">
      ${days.map((d, i) => {
        const h = Math.floor(d.minutes / 60)
        const m = d.minutes % 60
        const pct = (d.minutes / maxMinutes) * 100
        return `<div class="weekly-day${i === 0 ? ' today' : ''}">
          <span class="day-label">${d.label}</span>
          <span class="day-value">${h}h${m.toString().padStart(2, '0')}</span>
          <span class="day-label">${d.date}</span>
          <div class="day-bar"><div class="day-bar-fill" style="width:${pct}%"></div></div>
        </div>`
      }).join('')}
    </div>
  `
}

// --- Browse catalog ---
const browseBtn = document.getElementById('browse-btn')
const browseSection = document.getElementById('browse-section')
const browseStatus = document.getElementById('browse-status')
const browseTbody = document.getElementById('browse-tbody')
const filterMessier = document.getElementById('filter-messier')
const filterNgc = document.getElementById('filter-ngc')
const filterIc = document.getElementById('filter-ic')
const filterCaldwell = document.getElementById('filter-caldwell')
const filterMinAlt = document.getElementById('filter-min-alt')
const pagePrev = document.getElementById('page-prev')
const pageNext = document.getElementById('page-next')
const pageInfo = document.getElementById('page-info')

const PAGE_SIZE = 20
let browseResults = []
let filteredResults = []
let currentPage = 0

browseBtn.addEventListener('click', startBrowse)
pagePrev.addEventListener('click', () => { currentPage--; renderPage() })
pageNext.addEventListener('click', () => { currentPage++; renderPage() })
filterMessier.addEventListener('change', applyFilters)
filterNgc.addEventListener('change', applyFilters)
filterIc.addEventListener('change', applyFilters)
filterCaldwell.addEventListener('change', applyFilters)
filterMinAlt.addEventListener('change', applyFilters)

async function startBrowse() {
  if (lat == null || lon == null || isNaN(lat) || isNaN(lon)) {
    browseStatus.textContent = 'Set your location first'
    return
  }

  browseSection.classList.remove('hidden')
  browseTbody.innerHTML = ''
  browseStatus.textContent = 'Fetching catalog...'
  browseBtn.disabled = true

  try {
    const catalog = await fetchCatalog((msg) => { browseStatus.textContent = msg })

    // Update autocomplete cache
    cachedCatalog = catalog

    browseStatus.textContent = t('computing', { n: catalog.length })

    // Defer to let UI update
    await new Promise(r => setTimeout(r, 50))

    const now = new Date()
    const horizonFn = horizonPoints ? (az) => horizonAltAt(horizonPoints, az) : null
    const horizonThreshold = horizonFn || (() => 0)

    // Precompute sun altitudes for the 24h window (shared across all objects)
    const timeSteps = []
    for (let m = 0; m <= 24 * 60; m += 5) {
      const t = new Date(now.getTime() + m * 60000)
      const sunAlt = sunAltitude(lat, lon, t)
      timeSteps.push({ time: t, sunAlt })
    }

    // Quick filter: only compute objects that can ever rise at this latitude
    const latRad = lat * Math.PI / 180
    const results = []

    for (const obj of catalog) {
      // Check if object ever gets above 0 at this latitude
      const maxPossibleAlt = 90 - Math.abs(lat - obj.dec)
      if (maxPossibleAlt < 0) continue

      let astroNightMin = 0
      let nightVisibleMin = 0
      let maxAlt = -Infinity
      let transitTime = null
      let transitAlt = -Infinity

      for (const step of timeSteps) {
        const { alt, az } = altAz(obj.ra, obj.dec, lat, lon, step.time)
        const threshold = horizonThreshold(az)

        if (alt > maxAlt) {
          maxAlt = alt
          transitTime = step.time
          transitAlt = alt
        }

        const aboveHorizon = alt > threshold

        if (step.sunAlt < -18 && aboveHorizon) {
          astroNightMin += 5
        }
        if (step.sunAlt < 0 && aboveHorizon) {
          nightVisibleMin += 5
        }
      }

      if (astroNightMin > 0) {
        results.push({
          id: obj.id,
          ra: obj.ra,
          dec: obj.dec,
          name: obj.name || null,
          caldwell: obj.caldwell || null,
          astroNightMin,
          nightVisibleMin,
          maxAlt,
          transitTime,
        })
      }
    }

    // Sort by astro night visibility (descending)
    results.sort((a, b) => b.astroNightMin - a.astroNightMin)

    browseResults = results
    applyFilters()

    browseStatus.textContent = t('objectsVisible', { n: results.length })
  } catch (e) {
    browseStatus.textContent = `Error: ${e.message}`
  } finally {
    browseBtn.disabled = false
  }
}

function applyFilters() {
  const showMessier = filterMessier.checked
  const showNgc = filterNgc.checked
  const showIc = filterIc.checked
  const showCaldwell = filterCaldwell.checked
  const minAltVal = parseFloat(filterMinAlt.value) || 0

  filteredResults = browseResults.filter(obj => {
    const isMessier = obj.id.startsWith('M ')
    const isNgc = obj.id.startsWith('NGC ')
    const isIc = obj.id.startsWith('IC ')
    const isCaldwell = !!obj.caldwell

    // If caldwell filter is on, always show caldwell objects regardless of NGC/IC filter
    if (isCaldwell && showCaldwell) { /* pass through */ }
    else if (isMessier && !showMessier) return false
    else if (isNgc && !showNgc) return false
    else if (isIc && !showIc) return false

    if (obj.maxAlt < minAltVal) return false
    return true
  })

  currentPage = 0
  renderPage()
}

function renderPage() {
  const totalPages = Math.max(1, Math.ceil(filteredResults.length / PAGE_SIZE))
  currentPage = Math.max(0, Math.min(currentPage, totalPages - 1))

  const start = currentPage * PAGE_SIZE
  const pageItems = filteredResults.slice(start, start + PAGE_SIZE)

  browseTbody.innerHTML = pageItems.map(obj => {
    const astroH = Math.floor(obj.astroNightMin / 60)
    const astroM = obj.astroNightMin % 60
    const nightH = Math.floor(obj.nightVisibleMin / 60)
    const nightM = obj.nightVisibleMin % 60
    const transit = obj.transitTime
      ? obj.transitTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
      : '-'

    const labels = [obj.id]
    if (obj.caldwell) labels.push(obj.caldwell)
    const nameHtml = obj.name ? `<span class="obj-name">${obj.name}</span>` : ''

    return `<tr data-id="${obj.id}" data-ra="${obj.ra}" data-dec="${obj.dec}">
      <td>${labels.join(' / ')}${nameHtml}</td>
      <td class="astro-col">${astroH}h ${astroM.toString().padStart(2, '0')}m</td>
      <td>${nightH}h ${nightM.toString().padStart(2, '0')}m</td>
      <td>${obj.maxAlt.toFixed(1)}°</td>
      <td>${transit}</td>
    </tr>`
  }).join('')

  // Click to view object
  for (const row of browseTbody.querySelectorAll('tr')) {
    row.addEventListener('click', () => {
      const id = row.dataset.id
      const ra = parseFloat(row.dataset.ra)
      const dec = parseFloat(row.dataset.dec)
      simbadInput.value = id
      resolvedObject = { name: id, ra, dec }
      simbadStatus.textContent = '\u2713'
      simbadStatus.className = 'status-icon valid'
      simbadName.textContent = `${id} (${ra.toFixed(4)}°, ${dec.toFixed(4)}°)`
      updateOkButton()
      generateChart()
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  }

  pagePrev.disabled = currentPage === 0
  pageNext.disabled = currentPage >= totalPages - 1
  pageInfo.textContent = `${t('page')} ${currentPage + 1} ${t('of')} ${totalPages} (${filteredResults.length} ${t('objects')})`
}
