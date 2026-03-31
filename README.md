# Astro Planner

A browser-based astronomy planning tool that shows altitude graphs for celestial objects. Helps you figure out when and how long a target is visible from your location.

## Features

- **SIMBAD lookup** - Type any identifier (M31, NGC 7000, Vega, etc.) and it validates against the SIMBAD database in real-time
- **Altitude graph** - 24-hour altitude curve with twilight shading (civil, nautical, astronomical)
- **Custom horizon profile** - Upload a horizon file (NINA/Stellarium format) to see where your local horizon blocks the view
- **Moon overlay** - Optional moon altitude curve to plan around moonlight
- **Key stats** - Visible time in astronomical night, above-horizon time at night, min/max altitude
- **Transit & rise/set** - Transit direction, altitude, and time; rise and set times
- **North crossings** - Marks where the object crosses due North, above or below Polaris
- **"Now" indicator** - Yellow vertical line showing current time on the graph
- **Geolocation** - Auto-detects observer location, with manual override; persists across sessions
- **Object history** - Remembers your last 5 searched objects

## Getting started

```bash
npm install
npm run dev
```

Open http://localhost:5173 in your browser.

## Horizon file format

Plain text, one point per line: `azimuth altitude` (degrees), space or tab separated. Lines starting with `#` are comments.

```
0 10
45 15
90 20
135 12
180 8
225 10
270 15
315 12
360 10
```

Compatible with NINA and Stellarium horizon exports.

## Build for deployment

```bash
npm run build
```

Static files are output to `dist/`, ready for GitHub Pages or any static host.

## Tech stack

- Vite
- Chart.js
- SIMBAD TAP API
- Vanilla JS with no framework
