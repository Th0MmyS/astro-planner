import './style.css'
import { resolveSimbad } from './simbad.js'
import { parseHorizonFile, horizonAltAt } from './horizon.js'
import { computeAltitudeTrack, findTransit, findRiseSet, computeTwilightPeriods, computeMoonTrack } from './astro.js'
import { renderChart, buildInfoHTML } from './chart.js'

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

showMoonCheckbox.addEventListener('change', () => {
  if (resolvedObject && lat != null && lon != null) generateChart()
})

// --- Object history ---
const HISTORY_KEY = 'astro_object_history'
const MAX_HISTORY = 5
const historyDatalist = document.getElementById('simbad-history')

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || [] }
  catch { return [] }
}

function addToHistory(identifier) {
  let history = getHistory().filter(h => h.toLowerCase() !== identifier.toLowerCase())
  history.unshift(identifier)
  if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
  renderHistory()
}

function renderHistory() {
  historyDatalist.innerHTML = getHistory().map(h => `<option value="${h}">`).join('')
}

renderHistory()

// --- SIMBAD validation with debounce ---
let debounceTimer = null

simbadInput.addEventListener('input', () => {
  resolvedObject = null
  updateOkButton()

  const value = simbadInput.value.trim()
  if (!value) {
    simbadStatus.textContent = ''
    simbadStatus.className = 'status-icon'
    simbadName.textContent = ''
    return
  }

  simbadStatus.textContent = '...'
  simbadStatus.className = 'status-icon loading'
  simbadName.textContent = ''

  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => validateSimbad(value), 600)
})

async function validateSimbad(identifier) {
  try {
    const result = await resolveSimbad(identifier)
    // Check if input changed while we were fetching
    if (simbadInput.value.trim() !== identifier) return

    if (result) {
      resolvedObject = result
      addToHistory(identifier)
      simbadStatus.textContent = '\u2713'
      simbadStatus.className = 'status-icon valid'
      simbadName.textContent = `${result.name} (${result.ra.toFixed(4)}°, ${result.dec.toFixed(4)}°)`
    } else {
      resolvedObject = null
      simbadStatus.textContent = '\u2717'
      simbadStatus.className = 'status-icon invalid'
      simbadName.textContent = 'Not found in SIMBAD'
    }
  } catch (e) {
    simbadStatus.textContent = '\u2717'
    simbadStatus.className = 'status-icon invalid'
    simbadName.textContent = 'Error contacting SIMBAD'
  }
  updateOkButton()
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
    horizonStatus.textContent = `${horizonPoints.length} points loaded`
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

  // Visible time during astronomical night (sun < -18°) and above horizon
  let astroNightMinutes = 0
  // Visible time during any night (sun < 0°) and above horizon
  let nightVisibleMinutes = 0
  for (let i = 0; i < track.length; i++) {
    const p = track[i]
    const threshold = horizonThreshold(p.az)
    const aboveHorizon = p.alt > threshold

    const inAstroNight = twilight.night.some(
      n => p.time >= n.start && p.time < n.end
    )
    if (inAstroNight && aboveHorizon) {
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

  // Render
  chartSection.classList.remove('hidden')
  renderChart(canvas, track, twilight, transit, riseSet, horizonPoints, horizonFn, now, lat, moonTrack)
  infoBar.innerHTML = buildInfoHTML(transit, riseSet)

  statsPanel.innerHTML = `
    <div class="stat-item stat-primary">
      <span class="stat-label">Visible in astro night</span>
      <span class="stat-value">${astroHours}h ${astroMins.toString().padStart(2, '0')}m</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Above horizon at night</span>
      <span class="stat-value highlight">${nightHours}h ${nightMins.toString().padStart(2, '0')}m</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Max altitude</span>
      <span class="stat-value">${maxAlt.toFixed(1)}&deg;</span>
    </div>
    <div class="stat-item">
      <span class="stat-label">Min altitude</span>
      <span class="stat-value">${minAlt.toFixed(1)}&deg;</span>
    </div>
  `
}
