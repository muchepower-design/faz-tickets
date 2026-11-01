import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'

import { useAuth } from '../context/AuthContext'
import { useCart } from '../context/CartContext'
import MainLayout from '../layouts/MainLayout'
import { Button, Card, Badge, Spinner, Alert } from '../components/ui'
import { matchTeamLabels } from '../utils/teams'
import toast from 'react-hot-toast'

import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sky, Environment, ContactShadows } from '@react-three/drei'
import * as THREE from 'three'


/* =====================================================================
 * Shared helpers
 * ===================================================================== */

function safeDate(v) {
  if (!v) return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function seatKey(sectionName, row, seat) {
  return `${sectionName}|${row}|${seat}`
}

function findNextAvailable(section, pickedKeys) {
  for (const row of section.rows_detail || []) {
    for (const s of row.seats || []) {
      if (String(s.status || '').toLowerCase() !== 'available') continue
      const key = seatKey(section.name, row.label, s.seat)
      if (pickedKeys.has(key)) continue
      return { section: section.name, row: row.label, seat: s.seat, key }
    }
  }
  return null
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value))
}

function sectionRowLabel(index) {
  return index < 26 ? String.fromCharCode(65 + index) : `R${index + 1}`
}

function getStatusStyle(status, isPicked) {
  if (isPicked) {
    return { fill: '#22c55e', stroke: '#bbf7d0', glow: true, opacity: 1 }
  }
  const value = String(status || 'available').toLowerCase()
  if (['sold', 'sold_out', 'booked', 'purchased', 'unavailable'].includes(value)) {
    return { fill: '#f59e0b', stroke: '#fcd34d', glow: true, opacity: 0.92 }
  }
  if (['held', 'reserved', 'pending'].includes(value)) {
    return { fill: '#60a5fa', stroke: '#bfdbfe', glow: false, opacity: 0.95 }
  }
  return { fill: '#334155', stroke: '#64748b', glow: false, opacity: 0.78 }
}

/**
 * Convert a section's `deck` value into a zero-based tier index.
 *
 *   null / '' / 'Normal'    → 0  (ground tier)
 *   '1' .. '10'             → 0 .. 9
 *   'Lower'                 → 0  (legacy)
 *   'Upper'                 → 1  (legacy)
 *   'Middle'                → 1  (legacy)
 */
function deckIndex(section) {
  const raw = section?.deck
  if (raw === null || raw === undefined) return 0
  const str = String(raw).trim()
  if (str === '' || str.toLowerCase() === 'normal') return 0

  const num = parseInt(str, 10)
  if (!isNaN(num) && num > 0) return Math.min(9, num - 1)

  const low = str.toLowerCase()
  if (low.includes('lower') || low.includes('ground')) return 0
  if (low.includes('middle')) return 1
  if (low.includes('upper') || low.includes('top')) return 2
  return 0
}

/* =====================================================================
 * Compass / section-side logic
 * ===================================================================== */

const STADIUM_SIDES = [
  { name: 'north', angle: -Math.PI / 2, label: 'NORTH STAND' },
  { name: 'east',  angle: 0,            label: 'EAST STAND'  },
  { name: 'south', angle: Math.PI / 2,  label: 'SOUTH STAND' },
  { name: 'west',  angle: Math.PI,      label: 'WEST STAND'  },
]

function getExplicitSectionSide(section) {
  const values = [
    section?.side,
    section?.position,
    section?.location,
    section?.stand,
    section?.orientation,
    section?.direction,
  ]
  const value = values.filter(Boolean).join(' ').toLowerCase()
  if (!value) return null

  if (value.includes('north') || value.includes('top') || value.includes('upper')) return 'north'
  if (value.includes('south') || value.includes('bottom') || value.includes('lower')) return 'south'
  if (value.includes('east') || value.includes('right')) return 'east'
  if (value.includes('west') || value.includes('left')) return 'west'
  return null
}

function getSectionSide(section, index) {
  const explicit = getExplicitSectionSide(section)
  if (explicit) return STADIUM_SIDES.find(s => s.name === explicit)

  const name = String(section?.name || '').toLowerCase()
  if (name.includes('north') || name.includes('top')) return STADIUM_SIDES[0]
  if (name.includes('east') || name.includes('right')) return STADIUM_SIDES[1]
  if (name.includes('south') || name.includes('bottom')) return STADIUM_SIDES[2]
  if (name.includes('west') || name.includes('left')) return STADIUM_SIDES[3]

  return STADIUM_SIDES[index % STADIUM_SIDES.length]
}

function computeSectionPlacements(sections) {
  if (!sections || sections.length === 0) return []
  const total = sections.length
  return sections
    .filter(Boolean)
    .map((section, index) => {
      const side = getSectionSide(section, index)
      let span = Math.PI * 0.34
      if (total === 1) span = Math.PI * 0.38
      else if (total === 2) span = Math.PI * 0.30
      else if (total >= 5) span = Math.PI * 0.25
      const start = side.angle - span / 2
      const end = side.angle + span / 2
      return {
        section,
        side: side.name,
        label: side.label,
        centerAngle: side.angle,
        start,
        end,
        span,
        deck: deckIndex(section),   // NEW — tier index
      }
    })
}

/* =====================================================================
 * Seat layout
 * ===================================================================== */

function buildSeatLayout(activeTT) {
  const sections = activeTT?.sections || []
  const placements = computeSectionPlacements(sections)
  const seats = []

  placements.forEach(({ section, start, span, centerAngle, side, deck }) => {
    const rows = Math.max(0, section.rows || 0)
    const perRow = Math.max(0, section.seats_per_row || 0)
    if (!rows || !perRow) return

    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
      const rowLabel = sectionRowLabel(rowIndex)
      const radiusFactor = rowIndex / Math.max(1, rows - 1)
      const radius = 1 + radiusFactor

      for (let colIndex = 0; colIndex < perRow; colIndex++) {
        const seatLabel = String(colIndex + 1)
        const blocks = Math.floor(colIndex / 10)
        const gapAmount = blocks * 0.012
        const usableSpan = Math.max(0.001, span - gapAmount)
        const positionInRow = (colIndex + 0.5) / perRow
        const angle = start + positionInRow * usableSpan + blocks * 0.012

        seats.push({
          section: section.name,
          sectionId: section.id,
          row: rowLabel,
          seat: seatLabel,
          rowIndex,
          colIndex,
          angle,
          radius,
          side,
          centerAngle,
          deck,       // NEW — tier index
        })
      }
    }
  })

  return { seats, sections: placements }
}

function makeStatusMap(activeTT) {
  const map = new Map()
  for (const section of activeTT?.sections || []) {
    for (const row of section.rows_detail || []) {
      for (const seat of row.seats || []) {
        map.set(seatKey(section.name, row.label, seat.seat), seat.status)
      }
    }
  }
  return map
}

/* =====================================================================
 * Compass rose
 * ===================================================================== */

function CompassRose2D({ size = 92 }) {
  return (
    <svg width={size} height={size} viewBox="-50 -50 100 100" className="drop-shadow-lg">
      <circle r="44" fill="#0b1728" stroke="#334155" strokeWidth="2" opacity="0.92" />
      <circle r="38" fill="none" stroke="#1e293b" strokeWidth="1" />
      <polygon points="0,-34 6,-4 0,-10 -6,-4" fill="#ef4444" />
      <polygon points="0,34 6,4 0,10 -6,4" fill="#475569" />
      <polygon points="-34,0 -4,-6 -10,0 -4,6" fill="#475569" />
      <polygon points="34,0 4,-6 10,0 4,6" fill="#475569" />
      <circle r="3" fill="#f8fafc" />
      <text y="-38" textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="800">N</text>
      <text x="38" y="4" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="700">E</text>
      <text y="46" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="700">S</text>
      <text x="-38" y="4" textAnchor="middle" fill="#94a3b8" fontSize="10" fontWeight="700">W</text>
    </svg>
  )
}

/* =====================================================================
 * 2D stadium view — pan + zoom + compass + deck tiers + toggle fix
 * ===================================================================== */

const DECK_OFFSET_2D = 55        // px added per deck tier

function Stadium2DView({ activeTT, pickedKeys, toggleSeat }) {
  const [hovered, setHovered] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [panX, setPanX] = useState(0)
  const [panY, setPanY] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const dragRef = useRef(null)

  const width = 1100
  const height = 760
  const cx = width / 2
  const cy = height / 2

  const pitchW = 330
  const pitchH = 205
  const baseInnerRx = 250
  const baseInnerRy = 160
  const baseOuterRx = 475
  const baseOuterRy = 310

  const layout = useMemo(() => buildSeatLayout(activeTT), [activeTT])
  const statusMap = useMemo(() => makeStatusMap(activeTT), [activeTT])

  /* ---------- Pan ---------- */
  const handleMouseDown = e => {
    if (e.target && e.target.closest && e.target.closest('[data-seat="true"]')) return
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      startPanX: panX,
      startPanY: panY,
    }
    setIsDragging(true)
    e.preventDefault()
  }

  useEffect(() => {
    const onMove = e => {
      if (!dragRef.current) return
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setPanX(dragRef.current.startPanX + dx)
      setPanY(dragRef.current.startPanY + dy)
    }
    const onUp = () => {
      dragRef.current = null
      setIsDragging(false)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [])

  const handleZoomIn = () =>
    setZoom(prev => clamp(Number((prev + 0.15).toFixed(2)), 0.5, 3.2))
  const handleZoomOut = () =>
    setZoom(prev => clamp(Number((prev - 0.15).toFixed(2)), 0.5, 3.2))
  const handleZoomReset = () => {
    setZoom(1)
    setPanX(0)
    setPanY(0)
  }

  const handleWheel = e => {
    e.preventDefault()
    const direction = e.deltaY < 0 ? 0.12 : -0.12
    setZoom(prev => clamp(Number((prev + direction).toFixed(2)), 0.5, 3.2))
  }

  /* ---------- Per-section radii shift by deck ---------- */
  const sectionRadii = (sectionName) => {
    const section = (activeTT?.sections || []).find(s => s.name === sectionName)
    const d = section ? deckIndex(section) : 0
    const offset = d * DECK_OFFSET_2D
    return {
      innerRx: baseInnerRx + offset,
      innerRy: baseInnerRy + offset * 0.65,
      outerRx: baseOuterRx + offset,
      outerRy: baseOuterRy + offset * 0.65,
    }
  }

  const polarToSvg = seat => {
    const section = (activeTT?.sections || []).find(s => s.name === seat.section)
    const rows = Math.max(1, section?.rows || 1)
    const t = seat.rowIndex / Math.max(1, rows - 1)
    const r = sectionRadii(seat.section)
    const rx = r.innerRx + t * (r.outerRx - r.innerRx)
    const ry = r.innerRy + t * (r.outerRy - r.innerRy)
    return {
      x: cx + Math.cos(seat.angle) * rx,
      y: cy + Math.sin(seat.angle) * ry,
    }
  }

  const totalSeats = layout.seats.length
  const selectedCount = pickedKeys.size
  const soldCount = layout.seats.filter(s => {
    const status = String(statusMap.get(seatKey(s.section, s.row, s.seat)) || '').toLowerCase()
    return ['sold', 'sold_out', 'booked', 'purchased', 'unavailable'].includes(status)
  }).length

  // Distinct decks for legend
  const distinctDecks = Array.from(new Set(layout.sections.map(p => p.deck))).sort((a, b) => a - b)

  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-slate-800 bg-[#07111f] shadow-2xl select-none"
      onWheel={handleWheel}
    >
      <div className="absolute inset-x-0 top-0 z-20 flex flex-wrap items-center justify-between gap-3 bg-slate-950/90 px-5 py-3 text-xs text-white backdrop-blur">
        <div>
          <div className="font-bold tracking-wide">STADIUM SEAT MAP</div>
          <div className="text-slate-400">2D top view · drag to move · scroll to zoom</div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 rounded-full bg-slate-600" /> Available
          </span>
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 rounded-full bg-amber-400 shadow-[0_0_9px_rgba(251,191,36,.9)]" /> Sold
          </span>
          <span className="flex items-center gap-2">
            <i className="h-3 w-3 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,.95)]" /> Selected
          </span>
        </div>
      </div>

      <div className="absolute right-4 top-16 z-30 flex flex-col overflow-hidden rounded-xl border border-white/10 bg-slate-950/90 shadow-xl backdrop-blur">
        <button type="button" onClick={handleZoomIn} className="flex h-10 w-10 items-center justify-center text-xl font-bold text-white transition hover:bg-white/10" title="Zoom in">+</button>
        <div className="h-px bg-white/10" />
        <button type="button" onClick={handleZoomReset} className="flex h-10 w-10 items-center justify-center text-[10px] font-bold text-slate-300 transition hover:bg-white/10" title="Reset zoom & pan">
          {Math.round(zoom * 100)}%
        </button>
        <div className="h-px bg-white/10" />
        <button type="button" onClick={handleZoomOut} className="flex h-10 w-10 items-center justify-center text-xl font-bold text-white transition hover:bg-white/10" title="Zoom out">−</button>
      </div>

      {/* Deck legend */}
      {distinctDecks.length > 1 && (
        <div className="pointer-events-none absolute left-4 top-16 z-20 rounded-xl border border-white/10 bg-slate-950/85 px-4 py-3 text-[11px] text-white shadow-xl backdrop-blur">
          <div className="font-bold tracking-wider text-slate-300 mb-1">TIERS</div>
          {distinctDecks.map(d => (
            <div key={d} className="flex items-center gap-2">
              <span className="inline-block h-2 w-2 rounded-full bg-slate-400" />
              {d === 0 ? 'Ground' : `Deck ${d + 1}`}
            </div>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute right-4 bottom-20 z-20">
        <CompassRose2D />
      </div>

      <div
        className="overflow-hidden px-2 pb-3 pt-16"
        onMouseDown={handleMouseDown}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="mx-auto block min-w-[850px] w-full max-w-[1100px]"
          role="img"
          aria-label="Interactive football stadium seat map"
        >
          <defs>
            <radialGradient id="stadiumGlow2d" cx="50%" cy="50%" r="55%">
              <stop offset="0%" stopColor="#172b45" />
              <stop offset="70%" stopColor="#0b1728" />
              <stop offset="100%" stopColor="#030811" />
            </radialGradient>
            <linearGradient id="pitch2d" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ca85b" />
              <stop offset="50%" stopColor="#2d914c" />
              <stop offset="100%" stopColor="#23783f" />
            </linearGradient>
            <filter id="seatGlow2d" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="2.8" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="pitchShadow2d" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="12" stdDeviation="15" floodColor="#000" floodOpacity=".5" />
            </filter>
          </defs>

          <rect width={width} height={height} fill="url(#stadiumGlow2d)" />

          <g transform={`translate(${cx + panX} ${cy + panY}) scale(${zoom}) translate(${-cx} ${-cy})`}>
            {/* Outer shell — uses the largest section radius */}
            {(() => {
              const maxDeck = layout.sections.reduce((m, p) => Math.max(m, p.deck), 0)
              const extra = maxDeck * DECK_OFFSET_2D
              const shellOuterRx = baseOuterRx + extra + 24
              const shellOuterRy = baseOuterRy + extra * 0.65 + 24
              const shellInnerRx = baseOuterRx + extra
              const shellInnerRy = baseOuterRy + extra * 0.65
              const concourseRx = baseInnerRx - 8
              const concourseRy = baseInnerRy - 8
              return (
                <>
                  <ellipse cx={cx} cy={cy} rx={shellOuterRx} ry={shellOuterRy} fill="#050b14" stroke="#334155" strokeWidth="3" />
                  <ellipse cx={cx} cy={cy} rx={shellInnerRx} ry={shellInnerRy} fill="#111d2d" stroke="#475569" strokeWidth="4" />
                  <ellipse cx={cx} cy={cy} rx={concourseRx} ry={concourseRy} fill="#1e293b" stroke="#64748b" strokeWidth="12" />

                  {/* One band per tier present in the layout */}
                  {Array.from(new Set(layout.sections.map(p => p.deck)))
                    .sort((a, b) => a - b)
                    .map(d => {
                      const offset = d * DECK_OFFSET_2D
                      const rx = baseInnerRx + offset + 24
                      const ry = baseInnerRy + offset * 0.65 + 18
                      return (
                        <ellipse
                          key={`tier-${d}`}
                          cx={cx}
                          cy={cy}
                          rx={rx}
                          ry={ry}
                          fill="none"
                          stroke={d % 2 === 0 ? '#27364a' : '#334155'}
                          strokeWidth="28"
                          opacity=".9"
                        />
                      )
                    })}
                </>
              )
            })()}

            {/* Stand highlight blocks per section */}
            {layout.sections.map(({ section, centerAngle, span, deck }) => {
              const offset = deck * DECK_OFFSET_2D
              const standRadius = (baseInnerRx + baseOuterRx) / 2 + offset
              const x = cx + Math.cos(centerAngle) * standRadius
              const y = cy + Math.sin(centerAngle) * standRadius
              const widthStand = Math.max(90, span * 330)
              const isVertical = centerAngle === 0 || Math.abs(centerAngle) === Math.PI
              return (
                <ellipse
                  key={`stand-${section.id}`}
                  cx={x}
                  cy={y}
                  rx={isVertical ? 70 : widthStand / 2}
                  ry={isVertical ? widthStand / 2 : 55}
                  fill="#172235"
                  opacity=".35"
                />
              )
            })}

            {/* Pitch */}
            <g filter="url(#pitchShadow2d)">
              <rect x={cx - pitchW / 2} y={cy - pitchH / 2} width={pitchW} height={pitchH} rx="3" fill="url(#pitch2d)" stroke="#d9f99d" strokeWidth="3" />
              <rect x={cx - pitchW / 2 + 8} y={cy - pitchH / 2 + 8} width={pitchW - 16} height={pitchH - 16} fill="none" stroke="rgba(255,255,255,.82)" strokeWidth="2" />
              <line x1={cx} y1={cy - pitchH / 2 + 8} x2={cx} y2={cy + pitchH / 2 - 8} stroke="rgba(255,255,255,.82)" strokeWidth="2" />
              <circle cx={cx} cy={cy} r="38" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth="2" />
              <circle cx={cx} cy={cy} r="3" fill="white" />
              <rect x={cx - pitchW / 2 + 8} y={cy - 65} width="55" height="130" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth="2" />
              <rect x={cx + pitchW / 2 - 63} y={cy - 65} width="55" height="130" fill="none" stroke="rgba(255,255,255,.82)" strokeWidth="2" />
            </g>

            <rect x={cx - pitchW / 2 - 9} y={cy - 24} width="9" height="48" fill="#e2e8f0" />
            <rect x={cx + pitchW / 2} y={cy - 24} width="9" height="48" fill="#e2e8f0" />

            {/* Section labels */}
            {layout.sections.map(({ section, centerAngle, label, deck }) => {
              const maxBase = Math.max(baseOuterRx, baseOuterRy)
              const offset = deck * DECK_OFFSET_2D
              const labelRadius = maxBase + offset + 12
              const x = cx + Math.cos(centerAngle) * labelRadius
              const y = cy + Math.sin(centerAngle) * labelRadius
              return (
                <g key={`label-${section.id}`}>
                  <text x={x} y={y} fill="#cbd5e1" fontSize="13" fontWeight="800" textAnchor="middle" dominantBaseline="middle" letterSpacing="1.5">
                    {section.name}
                  </text>
                  <text x={x} y={y + 16} fill="#64748b" fontSize="8" fontWeight="700" textAnchor="middle" dominantBaseline="middle" letterSpacing="1">
                    {label}{deck > 0 ? ` · DECK ${deck + 1}` : ''}
                  </text>
                </g>
              )
            })}

            {/* Seats */}
            {layout.seats.map(seat => {
              const key = seatKey(seat.section, seat.row, seat.seat)
              const status = statusMap.get(key) || 'available'
              const isPicked = pickedKeys.has(key)
              const style = getStatusStyle(status, isPicked)
              const point = polarToSvg(seat)
              const isHover = hovered === key
              const isAvailable = String(status).toLowerCase() === 'available'
              const clickable = isPicked || isAvailable   // FIX — allow unpick

              return (
                <g
                  key={key}
                  data-seat="true"
                  transform={`translate(${point.x} ${point.y})`}
                  onMouseEnter={() => setHovered(key)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => {
                    if (!clickable) return
                    toggleSeat(activeTT.id, seat.section, seat.row, seat.seat)
                  }}
                  style={{ cursor: clickable ? 'pointer' : 'not-allowed' }}
                >
                  {style.glow && (
                    <circle r={isPicked ? 8 : 5.5} fill={style.fill} opacity=".18" filter="url(#seatGlow2d)" />
                  )}
                  <circle
                    r={isHover ? 5.5 : 4}
                    fill={style.fill}
                    stroke={style.stroke}
                    strokeWidth={isHover ? 1.8 : 0.9}
                    opacity={style.opacity}
                  />
                </g>
              )
            })}

            {/* Orientation labels */}
            <text x={cx} y="42" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700" letterSpacing="2">NORTH</text>
            <text x={cx} y={height - 28} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700" letterSpacing="2">SOUTH</text>
            <text x="30" y={cy} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700" letterSpacing="2">WEST</text>
            <text x={width - 30} y={cy} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700" letterSpacing="2">EAST</text>
          </g>
        </svg>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-slate-950/90 px-5 py-3 text-xs text-slate-400">
        <span>{totalSeats.toLocaleString()} seats shown</span>
        <span>{soldCount.toLocaleString()} unavailable · {selectedCount.toLocaleString()} selected</span>
        <span className="font-medium text-slate-300">Drag to move · Scroll to zoom · Click a seat to reserve</span>
      </div>

      {hovered && (() => {
        const [section, row, seat] = hovered.split('|')
        const status = statusMap.get(hovered) || 'available'
        return (
          <div className="pointer-events-none absolute bottom-14 left-1/2 z-20 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-950/95 px-4 py-2 text-center text-xs text-white shadow-xl backdrop-blur">
            <div className="font-bold">{section}</div>
            <div className="text-slate-400">Row {row} · Seat {seat} · {status}</div>
          </div>
        )
      })()}
    </div>
  )
}

/* =====================================================================
 * 3D seat
 * ===================================================================== */

function Seat3D({ position, rotation, status, isPicked, onClick }) {
  const [hovered, setHovered] = useState(false)
  const normalizedStatus = String(status || 'available').toLowerCase()
  const isAvailable = normalizedStatus === 'available'
  const clickable = isPicked || isAvailable   // FIX — allow unpick
  const style = getStatusStyle(normalizedStatus, isPicked)

  return (
    <group
      position={position}
      rotation={rotation}
      onClick={event => {
        event.stopPropagation()
        if (clickable) onClick()
      }}
      onPointerOver={event => {
        event.stopPropagation()
        setHovered(true)
        document.body.style.cursor = clickable ? 'pointer' : 'not-allowed'
      }}
      onPointerOut={() => {
        setHovered(false)
        document.body.style.cursor = 'default'
      }}
    >
      <mesh position={[0, 0.12, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.22, 0.48]} />
        <meshStandardMaterial
          color={style.fill}
          emissive={style.fill}
          emissiveIntensity={isPicked ? 0.7 : style.glow ? 0.12 : 0.01}
          roughness={0.62}
          metalness={0.04}
          transparent
          opacity={style.opacity}
        />
      </mesh>
      <mesh position={[0, 0.34, 0.18]} castShadow receiveShadow>
        <boxGeometry args={[0.58, 0.38, 0.10]} />
        <meshStandardMaterial
          color={style.fill}
          emissive={style.fill}
          emissiveIntensity={isPicked ? 0.75 : style.glow ? 0.15 : 0.01}
          roughness={0.62}
          metalness={0.04}
          transparent
          opacity={style.opacity}
        />
      </mesh>
      {hovered && clickable && (
        <mesh position={[0, 0.7, 0]}>
          <sphereGeometry args={[0.09, 10, 10]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  )
}

/* =====================================================================
 * 3D tier ring
 * ===================================================================== */

function StadiumTier3D({ radius, depth, height, segments = 96 }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, height, 0]} receiveShadow>
      <ringGeometry args={[radius, radius + depth, segments, 1, 0, Math.PI * 2]} />
      <meshStandardMaterial color="#172235" roughness={0.92} metalness={0.03} />
    </mesh>
  )
}

/* =====================================================================
 * 3D stadium view — pan on left drag, tiered decks
 * ===================================================================== */

function Stadium3DView({ activeTT, pickedKeys, toggleSeat }) {
  const layout = useMemo(() => buildSeatLayout(activeTT), [activeTT])
  const statusMap = useMemo(() => makeStatusMap(activeTT), [activeTT])

  const PITCH_W = 20
  const PITCH_H = 13
  const BASE_RADIUS = 15.5
  const ROW_DEPTH = 0.78
  const ROW_HEIGHT = 0.30

  const DECK_RADIUS_STEP = 3.2
  const DECK_HEIGHT_STEP = 2.4

  const maxDeck = layout.sections.reduce((m, p) => Math.max(m, p.deck), 0)

  const getSeatPosition = seat => {
    const deckR = seat.deck * DECK_RADIUS_STEP
    const deckH = seat.deck * DECK_HEIGHT_STEP
    const radius = BASE_RADIUS + deckR + seat.rowIndex * ROW_DEPTH
    const x = Math.cos(seat.angle) * radius
    const z = Math.sin(seat.angle) * radius
    const y = 0.55 + deckH + seat.rowIndex * ROW_HEIGHT
    const rotationY = -seat.angle + Math.PI / 2
    return { position: [x, y, z], rotation: [0, rotationY, 0] }
  }

  // Distinct decks for tier rings
  const decksPresent = Array.from(new Set(layout.sections.map(p => p.deck))).sort((a, b) => a - b)

  return (
    <div className="relative h-[650px] overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-2xl">
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [36, 32, 36], fov: 42, near: 0.1, far: 300 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <color attach="background" args={['#07111f']} />
        <fog attach="fog" args={['#07111f', 80, 190]} />

        <Sky distance={450000} sunPosition={[80, 70, 40]} turbidity={5} rayleigh={1.2} mieCoefficient={0.004} mieDirectionalG={0.78} />

        <ambientLight intensity={0.48} />
        <hemisphereLight skyColor="#b9d7ff" groundColor="#111827" intensity={0.75} />
        <directionalLight
          position={[25, 50, 20]}
          intensity={2.0}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={200}
          shadow-camera-left={-80}
          shadow-camera-right={80}
          shadow-camera-top={80}
          shadow-camera-bottom={-80}
        />
        <pointLight position={[-30, 30, -20]} intensity={90} distance={120} />
        <pointLight position={[30, 25, 25]} intensity={70} distance={120} />

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.25, 0]} receiveShadow>
          <circleGeometry args={[80, 128]} />
          <meshStandardMaterial color="#0b1220" roughness={0.96} />
        </mesh>

        {/* One concrete tier ring per deck present */}
        {decksPresent.map(d => {
          const radius = 13.8 + d * DECK_RADIUS_STEP
          const height = 0.15 + d * DECK_HEIGHT_STEP
          return (
            <StadiumTier3D
              key={`tier3d-${d}`}
              radius={radius}
              depth={2.4}
              height={height}
            />
          )
        })}

        {/* Pitch surround — flat */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow>
          <planeGeometry args={[PITCH_W + 3.0, PITCH_H + 3.0]} />
          <meshStandardMaterial color="#172b1d" roughness={0.88} />
        </mesh>

        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]} receiveShadow>
          <planeGeometry args={[PITCH_W, PITCH_H]} />
          <meshStandardMaterial color="#2f934d" roughness={0.92} metalness={0} />
        </mesh>

        <group position={[0, 0.14, 0]}>
          <mesh position={[0, 0.005, 0]}>
            <boxGeometry args={[0.08, 0.001, PITCH_H]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
            <ringGeometry args={[2.15, 2.21, 64]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.007, 0]}>
            <ringGeometry args={[0.08, 0.13, 24]} />
            <meshBasicMaterial color="#ffffff" side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-8.2, 0.003, 0]}>
            <planeGeometry args={[3.6, 6.0]} />
            <meshBasicMaterial color="#37a559" transparent opacity={0.55} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[8.2, 0.003, 0]}>
            <planeGeometry args={[3.6, 6.0]} />
            <meshBasicMaterial color="#37a559" transparent opacity={0.55} />
          </mesh>
        </group>

        {/* Goals */}
        <group position={[-10.35, 0.75, 0]}>
          <mesh position={[0, 0, -3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 6, 8]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.08, 3, 0.08]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>
        <group position={[10.35, 0.75, 0]}>
          <mesh position={[0, 0, -3]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.035, 0.035, 6, 8]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
          <mesh position={[0, 1.5, 0]} rotation={[0, 0, Math.PI / 2]}>
            <boxGeometry args={[0.08, 3, 0.08]} />
            <meshStandardMaterial color="#f8fafc" />
          </mesh>
        </group>

        {/* Section markers */}
        {layout.sections.map(({ section, centerAngle, deck }) => {
          const radius = 24 + deck * DECK_RADIUS_STEP
          const height = 0.15 + deck * DECK_HEIGHT_STEP
          const x = Math.cos(centerAngle) * radius
          const z = Math.sin(centerAngle) * radius
          return (
            <mesh key={`section-marker-${section.id}`} rotation={[-Math.PI / 2, 0, 0]} position={[x, height + 0.02, z]}>
              <circleGeometry args={[1.7, 32]} />
              <meshBasicMaterial color="#1e293b" transparent opacity={0.75} />
            </mesh>
          )
        })}

        {/* Seats */}
        {layout.seats.map(seat => {
          const key = seatKey(seat.section, seat.row, seat.seat)
          const status = statusMap.get(key) || 'available'
          const { position, rotation } = getSeatPosition(seat)
          return (
            <Seat3D
              key={key}
              position={position}
              rotation={rotation}
              status={status}
              isPicked={pickedKeys.has(key)}
              onClick={() => toggleSeat(activeTT.id, seat.section, seat.row, seat.seat)}
            />
          )
        })}

        {/* Floodlights */}
        {[[-45, -36], [45, -36], [-45, 36], [45, 36]].map(([x, z]) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 12, 0]} castShadow>
              <cylinderGeometry args={[0.22, 0.32, 24, 10]} />
              <meshStandardMaterial color="#64748b" metalness={0.65} roughness={0.38} />
            </mesh>
            <mesh position={[0, 24, 0]}>
              <boxGeometry args={[2.4, 0.5, 0.8]} />
              <meshStandardMaterial color="#f8fafc" emissive="#f8fafc" emissiveIntensity={2.2} />
            </mesh>
          </group>
        ))}

        <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={120} blur={2.6} far={70} />
        <Environment preset="night" />

        <OrbitControls
          makeDefault
          enablePan
          enableZoom
          enableRotate
          /* FIX: left-drag pans (like 2D), right-drag rotates */
          mouseButtons={{
            LEFT: THREE.MOUSE.PAN,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
          touches={{
            ONE: THREE.TOUCH.PAN,
            TWO: THREE.TOUCH.DOLLY_ROTATE,
          }}
          minDistance={24}
          maxDistance={140}
          minPolarAngle={0.35}
          maxPolarAngle={Math.PI / 2.02}
          target={[0, 3 + maxDeck * DECK_HEIGHT_STEP * 0.5, 0]}
          dampingFactor={0.08}
          enableDamping
        />
      </Canvas>

      <div className="pointer-events-none absolute left-4 top-4 rounded-xl border border-white/10 bg-slate-950/75 px-4 py-3 text-xs text-white shadow-xl backdrop-blur">
        <div className="font-bold tracking-wide">3D STADIUM EXPERIENCE</div>
        <div className="mt-1 text-slate-400">Left-drag to move · Right-drag to rotate · Scroll to zoom</div>
      </div>

      <div className="pointer-events-none absolute right-4 top-4 flex flex-col items-center gap-1 rounded-xl border border-white/10 bg-slate-950/75 px-3 py-2 text-white shadow-xl backdrop-blur">
        <div className="text-[10px] font-bold tracking-widest text-slate-300">COMPASS</div>
        <svg width="60" height="60" viewBox="-50 -50 100 100">
          <circle r="44" fill="#0b1728" stroke="#334155" strokeWidth="2" />
          <polygon points="0,-34 6,-4 0,-10 -6,-4" fill="#ef4444" />
          <polygon points="0,34 6,4 0,10 -6,4" fill="#475569" />
          <polygon points="-34,0 -4,-6 -10,0 -4,6" fill="#475569" />
          <polygon points="34,0 4,-6 10,0 4,6" fill="#475569" />
          <circle r="3" fill="#f8fafc" />
          <text y="-38" textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="800">N</text>
          <text x="38" y="4" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">E</text>
          <text y="46" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">S</text>
          <text x="-38" y="4" textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="700">W</text>
        </svg>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 flex flex-wrap gap-2 text-[11px] text-white">
        <span className="rounded-full bg-slate-950/80 px-3 py-1.5 backdrop-blur">Dark = available</span>
        <span className="rounded-full bg-amber-500/90 px-3 py-1.5">Bright = sold</span>
        <span className="rounded-full bg-green-600/95 px-3 py-1.5">Glow = your selection</span>
      </div>

      {decksPresent.length > 1 && (
        <div className="pointer-events-none absolute bottom-4 right-4 rounded-xl bg-slate-950/80 px-3 py-2 text-[11px] text-white backdrop-blur">
          <div className="font-bold tracking-wider text-slate-300 mb-1">TIERS</div>
          {decksPresent.map(d => (
            <div key={d}>{d === 0 ? 'Ground' : `Deck ${d + 1}`}</div>
          ))}
        </div>
      )}
    </div>
  )
}

/* =====================================================================
 * View toggle
 * ===================================================================== */

function ViewToggle({ value, onChange }) {
  const options = [
    { id: 'list', label: '📋 List' },
    { id: '2d',   label: '🗺️ 2D'   },
    { id: '3d',   label: '🏟️ 3D'   },
  ]
  return (
    <div className="inline-flex rounded-xl bg-gray-100 p-1">
      {options.map(o => {
        const isActive = value === o.id
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
              isActive ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* =====================================================================
 * AttachedProducts — products attached to this match (via e-commerce)
 * ===================================================================== */
function AttachedProducts({ matchId }) {
  const { api } = useAuth()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get(`/api/ecommerce/matches/${matchId}/adverts`)
      .then(res => { if (!cancelled) setProducts(res.data || []) })
      .catch(() => { if (!cancelled) setProducts([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [matchId, api])

  if (loading || products.length === 0) return null

  const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
  const shopBase = (import.meta.env.VITE_API_FRONTEND_SHOP || '').replace(/\/$/, '')

  const resolveImg = (url) => {
    if (!url) return null
    if (/^(https?:|data:|blob:)/i.test(url)) return url
    return `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`
  }

  return (
    <div className="mt-10">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-800">Available at the Match</h2>
        <p className="text-sm text-gray-500">
          Products and services from verified FAZ vendors for this match.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {products.map(product => {
          const cover = resolveImg(product.cover_image)
          const price = product.price
          const currency = product.currency || 'ZMW'
          const detailUrl = shopBase ? `${shopBase}/advert/${product.id}` : null

          const card = (
            <div className="group rounded-2xl overflow-hidden bg-white border border-gray-200 hover:border-green-400 hover:shadow-xl transition-all duration-200 h-full flex flex-col">
              <div className="aspect-[4/3] bg-gray-100 relative overflow-hidden">
                {cover ? (
                  <img
                    src={cover}
                    alt={product.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    onError={(e) => { e.currentTarget.style.display = 'none' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">🛍️</div>
                )}
                <span className="absolute top-2 left-2 bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Vendor
                </span>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <h3 className="font-semibold text-gray-800 line-clamp-2 mb-1">{product.title}</h3>
                {product.location_name && (
                  <p className="text-xs text-gray-500 mb-2 flex items-center gap-1">
                    📍 {product.location_name}
                  </p>
                )}
                <div className="mt-auto flex items-center justify-between">
                  {price !== null && price !== undefined ? (
                    <span className="text-lg font-bold text-green-600">
                      {currency} {Number(price).toFixed(2)}
                    </span>
                  ) : (
                    <span className="text-sm text-gray-400 italic">Contact for price</span>
                  )}
                  {detailUrl && (
                    <span className="text-sm font-medium text-green-600 group-hover:underline">View →</span>
                  )}
                </div>
              </div>
            </div>
          )

          return detailUrl ? (
            <a key={product.id} href={detailUrl} target="_blank" rel="noopener noreferrer" className="block h-full">
              {card}
            </a>
          ) : (
            <div key={product.id} className="h-full">{card}</div>
          )
        })}
      </div>
    </div>
  )
}

/* =====================================================================
 * Main page
 * ===================================================================== */

export default function MatchDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { api } = useAuth()
  const { addItem, items: cartItems } = useCart()

  const [match, setMatch] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [source, setSource] = useState(null)
  const pollingRef = useRef(null)
  const seatPollingRef = useRef(null)

  const [quantities, setQuantities] = useState({})
  const [holdTokens, setHoldTokens] = useState({})

  const [seatMap, setSeatMap] = useState(null)
  const [activeTicketTypeId, setActiveTicketTypeId] = useState('')
  const [selectedSeats, setSelectedSeats] = useState([])

  const [view, setView] = useState(() => {
    try { return localStorage.getItem('stadium_view') || 'list' } catch { return 'list' }
  })
  useEffect(() => {
    try { localStorage.setItem('stadium_view', view) } catch {}
  }, [view])

  useEffect(() => {
    setQuantities({})
    setHoldTokens({})
    setError('')
    setSource(null)
    setLoading(true)
    setSeatMap(null)
    setActiveTicketTypeId('')
    setSelectedSeats([])
  }, [id])

  const fetchMatch = useCallback(async () => {
    try {
      const res = await api.get(`/api/ticketing/matches/${id}`)
      setMatch(res.data)
      setSource('ticketing')
      setError('')
      return
    } catch (err) {
      if (err.response?.status !== 404) console.warn('Ticketing fetch error, falling back:', err)
    }
    try {
      const res = await api.get(`/api/competitions-management/matches/${id}`)
      const m = res.data || {}
      setMatch({
  id: m.id,
  home_team: m.home_team,
  away_team: m.away_team,
  home_team_info: m.home_team_info,       // ← new
  away_team_info: m.away_team_info,       // ← new
  match_date: m.match_date,
  venue: m.venue,
  competition: m.competition,
  status: m.status,
  home_score: m.home_score,
  away_score: m.away_score,
  is_ticketed: m.is_ticketed,
  ticket_types: [],
  total_capacity: null,
  total_tickets_sold: null,
  total_available: null,
})
      setSource('general')
      setError('')
    } catch {
      setError('Match not found')
      setMatch(null)
    }
  }, [id, api])

  useEffect(() => { fetchMatch().finally(() => setLoading(false)) }, [fetchMatch])

  const fetchSeatMap = useCallback(async () => {
    if (!match) return
    try {
      const res = await api.get(`/api/ticketing/matches/${id}/seat-map`)
      setSeatMap(res.data)
      setActiveTicketTypeId(prev => {
        const types = res.data?.ticket_types || []
        if (prev && types.some(t => t.id === prev)) return prev
        const first = types.find(t => t.sections?.length)
        return first ? first.id : ''
      })
    } catch (err) {
      console.warn('Seat map unavailable:', err)
      setSeatMap({ has_sections: false, ticket_types: [] })
    }
  }, [id, api, match])

  useEffect(() => {
    if (source === 'ticketing' && match) fetchSeatMap()
  }, [source, match, fetchSeatMap])

  useEffect(() => {
    if (source !== 'ticketing') return
    seatPollingRef.current = setInterval(fetchSeatMap, 15000)
    return () => clearInterval(seatPollingRef.current)
  }, [source, fetchSeatMap])

  useEffect(() => {
    if (source !== 'ticketing') return
    const handleVisibility = () => {
      clearInterval(pollingRef.current)
      pollingRef.current = setInterval(fetchMatch, document.hidden ? 5000 : 3000)
    }
    pollingRef.current = setInterval(fetchMatch, 3000)
    document.addEventListener('visibilitychange', handleVisibility)
    return () => {
      clearInterval(pollingRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
    }
  }, [fetchMatch, source])

  useEffect(() => {
    if (source !== 'ticketing') return
    const releaseAll = () => {
      selectedSeats.forEach(s => {
        if (s.holdToken) api.delete(`/api/ticketing/matches/${id}/hold/${s.holdToken}`).catch(() => {})
      })
      Object.entries(holdTokens).forEach(([, token]) => {
        const isInCart = cartItems.some(it => it.holdToken === token)
        if (token && !isInCart) {
          api.delete(`/api/ticketing/matches/${id}/hold/${token}`).catch(() => {})
        }
      })
    }
    window.addEventListener('beforeunload', releaseAll)
    return () => {
      window.removeEventListener('beforeunload', releaseAll)
      releaseAll()
    }
  }, [selectedSeats, holdTokens, id, api, cartItems, source])

  const syncHold = async (ticketTypeId, newQuantity) => {
    const tt = match?.ticket_types?.find(x => x.id === ticketTypeId)
    if (!tt) return
    const currentQty = quantities[ticketTypeId] || 0
    const currentToken = holdTokens[ticketTypeId]
    if (newQuantity === currentQty && currentToken) return
    try {
      const res = await api.post(`/api/ticketing/matches/${id}/hold`, {
        ticket_type_id: ticketTypeId,
        quantity: newQuantity,
        hold_token: currentToken || undefined,
      })
      const data = res.data
      if (data.hold_token && data.hold_token !== currentToken) {
        setHoldTokens(prev => ({ ...prev, [ticketTypeId]: data.hold_token }))
      }
      setQuantities(prev => ({ ...prev, [ticketTypeId]: newQuantity }))
      if (newQuantity === 0 && currentToken) {
        const isInCart = cartItems.some(it => it.holdToken === currentToken)
        if (!isInCart) await api.delete(`/api/ticketing/matches/${id}/hold/${currentToken}`)
        setHoldTokens(prev => ({ ...prev, [ticketTypeId]: null }))
      }
    } catch (err) {
      if (err.response?.status === 409) {
        const available = err.response.data?.available || 0
        setQuantities(prev => ({ ...prev, [ticketTypeId]: Math.min(prev[ticketTypeId] || 0, available) }))
        toast.error('Not enough seats available. Quantity adjusted.')
      } else {
        toast.error('Failed to reserve seats')
      }
    }
  }

  const handleQuantityChange = (ttId, newValue) => {
    const tt = match?.ticket_types?.find(x => x.id === ttId)
    if (!tt) return
    const myHoldQty = quantities[ttId] || 0
    const otherHolds = Math.max(0, (tt.held || 0) - myHoldQty)
    const maxForMe = tt.capacity - tt.tickets_sold - otherHolds
    let qty = parseInt(newValue, 10)
    if (isNaN(qty)) qty = 0
    qty = Math.max(0, Math.min(qty, maxForMe))
    setQuantities(prev => ({ ...prev, [ttId]: qty }))
    syncHold(ttId, qty)
  }

  const handleIncrement = (ttId) => {
    const tt = match?.ticket_types?.find(x => x.id === ttId)
    if (!tt) return
    const myHoldQty = quantities[ttId] || 0
    const otherHolds = Math.max(0, (tt.held || 0) - myHoldQty)
    const maxForMe = tt.capacity - tt.tickets_sold - otherHolds
    if (myHoldQty < maxForMe) handleQuantityChange(ttId, myHoldQty + 1)
  }

  const handleDecrement = (ttId) => {
    const cur = quantities[ttId] || 0
    if (cur > 0) handleQuantityChange(ttId, cur - 1)
  }

  const activeTT = seatMap?.ticket_types?.find(t => t.id === activeTicketTypeId)
  const pickedKeys = useMemo(() => new Set(selectedSeats.map(s => s.key)), [selectedSeats])
  const selectedForActiveTT = useMemo(
    () => selectedSeats.filter(s => s.ticket_type_id === activeTicketTypeId),
    [selectedSeats, activeTicketTypeId]
  )

  const pickSeat = async (ticketTypeId, sectionName, rowLabel, seatLabel) => {
    const key = seatKey(sectionName, rowLabel, seatLabel)
    if (pickedKeys.has(key)) return
    if (selectedForActiveTT.length >= 8) {
      toast.error('You can select up to 8 seats per ticket type')
      return
    }
    try {
      const res = await api.post(`/api/ticketing/matches/${id}/hold`, {
        ticket_type_id: ticketTypeId,
        quantity: 1,
        section: sectionName,
        row: rowLabel,
        seat: seatLabel,
      })
      const data = res.data
      setSelectedSeats(prev => [
        ...prev,
        { key, ticket_type_id: ticketTypeId, section: sectionName, row: rowLabel, seat: seatLabel, holdToken: data.hold_token },
      ])
    } catch (err) {
      toast.error(err.response?.data?.error || 'Seat not available')
      fetchSeatMap()
    }
  }

  const unpickSeat = async (seatObj) => {
    if (seatObj.holdToken) {
      api.delete(`/api/ticketing/matches/${id}/hold/${seatObj.holdToken}`).catch(() => {})
    }
    setSelectedSeats(prev => prev.filter(s => s.key !== seatObj.key))
  }

  const toggleSeat = async (ticketTypeId, sectionName, rowLabel, seatLabel) => {
    const key = seatKey(sectionName, rowLabel, seatLabel)
    const existing = selectedSeats.find(s => s.key === key)
    if (existing) await unpickSeat(existing)
    else await pickSeat(ticketTypeId, sectionName, rowLabel, seatLabel)
  }

  const autoAddSeat = async () => {
    if (!activeTT) return
    if (selectedForActiveTT.length >= 8) { toast.error('Up to 8 seats per ticket type'); return }
    for (const section of activeTT.sections || []) {
      const next = findNextAvailable(section, pickedKeys)
      if (next) {
        await pickSeat(activeTT.id, next.section, next.row, next.seat)
        return
      }
    }
    toast.error('No more seats available in this area')
  }

  const autoRemoveSeat = async () => {
    if (selectedForActiveTT.length === 0) return
    await unpickSeat(selectedForActiveTT[selectedForActiveTT.length - 1])
  }

  const buildCartItems = () => {
    const items = []
    if (!match) return items
    if (selectedSeats.length > 0) {
      selectedSeats.forEach(s => {
        const tt = match.ticket_types.find(x => x.id === s.ticket_type_id)
        if (!tt) return
        items.push({
          ticket_type_id: tt.id,
          ticket_type_name: tt.name,
          match_id: match.id,
          match_name: `${matchTeamLabels(match).home} vs ${matchTeamLabels(match).away}`,
          price: tt.price,
          quantity: 1,
          section: s.section,
          row: s.row,
          seat: s.seat,
          holdToken: s.holdToken || null,
        })
      })
      return items
    }
    match.ticket_types.forEach(tt => {
      const qty = quantities[tt.id] || 0
      if (qty > 0) {
        items.push({
          ticket_type_id: tt.id,
          ticket_type_name: tt.name,
          match_id: match.id,
          match_name: `${matchTeamLabels(match).home} vs ${matchTeamLabels(match).away}`,
          price: tt.price,
          quantity: qty,
          section: null, row: null, seat: null,
          holdToken: holdTokens[tt.id],
        })
      }
    })
    return items
  }

  const handleAddToCart = () => {
    const items = buildCartItems()
    if (items.length === 0) { toast.error('Please select at least one ticket'); return }
    items.forEach(i => addItem(i))
    toast.success('Added to cart!')
  }

  const handleBuyNow = () => {
    const items = buildCartItems()
    if (items.length === 0) { toast.error('Please select at least one ticket'); return }
    items.forEach(i => addItem(i))
    navigate('/checkout')
  }

  const renderListSeat = (ttId, sectionName, seat) => {
    const key = seatKey(sectionName, seat.rowLabel, seat.seat)
    const isPicked = pickedKeys.has(key)
    const isTaken = String(seat.status || '').toLowerCase() !== 'available'
    const clickable = isPicked || !isTaken
    return (
      <button
        key={seat.seat}
        disabled={!clickable}
        onClick={() => toggleSeat(ttId, sectionName, seat.rowLabel, seat.seat)}
        className={`rounded-full text-[10px] font-bold transition-all duration-150 border-2 ${
          !clickable
            ? 'w-6 h-6 bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed'
            : isPicked
              ? 'w-7 h-7 bg-green-500 text-white border-green-600 shadow-lg shadow-green-300/50 scale-110'
              : 'w-6 h-6 bg-white text-gray-700 border-gray-300 hover:border-green-500 hover:bg-green-50 hover:scale-110'
        }`}
        title={!clickable ? `Seat ${seat.seat} — taken` : `Seat ${seat.seat}`}
      >
        {seat.seat}
      </button>
    )
  }

  if (loading) {
    return <MainLayout><div className="flex justify-center py-20"><Spinner size="xl" /></div></MainLayout>
  }

  if (error || !match) {
    return (
      <MainLayout>
        <div className="container mx-auto px-4 py-8">
          <Alert variant="error">{error || 'Match not found'}</Alert>
          <div className="mt-6"><Link to="/matches"><Button variant="outline">← Back to Matches</Button></Link></div>
        </div>
      </MainLayout>
    )
  }

  const isNational =
    (match.match_type || '').toLowerCase().includes('national') ||
    (match.home_team || '').toLowerCase().includes('zambia') ||
    (match.away_team || '').toLowerCase().includes('zambia')
  const dt = safeDate(match.match_date)
  const hasTickets = Array.isArray(match.ticket_types) && match.ticket_types.length > 0
  const isTicketing = source === 'ticketing'
  const quantityTotal = Object.values(quantities).reduce((a, b) => a + b, 0)
  const hasSections = seatMap?.has_sections && (seatMap.ticket_types || []).length > 0
  const canProceed = selectedSeats.length > 0 || quantityTotal > 0
  const { home: homeLabel, away: awayLabel } = matchTeamLabels(match)

  return (
    <MainLayout>
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-4">
            <Link to="/matches" className="text-sm text-gray-500 hover:text-green-600">← Back to Matches</Link>
          </div>

          <div className={`rounded-2xl p-8 text-white mb-8 ${isNational ? 'bg-gradient-to-r from-green-600 to-green-700' : 'bg-gradient-to-r from-orange-500 to-orange-600'}`}>
            <Badge variant={isNational ? 'success' : 'orange'} className="mb-4">
              {isNational ? '🇿🇲 National Team' : '🏆 Club Match'}
            </Badge>
            <h1 className="text-3xl md:text-4xl font-bold mb-3">{homeLabel} vs {awayLabel}</h1>
            <div className="flex flex-wrap gap-6 text-white/90">
              <span className="flex items-center gap-2">📍 {match.venue || 'Venue TBA'}</span>
              <span className="flex items-center gap-2">📅 {dt ? dt.toLocaleString() : 'Date TBA'}</span>
              {match.competition && <span className="flex items-center gap-2">🏆 {match.competition}</span>}
            </div>
          </div>

          {isTicketing && hasSections && (
            <Card padding="lg" className="mb-6">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800">Choose Your Seats</h2>
                  <p className="text-sm text-gray-500">Pick a view below — click a seat, or use + / − to auto-pick.</p>
                </div>
                <ViewToggle value={view} onChange={setView} />
              </div>

              <div className="flex flex-wrap gap-2 mb-6">
                {seatMap.ticket_types.map(tt => {
                  const isActive = tt.id === activeTicketTypeId
                  const myCount = selectedSeats.filter(s => s.ticket_type_id === tt.id).length
                  const totalSeats = (tt.sections || []).reduce(
                    (sum, s) => sum + (s.rows || 0) * (s.seats_per_row || 0), 0
                  )
                  return (
                    <button
                      key={tt.id}
                      onClick={() => setActiveTicketTypeId(tt.id)}
                      className={`px-5 py-3 rounded-xl border text-left transition ${
                        isActive
                          ? 'bg-green-600 text-white border-green-700 shadow-lg'
                          : 'bg-white text-gray-700 border-gray-300 hover:border-green-500'
                      }`}
                    >
                      <div className="font-bold">{tt.name}</div>
                      <div className={`text-xs ${isActive ? 'opacity-90' : 'text-gray-500'}`}>
                        ZMW {tt.price.toFixed(2)}
                        {totalSeats > 0 ? ` · ${totalSeats} seats` : ''}
                        {myCount > 0 ? ` · ${myCount} picked` : ''}
                      </div>
                    </button>
                  )
                })}
              </div>

              {activeTT && (
                <>
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4 mb-6 flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={autoRemoveSeat}
                        disabled={selectedForActiveTT.length === 0}
                        className="w-11 h-11 rounded-full bg-white border-2 border-gray-300 hover:bg-gray-50 disabled:opacity-40 text-xl font-bold shadow-sm"
                      >
                        −
                      </button>
                      <div className="text-center min-w-[60px]">
                        <div className="text-2xl font-bold text-green-700">{selectedForActiveTT.length}</div>
                        <div className="text-xs text-gray-500">seats</div>
                      </div>
                      <button
                        onClick={autoAddSeat}
                        disabled={selectedForActiveTT.length >= 8}
                        className="w-11 h-11 rounded-full bg-green-600 text-white hover:bg-green-700 disabled:opacity-40 text-xl font-bold shadow-sm"
                      >
                        +
                      </button>
                    </div>
                    <div className="text-sm text-gray-600 flex-1">
                      + auto-picks the next available seat. Click a seat to choose manually.
                    </div>
                    {selectedForActiveTT.length > 0 && (
                      <div className="text-sm font-semibold text-green-800">
                        Total: ZMW {(activeTT.price * selectedForActiveTT.length).toFixed(2)}
                      </div>
                    )}
                  </div>

                  {view === 'list' && (
                    <div className="space-y-10">
                      {activeTT.sections.map(section => (
                        <div key={section.id} className="bg-gray-50 rounded-2xl p-5">
                          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
                            <div>
                              <h3 className="text-lg font-bold text-gray-800">
                                {section.name}
                                {section.deck ? <span className="text-sm font-normal text-gray-500 ml-2">· {section.deck}</span> : null}
                              </h3>
                              <p className="text-xs text-gray-500">
                                {section.rows} rows × {section.seats_per_row} seats · {section.total_seats} total
                              </p>
                            </div>
                          </div>

                          {section.rows === 0 ? (
                            <p className="text-sm text-gray-500 italic">General admission — no specific seats.</p>
                          ) : (
                            <>
                              <div className="mb-3 flex justify-center">
                                <div className="text-[10px] font-bold tracking-widest text-gray-400 bg-white px-6 py-1 rounded-full border border-gray-200">
                                  ▲ FIELD / STAGE ▲
                                </div>
                              </div>
                              <div className="overflow-x-auto pb-4">
                                <div className="inline-flex flex-col gap-2 min-w-full items-center">
                                  {section.rows_detail.map(row => (
                                    <div key={row.label} className="flex items-center gap-3">
                                      <div className="w-7 text-center font-bold text-gray-500 text-xs">{row.label}</div>
                                      <div className="flex gap-1.5">
                                        {row.seats.map(s =>
                                          renderListSeat(activeTT.id, section.name, {
                                            rowLabel: row.label,
                                            seat: s.seat,
                                            status: s.status,
                                          })
                                        )}
                                      </div>
                                      <div className="w-7 text-center font-bold text-gray-500 text-xs">{row.label}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {view === '2d' && (
                    <Stadium2DView
                      activeTT={activeTT}
                      pickedKeys={pickedKeys}
                      toggleSeat={toggleSeat}
                    />
                  )}

                  {view === '3d' && (
                    <Stadium3DView
                      activeTT={activeTT}
                      pickedKeys={pickedKeys}
                      toggleSeat={toggleSeat}
                    />
                  )}

                  {selectedSeats.length > 0 && (
                    <div className="mt-6 bg-gray-50 rounded-xl p-4">
                      <h4 className="font-semibold text-gray-800 mb-2">Your selection</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedSeats.map(s => {
                          const tt = seatMap.ticket_types.find(x => x.id === s.ticket_type_id)
                          return (
                            <span key={s.key} className="inline-flex items-center gap-2 bg-white border border-green-300 rounded-full px-3 py-1 text-xs">
                              <span className="font-semibold">{tt?.name}</span>
                              <span className="text-gray-500">·</span>
                              <span>{s.section}</span>
                              <span className="text-gray-500">·</span>
                              <span>Row {s.row}</span>
                              <span className="text-gray-500">·</span>
                              <span>Seat {s.seat}</span>
                              <button onClick={() => unpickSeat(s)} className="text-red-500 hover:text-red-700 ml-1 font-bold">×</button>
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </Card>
          )}

          <Card padding="lg">
            {!hasTickets ? (
              <div className="text-center py-6">
                <h2 className="text-xl font-bold text-gray-800 mb-3">Tickets Not Yet Available</h2>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  This match is scheduled but tickets haven't been published yet.
                </p>
                <Link to="/matches"><Button variant={isNational ? 'primary' : 'secondary'}>Browse Other Matches</Button></Link>
              </div>
            ) : hasSections ? (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-800">Review & Pay</h2>
                  {selectedSeats.length > 0 && (
                    <span className="text-sm text-gray-500">{selectedSeats.length} ticket(s) selected</span>
                  )}
                </div>
                <div className="flex gap-4">
                  <Button variant="outline" size="lg" onClick={handleAddToCart} disabled={!canProceed}>Add to Cart</Button>
                  <Button
                    variant={isNational ? 'primary' : 'secondary'}
                    size="lg"
                    onClick={handleBuyNow}
                    disabled={!canProceed}
                    icon="→"
                    iconPosition="right"
                  >
                    Buy Now
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2 className="text-xl font-bold text-gray-800 mb-6">Select Your Tickets</h2>
                <div className="space-y-4">
                  {match.ticket_types.map(tt => {
                    const myHoldQty = quantities[tt.id] || 0
                    const otherHolds = Math.max(0, (tt.held || 0) - myHoldQty)
                    const maxForMe = tt.capacity - tt.tickets_sold - otherHolds
                    const freeForMe = maxForMe - myHoldQty
                    const showControls = myHoldQty > 0 || maxForMe > 0
                    return (
                      <div key={tt.id} className="flex flex-wrap items-center justify-between gap-4 p-4 border border-gray-100 rounded-xl hover:border-green-200 transition">
                        <div className="flex-1">
                          <h4 className="font-semibold text-lg text-gray-800">{tt.name}</h4>
                          <p className="text-2xl font-bold text-green-600">ZMW {tt.price.toFixed(2)}</p>
                          {myHoldQty > 0 && <p className="text-sm text-green-700 font-medium">✅ You hold {myHoldQty} seat(s)</p>}
                          <p className={`text-sm ${freeForMe === 0 && myHoldQty === 0 ? 'text-red-500' : 'text-gray-500'}`}>
                            {freeForMe > 0 ? `${freeForMe} seat(s) available` : ''}
                            {myHoldQty > 0 ? ` (max ${maxForMe})` : ''}
                          </p>
                        </div>
                        {showControls ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleDecrement(tt.id)} disabled={myHoldQty <= 0} className="w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-100 text-xl font-bold">-</button>
                            <input type="number" min="0" max={maxForMe} value={myHoldQty} onChange={e => handleQuantityChange(tt.id, e.target.value)} className="w-16 h-10 text-center border border-gray-200 rounded-lg text-lg font-semibold" />
                            <button onClick={() => handleIncrement(tt.id)} disabled={myHoldQty >= maxForMe} className="w-10 h-10 rounded-xl border border-gray-200 hover:bg-gray-100 text-xl font-bold">+</button>
                          </div>
                        ) : <Badge variant="danger">Sold Out</Badge>}
                      </div>
                    )
                  })}
                </div>
                <div className="flex gap-4 mt-8">
                  <Button variant="outline" size="lg" onClick={handleAddToCart} disabled={quantityTotal === 0}>Add to Cart</Button>
                  <Button
                    variant={isNational ? 'primary' : 'secondary'}
                    size="lg"
                    onClick={handleBuyNow}
                    disabled={quantityTotal === 0}
                    icon="→"
                    iconPosition="right"
                  >
                    Buy Now
                  </Button>
                </div>
              </>
            )}
          </Card>

          <AttachedProducts matchId={match.id} />
          
        </div>
      </div>
    </MainLayout>
  )
}