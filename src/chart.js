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
export function renderChart(canvas, track, twilight, transit, riseSet, horizonPoints, horizonAltFn, nowTime, lat, moonTrack, minAlt) {
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
      borderColor: '#e8907a',
      backgroundColor: 'rgba(232, 144, 122, 0.1)',
      borderWidth: 2.5,
      pointRadius: 0,
      pointHoverRadius: 5,
      pointHoverBackgroundColor: '#fff',
      tension: 0.3,
      fill: false,
    },
  ]

  if (horizonData) {
    datasets.push({
      label: 'Horizon',
      data: horizonData,
      borderColor: 'rgba(100, 200, 100, 0.7)',
      backgroundColor: 'rgba(100, 200, 100, 0.15)',
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
      backgroundColor: '#fff',
      pointRadius: 6,
      pointBorderColor: '#e8907a',
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
      borderColor: 'rgba(200, 200, 120, 0.5)',
      backgroundColor: 'rgba(255, 255, 255, 0.10)',
      borderWidth: 1.5,
      borderDash: [4, 4],
      pointRadius: 0,
      pointHoverRadius: 4,
      pointHoverBackgroundColor: 'rgba(200, 200, 120, 0.8)',
      tension: 0.3,
      fill: 'origin',
    })
  }

  chartInstance = new Chart(canvas, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
              if (item.dataset.label === 'Horizon') {
                return `Horizon: ${item.parsed.y.toFixed(1)}°`
              }
              if (item.dataset.label === 'Moon') {
                return `Moon: ${item.parsed.y.toFixed(1)}°`
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
            color: '#666',
            maxTicksLimit: 13,
            maxRotation: 0,
          },
          grid: {
            color: 'rgba(255,255,255,0.05)',
          },
        },
        y: {
          min: -10,
          max: 90,
          ticks: {
            color: '#666',
            stepSize: 10,
            callback: v => v + '°',
          },
          grid: {
            color: (ctx) => {
              if (ctx.tick.value === 0) return 'rgba(255,255,100,0.3)'
              return 'rgba(255,255,255,0.05)'
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
    day: 'rgba(135, 170, 220, 0.25)',
    civil: 'rgba(80, 100, 160, 0.30)',
    nautical: 'rgba(40, 50, 100, 0.35)',
    astro: 'rgba(20, 25, 60, 0.40)',
    night: 'rgba(10, 10, 30, 0.50)',
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
        ctx.strokeStyle = '#e8c170'
        ctx.lineWidth = 2
        ctx.setLineDash([])
        ctx.beginPath()
        ctx.moveTo(x, top)
        ctx.lineTo(x, bottom)
        ctx.stroke()

        // Label
        ctx.fillStyle = '#e8c170'
        ctx.font = '11px sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Now', x, top - 4)
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
            ctx.strokeStyle = 'rgba(100, 180, 255, 0.6)'
            ctx.lineWidth = 1.5
            ctx.setLineDash([6, 4])
            ctx.beginPath()
            ctx.moveTo(x, top)
            ctx.lineTo(x, bottom)
            ctx.stroke()

            ctx.fillStyle = 'rgba(100, 180, 255, 0.8)'
            ctx.font = '11px sans-serif'
            ctx.textAlign = 'center'
            ctx.fillText(label, x, top - 4)
            ctx.restore()
          }
        }
      }
    },
  }
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
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([6, 4])
      ctx.beginPath()
      ctx.moveTo(left, yPos)
      ctx.lineTo(right, yPos)
      ctx.stroke()

      // Label
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)'
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
export function buildInfoHTML(transit, riseSet) {
  const parts = []

  if (transit) {
    const tTime = formatTime(transit.time)
    parts.push(
      `<span class="info-item transit-info">transit: ${transit.direction} &middot; ${transit.alt.toFixed(0)}&deg; &middot; ${tTime} hr</span>`
    )
  }

  if (riseSet.rise) {
    parts.push(
      `<span class="info-item"><span class="info-label">&#x2B06; Rise:</span> ${formatTime(riseSet.rise)} hr</span>`
    )
  }

  if (riseSet.set) {
    parts.push(
      `<span class="info-item"><span class="info-label">&#x2B07; Set:</span> ${formatTime(riseSet.set)} hr</span>`
    )
  }

  return parts.join('')
}
