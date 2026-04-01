import { Chart, registerables } from 'chart.js'
Chart.register(...registerables)

let chartInstance = null

/**
 * Render the altitude chart.
 * @param {HTMLCanvasElement} canvas
 * @param {Array} track - [{ time, alt, az }]
 * @param {object} twilight - { day, civil, nautical, astro, night }
 * @param {object} transit - { time, alt, az, direction }
 * @param {object} riseSet - { rise, set }
 * @param {Array|null} horizonPoints - [{ az, alt }]
 * @param {Function|null} horizonAltFn - (az) => alt
 */
export function renderChart(canvas, track, twilight, transit, riseSet, horizonPoints, horizonAltFn, nowTime, lat, moonTrack, minAlt, astroNightPeriods) {
  if (chartInstance) {
    chartInstance.destroy()
  }

  const labels = track.map(p => p.time)
  const altData = track.map(p => p.alt)

  // Horizon line data (altitude threshold at each track point's azimuth)
  const horizonData = horizonAltFn
    ? track.map(p => horizonAltFn(p.az))
    : null

  // Build twilight background bands as box annotations
  const backgroundBands = buildTwilightBoxes(twilight, track[0].time, track[track.length - 1].time)

  // Transit annotation
  const transitIndex = track.findIndex(p => p.time.getTime() === transit.time.getTime())

  const datasets = [
    {
      label: 'Altitude',
      data: altData,
      borderColor: '#4C7BF4',
      backgroundColor: 'rgba(76, 123, 244, 0.1)',
      borderWidth: 2,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#E0E6F0',
      tension: 0.3,
      fill: false,
      order: 2,
    },
  ]

  // Prepare integration data (added last so it renders on top)
  let integrationDataset = null
  if (astroNightPeriods && astroNightPeriods.length) {
    const visibleData = track.map(p => {
      const threshold = Math.max(horizonAltFn ? horizonAltFn(p.az) : 0, minAlt || 0)
      const inAstro = astroNightPeriods.some(n => p.time >= n.start && p.time < n.end)
      return (inAstro && p.alt > threshold) ? p.alt : null
    })
    integrationDataset = {
      label: 'Integration',
      data: visibleData,
      borderColor: 'rgba(231, 76, 60, 0.9)',
      borderWidth: 4,
      pointRadius: 0,
      pointHoverRadius: 0,
      tension: 0.3,
      fill: false,
      spanGaps: false,
      order: 0,
    }
  }

  if (horizonData) {
    datasets.push({
      label: 'Horizon',
      data: horizonData,
      borderColor: 'rgba(46, 204, 113, 0.7)',
      backgroundColor: 'rgba(46, 204, 113, 0.70)',
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0.3,
      fill: 'origin',
    })
  }

  // Transit point as a separate dataset
  if (transitIndex >= 0) {
    const transitData = new Array(track.length).fill(null)
    transitData[transitIndex] = transit.alt
    datasets.push({
      label: 'Transit',
      data: transitData,
      borderColor: 'transparent',
      backgroundColor: '#E0E6F0',
      pointRadius: 6,
      pointBorderColor: '#4C7BF4',
      pointBorderWidth: 2,
      pointHoverRadius: 8,
      showLine: false,
    })
  }

  // Moon altitude curve
  if (moonTrack && moonTrack.length === track.length) {
    datasets.push({
      label: 'Moon',
      data: moonTrack.map(p => p.alt),
      borderColor: 'rgba(232, 168, 56, 0.5)',
      backgroundColor: 'rgba(232, 168, 56, 0.06)',
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: 'rgba(232, 168, 56, 0.8)',
      tension: 0.3,
      fill: 'origin',
    })
  }

  // Add integration line last so it renders on top of everything
  if (integrationDataset) {
    datasets.push(integrationDataset)
  }

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      layout: {
        padding: { top: 20 },
      },
      interaction: {
        mode: 'index',
        intersect: false,
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            title: (items) => {
              const d = new Date(items[0].parsed.x)
              return formatTime(labels[items[0].dataIndex])
            },
            label: (item) => {
              if (item.dataset.label === 'Transit') {
                return `Transit: ${transit.alt.toFixed(1)}°`
              }
              if (item.dataset.label === 'Integration') {
                return null // don't duplicate the altitude tooltip
              }
              if (item.dataset.label === 'Horizon') {
                return `Horizon: ${item.parsed.y.toFixed(1)}°`
              }
              if (item.dataset.label === 'Moon') {
                return `Moon alt: ${item.parsed.y.toFixed(1)}°`
              }
              return `Alt: ${item.parsed.y.toFixed(1)}°`
            },
          },
        },
      },
      scales: {
        x: {
          type: 'category',
          labels: labels.map(t => formatTime(t)),
          ticks: {
            color: '#8A94A8',
            maxRotation: 0,
            callback: (val, index) => index % 12 === 0 ? labels.map(t => formatTime(t))[val] : '',
            autoSkip: false,
          },
          grid: {
            color: (ctx) => ctx.index % 12 === 0 ? '#2A3A52' : 'transparent',
          },
        },
        y: {
          min: -10,
          max: 90,
          ticks: {
            color: '#8A94A8',
            stepSize: 10,
            callback: v => v + '°',
          },
          grid: {
            color: (ctx) => {
              if (ctx.tick.value === 0) return 'rgba(232, 168, 56, 0.3)'
              return '#1E2A3A'
            },
            lineWidth: (ctx) => {
              if (ctx.tick.value === 0) return 1.5
              return 1
            },
          },
        },
      },
    },
    plugins: [
      twilightBackgroundPlugin(backgroundBands, labels),
      verticalLinesPlugin(labels, track, nowTime, lat),
      minAltLinePlugin(minAlt),
    ],
  })

  return chartInstance
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
}

/**
 * Build twilight box definitions from periods.
 */
function buildTwilightBoxes(twilight, startTime, endTime) {
  const boxes = []
  const colors = {
    day: 'rgba(100, 150, 220, 0.20)',
    civil: 'rgba(60, 80, 150, 0.25)',
    nautical: 'rgba(30, 45, 100, 0.30)',
    astro: 'rgba(15, 20, 55, 0.35)',
    night: 'rgba(5, 8, 25, 0.45)',
  }

  for (const [category, periods] of Object.entries(twilight)) {
    for (const period of periods) {
      boxes.push({
        start: period.start.getTime(),
        end: period.end.getTime(),
        color: colors[category] || colors.night,
      })
    }
  }

  return boxes
}

/**
 * Chart.js plugin to draw twilight background bands.
 */
function twilightBackgroundPlugin(bands, timeLabels) {
  return {
    id: 'twilightBackground',
    beforeDraw(chart) {
      const { ctx, chartArea: { left, right, top, bottom }, scales: { x } } = chart

      if (!bands.length || !timeLabels.length) return

      const startMs = timeLabels[0].getTime()
      const endMs = timeLabels[timeLabels.length - 1].getTime()
      const totalMs = endMs - startMs
      const chartWidth = right - left

      for (const band of bands) {
        const bandStart = Math.max(band.start, startMs)
        const bandEnd = Math.min(band.end, endMs)
        if (bandEnd <= bandStart) continue

        const x1 = left + ((bandStart - startMs) / totalMs) * chartWidth
        const x2 = left + ((bandEnd - startMs) / totalMs) * chartWidth

        ctx.fillStyle = band.color
        ctx.fillRect(x1, top, x2 - x1, bottom - top)
      }
    },
  }
}

/**
 * Chart.js plugin to draw vertical "Now" and "North" lines.
 */
function verticalLinesPlugin(timeLabels, track, nowTime, observerLat) {
  return {
    id: 'verticalLines',
    afterDraw(chart) {
      const { ctx, chartArea: { left, right, top, bottom } } = chart

      if (!timeLabels.length) return

      const startMs = timeLabels[0].getTime()
      const endMs = timeLabels[timeLabels.length - 1].getTime()
      const totalMs = endMs - startMs
      const chartWidth = right - left

      const toX = (ms) => left + ((ms - startMs) / totalMs) * chartWidth

      // Draw "Now" line
      const nowMs = nowTime.getTime()
      if (nowMs >= startMs && nowMs <= endMs) {
        const x = toX(nowMs)
        ctx.save()
        ctx.strokeStyle = '#E8A838'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(x, top)
        ctx.lineTo(x, bottom)
        ctx.stroke()

        // Label
        ctx.fillStyle = '#E8A838'
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Now', x, top - 6)
        ctx.restore()
      }

      // Draw "North" crossings (azimuth crosses 0/360)
      for (let i = 1; i < track.length; i++) {
        const prevAz = track[i - 1].az
        const currAz = track[i].az

        // Detect North crossing: azimuth wraps from >350 to <10 or vice versa
        const crossesNorth =
          (prevAz > 270 && currAz < 90) ||
          (currAz > 270 && prevAz < 90)

        if (crossesNorth) {
          // Interpolate the exact crossing time
          const prevMs = timeLabels[i - 1].getTime()
          const currMs = timeLabels[i].getTime()
          const adjPrev = prevAz > 270 ? prevAz - 360 : prevAz
          const adjCurr = currAz > 270 ? currAz - 360 : currAz
          const t = adjPrev === adjCurr ? 0.5 : -adjPrev / (adjCurr - adjPrev)
          const crossMs = prevMs + t * (currMs - prevMs)

          // Interpolate altitude at crossing
          const crossAlt = track[i - 1].alt + t * (track[i].alt - track[i - 1].alt)
          const poleAlt = Math.abs(observerLat)
          const abovePolaris = crossAlt > poleAlt
          const label = abovePolaris ? 'N \u2191' : 'N \u2193'

          if (crossMs >= startMs && crossMs <= endMs) {
            const x = toX(crossMs)
            ctx.save()
            ctx.strokeStyle = 'rgba(0, 191, 165, 0.6)'
            ctx.lineWidth = 1.5
            ctx.setLineDash([6, 4])
            ctx.beginPath()
            ctx.moveTo(x, top)
            ctx.lineTo(x, bottom)
            ctx.stroke()

            ctx.fillStyle = 'rgba(0, 191, 165, 0.8)'
            ctx.font = '11px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(label, x, top - 6)
            ctx.restore()
          }
        }
      }
    },
  }
}

/**
 * Chart.js plugin to fill between the object curve and the threshold
 * only during astronomical night when the object is above threshold.
 */
function visibilityFillPlugin(track, timeLabels, horizonAltFn, minAlt, astroNightPeriods) {
  return {
    id: 'visibilityFill',
    afterDatasetsDraw(chart) {
      if (!track.length || !astroNightPeriods || !astroNightPeriods.length) return

      const { ctx, chartArea: { left, right, top, bottom }, scales: { x, y } } = chart
      const startMs = timeLabels[0].getTime()
      const endMs = timeLabels[timeLabels.length - 1].getTime()
      const totalMs = endMs - startMs
      const chartWidth = right - left

      const toX = (i) => {
        // Map index to pixel position
        const ms = timeLabels[i].getTime()
        return left + ((ms - startMs) / totalMs) * chartWidth
      }

      ctx.save()
      ctx.fillStyle = 'rgba(231, 76, 60, 0.70)'
      ctx.beginPath()

      let inSegment = false

      for (let i = 0; i < track.length; i++) {
        const p = track[i]
        const threshold = Math.max(horizonAltFn ? horizonAltFn(p.az) : 0, minAlt || 0)
        const inAstro = astroNightPeriods.some(n => p.time >= n.start && p.time < n.end)
        const visible = inAstro && p.alt > threshold

        const px = toX(i)
        const altY = y.getPixelForValue(p.alt)
        const threshY = y.getPixelForValue(threshold)

        if (visible) {
          if (!inSegment) {
            // Start a new fill segment — move to threshold, then up to altitude
            ctx.moveTo(px, threshY)
            ctx.lineTo(px, altY)
            inSegment = true
          } else {
            ctx.lineTo(px, altY)
          }
        } else {
          if (inSegment) {
            // Close the segment — go back down along the threshold
            // Trace threshold line backwards
            const segStart = findSegmentStart(track, i, timeLabels, horizonAltFn, minAlt, astroNightPeriods)
            for (let j = i - 1; j >= segStart; j--) {
              const tp = track[j]
              const th = Math.max(horizonAltFn ? horizonAltFn(tp.az) : 0, minAlt || 0)
              ctx.lineTo(toX(j), y.getPixelForValue(th))
            }
            ctx.closePath()
            inSegment = false
          }
        }
      }

      // Close final segment if still open
      if (inSegment) {
        const lastI = track.length - 1
        for (let j = lastI; j >= 0; j--) {
          const p = track[j]
          const threshold = Math.max(horizonAltFn ? horizonAltFn(p.az) : 0, minAlt || 0)
          const inAstro = astroNightPeriods.some(n => p.time >= n.start && p.time < n.end)
          if (!(inAstro && p.alt > threshold)) {
            // Trace back threshold from j+1 to segment start
            const segStart = findSegmentStart(track, j + 1, timeLabels, horizonAltFn, minAlt, astroNightPeriods)
            for (let k = j; k >= segStart; k--) {
              const tp = track[k]
              const th = Math.max(horizonAltFn ? horizonAltFn(tp.az) : 0, minAlt || 0)
              ctx.lineTo(toX(k), y.getPixelForValue(th))
            }
            break
          }
          if (j === 0) {
            const th = Math.max(horizonAltFn ? horizonAltFn(track[0].az) : 0, minAlt || 0)
            ctx.lineTo(toX(0), y.getPixelForValue(th))
          }
        }
        ctx.closePath()
      }

      ctx.fill()
      ctx.restore()
    },
  }
}

function findSegmentStart(track, endI, timeLabels, horizonAltFn, minAlt, astroNightPeriods) {
  for (let j = endI - 1; j >= 0; j--) {
    const p = track[j]
    const threshold = Math.max(horizonAltFn ? horizonAltFn(p.az) : 0, minAlt || 0)
    const inAstro = astroNightPeriods.some(n => p.time >= n.start && p.time < n.end)
    if (!(inAstro && p.alt > threshold)) return j + 1
  }
  return 0
}

/**
 * Chart.js plugin to draw a horizontal min altitude line at any value.
 */
function minAltLinePlugin(minAltValue) {
  return {
    id: 'minAltLine',
    afterDraw(chart) {
      if (!minAltValue || minAltValue <= 0) return

      const { ctx, chartArea: { left, right, top, bottom }, scales: { y } } = chart
      const yPos = y.getPixelForValue(minAltValue)

      if (yPos < top || yPos > bottom) return

      ctx.save()
      ctx.strokeStyle = 'rgba(76, 123, 244, 0.35)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(left, yPos)
      ctx.lineTo(right, yPos)
      ctx.stroke()

      // Label
      ctx.fillStyle = 'rgba(76, 123, 244, 0.5)'
      ctx.font = '10px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(`${minAltValue}°`, left - 4, yPos + 3)
      ctx.restore()
    },
  }
}

/**
 * Build the info bar HTML showing rise, set, transit info.
 */
export function buildInfoHTML(transit, riseSet, labels = {}) {
  const parts = []
  const transitLabel = labels.transit || 'transit'
  const riseLabel = labels.rise || 'Rise'
  const setLabel = labels.set || 'Set'

  if (transit) {
    const tTime = formatTime(transit.time)
    const dir = labels[transit.direction] || transit.direction
    parts.push(
      `<span class="info-item transit-info">${transitLabel}: ${dir} &middot; ${transit.alt.toFixed(0)}&deg; &middot; ${tTime} hr</span>`
    )
  }

  if (riseSet.rise) {
    parts.push(
      `<span class="info-item"><span class="info-label">&#x2B06; ${riseLabel}:</span> ${formatTime(riseSet.rise)} hr</span>`
    )
  }

  if (riseSet.set) {
    parts.push(
      `<span class="info-item"><span class="info-label">&#x2B07; ${setLabel}:</span> ${formatTime(riseSet.set)} hr</span>`
    )
  }

  return parts.join('')
}
