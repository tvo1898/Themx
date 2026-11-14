// Builds band-idle.svg and band-working.svg from pixel maps.
// One unit = one 2x2 CSS px pixel. Canvas 180 x 14 units.
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

// ---------- pixel helpers ----------
const key = (x, y) => `${x},${y}`
const unkey = k => k.split(',').map(Number)

function pathOf(pixels) {
  // merge horizontal runs per row
  const rows = new Map()
  for (const k of pixels) {
    const [x, y] = unkey(k)
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push(x)
  }
  let d = ''
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = rows.get(y).sort((a, b) => a - b)
    let start = xs[0]
    let prev = xs[0]
    const flush = () => {
      d += `M${start} ${y}h${prev - start + 1}v1h-${prev - start + 1}z`
    }
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] === prev + 1) {
        prev = xs[i]
      } else {
        flush()
        start = prev = xs[i]
      }
    }
    flush()
  }
  return d
}

// ASCII map -> { char: Set(pixels) }, origin (ox, oy)
function fromAscii(lines, ox = 0, oy = 0) {
  const out = {}
  lines.forEach((line, y) => {
    ;[...line].forEach((ch, x) => {
      if (ch === '.' || ch === ' ') return
      ;(out[ch] ||= new Set()).add(key(ox + x, oy + y))
    })
  })
  return out
}

function dilate(pixels, diag = false) {
  const out = new Set()
  for (const k of pixels) {
    const [x, y] = unkey(k)
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]]
    if (diag) n.push([1, 1], [1, -1], [-1, 1], [-1, -1])
    for (const [dx, dy] of n) {
      const nk = key(x + dx, y + dy)
      if (!pixels.has(nk) && y + dy >= 0 && y + dy < 14) out.add(nk)
    }
  }
  return out
}

const union = (...sets) => new Set(sets.flatMap(s => [...s]))
const minus = (a, b) => new Set([...a].filter(k => !b.has(k)))

// ---------- font: 5 wide, rows 0..7 (0-1 ascender, 2-6 x-height, 7 descender) ----------
const FONT = {
  '>': ['.....', '.....', 'XX...', '.XX..', '..XX.', '.XX..', 'XX...', '.....'],
  n: ['.....', '.....', 'X.XX.', 'XX..X', 'X...X', 'X...X', 'X...X', '.....'],
  o: ['.....', '.....', '.XXX.', 'X...X', 'X...X', 'X...X', '.XXX.', '.....'],
  i: ['..X..', '.....', '.XX..', '..X..', '..X..', '..X..', '.XXX.', '.....'],
  r: ['.....', '.....', 'X.XX.', 'XX..X', 'X....', 'X....', 'X....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.XX..', '.XX..', '.....'],
  s: ['.....', '.....', '.XXXX', 'X....', '.XXX.', '....X', 'XXXX.', '.....'],
  y: ['.....', '.....', 'X...X', 'X...X', 'X...X', '.XXXX', '....X', '.XXX.'],
  e: ['.....', '.....', '.XXX.', 'X...X', 'XXXXX', 'X....', '.XXX.', '.....'],
  a: ['.....', '.....', '.XXX.', '....X', '.XXXX', 'X...X', '.XXXX', '.....'],
  d: ['....X', '....X', '.XX.X', 'X..XX', 'X...X', 'X...X', '.XXXX', '.....'],
  u: ['.....', '.....', 'X...X', 'X...X', 'X...X', 'X..XX', '.XX.X', '.....'],
  g: ['.....', '.....', '.XXXX', 'X...X', 'X...X', '.XXXX', '....X', '.XXX.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....', '.....'],
}

const ADV = 6
function textPixels(str, x0, y0) {
  const px = new Set()
  ;[...str].forEach((ch, i) => {
    const g = FONT[ch]
    if (!g) throw new Error('no glyph ' + ch)
    g.forEach((row, y) => {
      ;[...row].forEach((c, x) => {
        if (c === 'X') px.add(key(x0 + i * ADV + x, y0 + y))
      })
    })
  })
  return px
}

// ---------- tile + mascot ----------
// 20 x 14 frame, x 0..19. A lit window (venetian-blind slats) with the
// detective in silhouette: fedora, CRT head with a glowing screen, trench coat.
// g outer glow, b border, w window light, d blind slat (dark line)
const TILE = [
  '..gggggggggggggggg..',
  '.gbbbbbbbbbbbbbbbbg.',
  'gbwwwwwwwwwwwwwwwwbg',
  'gbddddddddddddddddbg',
  'gbwwwwwwwwwwwwwwwwbg',
  'gbwwwwwwwwwwwwwwwwbg',
  'gbddddddddddddddddbg',
  'gbwwwwwwwwwwwwwwwwbg',
  'gbwwwwwwwwwwwwwwwwbg',
  'gbddddddddddddddddbg',
  'gbwwwwwwwwwwwwwwwwbg',
  'gbwwwwwwwwwwwwwwwwbg',
  '.gbbbbbbbbbbbbbbbbg.',
  '..gggggggggggggggg..',
]
// rain on the glass, behind the slats and the man: [x, offset]; drops sit between y2 and y10, frozen mid-fall
const RAIN = [[3, 5], [16, 1], [6, 0], [13, 7], [10, 3]]
// static body: K ink silhouette (trench coat, collar popped up around the head),
// M monitor bezel, S screen, D power LED (bottom-right corner, clear of the eyes)
const ENV = process.env
const BODY = [
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '.....MMMMMMMMMM.....',
  '.....MSSSSSSSSM.....',
  '.....MSSSSSSSSM.....',
  '....KMSSSSSSSSMK....',
  '...KKMMMMMMMMMDKK...',
  '...KKKKKKKKKKKKKK...',
  '..KKKKKKKKKKKKKKKK..',
  '..KKKKKKKKKKKKKKKK..',
  '....................',
]
// fedora: K rounded crown and brim, P band in the scene's HOTEL magenta
const HAT = [
  '',
  '',
  '........KKKK........',
  '......KKKKKKKK......',
  '......PPPPPPPP......',
  '...KKKKKKKKKKKKKK...',
]
// eyes 2x2 under the brim; SHUT is the blink (lids down to one row), WINK closes the left
const EYES = ['', '', '', '', '', '', '', '.......EE..EE', '.......EE..EE']
const SHUT = ['', '', '', '', '', '', '', '', '.......EE..EE']
const WINK = ['', '', '', '', '', '', '', '...........EE', '.......EE..EE']

// every color lives here, at the top of each <style>: paired with the palette (focus glow #7dff3a,
// accent-700 #1d6b22, accent-800 #0f3315) and the scene (HOTEL magenta #ff1fd2, ink, highlight)
const STYLE_VARS = `svg{--phos:#4dff70;--glow:#7dff3a;--phos-dim:#1d6b22;--tile:#0f3315;--pop:#ff1fd2;--ink:#020a05;--hi:#c9ffd6}`

function head(css) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 14" width="360" height="28" shape-rendering="crispEdges"><style>${STYLE_VARS}${css}@media (prefers-reduced-motion: reduce){*{animation:none!important}}</style>`
}

// CRT scanlines: the lower half of every lit pixel row, darkened
const SCAN = ENV.SCAN !== '0'
function scanOf(set, cls = 'scn') {
  if (!SCAN) return ''
  const rows = new Map()
  for (const k of set) {
    const [x, y] = unkey(k)
    if (!rows.has(y)) rows.set(y, [])
    rows.get(y).push(x)
  }
  let d = ''
  for (const y of [...rows.keys()].sort((a, b) => a - b)) {
    const xs = rows.get(y).sort((a, b) => a - b)
    let st = xs[0], pv = xs[0]
    const flush = () => { d += `M${st} ${y}.5h${pv - st + 1}v.5h-${pv - st + 1}z` }
    for (let i = 1; i < xs.length; i++) {
      if (xs[i] === pv + 1) pv = xs[i]
      else { flush(); st = pv = xs[i] }
    }
    flush()
  }
  return `<path class="${cls}" d="${d}"/>`
}

const p = (cls, set) => (set && set.size ? `<path class="${cls}" d="${pathOf(set)}"/>` : '')

const TH = +(ENV.TH || .16)
const TH2 = +(ENV.TH2 || .05)
const BASE_CSS = [
  '.gl{fill:var(--glow);opacity:.16}',
  '.bd{fill:var(--phos);opacity:.8}',
  '.tl{fill:var(--tile)}',
  '.wl{fill:var(--phos);opacity:.42}',
  '.sl{fill:var(--ink);opacity:.42}',
  '.sg{fill:var(--phos);opacity:.34}',
  '.k{fill:var(--ink)}',
  '.pp{fill:var(--pop)}',
  '.ey{fill:var(--hi)}',
  '.bz{fill:var(--ink)}',
  '.led{fill:var(--phos)}',
  // rain streaks rest at their still offsets in both states: the band is its own image and cannot share the
  // scene's 1/16 s clock, so falling drops here would add a composited frame for every step they take
  '.rn{fill:var(--hi);opacity:.4}',
  ...RAIN.map(([, o], i) => `.r${i}{transform:translateY(${o}px)}`),
  `.th{fill:var(--glow);opacity:${TH}}`,
  `.th2{fill:var(--glow);opacity:${TH2}}`,
  '.scn{fill:var(--ink);opacity:.3}',
  '.sct{fill:var(--ink);opacity:.16}',
  '.tx{fill:var(--phos)}',
  '.cu{fill:var(--phos)}',
  '.ch{fill:var(--glow);opacity:.18}',
  // the text's own backing: invisible on glass or the page color, but it quiets a bare scene's rain
  '.kb{fill:var(--ink);opacity:.72}',
].join('')

function mascotSvg({ hatClass = '', eyeClass = '', shutClass = '', winkClass = '', screenExtra = '', ledClass = 'led' } = {}) {
  const t = fromAscii(TILE)
  const b = fromAscii(BODY)
  const h = fromAscii(HAT)
  let s = ''
  const pane = union(t.w, t.d)
  s += p('gl', t.g) + p('bd', t.b) + p('tl', pane) + p('wl', pane)
  RAIN.forEach(([x], i) => {
    s += `<path class="rn r${i}" d="M${x} 2h1v2h-1z"/>`
  })
  s += p('sl', t.d) + scanOf(union(pane, t.b))
  s += p('k', union(b.K, b.S, b.M, b.D)) + p('bz', b.M) + p('sg', b.S)
  s += `<path class="${ledClass}" d="${pathOf(b.D)}"/>`
  if (screenExtra) s += screenExtra
  const eye = set => p('ey', set)
  s += `<g class="${eyeClass}">${eye(fromAscii(EYES).E)}</g>`
  if (shutClass) s += `<g class="${shutClass}">${eye(fromAscii(SHUT).E)}</g>`
  if (winkClass) s += `<g class="${winkClass}">${eye(fromAscii(WINK).E)}</g>`
  s += `<g class="${hatClass}">${p('k', h.K)}${p('pp', h.P)}${scanOf(h.P)}</g>`
  return s
}


const TX = 25
const TY = 3

// bloom: a tight ring and a soft outer ring (TH, TH2 env override for variant sheets), both whole pixels so the glyph core stays crisp
function rings(set) {
  const halo = dilate(set)
  const halo2 = dilate(union(set, halo), true)
  return { halo, halo2 }
}
const glow = ({ halo, halo2 }) => p('th', halo) + (TH2 > 0 ? p('th2', halo2) : '')
// a plate from x 23 to x1 (exclusive), rows 1..12, with 1-unit notched corners to keep the pixel look
const plate = x1 => { const w = x1 - 23; return `<path class="kb" d="M24 1h${w - 2}v1h1v10h-1v1h-${w - 2}v-1h-1v-10h1z"/>` }
function textBlock(str) {
  const tx = textPixels(str, TX, TY)
  return { tx, ...rings(tx), end: TX + str.length * ADV }
}

function cursorAt(x) {
  const cur = new Set()
  for (let y = TY; y <= TY + 7; y++) for (let i = 0; i < 5; i++) cur.add(key(x + i, y))
  const r = rings(cur)
  return { cur, halo: r.halo, halo2: r.halo2 }
}

// ---------- idle ----------
function idle() {
  const { tx, halo, halo2, end } = textBlock('> noir.sys ready')
  // one dark column between the last glyph and the cursor, so their halos never fuse
  const { cur, halo: ch, halo2: ch2 } = cursorAt(end + 1)
  const css = BASE_CSS +
    '.cb{animation:blink 1.2s steps(1,end) infinite}' +
    '@keyframes blink{0%{opacity:1}50%{opacity:0}}' +
    '.eo{animation:eo 7s steps(1,end) infinite}' +
    '@keyframes eo{0%{opacity:1;transform:none}15%{transform:translateX(1px)}27%{transform:none}40%{opacity:0}42.5%{opacity:1}80%{opacity:0}90%{opacity:1}}' +
    '.es{opacity:0;animation:es 7s steps(1,end) infinite}' +
    '@keyframes es{0%{opacity:0}40%{opacity:1}42.5%{opacity:0}}' +
    '.ew{opacity:0;animation:ew 7s steps(1,end) infinite}' +
    '@keyframes ew{0%{opacity:0}80%{opacity:1}90%{opacity:0}}' +
    '.ht{animation:ht 7s steps(1,end) infinite}' +
    '@keyframes ht{0%{transform:none}80%{transform:translateY(-1px)}81.5%{transform:translateY(-2px)}88.5%{transform:translateY(-1px)}90%{transform:none}}'
  let s = head(css)
  s += mascotSvg({ hatClass: 'ht', eyeClass: 'eo', shutClass: 'es', winkClass: 'ew' })
  s += plate(end + 1 + 5 + 3)
  s += glow({ halo, halo2 }) + p('tx', tx) + scanOf(tx, 'sct')
  s += `<g class="cb">${TH2 > 0 ? p('th2', ch2) : ''}${p('ch', ch)}${p('cu', cur)}${scanOf(cur)}</g>`
  s += '</svg>'
  return s
}

// ---------- working ----------
function working() {
  const { tx, halo, halo2, end } = textBlock('> running')
  // three progress blocks, 4 wide x 5 tall on the x-height
  const bx = end + ADV
  const blocks = [0, 1, 2].map(i => {
    const set = new Set()
    for (let y = TY + 2; y <= TY + 6; y++) for (let x = 0; x < 4; x++) set.add(key(bx + i * 6 + x, y))
    return set
  })
  const curX = bx + 3 * 6 + 2
  const { cur, halo: ch, halo2: ch2 } = cursorAt(curX)
  // calm: one 2.4 s loop on a 0.6 s grid. The cells fill one per step and the eyes read
  // along with them (left, centre, right, then a carriage return); the cursor and the
  // monitor LED blink together at 1.2 s, so every change lands on the same beat.
  const css = BASE_CSS +
    '.pe{fill:var(--phos-dim);opacity:.5}' +
    '.pf{fill:var(--phos)}' +
    '.cb{animation:blink 1.2s steps(1,end) infinite}' +
    '@keyframes blink{0%{opacity:1}50%{opacity:0}}' +
    // base opacity 1 on all three: the still (reduced motion) reads as a calm, full 'running' bar
    '.p1,.p2,.p3{opacity:1;animation:2.4s steps(1,end) infinite}' +
    '.p1{animation-name:p1}.p2{animation-name:p2}.p3{animation-name:p3}' +
    '@keyframes p1{0%{opacity:0}25%{opacity:1}}' +
    '@keyframes p2{0%{opacity:0}50%{opacity:1}}' +
    '@keyframes p3{0%{opacity:0}75%{opacity:1}}' +
    '.lw{animation:led 1.2s steps(1,end) infinite}' +
    '@keyframes led{0%{opacity:1}50%{opacity:.3}}' +
    '.rd{transform:translateX(1px);animation:rd 2.4s steps(1,end) infinite}' +
    '@keyframes rd{0%{transform:translateX(-1px)}25%{transform:none}50%{transform:translateX(1px)}}'
  let s = head(css)
  s += mascotSvg({ eyeClass: 'rd', ledClass: 'led lw' })
  s += plate(curX + 5 + 3)
  s += glow({ halo, halo2 }) + p('tx', tx) + scanOf(tx, 'sct')
  s += p('pe', union(...blocks))
  blocks.forEach((b, i) => {
    s += `<g class="p${i + 1}">${p('th', dilate(b))}${p('pf', b)}${scanOf(b)}</g>`
  })
  s += `<g class="cb">${TH2 > 0 ? p('th2', ch2) : ''}${p('ch', ch)}${p('cu', cur)}${scanOf(cur)}</g>`
  s += '</svg>'
  return s
}

const I = idle()
const W = working()
const outDir = ENV.OUT || here
writeFileSync(join(outDir, 'band-idle.svg'), I)
writeFileSync(join(outDir, 'band-working.svg'), W)
console.log('idle', I.length, 'working', W.length)
