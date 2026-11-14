// Where the scene's four subjects sit, for every window shape. Imported by gen.mjs (which emits the
// rules) and by verify-layout.mjs (which sweeps window sizes against the app's panels).
//
// Base rules follow the scene's own aspect ratio only (as on phones). Desktop windows (>= 1000px wide)
// add solved cells: the app's sidebar (293px) and its centred 720px chat column are fixed PIXEL sizes,
// while the scene scales with the window, so each subject is placed per (aspect, size) cell to sit
// wholly in a gutter, wholly under the solid sidebar, or (the moon only) wholly under the column:
// never across a panel edge, where a frosted card would cut it into crisp slices. Where a gutter exists
// that is also clean with the sidebar collapsed (the column then re-centres at W/2), the solver prefers
// it (zones LG2/SB2); at 1280-1536 wide no left spot is both, and the open-sidebar choice stands.

export const VW = 480, VH = 300
export const MX = 144
export const BX = 403, BY = 14, BW = 71, BH = 42

// frame boxes in world units, with the glow each carries (the TTY scales about its top-right corner)
export const SUBJ = {
  H: { g: 'lf', x0: 90, x1: 121, y0: 42, y1: 163, glow: 3 },        // HOTEL sign + 24H + its tube
  M: { g: 'mn', x0: 130, x1: 158, y0: 12, y1: 40, glow: 5, bank: 55 }, // moon disc; its smog bank ends at 55
  T: { g: 'bx', x0: BX, x1: BX + BW, y0: BY, y1: BY + BH, glow: 3 },  // the TTY window
  J: { g: 'rf', x0: 410, x1: 434, y0: 66, y1: 177, glow: 3 },       // JAZZ sign + cocktail
}
const KEYS = ['H', 'M', 'T', 'J']

// ---------- base rules: the scene's own aspect ratio ----------
const Lf = s => Math.max(0, (VW - VH * s) / 2)
const tt = s => Math.min(1, Math.max(0, (1.6 - s) / (1.6 - 0.46)))
const GROUPS = [
  { cls: 'lf', side: 1, A: 92, P: 21 }, { cls: 'lm', side: 1, A: 156, P: 49 },
  { cls: 'rf', side: -1, A: 44, P: 21 }, { cls: 'rm', side: -1, A: 100, P: 49 },
  { cls: 'mn', side: 1, A: MX, P: 30 },
]
const txOf = (g, s) => { const pos = g.A + tt(s) * (g.P - g.A); return Math.round(g.side * (Lf(s) + pos - g.A)) }
export const TALL = [160, 150, 140, 130, 120, 110, 100, 90, 80, 72, 64, 56, 50, 44, 38]
export const WIDE = [160, 175, 190, 205, 220, 240, 260, 290, 330, 380, 450]
// at aspect <= 1.6 there is no room for the moon beside the HOTEL sign: the sign drops 20u, below the
// moon's smog bank, and the moon floats centred above it. In portrait the TTY and JAZZ also drop below
// the phone's header, and the near car's flight line drops below the TTY.
const SIGN_DY = 20, MOON_OVER = -38
const PORT_DY = { rf: 28, bx: 28, cy: 27 }
const PORT_SIGN_DY = 24

export function baseRules(signAt = {}) {
  const rules = []
  TALL.forEach((b, i) => {
    const lo = (TALL[i + 1] ?? b - 8) / 100, s = (b / 100 + lo) / 2, port = b <= 100
    const set = {}
    for (const g of GROUPS) set[g.cls] = [txOf(g, s), port ? (PORT_DY[g.cls] ?? 0) : 0, 1]
    // in portrait the pair drops a further PORT_SIGN_DY, so the moon clears the phone's status bar and header
    const pd = port ? PORT_SIGN_DY : 0
    set.lf = [signAt[b] ?? set.lf[0], SIGN_DY + pd, 1]
    set.mn = [set.lf[0] + MOON_OVER, pd, 1]
    // the TTY's right frame sits >= 4u inside the visible edge at the bucket's narrow end
    set.bx = [Math.floor(2 - Lf(lo)), port ? PORT_DY.bx : 0, 1]
    if (port) set.cy = [0, PORT_DY.cy, 1]
    const e = Math.floor(Lf(b / 100))
    rules.push({ q: { aMax: [b, 100] }, set, css: `.vl{transform:translate(${e}px,0)}.vr{transform:translate(${-e}px,0)}` })
  })
  WIDE.forEach((b, i) => {
    const hi = (WIDE[i + 1] ?? b + 60) / 100, s = (b / 100 + hi) / 2
    const e = Math.floor(150 - 240 / (b / 100))
    // world and HUD drop by the bucket's middle: at the bucket's wide end at most ~6.5u of the world's
    // top is cut, and nothing lit sits above y = 8 (the left tower's beacon was lowered for this)
    const sw = Math.round(150 - 240 / s), sh = sw
    rules.push({ q: { aMin: [b, 100] }, set: {}, sw, sh, css: `.vt{transform:translate(0,${e}px)}.vb{transform:translate(0,${-e}px)}` })
  })
  // 1.6-1.9 below 1400px wide: the column's edge is closest to the right gutter, so the TTY and JAZZ ride
  // 4u right (from 1400 the desktop cells place them, with the TTY's frame ~24px in from the window's edge)
  rules.push({ q: { aMin: [160, 100], aMax: [190, 100], wMax: 1400 - EPS }, set: { bx: [4, 0, 1], rf: [4, 0, 1] } })
  return rules
}

// ---------- media matching (exact, as CSS compares ratios) ----------
// A cell's top edge is hi - EPS: engines compare lengths in 1/64 px layout units, so a 1679.99px bound
// rounds up and also matches a 1680px window (where the next cell's unset vars would leak in); 0.02 does not
export const EPS = 0.02
const matchQ = (q, W, H) =>
  (!q.aMin || W * q.aMin[1] >= q.aMin[0] * H) && (!q.aMax || W * q.aMax[1] <= q.aMax[0] * H) &&
  (q.wMin == null || W >= q.wMin) && (q.wMax == null || W <= q.wMax) &&
  (q.hMin == null || H >= q.hMin) && (q.hMax == null || H <= q.hMax)

export function simulate(W, H, rules) {
  const t = { lf: [0, 0, 1], lm: [0, 0, 1], rf: [0, 0, 1], rm: [0, 0, 1], mn: [0, 0, 1], bx: [0, 0, 1], cy: [0, 0, 1] }
  let sw = 0, sh = 0
  for (const r of rules) if (matchQ(r.q, W, H)) { Object.assign(t, r.set); if (r.sw != null) { sw = r.sw; sh = r.sh } }
  return { t, sw, sh }
}

// ---------- the app's panels (the checker's desktop mock) ----------
export const SIDE = 293                // 260px sidebar + 2x16 padding + 1px border
export const colOf = W => W - 260 >= 760 ? [W / 2 - 230, W / 2 + 490] : [280, W - 20]
export function viewOf(W, H, sw = 0, sh = 0) {
  if (W * 5 >= 8 * H) return { u: W / VW, vl: 0, vt: 150 - 240 * H / W, sw, sh }
  return { u: H / VH, vl: 240 - 150 * W / H, vt: 0, sw, sh }
}
// frame box (world units) of subject k under transform [tx, ty, s]
export function frameOf(k, [tx, ty, s]) {
  const S = SUBJ[k]
  if (k === 'T') return { x0: S.x1 + tx - (S.x1 - S.x0) * s, x1: S.x1 + tx, y0: S.y0 + ty, y1: S.y0 + ty + (S.y1 - S.y0) * s, g: S.glow * s }
  return { x0: S.x0 + tx, x1: S.x1 + tx, y0: S.y0 + ty, y1: S.y1 + ty, g: S.glow }
}
// glow box in screen px
export function pxBox(k, f, v) {
  const sh = k === 'T' ? v.sh : v.sw
  const X = x => (x - v.vl) * v.u, Y = y => (y + sh - v.vt) * v.u
  const yb = k === 'M' ? Math.max(f.y1 + f.g, SUBJ.M.bank + (f.y0 - SUBJ.M.y0)) : f.y1 + f.g
  return { x0: X(f.x0 - f.g), x1: X(f.x1 + f.g), y0: Y(f.y0 - f.g), y1: Y(yb), fx0: X(f.x0), fx1: X(f.x1), fy0: Y(f.y0) }
}
const M = 2          // px between a glow box and a panel edge
export const TTY_IN = 24   // px the TTY's frame aims to sit in from the window's right edge (as at 1920x1080)
// 1 point per px short of TTY_IN - TTY_TOL at the cell's tightest width, capped just above the 12 points
// between two TTY scales: a TTY jammed into the corner loses to the next scale down sitting TTY_IN px in
const TTY_PEN = 1, TTY_CAP = 13, TTY_TOL = 3
const GAP = 3        // px between two subjects' glow boxes
const FOOT = 40      // px kept clear above the window's foot
export function zoneOf(b, W, H, k, u) {
  const [cL, cR] = colOf(W), fw = b.fx1 - b.fx0
  if (b.y0 < -2 || b.y1 > H - FOOT) return null
  // dual-state zones (preferred): also clear of the column when the sidebar is collapsed and the 720px
  // column re-centres at W/2, and (SB2) never cropped by the window's left edge
  const cc = W / 2 - 360 - M
  if (b.x0 >= SIDE + M && b.x1 <= Math.min(cL - M, cc)) return 'LG2'
  if (b.x0 >= SIDE + M && b.x1 <= cL - M) return 'LG'
  if (b.x1 <= Math.min(SIDE - M, cc) && b.fx0 >= 2 * u) return 'SB2'
  if (b.x0 >= cR + M && b.fx1 <= W - Math.max(2 * u, 6) + 1e-6) return 'RG'
  if (b.x1 <= SIDE - M && b.fx0 >= -0.25 * fw) return 'SB'
  // the moon may also peek in from the window's right edge: clear of the column, at least half its disc
  // on screen (a crop by the window edge reads as framing; a crop by a card reads as a glitch)
  if (k === 'M' && b.x0 >= cR + M && (b.fx0 + b.fx1) / 2 <= W - 2 && W - b.fx0 >= 0.5 * fw) return 'RGE'
  if (b.x1 < -2 || b.x0 > W + 2) return 'OFF'
  return null
}
const overlap = (a, b) => !(a.x1 + GAP <= b.x0 || b.x1 + GAP <= a.x0 || a.y1 + GAP <= b.y0 || b.y1 + GAP <= a.y0)
// the JAZZ group's tower (world x 436-500, drawn after the HOTEL group) must never stand in front of the
// HOTEL sign: it would hide the sign and leave its magenta-lit rain floating on a dark wall
export const signBehindTower = (lf, rf) => lf[0] > -800 && rf[0] > -800 && 90 + lf[0] < 500 + rf[0] && 436 + rf[0] < 122 + lf[0]

// ---------- the solver ----------
const ZSCORE = {
  T: { RG: s => ({ 1: 100, 0.85: 88, 0.7: 76 })[s], SB2: s => ({ 1: 44, 0.8: 40, 0.65: 36 })[s], SB: s => ({ 1: 40, 0.8: 36, 0.65: 32 })[s], OFF: () => -100 },
  J: { RG: () => 40, SB2: () => 24, SB: () => 20, OFF: () => -40 },
  H: { LG2: ty => ty === 0 ? 48 : 45, LG: ty => ty === 0 ? 40 : 37, SB2: () => 22, SB: () => 18, OFF: () => -90 },
  M: { LG2: () => 38, LG: () => 30, RG: () => 24, RGE: () => 16, OFF: () => -20 },
}
// tx interval (world units) that keeps subject k (pre-translate frame f0) inside zone z at view v
function txRange(z, f0, v, W) {
  const [cL, cR] = colOf(W), u = v.u, g = f0.g + 1 / u    // the solver keeps 1px more than the check
  const cc = W / 2 - 360 - M
  if (z === 'LG2') return [(SIDE + M) / u + v.vl - f0.x0 + g, Math.min(cL - M, cc) / u + v.vl - f0.x1 - g]
  if (z === 'SB2') return [v.vl - f0.x0 + 2 + f0.g, Math.min(SIDE - M, cc) / u + v.vl - f0.x1 - g]
  if (z === 'LG') return [(SIDE + M) / u + v.vl - f0.x0 + g, (cL - M) / u + v.vl - f0.x1 - g]
  if (z === 'RG') return [(cR + M) / u + v.vl - f0.x0 + g, (W - Math.max(2 * u, 6)) / u + v.vl - f0.x1]
  if (z === 'SB') return [v.vl - f0.x0 - 0.25 * (f0.x1 - f0.x0), (SIDE - M) / u + v.vl - f0.x1 - g]
  if (z === 'RGE') return [(cR + M) / u + v.vl - f0.x0 + g, Math.min((W - 2) / u + v.vl - (f0.x0 + f0.x1) / 2, (W - 0.5 * (f0.x1 - f0.x0) * u) / u + v.vl - f0.x0)]
  return [-1e9, 1e9]
}
// the TTY's tx that puts its frame m px in from sample s's right window edge (the frame's right edge is
// world x 474 + tx at any scale), and the score cost of a placement short of TTY_IN at the tightest sample
const ttyIn = (s, m) => (s.W - m) / s.v.u + s.v.vl - SUBJ.T.x1
const ttyShort = (S, txOf) => {
  const short = Math.max(0, ...S.map(s => TTY_IN - TTY_TOL - (s.W - (SUBJ.T.x1 + (typeof txOf === 'number' ? txOf : txOf(s)) - s.v.vl) * s.v.u)))
  return Math.min(TTY_CAP, TTY_PEN * short)
}
const yOk = (k, f, v, H) => { const b = pxBox(k, f, v); return b.y0 >= -2 && b.y1 <= H - FOOT }

export function solveCell(samples, rules, debug = false) {
  // per-sample view (shifts from the base rules) and base transforms
  const S = samples.map(([W, H]) => { const sim = simulate(W, H, rules); return { W, H, v: viewOf(W, H, sim.sw, sim.sh), base: sim.t } })
  // regime A (aspect >= 1.6): the window's right edge is world x 480 at every sample, so one tx gives the
  // TTY a margin that grows smoothly with the width, and the TTY_IN target applies. In a B/C cell the edge
  // moves 15u across the aspect bucket, so the TTY docks right at the bucket's narrow end (as the base does)
  const regA = S.every(s => s.W * 5 >= 8 * s.H)
  const opts = {}
  for (const k of KEYS) {
    const list = []
    // default: the base rule's own placement, if it is clean everywhere in the cell
    let dz = Infinity, ok = true, dzone = null
    for (const s of S) {
      const tr = s.base[SUBJ[k].g], b = pxBox(k, frameOf(k, tr), s.v), z = zoneOf(b, s.W, s.H, k, s.v.u)
      if (!z || z === 'OFF' || !ZSCORE[k][z]) { ok = false; break }
      if (k === 'T' && z === 'RG' && regA) dzone = 'RG'
      // (the TTY scores at its own base scale: a cell edge such as aspect 1.6 can hand it a smaller one)
      dz = Math.min(dz, ZSCORE[k][z](k === 'T' ? tr[2] : k === 'H' ? tr[1] : 0) ?? -999)
    }
    if (ok) list.push({ id: "def", score: dz + 5 - (k === 'T' && dzone === 'RG' ? ttyShort(S, s => s.base.bx[0]) : 0), def: true })
    const tys = k === 'H' ? [0, 20, 32] : [0]
    const ss = k === 'T' ? [1, 0.85, 0.8, 0.7, 0.65] : [1]
    for (const z of Object.keys(ZSCORE[k])) for (const ty of tys) for (const sc of ss) {
      if (z === 'OFF') { if (ty === 0 && sc === 1) list.push({ id: 'OFF', tr: [-900, 0, 1], score: ZSCORE[k].OFF() }); continue }
      const zs = k === 'T' ? ZSCORE.T[z](sc) : k === 'H' ? ZSCORE.H[z](ty) : ZSCORE[k][z]()
      if (zs == null) continue
      if (k === 'H' && (z === 'LG' || z === 'LG2') && ty === 32) continue
      const f0 = frameOf(k, [0, ty, sc])
      let lo = -1e9, hi = 1e9
      for (const s of S) { const [a, b] = txRange(z, f0, s.v, s.W); lo = Math.max(lo, a); hi = Math.min(hi, b) }
      if (!(Math.ceil(lo) <= Math.floor(hi))) continue
      if (!S.every(s => yOk(k, f0, s.v, s.H))) continue
      const L = Math.ceil(lo), R = Math.floor(hi), mid = Math.round((lo + hi) / 2)
      // the TTY sits TTY_IN px in from the window's edge where the gutter allows (else as far in as it can),
      // and an option short of that margin scores lower, so a roomy width never shares a cell (and its one
      // tx) with a tight one; the signs and the moon centre in their gutter; under the sidebar, try a few spots
      let picks
      if (k === 'T' && z === 'RG' && regA) {
        const x = Math.max(L, Math.min(R, Math.floor(Math.min(...S.map(s => ttyIn(s, TTY_IN))))))
        picks = [[x, -ttyShort(S, x)]]
      } else picks = k === 'T' ? [[R, 0]] : (z === 'SB' || z === 'SB2') ? [[R, 0], [mid, -0.5], [L, -1]] : z === 'RGE' ? [[L, 0]] : [[Math.min(R, Math.max(L, mid)), 0]]
      for (const [x, d] of picks) list.push({ id: `${z}${ty ? ty : ''}${sc !== 1 ? '@' + sc : ''}`, z, tr: [x, ty, sc], score: zs + d, lo: L, hi: R })
    }
    opts[k] = list.sort((a, b) => b.score - a.score)
    if (debug) console.log(k, opts[k].map(o => `${o.id}:${o.score}${o.tr ? "@" + o.tr[0] : ""}`).join(" "))
  }
  // the moon also may sit right above the HOTEL sign, or above JAZZ: placed relative to them
  let best = null
  const boxesAt = (ch, s) => {
    const o = {}
    for (const k of KEYS) { const tr = ch[k].def ? s.base[SUBJ[k].g] : ch[k].tr; o[k] = pxBox(k, frameOf(k, tr), s.v) }
    return o
  }
  const pairsOk = ch => S.every(s => {
    if (signBehindTower(ch.H.def ? s.base.lf : ch.H.tr, ch.J.def ? s.base.rf : ch.J.tr)) return false
    const b = boxesAt(ch, s)
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const p = KEYS[i], q = KEYS[j]
      if (ch[p].id === 'OFF' || ch[q].id === 'OFF') continue
      if (overlap(b[p], b[q])) return false
    }
    return true
  })
  const moonRel = (ch, mode) => {
    // a moon placement centred over the sign (H) or over JAZZ (J), clamped into its zone
    const anchorK = mode === 'aboveH' ? 'H' : 'J', a = ch[anchorK]
    const z = mode === 'aboveH' ? (a.z === 'LG2' ? 'LG2' : 'LG') : 'RG'
    if (a.def) return null
    const A = frameOf(anchorK, a.tr), cx = (A.x0 + A.x1) / 2
    const f0 = frameOf('M', [0, 0, 1])
    let lo = -1e9, hi = 1e9
    for (const s of S) { const [p, q] = txRange(z, f0, s.v, s.W); lo = Math.max(lo, p); hi = Math.min(hi, q) }
    const want = Math.round(cx - (f0.x0 + f0.x1) / 2)
    const x = Math.min(Math.floor(hi), Math.max(Math.ceil(lo), want))
    if (x < Math.ceil(lo) || Math.abs(x - want) > 6) return null
    // a sign that dropped below the bank wants its moon right above it
    return { id: mode, z, tr: [x, 0, 1], score: (mode === 'aboveH' ? (a.tr[1] ? 36 : 28) : 24) + (z === 'LG2' ? 8 : 0) }
  }
  for (const T of opts.T) for (const J of opts.J) for (const Hh of opts.H) {
    const partial = T.score + J.score + Hh.score
    if (best && partial + 33 <= best.score) continue
    const moons = [...opts.M]
    for (const mode of ['aboveH', 'aboveJ']) { const m = moonRel({ H: Hh, J }, mode); if (m) moons.push(m) }
    moons.sort((a, b) => b.score - a.score)
    for (const Mm of moons) {
      const sc = partial + Mm.score
      if (best && sc <= best.score) break
      const ch = { T, J, H: Hh, M: Mm }
      if (pairsOk(ch)) { best = { score: sc, ch }; break }
    }
  }
  // with both in the right gutter, JAZZ centres under the TTY (one stacked column of light), as far as its
  // own gutter range allows; a moon placed over JAZZ keeps JAZZ where it is
  if (best && best.ch.T.z === 'RG' && !best.ch.T.def && best.ch.M.id !== 'aboveJ' && (best.ch.J.z === 'RG' || best.ch.J.def)) {
    const Tf = frameOf('T', best.ch.T.tr), f0 = frameOf('J', [0, 0, 1])
    let lo = -1e9, hi = 1e9
    for (const s of S) { const [p, q] = txRange('RG', f0, s.v, s.W); lo = Math.max(lo, p); hi = Math.min(hi, q) }
    const want = Math.round((Tf.x0 + Tf.x1) / 2 - (f0.x0 + f0.x1) / 2)
    const x = Math.min(Math.floor(hi), Math.max(Math.ceil(lo), want))
    const same = best.ch.J.def ? S.every(s => s.base.rf[0] === x && s.base.rf[1] === 0) : best.ch.J.tr[0] === x
    if (Math.ceil(lo) <= Math.floor(hi) && !same) {
      const ch = { ...best.ch, J: { id: 'RGc', z: 'RG', tr: [x, 0, 1], score: best.ch.J.score } }
      if (pairsOk(ch)) best = { score: best.score, ch }
    }
  }
  return best
}
const classOf = sol => KEYS.map(k => sol.ch[k].id).join('|')

// both ends always, and every <= 20px between
const steps = (lo, hi) => { const o = []; for (let x = lo; x < hi; x += Math.min(20, Math.max(2, (hi - lo) / 6))) o.push(x); o.push(hi); return o }
// samples over a cell; aspect ratios include each wide bucket's edges (the world's shift jumps there)
export function samplesA(W0, W1) {
  const as = [1.6, 1.65, 1.7, 1.7499, 1.75, 1.8, 1.85, 1.8999, 1.9, 1.95, 2.0, 2.0499, 2.05, 2.1, 2.1999, 2.2, 2.3, 2.39]
  const out = []
  for (const W of steps(W0, W1)) for (const a of as) { const H = W / a; if (H >= 600) out.push([W, H]) }
  return out
}
function samplesBC(a0, a1, H0, H1) {
  const out = []
  for (const a of [a0, a0 + 0.0005, ...Array.from({ length: 9 }, (_, i) => a0 + (i + 1) * (a1 - a0) / 10), a1 - 0.0005, a1]) for (const H of steps(H0, H1)) { const W = a * H; if (W >= 1000 && H >= 600) out.push([W, H]) }
  return out
}

// greedy: grow a band of fine cells while the merged band keeps the same choices as each part
const TOL = 5
function bands(fine, solveFine, solveUnion, strict = false) {
  const out = []
  let cur = null
  for (const c of fine) {
    const s = solveFine(c)
    if (!s) { if (cur) out.push(cur); cur = null; out.push({ cell: c, sol: null }); continue }
    if (cur) {
      const u = solveUnion(cur.cell, c), top = Math.max(cur.top, s.score)
      if (u && (strict ? u.score > top - TOL : u.score >= top - TOL)) { cur = { cell: { ...cur.cell, hi: c.hi }, sol: u, top }; continue }
    }
    if (cur) out.push(cur)
    cur = { cell: c, sol: s, top: s.score }
  }
  if (cur) out.push(cur)
  return out
}

// The side vignette bands lie under the moon (only the front towers and their signs are lifted above
// them): where a cell parks the moon's disc in the right band's 13u, the band slides off-screen there,
// so its black dither never punches holes in the disc. The band sits at the tall bucket's shift: in a B/C
// cell [a0,a1] that is floor(Lf(a1)), and at exactly a0 the narrower bucket's floor(Lf(a0)) (regime A: 0);
// pushed by 13 - floor(Lf(a1)) it clears the visible edge across the whole cell
const vrOff = c => {
  const m = c.sol?.ch.M
  if (!m || m.def || m.id === 'OFF') return ''
  const es = c.regime === 'A' ? [0] : [c.q.aMin[0], c.q.aMax[0]].map(a => Math.floor(Lf(a / 100)))
  const x0 = SUBJ.M.x0 - 2 + m.tr[0], x1 = SUBJ.M.x1 + 2 + m.tr[0]
  return es.some(e => x1 > VW - e - 13 && x0 < VW - e) ? `.vr{transform:translate(${13 - es[es.length - 1]}px,0)}` : ''
}
const toRule = c => {
  const set = {}
  if (c.sol) for (const k of KEYS) if (!c.sol.ch[k].def) set[SUBJ[k].g] = c.sol.ch[k].tr
  const css = vrOff(c)
  return { q: c.q, set, sol: c.sol, regime: c.regime, cls: c.sol ? classOf(c.sol) : 'NONE', ...(css ? { css } : {}) }
}
// Each cell is solved against the cascade so far (base + the cells emitted before it), so a subject left
// at 'def' is checked against what really applies there, edges included. Height/width bands do not overlap.
export function desktopRules(base) {
  const out = [], acc = [...base]
  // regime B/C: aspect 1.0-1.6, where the column sits at a fixed unit offset per window height
  const ABUCK = [[100, 110], [110, 120], [120, 130], [130, 140], [140, 150], [150, 160]]
  for (const [a0, a1] of ABUCK) {
    const Hmin = Math.max(600, Math.floor(1000 / (a1 / 100) / 50) * 50)
    const fine = []
    for (let H = Hmin; H < 1700; H += 50) fine.push({ lo: H, hi: H + 50 })
    fine.push({ lo: 1700, hi: 2400 })
    const sv = c => solveCell(samplesBC(a0 / 100, a1 / 100, c.lo, c.hi - EPS), acc)
    const got = bands(fine, sv, (p, c) => sv({ lo: p.lo, hi: c.hi })).map(b =>
      toRule({ q: { aMin: [a0, 100], aMax: [a1, 100], hMin: b.cell.lo, hMax: b.cell.hi - EPS, wMin: 1000 }, sol: b.sol, regime: 'BC' }))
    out.push(...got); acc.push(...got)
  }
  // regime A: aspect >= 1.6, where the unit geometry depends on the window width alone
  const fine = []
  for (let W = 1000; W < 1700; W += 20) fine.push({ lo: W, hi: W + 20 })
  fine.push({ lo: 1700, hi: 4000 })
  const sv = c => solveCell(samplesA(c.lo, c.hi - EPS), acc)
  // (strict: a merge that costs a full TOL, such as an explicit TTY placement swallowing the wide windows'
  // own base placement, starts a new band instead)
  out.push(...bands(fine, sv, (p, c) => sv({ lo: p.lo, hi: c.hi }), true).map(b =>
    toRule({ q: { aMin: [160, 100], wMin: b.cell.lo, wMax: b.cell.hi - EPS }, sol: b.sol, regime: 'A' })))
  return out
}

// Two passes: the landscape tall buckets (1.0-1.6) first take the HOTEL position the solver finds for
// a typical desktop height (1000-1200px), so the most common windows need no extra rule at all.
export function buildRules() {
  const signAt = {}
  const b0 = baseRules()
  for (const [a0, a1] of [[100, 110], [110, 120], [120, 130], [130, 140], [140, 150], [150, 160]]) {
    const sol = solveCell(samplesBC(a0 / 100, a1 / 100, 1000, 1200), b0)
    if (sol && (sol.ch.H.z === 'LG' || sol.ch.H.z === 'LG2') && !sol.ch.H.def) signAt[a1] = sol.ch.H.tr[0]
  }
  const base = baseRules(signAt)
  return { base, desk: desktopRules(base) }
}

// ---------- CSS ----------
// Each placed group reads its transform from custom properties on the root, so a media rule only
// sets a few numbers. The TTY scales about its top-right corner: its translate carries (1-s)*corner.
const num = x => +(+x).toFixed(3)
const V = { lf: 'l', lm: 'p', rf: 'j', rm: 'q', mn: 'm', bx: 't', cy: 'c' }
export const GROUP_CSS = Object.entries(V).map(([c, v]) =>
  `.${c}{transform:translate(var(--${v},0px,0px))${c === 'bx' ? ' scale(var(--s,1))' : ''}}`).join('')
const px = x => x ? `${x}px` : '0'
function varsOf(cls, [tx, ty, s]) {
  if (cls === 'bx') return [`--t:${px(num(tx + (1 - s) * (BX + BW)))},${px(num(ty + (1 - s) * BY))}`, `--s:${s}`]
  return [`--${V[cls]}:${px(tx)},${px(ty)}`]
}
const ratio = ([n, d]) => { const g = (a, b) => b ? g(b, a % b) : a, k = g(n, d); return `${n / k}/${d / k}` }
export function mqOf(q) {
  const p = []
  if (q.aMin) p.push(`(min-aspect-ratio:${ratio(q.aMin)})`)
  if (q.aMax) p.push(`(max-aspect-ratio:${ratio(q.aMax)})`)
  if (q.wMin != null && !(q.hMin != null && q.aMin && q.hMin * q.aMin[0] / q.aMin[1] >= q.wMin)) p.push(`(min-width:${q.wMin}px)`)
  if (q.wMax != null) p.push(`(max-width:${q.wMax}px)`)
  if (q.hMin != null) p.push(`(min-height:${q.hMin}px)`)
  if (q.hMax != null) p.push(`(max-height:${q.hMax}px)`)
  return `@media ${p.join(' and ')}`
}
export function rulesCss(rules) {
  return rules.map(r => {
    const vars = Object.entries(r.set).flatMap(([c, tr]) => varsOf(c, tr))
    let body = vars.length ? `svg{${vars.join(';')}}` : ''
    if (r.sw != null) body += `.w{transform:translate(0,${r.sw}px)}`
    body += r.css ?? ''
    return body ? `${mqOf(r.q)}{${body}}` : ''
  }).filter(Boolean).join('\n')
}
