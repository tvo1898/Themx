// node verify-layout.mjs [scene.svg]
// 1) the browser's own boxes for the four subjects match layout.mjs's model (so the sweep is honest)
// 2) a dense sweep of desktop window sizes: every subject sits wholly in a gutter, wholly under the
//    sidebar, or (moon) wholly under the column, and no two subjects overlap
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildRules, simulate, viewOf, frameOf, pxBox, zoneOf, signBehindTower, SUBJ } from './layout.mjs'
const matchQ = (q, W, H) =>
  (!q.aMin || W * q.aMin[1] >= q.aMin[0] * H) && (!q.aMax || W * q.aMax[1] <= q.aMax[0] * H) &&
  (q.wMin == null || W >= q.wMin) && (q.wMax == null || W <= q.wMax) && (q.hMin == null || H >= q.hMin) && (q.hMax == null || H <= q.hMax)
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = dirname(fileURLToPath(import.meta.url))
const file = process.argv[2] ? (process.argv[2].startsWith('/') ? process.argv[2] : join(process.cwd(), process.argv[2])) : join(here, 'scene.svg')
const { base, desk } = buildRules()
const all = [...base, ...desk]
const KEYS = ['H', 'M', 'T', 'J']

const model = (W, H) => {
  const sim = simulate(W, H, all), v = viewOf(W, H, sim.sw, sim.sh), o = {}
  for (const k of KEYS) { const f = frameOf(k, sim.t[SUBJ[k].g]); o[k] = { b: pxBox(k, f, v), f, v } }
  return o
}

// ---- 1: browser vs model (frame boxes) ----
const b = await chromium.launch()
const sizes = [[390, 844], [844, 390], [820, 1180], [1440, 900], [2560, 1080], [360, 740], [430, 932], [768, 1024], [1024, 768], [1280, 800],
  [1366, 768], [1920, 1080], [1200, 1000], [3440, 1440], [1470, 956], [1512, 982], [1180, 820], [1536, 864], [1600, 1200], [1280, 1024], [1440, 960], [1680, 1050],
  [1480, 925], [1580, 900], [1700, 1062], [1300, 1000], [1152, 864], [1100, 660], [1920, 1200]]
let worst = 0
for (const [W, H] of sizes) {
  const p = await (await b.newContext({ viewport: { width: W, height: H }, reducedMotion: 'reduce' })).newPage()
  await p.goto('file://' + file)
  const r = await p.evaluate(() => {
    const R = el => { const q = el.getBoundingClientRect(); return [q.left, q.right, q.top, q.bottom] }
    return {
      H: R(document.querySelector('.lf path[fill="#16031a"]')),
      M: R(document.querySelector('.mn > path[fill="#6dff95"]')),
      T: R(document.querySelector('.bx path[fill="#010a04"]')),
      J: R(document.querySelector('.rf path[fill="#011a08"]')),
    }
  })
  await p.context().close()
  const m = model(W, H)
  // the measured elements: HOTEL sign box (94..118 x 42..144), moon disc, TTY box, JAZZ box (410..434 x 66..150)
  const exp = {
    H: [94, 118, 42, 144], M: [130, 158, 12, 40], T: null, J: [410, 434, 66, 150],
  }
  const line = []
  for (const k of KEYS) {
    const { f, v } = m[k], sh = k === 'T' ? v.sh : v.sw
    let x0, x1, y0, y1
    if (k === 'T') { x0 = f.x0; x1 = f.x1; y0 = f.y0; y1 = f.y1 }
    else { const e = exp[k], dx = f.x0 - SUBJ[k].x0, dy = f.y0 - SUBJ[k].y0; [x0, x1, y0, y1] = [e[0] + dx, e[1] + dx, e[2] + dy, e[3] + dy] }
    const px = [(x0 - v.vl) * v.u, (x1 - v.vl) * v.u, (y0 + sh - v.vt) * v.u, (y1 + sh - v.vt) * v.u]
    const d = Math.max(...px.map((q, i) => Math.abs(q - r[k][i])))
    worst = Math.max(worst, d)
    if (d > 2) line.push(`${k} model ${px.map(Math.round)} browser ${r[k].map(Math.round)}`)
  }
  if (line.length) console.log(`MISMATCH ${W}x${H}: ` + line.join(' | '))
}
await b.close()
console.log(`browser vs model: worst ${worst.toFixed(2)}px over ${sizes.length} sizes`)

// ---- 2: dense sweep ----
// open sidebar (the checker's mock) must be clean; with the sidebar collapsed the 720px column re-centres
// at W/2, and the sweep reports (does not fail) the sizes where a subject then crosses a card edge
const bad = {}, coll = { H: 0, M: 0, T: 0, J: 0 }
let n = 0, collN = 0
const collCut = (x, W) => !(x.x1 < 0 || x.x0 > W) && !(x.x1 <= W / 2 - 362 || x.x0 >= W / 2 + 362)
const GAP = 3
const ov = (a, c) => !(a.x1 + GAP <= c.x0 || c.x1 + GAP <= a.x0 || a.y1 + GAP <= c.y0 || c.y1 + GAP <= a.y0)
for (let W = 1000; W <= 3840; W += 6) for (let H = 600; H <= 2160; H += 6) {
  const a = W / H
  if (a < 1 || a > 2.39) continue
  n++
  const m = model(W, H), z = {}
  for (const k of KEYS) {
    z[k] = zoneOf(m[k].b, W, H, k, m[k].v.u)
    if (!z[k]) (bad[`${k} crosses a panel edge`] ??= []).push(`${W}x${H}`)
    if (z[k] === 'OFF') (bad[`${k} off-screen`] ??= []).push(`${W}x${H}`)
  }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
    const p = KEYS[i], q = KEYS[j]
    if (z[p] === 'OFF' || z[q] === 'OFF') continue
    if (ov(m[p].b, m[q].b)) (bad[`${p}/${q} overlap`] ??= []).push(`${W}x${H}`)
  }
  const st = simulate(W, H, all).t
  if (signBehindTower(st.lf, st.rf)) (bad['H behind the JAZZ tower'] ??= []).push(`${W}x${H}`)
  // the right vignette band (world x 467-480 plus its last matching .vr shift) must not lie on the moon's
  // disc where both are on screen
  let vr = 0
  for (const r of all) if (r.css && matchQ(r.q, W, H)) { const m = r.css.match(/\.vr\{transform:translate\((-?[\d.]+)px,0\)\}/); if (m) vr = +m[1] }
  const mf = frameOf('M', st.mn), vEdge = m.M.v.vl + W / m.M.v.u
  if (z.M !== 'OFF' && mf.x1 + 2 > 467 + vr && mf.x0 - 2 < Math.min(480 + vr, vEdge) && 467 + vr < vEdge - 0.01) (bad['moon under the right vignette'] ??= []).push(`${W}x${H}`)
  const cut = KEYS.filter(k => collCut(m[k].b, W))
  for (const k of cut) coll[k]++
  if (cut.length) collN++
}
console.log(`sweep: ${n} desktop window sizes (1000-3840 wide, aspect 1.0-2.39)`)
for (const [k, v] of Object.entries(bad)) console.log(`  ${k}: ${v.length} (${(100 * v.length / n).toFixed(2)}%) e.g. ${v.filter((_, i) => i % Math.max(1, Math.floor(v.length / 6)) === 0).slice(0, 6).join(' ')}`)
if (!Object.keys(bad).length) console.log('  clean')
const pc = x => (100 * x / n).toFixed(1) + '%'
console.log(`collapsed sidebar (report only): ${pc(collN)} of sizes have a subject across a card edge`, Object.fromEntries(Object.entries(coll).map(([k, c]) => [k, pc(c)])))
const common = [[1280, 800], [1366, 768], [1440, 900], [1536, 864], [1600, 900], [1680, 1050], [1728, 1117], [1920, 1080], [1920, 1200], [2560, 1440], [1180, 820], [1200, 1000]]
console.log('  common sizes cut when collapsed: ' + common.map(([W, H]) => { const m = model(W, H), c = KEYS.filter(k => collCut(m[k].b, W)); return c.length ? `${W}x${H}:${c.join('')}` : '' }).filter(Boolean).join(' '))
