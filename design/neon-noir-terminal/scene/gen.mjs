// PHOSPHOR CITY: the rain-slicked skyline frame, redrawn on a green phosphor CRT.
// node gen.mjs > scene.svg   (placement per window shape lives in layout.mjs)
import { buildRules, rulesCss, GROUP_CSS, BX as LBX, BY as LBY, BW as LBW, BH as LBH, MX as LMX } from './layout.mjs'
const W = 480, H = 300

function rng(seed) {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
// relative moves: after z the pen is back at the rect's corner
const d = rs => { let o = '', px = null, py = 0; for (const [x, y, w, h] of rs) { o += (px === null ? `M${x} ${y}` : `m${x - px} ${y - py}`) + `h${w}v${h}h${-w}z`; px = x; py = y } return o }
const P = (rs, a = '') => rs.length ? `<path${a ? ' ' + a : ''} d="${d(rs)}"/>` : ''
const merge = rs => {
  const out = []
  for (const r of rs) {
    const p = out[out.length - 1]
    if (p && p[0] === r[0] && p[2] === r[2] && p[1] + p[3] === r[1]) p[3] += r[3]
    else out.push([...r])
  }
  return out
}
const disc = (cx, cy, r) => {
  const rs = []
  for (let i = -r; i < r; i++) {
    const dy = i + 0.5, hw = Math.round(Math.sqrt(Math.max(0, r * r - dy * dy)))
    if (hw > 0) rs.push([cx - hw, cy + i, 2 * hw, 1])
  }
  return merge(rs)
}
const rrect = (x, y, w, h, r) => {
  const top = [], bot = []
  for (let i = 0; i < r; i++) {
    const dy = r - i - 0.5
    const ins = Math.round(r - Math.sqrt(Math.max(0, r * r - dy * dy)))
    top.push([x + ins, y + i, w - 2 * ins, 1])
    bot.unshift([x + ins, y + h - 1 - i, w - 2 * ins, 1])
  }
  return merge([...top, [x, y + r, w, h - 2 * r], ...bot])
}

// ---------- 5x7 sign font ----------
const F = {
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  2: ['01110', '10001', '00001', '00010', '00100', '01000', '11111'],
  4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
}
const rowsToRects = (rows, ox, oy, s = 1) => {
  const out = []
  rows.forEach((row, r) => {
    let c = 0
    while (c < row.length) {
      if (row[c] === '1') {
        let e = c; while (e < row.length && row[e] === '1') e++
        out.push([ox + c * s, oy + r * s, (e - c) * s, s]); c = e
      } else c++
    }
  })
  return out
}
const glyph = (ch, ox, oy, s = 1) => rowsToRects(F[ch], ox, oy, s)

// ---------- 3x5 terminal font ----------
const T3 = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100111100111', G: '011100101101011', I: '111010010010111', K: '101101110101101',
  L: '100100100100111', M: '101111111101101', N: '10011101101110011001', O: '010101101101010',
  P: '110101110100100', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101011', W: '101101111111101', Y: '101101010010010',
  0: '011101101101110', 1: '010110010010010', 2: '110001010100111', 3: '110001010001110',
  4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010100100',
  8: '111101111101111', 9: '111101111001110', ':': '000010000010000', '.': '000000000000010',
  '>': '100010001010100', '_': '000000000000111', '-': '000000111000000', ' ': '000000000000000',
}
const gw = ch => T3[ch].length / 5
const tw = str => [...str].reduce((a, ch) => a + gw(ch) + 1, 0)
const t3 = (str, ox, oy) => { let x = ox; return [...str].flatMap(ch => {
  const b = T3[ch], w = gw(ch), rs = rowsToRects([0, 1, 2, 3, 4].map(r => b.slice(r * w, r * w + w)), x, oy); x += w + 1; return rs
}) }

const defs = []
// neon tube: pale core, saturated rim, translucent outer glow, all from one shape
const neon = (id, rects, col, core, o = '.34') => {
  defs.push(`<path id="${id}" d="${d(rects)}"/>`)
  const u = (x, y) => `<use href="#${id}"${x ? ` x="${x}"` : ''}${y ? ` y="${y}"` : ''}/>`
  return `<g fill="${col}" opacity="${o}">${u(-2, 0)}${u(2, 0)}${u(0, -2)}${u(0, 2)}${u(-1, -1)}${u(1, 1)}${u(1, -1)}${u(-1, 1)}</g>` +
    `<g fill="${col}">${u(-1, 0)}${u(1, 0)}${u(0, -1)}${u(0, 1)}</g><use href="#${id}" fill="${core}"/>`
}
// soft phosphor text: a CRT's vertical bleed under a bright core (no sideways bloom, so the 1-unit
// counters of O/0 and the gaps between letters stay dark)
const glowText = (id, rects, col, core, o = '.3') => {
  defs.push(`<path id="${id}" d="${d(rects)}"/>`)
  const u = (x, y) => `<use href="#${id}"${x ? ` x="${x}"` : ''}${y ? ` y="${y}"` : ''}/>`
  return `<g fill="${col}" opacity="${o}">${u(0, -1)}${u(0, 1)}</g><use href="#${id}" fill="${core}"/>`
}
// antenna beacon: a point of light (core, cross arms, faint diagonals, a fainter ring above and beside)
const beacon = (cls, cx, cy, k) => `<g class="${cls}">` +
  P([[cx, cy - 2, k, 1], [cx - 2, cy, 1, k], [cx + k + 1, cy, 1, k]], `fill="${C.p1}" opacity=".08"`) +
  P([[cx - 1, cy - 1, 1, 1], [cx + k, cy - 1, 1, 1], [cx - 1, cy + k, 1, 1], [cx + k, cy + k, 1, 1]], `fill="${C.p1}" opacity=".18"`) +
  P([[cx, cy - 1, k, 1], [cx - 1, cy, 1, k], [cx + k, cy, 1, k], [cx, cy + k, k, 1]], `fill="${C.p1}" opacity=".5"`) +
  P([[cx, cy, k, k]], `fill="${C.p0}"`) + `</g>`
const halo = (x, y, w, h, col, steps) =>
  `<g fill="${col}">` + steps.map(([e, o]) => P(rrect(x - e, y - e, w + 2 * e, h + 2 * e, Math.min(e + 1, 12)), `opacity="${o}"`)).join('') + '</g>'
const frame = (x, y, w, h) => [[x, y, w, 1], [x, y + h - 1, w, 1], [x, y + 1, 1, h - 2], [x + w - 1, y + 1, 1, h - 2]]

// ---------- palette: one phosphor, one neon ----------
const C = {
  sky: '#010604',
  mag: '#ff1fd2', magC: '#ffa6f1',
  g: '#2bff6a', gC: '#a6ffbb',           // neon-green tube + core (green enough to stay green on a dimmed scanline row)
  p0: '#c9ffd6', p1: '#6dff95', p2: '#2fdc5e', p3: '#1a8f3e', p4: '#0f5a27', p5: '#08321a', p6: '#041a0c',
  tF: '#010402', tM: '#020a05',
}
const LIT = [C.p2, C.p2, C.p2, C.p1, C.p0, C.p3]

const litWindows = (rand, x0, x1, y0, y1, sx, sy, ww, wh, p, cols = LIT, skip = () => false) => {
  const by = {}
  for (let x = x0; x + ww <= x1; x += sx) for (let y = y0; y + wh <= y1; y += sy) {
    if (skip(x, y)) continue
    const pp = (typeof p === 'function' ? p(x, y) : p) * (y < 140 ? 1 : y < 200 ? 0.5 : 0.28)
    if (rand() < pp) {
      const c = cols[Math.floor(rand() * cols.length)]
      ;(by[c] ||= []).push([x, y, ww, wh])
    }
  }
  return Object.entries(by).map(([c, rs]) => P(rs, `fill="${c}"`)).join('')
}

// ---------- patterns ----------
const dither = (id, col, n, o = '') => {
  const a = o ? ` opacity="${o}"` : ''
  if (n === 50) return `<pattern id="${id}" width="2" height="2" patternUnits="userSpaceOnUse"><path fill="${col}"${a} d="M0 0h1v1h-1zM1 1h1v1h-1z"/></pattern>`
  if (n === 25) return `<pattern id="${id}" width="2" height="2" patternUnits="userSpaceOnUse"><path fill="${col}"${a} d="M0 0h1v1h-1z"/></pattern>`
  return `<pattern id="${id}" width="4" height="4" patternUnits="userSpaceOnUse"><path fill="${col}"${a} d="M0 0h1v1h-1zM2 2h1v1h-1z"/></pattern>`
}
defs.push(dither('g12', '#06200f', 12), dither('g25', '#06200f', 25), dither('g50', '#06200f', 50), dither('h25', '#0c3a1b', 25), dither('h12', '#0c3a1b', 12))
defs.push(dither('s50', '#041409', 50))
defs.push(dither('k50', '#000', 50), dither('k25', '#000', 25), dither('k12', '#000', 12))
// CRT: scanlines (every other row dimmed) and a faint phosphor dot mesh
defs.push(`<pattern id="scan" width="4" height="2" patternUnits="userSpaceOnUse"><path fill="#000" opacity=".34" d="M0 1h4v1h-4z"/></pattern>`)
// the same raster with the other phase (even rows dimmed), for TTY log lines that start on an odd row
defs.push(`<pattern id="scanB" width="4" height="2" patternUnits="userSpaceOnUse"><path fill="#000" opacity=".34" d="M0 0h4v1h-4z"/></pattern>`)
defs.push(`<pattern id="mesh" width="3" height="4" patternUnits="userSpaceOnUse"><path fill="${C.p1}" opacity=".05" d="M0 0h1v1h-1z"/></pattern>`)
defs.push(`<pattern id="wF" width="6" height="8" patternUnits="userSpaceOnUse"><path fill="#04140a" d="M2 2h2v3h-2z"/></pattern>`)
defs.push(`<pattern id="wM" width="5" height="6" patternUnits="userSpaceOnUse"><path fill="#061a0d" d="M2 2h2v2h-2z"/></pattern>`)
// one streak per cell of a cols x rows grid, jittered anywhere in its cell, length +-1
const rainTile = (id, tw, th, cols, rows, len, col, seed) => {
  const r = rng(seed), rs = [], cw = tw / cols, ch = th / rows
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const q = r(), L = Math.max(1, len + (q < 0.25 ? -1 : q > 0.8 ? 1 : 0))
    rs.push([Math.floor(i * cw + r() * cw), Math.floor(j * ch + r() * (ch - L)), 1, L])
  }
  return `<pattern id="${id}" width="${tw}" height="${th}" patternUnits="userSpaceOnUse">${P(rs.sort((a, b) => a[1] - b[1] || a[0] - b[0]), `fill="${col}"`)}</pattern>`
}
defs.push(rainTile('ra', 96, 144, 6, 8, 2, '#17703a', 11), rainTile('rb', 128, 192, 6, 6, 4, '#33b85f', 22), rainTile('rc', 184, 240, 5, 6, 6, C.p1, 33))

// ---------- layers ----------
const S = []

// city light on the smog: a dithered green horizon glow
S.push(`<g>` +
  `<rect x="-400" y="90" width="1280" height="20" fill="url(#g12)"/>` +
  `<rect x="-400" y="110" width="1280" height="16" fill="url(#g25)"/>` +
  `<rect x="-400" y="126" width="1280" height="14" fill="url(#g50)"/>` +
  `<rect x="-400" y="140" width="1280" height="400" fill="#06200f"/>` +
  `<rect x="-400" y="136" width="1280" height="10" fill="url(#h12)"/>` +
  `<rect x="-400" y="146" width="1280" height="400" fill="url(#h25)"/></g>`)

// stars: phosphor specks
{
  const r = rng(5), dim = [], br = []
  for (let i = 0; i < 26; i++) {
    const x = Math.floor(r() * 520) - 20, y = Math.floor(r() * 80) + 2
    ;(r() < 0.3 ? br : dim).push([x, y, 1, 1])
  }
  S.push(P(dim, `fill="${C.p3}"`) + P(br, `fill="${C.p1}"`))
}

// the moon: a phosphor disc, half sunk in a drifting smog bank
const MX = LMX, MY = 26
{
  const mx = MX, my = MY, r = 14
  let m = `<g class="mn">`
  m += `<g fill="${C.g}">` + P(disc(mx, my, r + 18), 'opacity=".035"') + P(disc(mx, my, r + 11), 'opacity=".07"') + P(disc(mx, my, r + 5), 'opacity=".14"') + P(disc(mx, my, r + 2), 'opacity=".2"') + '</g>'
  m += P(disc(mx, my, r), `fill="${C.p1}"`)
  // raster bands across the disc: every third row a touch dimmer
  const rows = disc(mx, my, r).flatMap(([x, y, w, h]) => Array.from({ length: h }, (_, k) => [x, y + k, w, 1]))
  m += P(rows.filter(q => (q[1] - my) % 3 === 0), `fill="${C.p2}"`)
  const limb = rows.map(([x, y, w]) => [x + w - Math.min(4, w), y, Math.min(4, w), 1])
  m += P(limb, `fill="${C.p3}"`)
  m += P([[mx - 7, my - 8, 4, 3], [mx + 3, my - 5, 5, 4], [mx - 4, my + 2, 3, 2], [mx + 6, my + 4, 2, 3], [mx - 10, my - 1, 2, 2]], `fill="${C.p2}"`)
  m += P([[mx - 9, my - 10, 6, 1], [mx - 11, my - 8, 2, 4]], `fill="${C.p0}"`)
  const bank = (x0, x1, base, depth, bumps) => {
    const tops = []
    for (let x = x0; x < x1; x++) {
      let t = base
      for (const [cx, br, hh] of bumps) {
        const dx = x - cx
        if (Math.abs(dx) < br) t = Math.min(t, base - Math.round(Math.sqrt(br * br - dx * dx) * hh / br))
      }
      tops.push(t)
    }
    const body = [], hot = [], warm = [], cool = []
    let i = 0
    while (i < tops.length) {
      let j = i; while (j < tops.length && tops[j] === tops[i]) j++
      const x = x0 + i, w = j - i, t = tops[i]
      body.push([x, t, w, base + depth - t])
      const dist = Math.hypot(x + w / 2 - mx, t - my)
      ;(dist < r + 9 ? hot : dist < r + 30 ? warm : cool).push([x, t, w, 1])
      i = j
    }
    return P(body, `fill="${C.sky}"`) + P(cool, `fill="${C.p5}"`) + P(warm, `fill="${C.p3}"`) + P(hot, `fill="${C.p0}"`) +
      `<rect x="${x0}" y="${base + depth}" width="${x1 - x0}" height="3" fill="url(#s50)"/>`
  }
  const o = mx - 330
  m += `<g class="sd">` + bank(232 + o, 444 + o, my + 18, 8, [[244, 8, 4], [262, 12, 7], [284, 10, 5], [304, 13, 8], [326, 11, 9], [345, 13, 10], [366, 9, 6], [388, 12, 7], [410, 9, 5], [430, 8, 4]].map(([a, b, c]) => [a + o, b, c])) + `</g>`
  const wisp = []
  wisp.push([mx - 150, 58, 120, 2], [mx - 120, 60, 60, 1], [mx + 40, 64, 90, 2], [mx + 60, 66, 40, 1])
  m += `<g class="sd2">` + P(wisp, 'fill="url(#s50)"') + `</g>`
  m += `</g>`
  S.push(m)
}

// distant skyline: a hazy far layer and a darker near layer outlined in phosphor
{
  const r = rng(3)
  const A = [], Aw = []
  let x = -60
  while (x < 540) {
    const w = 8 + Math.floor(r() * 14), f = Math.min(1, Math.abs(x + w / 2 - 240) / 230)
    const top = Math.min(144, Math.round(146 - 48 * f + (r() - 0.5) * 22))
    A.push([x, top, w, 300])
    if (r() < 0.35) { const cw = Math.max(3, w >> 1); A.push([x + ((w - cw) >> 1), top - 5, cw, 5]) }
    for (let yy = top + 3; yy < 300; yy += 3) for (let xx = x + 1; xx < x + w - 1; xx += 2) if (yy < 176 && r() < 0.07) Aw.push([xx, yy, 1, 1])
    x += w
  }
  const B = [[], []], rims = [], winD = [], winB = [], ants = [], reds = []
  const rw = rng(9)    // windows draw from their own stream, so the silhouette stays as it was
  x = -60
  let k = 0
  while (x < 540) {
    const w = 12 + Math.floor(r() * 20), f = Math.min(1, Math.abs(x + w / 2 - 240) / 230)
    const top = Math.round(178 - 66 * f + (r() - 0.5) * 26)
    B[k % 2].push([x, top, w, 300])
    rims.push([x + w - 1, top, 1, 300], [x, top, w - 1, 1], [x, top + 1, 1, 300])
    if (r() < 0.5) {
      const cw = Math.max(4, Math.floor(w * 0.45)), cx = x + Math.floor((w - cw) / 2)
      B[k % 2].push([cx, top - 6, cw, 6]); rims.push([cx, top - 6, cw, 1], [cx, top - 5, 1, 5], [cx + cw - 1, top - 5, 1, 5])
      if (r() < 0.65) { ants.push([cx + (cw >> 1), top - 15, 1, 9]); reds.push([cx + (cw >> 1) - 1, top - 17, 3, 2]) }
    }
    // floors every 4u; ~15% light a run of 2-6 adjacent 2x1 windows, one run per tower burns brighter,
    // and at most one floor per tower is lit end to end
    const slots = Math.floor((w - 3) / 3)
    let full = false, bright = false
    for (let yy = top + 4; yy < 250 && slots >= 2; yy += 4) {
      const q = rw(), pf = yy < 200 ? 1 : 0.5
      if (!full && q < 0.02 * pf) { for (let k2 = 0; k2 < slots; k2++) winD.push([x + 2 + k2 * 3, yy, 2, 1]); full = true; continue }
      if (q < 0.15 * pf) {
        const L = Math.min(slots, 2 + Math.floor(rw() * 5)), st = Math.floor(rw() * (slots - L + 1))
        const tgt = !bright && rw() < 0.3 ? (bright = true, winB) : winD
        for (let k2 = 0; k2 < L; k2++) tgt.push([x + 2 + (st + k2) * 3, yy, 2, 1])
      }
    }
    x += w + (r() < 0.55 ? 3 + Math.floor(r() * 10) : 0); k++
  }
  // the far layer is a dark cut-out (tM): darker than both the smog dither above y 140 and the glow below
  // it, so its edge never flips sign at the horizon line
  S.push(P(A, `fill="${C.tM}"`) + P(Aw, `fill="${C.p5}"`) +
    P(B[0], 'fill="#010503"') + P(B[1], 'fill="#020704"') + P(rims, 'fill="#093a1b"') + P(ants, 'fill="#093a1b"') +
    P(winD, `fill="${C.p4}"`) + P(winB, `fill="${C.p3}"`) + P(reds.slice(2), `fill="${C.p1}" opacity=".7"`) +
    reds.slice(0, 2).map((q, i) => `<g class="b${5 + i}">${P([q], `fill="${C.p0}"`)}</g>`).join(''))
}

// far rain
S.push(`<g opacity=".55"><rect class="r1" x="-10" y="-164" width="500" height="628" fill="url(#ra)"/></g>`)

// far hover car (small, right to left)
S.push(`<g transform="translate(300 90)"><g class="c2">` +
  P([[-8, 1, 8, 3]], `fill="${C.p0}" opacity=".12"`) +
  P([[10, 2, 10, 1]], `fill="${C.p2}" opacity=".5"`) + P([[21, 2, 14, 1]], `fill="${C.p2}" opacity=".2"`) +
  P([[3, 0, 4, 1]], `fill="${C.p3}"`) + P([[1, 1, 9, 1], [0, 2, 10, 1]], `fill="${C.p5}"`) + P([[3, 1, 3, 1]], `fill="${C.p1}"`) +
  P([[0, 2, 1, 1]], `fill="${C.p0}"`) + P([[9, 2, 1, 1]], `fill="${C.p1}"`) + P([[2, 3, 6, 1]], `fill="${C.g}" opacity=".7"`) +
  `</g></g>`)

// ---- mid towers ----
{
  const r = rng(41)
  let g = `<g class="lm">`
  g += P([[60, 78, 96, 260], [108, 70, 40, 8]], `fill="${C.tM}"`)
  g += `<rect x="60" y="82" width="96" height="230" fill="url(#wM)"/>`
  g += litWindows(r, 62, 156, 82, 300, 5, 6, 2, 2, (x) => x > 116 ? 0.2 : 0.08)
  g += P([[108, 70, 40, 1], [148, 78, 8, 1], [107, 71, 1, 7]], `fill="${C.p3}"`) + P([[155, 79, 1, 230]], `fill="${C.p4}"`)
  g += P([[114, 60, 12, 8], [115, 68, 1, 2], [124, 68, 1, 2], [140, 52, 1, 18], [138, 58, 5, 1]], `fill="${C.tM}"`)
  g += P([[114, 60, 12, 1], [140, 52, 1, 6]], `fill="${C.p4}"`)
  g += beacon('b3', 140, 50, 1)
  g += `</g>`
  g += `<g class="rm">`
  g += P([[380, 70, 80, 260], [386, 62, 30, 8]], `fill="${C.tM}"`)
  g += `<rect x="380" y="74" width="56" height="240" fill="url(#wM)"/>`
  g += litWindows(r, 382, 436, 74, 300, 5, 6, 2, 2, (x) => x < 400 ? 0.2 : 0.1)
  g += P([[386, 62, 30, 1], [380, 70, 6, 1], [416, 63, 1, 7]], `fill="${C.p3}"`) + P([[380, 71, 1, 240]], `fill="${C.p4}"`)
  g += P([[392, 52, 12, 10], [390, 44, 1, 18], [388, 50, 5, 1]], `fill="${C.tM}"`) + P([[392, 52, 12, 1], [390, 44, 1, 6]], `fill="${C.p4}"`)
  g += beacon('b4', 390, 42, 1)
  g += `<g class="t3">${P([[392, 110, 2, 2], [397, 110, 2, 2]], `fill="${C.p0}"`)}</g>`
  g += `</g>`
  S.push(g)
}

// mid rain
S.push(`<g opacity=".55"><rect class="r2" x="-10" y="-212" width="500" height="724" fill="url(#rb)"/></g>`)

// near hover car with a phosphor light trail (left to right); nothing on it is brighter than the message
// text (#80ff98), since its flight line can cross the slit between two message cards. Its body (y 68-77)
// flies at or below JAZZ's top frame (66), so it passes wholly behind the sign instead of riding its edge
S.push(`<g class="cy"><g transform="translate(150 68)"><g class="c1">` +
  `<g fill="${C.g}">${P([[28, 3, 10, 2]], 'opacity=".3"')}${P([[38, 2, 10, 4]], 'opacity=".14"')}${P([[48, 1, 12, 6]], 'opacity=".06"')}</g>` +
  `<g fill="${C.p1}">${P([[-10, 3, 10, 1]], 'opacity=".5"')}${P([[-14, 4, 14, 1]], 'opacity=".5"')}${P([[-32, 4, 18, 1]], 'opacity=".45"')}${P([[-56, 4, 24, 1]], 'opacity=".22"')}${P([[-84, 4, 28, 1]], 'opacity=".09"')}</g>` +
  `<g fill="${C.g}">${P([[-12, 7, 16, 1]], 'opacity=".5"')}${P([[-30, 7, 18, 1]], 'opacity=".25"')}${P([[-52, 7, 22, 1]], 'opacity=".1"')}</g>` +
  P([[9, 0, 10, 1]], `fill="${C.p1}"`) + P([[7, 1, 14, 1]], `fill="${C.p6}"`) + P([[10, 1, 8, 1]], `fill="${C.p2}"`) + P([[11, 1, 2, 1]], `fill="${C.p1}"`) +
  P([[3, 2, 23, 1]], `fill="${C.p4}"`) + P([[19, 2, 7, 1]], `fill="${C.p3}"`) + P([[1, 3, 26, 2], [0, 4, 1, 1]], `fill="${C.p5}"`) +
  P([[25, 3, 3, 2]], `fill="${C.p2}"`) + P([[0, 3, 2, 2]], `fill="${C.p1}"`) + P([[2, 5, 23, 1]], `fill="${C.g}"`) + P([[2, 6, 23, 1]], `fill="${C.p6}"`) +
  P([[4, 7, 6, 1], [17, 7, 6, 1]], `fill="${C.g}"`) + P([[5, 8, 4, 1], [18, 8, 4, 1]], `fill="${C.g}" opacity=".45"`) +
  `</g></g></g>`)

// dithered vignette, one band per edge; @media slides each band to the visible edge. The side bands sit
// here, under the front towers and their signs, so a sign riding a narrow gutter at the window's edge
// keeps its tubes clean; the top and bottom bands stay on the glass.
const band = (cls, rs) => `<g class="${cls}">${rs.map(([x, y, w, h, f]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f}"/>`).join('')}</g>`
// each band: solid beyond the edge, then 50% / 25% / 12% ordered dither stepping inward
const vb = (a, b, c) => [[0, a, 'url(#k50)'], [a, b, 'url(#k25)'], [a + b, c, 'url(#k12)']]
S.push(band('vl', [[-400, -400, 400, 1100, '#000'], ...vb(3, 4, 6).map(([o, w, f]) => [o, -400, w, 1100, f])]))
S.push(band('vr', [[480, -400, 400, 1100, '#000'], ...vb(3, 4, 6).map(([o, w, f]) => [480 - o - w, -400, w, 1100, f])]))

// ---- front towers + signs ----
{
  const r = rng(77)
  // LEFT front tower, lit by the one magenta sign in a green world
  let g = `<g class="lf">`
  g += P([[-20, 34, 112, 290], [28, 26, 60, 8], [52, 18, 32, 8]], `fill="${C.tF}"`) + P([[79, 13, 1, 5], [77, 16, 5, 1]], `fill="${C.p4}"`)
  g += `<rect x="0" y="40" width="88" height="270" fill="url(#wF)"/>`
  g += litWindows(r, 2, 90, 42, 300, 6, 8, 2, 3, (x) => x > 64 ? 0.24 : 0.1)
  g += P([[-20, 34, 48, 1], [28, 26, 24, 1], [52, 18, 32, 1], [27, 27, 1, 7], [51, 19, 1, 7], [84, 19, 1, 7], [88, 27, 1, 7]], `fill="${C.p2}"`) +
    P([[-20, 82, 112, 1], [-20, 146, 112, 1], [-20, 210, 112, 1], [-20, 274, 112, 1]], `fill="${C.p5}"`)
  g += P([[91, 34, 1, 116]], `fill="${C.mag}" opacity=".9"`) + P(Array.from({ length: 20 }, (_, i) => [90, 40 + i * 5 + (i % 2), 1, 1]), `fill="${C.mag}" opacity=".6"`)
  g += P(Array.from({ length: 16 }, (_, i) => [91, 152 + i * 2, 1, 1]), `fill="${C.mag}" opacity=".6"`)
  g += P([[56, 21, 2, 3], [64, 21, 2, 3], [72, 21, 2, 3]], `fill="${C.p2}"`) + P([[80, 21, 2, 3]], `fill="${C.p0}"`) + P([[34, 29, 2, 2], [46, 29, 2, 2]], `fill="${C.p1}"`)
  g += P([[84, 82, 8, 1], [76, 82, 1, 1], [78, 82, 1, 1], [80, 82, 1, 1], [82, 82, 1, 1], [108, 70, 10, 1]], `fill="${C.mag}"`) + P([[86, 146, 6, 1], [80, 146, 1, 1], [82, 146, 1, 1], [84, 146, 1, 1]], `fill="${C.p1}"`)
  g += P(Array.from({ length: 11 }, (_, i) => [88 + (i % 2), 166 + Math.round(i * i * 0.9), 1, 2]), `fill="${C.mag}" opacity=".55"`)
  g += beacon('b1', 79, 10, 2)
  g += `<g class="t1">${P([[74, 58, 2, 3]], `fill="${C.p0}"`)}</g>`
  // HOTEL: the noir pop
  g += P([[92, 52, 2, 2], [92, 132, 2, 2], [92, 155, 2, 2]], 'fill="#1b2a20"')
  g += `<g class="hm">${halo(94, 42, 24, 102, C.mag, [[3, '.32'], [8, '.15'], [15, '.075'], [25, '.035']])}</g>`
  g += P([[94, 42, 24, 102]], 'fill="#16031a"') + P([[98, 46, 16, 94]], `fill="${C.mag}" opacity=".24"`) + P([...frame(95, 43, 22, 100), ...frame(97, 45, 18, 96)], `fill="${C.mag}"`) + P(frame(96, 44, 20, 98), `fill="${C.magC}"`)
  g += neon('tH', [...'HOTEL'].flatMap((ch, i) => glyph(ch, 101, 50 + i * 18, 2)), C.mag, C.magC)
  // 24H in phosphor green beneath it
  g += halo(94, 150, 27, 13, C.g, [[2, '.25'], [6, '.1']])
  g += P([[94, 150, 27, 13]], 'fill="#011a08"') + P(frame(95, 151, 25, 11), `fill="${C.g}"`)
  g += P([...glyph('2', 98, 153), ...glyph('4', 105, 153), ...glyph('H', 112, 153)], `fill="${C.gC}"`)
  g += `</g>`

  // RIGHT front tower (roof dropped to leave the top corner to the terminal)
  const dy = 30
  g += `<g class="rf">`
  g += P([[436, 30 + dy, 64, 290], [440, 22 + dy, 44, 8], [446, 14 + dy, 26, 8], [452, 6 + dy, 1, 8], [450, 9 + dy, 5, 1]], `fill="${C.tF}"`)
  g += `<rect x="438" y="${36 + dy}" width="50" height="270" fill="url(#wF)"/>`
  g += litWindows(r, 440, 482, 36 + dy, 300, 6, 8, 2, 3, (x) => x < 460 ? 0.24 : 0.12)
  g += P([[440, 22 + dy, 6, 1], [446, 14 + dy, 26, 1], [472, 22 + dy, 12, 1], [484, 30 + dy, 16, 1], [440, 23 + dy, 1, 7], [446, 15 + dy, 1, 7], [471, 15 + dy, 1, 7], [483, 23 + dy, 1, 7]], `fill="${C.p2}"`) +
    P([[436, 78 + dy, 64, 1], [436, 142 + dy, 64, 1], [436, 206 + dy, 64, 1]], `fill="${C.p5}"`)
  g += P([[436, 30 + dy, 1, 104]], `fill="${C.g}" opacity=".9"`) + P(Array.from({ length: 18 }, (_, i) => [437, 36 + dy + i * 5 + (i % 2), 1, 1]), `fill="${C.g}" opacity=".6"`)
  g += P(Array.from({ length: 12 }, (_, i) => [436, 136 + dy + i * 2, 1, 1]), `fill="${C.p1}" opacity=".6"`)
  g += P([[450, 17 + dy, 2, 3], [462, 17 + dy, 2, 3]], `fill="${C.p2}"`) + P([[456, 17 + dy, 2, 3]], `fill="${C.p0}"`) + P([[444, 25 + dy, 2, 2], [476, 25 + dy, 2, 2]], `fill="${C.p1}"`)
  g += P([[436, 78 + dy, 8, 1], [445, 78 + dy, 1, 1], [447, 78 + dy, 1, 1], [449, 78 + dy, 1, 1], [451, 78 + dy, 1, 1]], `fill="${C.p1}"`)
  g += P(Array.from({ length: 11 }, (_, i) => [437 + (i % 2), 154 + dy + Math.round(i * i * 0.9), 1, 2]), `fill="${C.g}" opacity=".55"`)
  g += `<g class="t2">${P([[464, 116 + dy, 2, 3], [470, 116 + dy, 2, 3]], `fill="${C.p0}"`)}</g>`
  // JAZZ in phosphor green
  const jy = 36 + dy
  g += P([[434, jy + 10, 2, 2], [434, jy + 72, 2, 2], [432, jy + 95, 4, 2]], 'fill="#1b2a20"')
  g += `<g class="hm2">${halo(410, jy, 24, 84, C.g, [[3, '.3'], [8, '.14'], [15, '.07'], [25, '.03']])}</g>`
  g += P([[410, jy, 24, 84]], 'fill="#011a08"') + P([[414, jy + 4, 16, 76]], `fill="${C.g}" opacity=".2"`) + P([...frame(411, jy + 1, 22, 82), ...frame(413, jy + 3, 18, 78)], `fill="${C.g}"`) + P(frame(412, jy + 2, 20, 80), `fill="${C.gC}"`)
  g += neon('tJ', [...'JAZZ'].flatMap((ch, i) => glyph(ch, 417, jy + 8 + i * 18, 2)), C.g, C.gC)
  // cocktail glyph sign: a dying tube
  const glass = [[0, 0, 13, 1]]
  for (let i = 1; i <= 5; i++) glass.push([i, i, 1, 1], [12 - i, i, 1, 1])
  glass.push([6, 6, 1, 6], [3, 12, 7, 1], [9, -3, 1, 1], [8, -2, 1, 1], [7, -1, 1, 1])
  const cy = jy + 90
  g += P([[412, cy, 20, 21]], 'fill="#011006"')
  g += `<g class="fl">${halo(412, cy, 20, 21, C.p2, [[2, '.25'], [6, '.1'], [11, '.04']])}` +
    neon('tG', glass.map(([x, y, w, h]) => [416 + x, cy + 6 + y, w, h]), C.p2, C.gC) + `</g>`
  g += P(frame(412, cy, 20, 21), `fill="${C.p4}"`)
  g += `</g>`
  S.push(g)
}

// near rain, with drops lit by the signs
S.push(`<g opacity=".32"><rect class="r3" x="-10" y="-260" width="500" height="820" fill="url(#rc)"/></g>`)
// the magenta-lit drops stop above the green 24H panel (and its halo) and resume below it
defs.push(`<clipPath id="kL">${P(rrect(78, 26, 58, 120, 10))}${P([[78, 170, 58, 8]])}</clipPath><clipPath id="kR">${P(rrect(394, 50, 58, 146, 10))}</clipPath>`)
defs.push(rainTile('rm', 69, 90, 4, 5, 5, '#ff86ea', 44), rainTile('rn', 69, 90, 4, 5, 5, C.gC, 55))
S.push(`<g class="lf"><g clip-path="url(#kL)"><rect class="r4" x="60" y="-70" width="90" height="260" fill="url(#rm)"/></g></g>` +
  `<g class="rf"><g clip-path="url(#kR)"><rect class="r4" x="380" y="-44" width="90" height="250" fill="url(#rn)"/></g></g>`)

const HUD = []
// ---------- the terminal: a boot log typing out in the top-right corner ----------
const BX = LBX, BY = LBY, BW = LBW
// every glyph lands on a 1/8 s beat (the scene's shared clock)
const LINES = [
  ['> BOOT NOIR.SYS', 0.75, 2.625],
  [' RAIN ..... OK', 3.25, 5.0],
  [' NEON .. ONLINE', 5.5, 7.375],
  ['> ', 7.75, 8.0],
]
const LY = i => BY + 12 + i * 7
const BH = LY(LINES.length - 1) + 5 + 4 - BY
if (BH !== LBH) throw new Error('layout.mjs BH out of sync')
const TYPE_T = 40
// between boots the prompt stays alive: a command types (one glyph per 1/8 s), holds, clears in one step
const CMD = 'CAT RAIN.LOG', CMD_AT = [10.0, 26.0], CMD_STEP = 0.125, CMD_HOLD = 8
const CMD_CUM = [...CMD].map((_, j) => tw(CMD.slice(0, j + 1)))   // pixel width typed after each glyph
const W3 = BW - 4                                                // the prompt line's clip spans the whole row
{
  // the glass (.bx's own fill) stays solid at every size, so nothing behind the window shows through its
  // log; on a phone only what is drawn around and on it dims (.bxh halo, .bxi ink)
  let b = `<g class="bx">`
  b += `<g class="bxh">${halo(BX, BY, BW, BH, C.g, [[1, '.3'], [3, '.12'], [6, '.05'], [10, '.025']])}</g>`
  b += P(rrect(BX, BY, BW, BH, 2), `fill="#010a04"`)
  b += `<g class="bxi">`
  b += P(merge([[BX + 2, BY, BW - 4, 1], [BX + 1, BY + 1, 1, 1], [BX + BW - 2, BY + 1, 1, 1], [BX, BY + 2, 1, BH - 4], [BX + BW - 1, BY + 2, 1, BH - 4], [BX + 1, BY + BH - 2, 1, 1], [BX + BW - 2, BY + BH - 2, 1, 1], [BX + 2, BY + BH - 1, BW - 4, 1]]), `fill="${C.p1}"`)
  // title row: tty label, signal bars, clock
  b += P([[BX + 1, BY + 8, BW - 2, 1]], `fill="${C.p4}"`)
  // everything that reads as text (title row and log) goes in .lg; under a phone's flat veil the ink dims
  // (.bxi .6) and the text a touch more (.lg .9), so glyphs this size never read as words behind the
  // conversation and the frame never undercuts a line's contrast
  let lg = ''
  lg += P(t3('TTY1', BX + 4, BY + 2), `fill="${C.p2}"`)
  lg += P([[BX + 22, BY + 5, 1, 2], [BX + 24, BY + 4, 1, 3], [BX + 26, BY + 3, 1, 4]], `fill="${C.p2}"`) + `<g class="sg">${P([[BX + 28, BY + 2, 1, 5]], `fill="${C.p1}"`)}</g>`
  // clock 02:mm:ss with rolling digit strips (minutes tens and ones, seconds tens and ones)
  const cx = BX + BW - 4 - 31
  lg += P(t3('02:', cx, BY + 2), `fill="${C.p2}"`) + P(t3(':', cx + 20, BY + 2), `fill="${C.p2}"`)
  defs.push(`<clipPath id="kc">${P([[cx + 12, BY + 2, 7, 5], [cx + 24, BY + 2, 7, 5]])}</clipPath>`)
  const strip = (n, x) => P(Array.from({ length: n }, (_, k) => t3(String(k), x, BY + 2 + k * 7)).flat(), `fill="${C.p2}"`)
  lg += `<g clip-path="url(#kc)"><g class="d0">${strip(6, cx + 12)}</g><g class="d1">${strip(10, cx + 16)}</g>` +
    `<g class="d2">${strip(6, cx + 24)}</g><g class="d3">${strip(10, cx + 28)}</g></g>`
  // log lines, each revealed by a clip rect stepping across one character at a time
  LINES.forEach(([str, , ], i) => {
    const y = LY(i), n = str.length, last = i === LINES.length - 1
    defs.push(`<clipPath id="kt${i}"><rect class="k${i}" x="${BX + 3}" y="${y - 2}" width="${last ? W3 : tw(str) + 2}" height="9"/></clipPath>`)
    const hi = [], lo = []
    let cx0 = BX + 4
    ;[...str].forEach((ch, j) => {
      const rs = t3(ch, cx0, y); cx0 += gw(ch) + 1
      ;(ch === '>' || (str.endsWith('OK') && j >= n - 2) || (str.endsWith('ONLINE') && j >= n - 6) ? hi : lo).push(...rs)
    })
    let inner = ''
    if (lo.length) inner += glowText(`tl${i}`, lo, C.g, C.p2, '.2')
    if (hi.length) inner += glowText(`th${i}`, hi, C.g, C.p0, '.34')
    if (last) {
      // the command, revealed by its own stepping clip; drawn a touch brighter than the log (typed input)
      const x0 = BX + 4 + tw(str), cw = tw(CMD)
      defs.push(`<clipPath id="kt4"><rect class="k4" x="${x0 - 1}" y="${y - 2}" width="${cw + 2}" height="9"/></clipPath>`)
      inner += `<g clip-path="url(#kt4)">${glowText('tc', t3(CMD, x0, y), C.g, C.p1, '.24')}</g>`
      // block cursor: a 3x5 core in a 5x7 halo, one dark column after the typed command (the still);
      // .cm rides the typing edge, .ci/.cu blink while idle, .cs holds it solid while keys fall
      const kx = x0 + cw + 1
      defs.push(`<g id="cur">${P([[kx - 1, y - 1, 5, 7]], `fill="${C.g}" opacity=".3"`)}${P([[kx, y, 3, 5]], `fill="${C.p0}"`)}</g>`)
      inner += `<g class="cm"><g class="ci"><g class="cu"><use href="#cur"/></g></g><g class="cs" opacity="0"><use href="#cur"/></g></g>`
    }
    lg += `<g clip-path="url(#kt${i})">${inner}</g>`
  })
  // its own scanlines, in the box's own (scaled) space, so each glyph row gets one whole stripe at any scale.
  // The line pitch (7) is odd, so each line gets the raster phase that puts its glyph rows 0/2/4 (the bars of
  // the 3x5 font) on bright rows: one band per line, cut on the gap row above it
  const cut = [BY, ...LINES.slice(1).map((_, i) => LY(i + 1) - 1), BY + BH]
  b += `<g class="lg">${lg}</g>` + cut.slice(0, -1).map((y0, i) =>
    `<rect x="${BX}" y="${y0}" width="${BW}" height="${cut[i + 1] - y0}" fill="url(#scan${LY(i) % 2 ? 'B' : ''})"/>`).join('') + `</g></g>`
  HUD.push(b)
}

// ---------- CRT glass (screen space, outside the shifting world) ----------
const crt = []
crt.push(band('vt', [[-400, -400, 1280, 400, '#000'], ...vb(3, 5, 7).map(([o, h, f]) => [-400, o, 1280, h, f])]))
crt.push(band('vb', [[-400, 300, 1280, 400, '#000'], ...vb(4, 6, 9).map(([o, h, f]) => [-400, 300 - o - h, 1280, h, f])]))
crt.push(`<rect x="-400" y="-400" width="1280" height="1100" fill="url(#mesh)"/>`)
crt.push(`<rect x="-400" y="-400" width="1280" height="1100" fill="url(#scan)"/>`)
// the terminal floats on the glass, above the vignette and the screen-wide raster (it carries its own)
crt.push(`<g class="w">${HUD.join('')}</g>`)
// rolling scan band
crt.push(`<g class="sb">` +
  P([[-400, 0, 1280, 2]], `fill="${C.p1}" opacity=".035"`) + P([[-400, 2, 1280, 8]], `fill="${C.p1}" opacity=".07"`) +
  P([[-400, 10, 1280, 2]], `fill="${C.g}" opacity=".1"`) + P([[-400, 12, 1280, 4]], `fill="${C.p1}" opacity=".05"`) + `</g>`)

// ---------- responsive placement: see layout.mjs ----------
const { base: BASE_RULES, desk: DESK_RULES } = buildRules()
const mqCss = rulesCss([...BASE_RULES, ...DESK_RULES])

// typewriter keyframes, one per line
const pc = t => +(t / TYPE_T * 100).toFixed(4)
const X = v => `{transform:translateX(${v}px)}`
// each glyph lands whole: the clip edge steps to the middle of the 1u gap after it (N is 4 wide, the rest 3),
// so at a fractional scale the edge never rounds onto the next glyph's first column
const typeCss = LINES.map(([str, s, e], i) => {
  const w = i === LINES.length - 1 ? W3 : tw(str) + 2   // the prompt's clip opens across the whole row (command + cursor live inside)
  const st = [...str].slice(0, -1).map((_, j) => `${pc(s + (j + 1) * (e - s) / str.length)}%${X(-w + tw(str.slice(0, j + 1)) + 0.5)}`).join('')
  return `@keyframes k${i}{0%${X(-w)}${st}${pc(e)}%,100%${X(0)}}.k${i}{animation:k${i} ${TYPE_T}s step-end -9s infinite}`
}).join('\n')
// the command: 13 exact glyph steps (pixel-true for the 4-wide N), an 8s hold, a one-step clear
const cmdKf = (name, hide, at) => {
  const st = []
  for (const t0 of CMD_AT) {
    CMD_CUM.forEach((c, j) => st.push(`${pc(t0 + (j + 1) * CMD_STEP)}%${X(at(c))}`))
    st.push(`${pc(t0 + CMD.length * CMD_STEP + CMD_HOLD)}%${X(hide)}`)
  }
  return `@keyframes ${name}{0%${X(hide)}${st.join('')}100%${X(hide)}}.${name}{animation:${name} ${TYPE_T}s step-end -9s infinite}`
}
const cmdW = tw(CMD)
const solid = CMD_AT.map(t0 => [pc(t0), pc(t0 + CMD.length * CMD_STEP + 0.5)])
const cmdCss = cmdKf('k4', -(cmdW + 2), c => c - cmdW - 1.5) + '\n' + cmdKf('cm', -cmdW, c => c - cmdW) + '\n' +
  `@keyframes ci{0%{opacity:1}${solid.map(([a, b]) => `${a}%{opacity:0}${b}%{opacity:1}`).join('')}100%{opacity:1}}.ci{animation:ci ${TYPE_T}s step-end -9s infinite}` +
  `@keyframes cs{0%{opacity:0}${solid.map(([a, b]) => `${a}%{opacity:1}${b}%{opacity:0}`).join('')}100%{opacity:0}}.cs{animation:cs ${TYPE_T}s step-end -9s infinite}`

// Every stepped animation runs on one shared clock: durations, delays and keyframe times are multiples
// of 1/16 s (the full-window rain of 1/8 s), so changes coincide and the scene repaints at most 16 times
// a second instead of on ~40 unrelated beats. Base transforms below park the moving props where the
// still (reduced motion) wants them: both cars off-screen at their 0% keyframes, the scan band above
// the top edge, and the clock strips reading 02:40:17.
const css = `
${GROUP_CSS}
.sb{transform:translateY(-24px)}.c1{transform:translateX(-230px)}.c2{transform:translateX(220px)}
.d0{transform:translateY(-28px)}.d2{transform:translateY(-7px)}.d3{transform:translateY(-49px)}
@keyframes ra{to{transform:translateY(144px)}}@keyframes rb{to{transform:translateY(192px)}}@keyframes rc{to{transform:translateY(240px)}}@keyframes rd{to{transform:translateY(90px)}}
.r1{animation:ra 12s steps(48) infinite}.r2{animation:rb 6s steps(48) infinite}.r3{animation:rc 5s steps(40) infinite}.r4{animation:rd 2.25s steps(18) infinite}
@keyframes c1{0%{transform:translateX(-230px)}41.9355%,100%{transform:translateX(394px)}}
.c1{animation:c1 31s steps(208) -6s infinite}
@keyframes c2{0%{transform:translateX(220px)}40.6977%,100%{transform:translateX(-340px)}}
.c2{animation:c2 43s steps(280) -22s infinite}
@keyframes bl{0%{opacity:1}50%,100%{opacity:.08}}
.b1{animation:bl 2.5s step-end infinite}.b3{animation:bl 3s step-end -.5s infinite}
.b4{animation:bl 4s step-end -2s infinite}.b5{animation:bl 3.75s step-end -.25s infinite}.b6{animation:bl 5s step-end -2.5s infinite}
@keyframes fl{0%{opacity:1}58.3333%{opacity:.16}61.4583%{opacity:1}64.0625%{opacity:.32}68.2292%{opacity:1}88.0208%{opacity:.4}91.1458%{opacity:1}}
.fl{animation:fl 12s step-end infinite}
@keyframes hm{50%{opacity:.62}}
.hm{animation:hm 7s steps(8) infinite}.hm2{animation:hm 9s steps(8) -3s infinite}
@keyframes sd{from{transform:translateX(-12px)}to{transform:translateX(12px)}}
.sd{animation:sd 48s steps(24) infinite alternate}.sd2{animation:sd 66s steps(24) -30s infinite alternate-reverse}
@keyframes wt{0%{opacity:1}62.5%,100%{opacity:0}}
.t1{animation:wt 24s step-end infinite}.t2{animation:wt 32s step-end -9s infinite}.t3{animation:wt 20s step-end -4s infinite}
${typeCss}
${cmdCss}
@keyframes cu{0%{opacity:1}50%,100%{opacity:0}}.cu{animation:cu 1.125s step-end -.5s infinite}
@keyframes sg{0%{opacity:1}75%,100%{opacity:.15}}.sg{animation:sg 4s step-end infinite}
@keyframes d0{from{transform:none}to{transform:translateY(-42px)}}.d0{animation:d0 3600s steps(6) -2417s infinite}
@keyframes d1{from{transform:none}to{transform:translateY(-70px)}}.d1{animation:d1 600s steps(10) -17s infinite}
@keyframes d2{from{transform:none}to{transform:translateY(-42px)}}.d2{animation:d2 60s steps(6) -17s infinite}
@keyframes d3{from{transform:none}to{transform:translateY(-70px)}}.d3{animation:d3 10s steps(10) -7s infinite}
@keyframes sb{from{transform:translateY(-24px)}to{transform:translateY(316px)}}.sb{animation:sb 10.625s steps(85) infinite}
${mqCss}
@media (max-aspect-ratio:1/1),(max-width:999px){.lg{opacity:.9}.bxh,.bxi{opacity:.6}.mn{opacity:.5}}
@media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" shape-rendering="crispEdges">
<style>${css}</style>
<defs>${defs.join('')}</defs>
<rect x="-400" y="-400" width="1280" height="1100" fill="${C.sky}"/>
<g class="w">
${S.join('\n')}
</g>
${crt.join('\n')}
</svg>
`
process.stdout.write(svg)
