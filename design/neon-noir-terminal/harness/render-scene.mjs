// Usage: node render-scene.mjs <scene.svg> [outDir] [resolved.json]
// Checks a backdrop scene SVG against the engine's limits and renders it:
//  - static checks (size, viewBox, slice, no script/handlers/external loads, reduced motion)
//  - raw scene at 5 screen shapes x dark/light color scheme
//  - a mock of the app over it: desktop frosted panels, mobile single veil
//  - motion check (frames differ) and reduced-motion check (frames identical)
//  - contact sheets sheet-dark.png / sheet-light.png combining everything
// resolved.json (from palette-check.mjs) supplies the mock's panel colors.
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve, dirname } from 'node:path'

const require = createRequire(import.meta.url)
// Flags: --dark-only (the look is dark only: skip light renders, refuse a light
// variant in the scene), --opacity=<0..1> (the glass/veil opacity, default 0.8 with
// --dark-only else 0.6), --blur=<px> (default 14).
const flags = process.argv.slice(2).filter(a => a.startsWith('--'))
const pos = process.argv.slice(2).filter(a => !a.startsWith('--'))
const DARK_ONLY = flags.includes('--dark-only')
const flag = (n, d) => { const f = flags.find(a => a.startsWith(`--${n}=`)); return f ? Number(f.split('=')[1]) : d }
const OPACITY = flag('opacity', DARK_ONLY ? 0.8 : 0.6)
const BLUR = flag('blur', 14)
const svgPath = resolve(pos[0] ?? '')
if (!pos[0]) { console.error('usage: node render-scene.mjs <scene.svg> [outDir] [resolved.json] [--dark-only] [--opacity=0.8] [--blur=14]'); process.exit(2) }
const outDir = resolve(pos[1] ?? svgPath.replace(/\.svg$/, '') + '-render')
mkdirSync(outDir, { recursive: true })
const src = readFileSync(svgPath, 'utf8')
const resolved = pos[2] ? JSON.parse(readFileSync(pos[2], 'utf8')) : null
const MODES = DARK_ONLY ? ['dark'] : ['dark', 'light']

// ---------- static checks ----------
const fails = [], warns = []
const root = (src.match(/<svg\b[^>]*>/) ?? [''])[0]
if (src.length > 131072) fails.push(`size ${src.length} chars > 131072 limit`)
else if (src.length > 100000) warns.push(`size ${src.length} chars is close to the 131072 limit`)
if (!/viewBox=/.test(root)) fails.push('root <svg> has no viewBox')
if (!/preserveAspectRatio="xMidYMid slice"/.test(root)) fails.push('root <svg> lacks preserveAspectRatio="xMidYMid slice"')
if (/\swidth="\d|\sheight="\d/.test(root)) warns.push('root <svg> has a fixed width/height: it should fill its box')
if (!/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(root)) fails.push('root <svg> lacks xmlns')
if (/<script/i.test(src)) fails.push('contains <script>')
if (/\son[a-z]+\s*=/i.test(src)) fails.push('contains an on* event-handler attribute')
if (/<foreignObject/i.test(src)) fails.push('contains <foreignObject>')
if (/<image\b/i.test(src)) fails.push('contains <image> (a scene loads nothing)')
if (/(href|src)\s*=\s*"(?!#)/i.test(src)) fails.push('contains an href/src that is not a local #fragment')
if (/url\(\s*['"]?(?!#)/i.test(src)) fails.push('contains a url() that is not a local #fragment (no external loads, no data URIs)')
if (/@import/i.test(src)) fails.push('contains @import')
if (/@font-face/i.test(src)) fails.push('contains @font-face')
if (!/prefers-reduced-motion/.test(src)) fails.push('no @media (prefers-reduced-motion) rule')
if (!/crispEdges/.test(src)) warns.push('no shape-rendering="crispEdges": pixels may blur when scaled')
if (/<animate|<animateTransform|<animateMotion|<set\b/.test(src)) warns.push('uses SMIL: prefer CSS animation in the scene\'s own <style>')
if (DARK_ONLY && /prefers-color-scheme/.test(src)) fails.push('has a prefers-color-scheme rule: the look is dark only, so the scene must always be the night')
if (/\b(blade\s*runner|cyberpunk\s*2077|tron|akira|ghost in the shell|coca|pepsi|sony|nike|atari|nintendo)\b/i.test(src)) fails.push('names a brand or film: keep the art original')

console.log(`chars: ${src.length}`)
for (const f of fails) console.log('FAIL: ' + f)
for (const w of warns) console.log('WARN: ' + w)

// ---------- render ----------
copyFileSync(svgPath, `${outDir}/scene.svg`)
const SIZES = [
  ['phone', 390, 844],
  ['phone-land', 844, 390],
  ['tablet', 820, 1180],
  ['desktop', 1440, 900],
  ['ultrawide', 2560, 1080],
  // --extra: the shapes between, where aspect-ratio buckets change.
  ...(flags.includes('--extra') ? [
    ['phone-small', 360, 740],
    ['phone-big', 430, 932],
    ['ipad', 768, 1024],
    ['ipad-land', 1024, 768],
    ['laptop', 1280, 800],
    ['laptop-wide', 1366, 768],
    ['fullhd', 1920, 1080],
    ['desktop-tall', 1200, 1000],
    ['ultrawide-21', 3440, 1440],
  ] : []),
]
const tok = (mode, k, d) => resolved?.[mode]?.[k] ?? d
const rgba = (h, a) => {
  const n = h.replace('#', '')
  return `rgba(${parseInt(n.slice(0, 2), 16)},${parseInt(n.slice(2, 4), 16)},${parseInt(n.slice(4, 6), 16)},${a})`
}
const mock = (mode, kind) => {
  const s0 = tok(mode, 'surface-0', mode === 'dark' ? '#0b0a14' : '#e4e0ee')
  const s1 = tok(mode, 'surface-1', mode === 'dark' ? '#12101f' : '#ece9f4')
  const s2 = tok(mode, 'surface-2', mode === 'dark' ? '#181528' : '#f4f2f9')
  const tp = tok(mode, 'text-primary', mode === 'dark' ? '#f2ecff' : '#16131f')
  const tm = tok(mode, 'text-muted', mode === 'dark' ? '#9a8fbf' : '#5a5372')
  const ac = tok(mode, 'text-accent', mode === 'dark' ? '#ff79df' : '#8d006e')
  const bd = tok(mode, 'border', 'rgba(128,128,160,.25)')
  // The mod's glass: one tint (the page color) at OPACITY; desktop panels also blur.
  const tint = DARK_ONLY ? s0 : s1
  const glass = kind === 'desktop'
    ? `backdrop-filter:blur(${BLUR}px);-webkit-backdrop-filter:blur(${BLUR}px);background:${rgba(tint, OPACITY)}`
    : ''
  const veil = kind === 'mobile' ? `<div style="position:fixed;inset:0;background:${rgba(s0, OPACITY)}"></div>` : ''
  const side = kind === 'desktop'
    ? `<aside style="position:fixed;left:0;top:0;bottom:0;width:260px;${glass};border-right:1px solid ${bd};padding:16px;color:${tm}">
        <div style="color:${tp};font-weight:600;margin-bottom:12px">Sessions</div><div>Fix login validation</div><div>Refactor router</div><div>Neon theme</div></aside>`
    : ''
  const col = kind === 'desktop' ? 'left:260px;right:0' : 'left:0;right:0'
  const card = kind === 'desktop' ? `${glass};border:1px solid ${bd};border-radius:12px;padding:12px 16px;margin:12px 0` : 'padding:8px 0;margin:8px 0'
  return `<!doctype html><meta charset=utf-8><style>html,body{margin:0;height:100%;overflow:hidden;font:15px/1.5 system-ui,sans-serif;color-scheme:${mode}}
iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>
<iframe src="scene.svg"></iframe>${veil}${side}
<main style="position:fixed;${col};top:0;bottom:0;color:${tp}">
 <div style="max-width:720px;margin:0 auto;padding:24px 20px">
  <div style="${card}">Make the login form validate emails before submit.</div>
  <div style="${card}">Sure. I updated <span style="color:${ac}">src/auth/login.ts</span> so the address is checked first, then ran the tests: all 48 pass. <div style="color:${tm}">3 files changed · 2m ago</div></div>
  <div style="${card}">Next I'd add a unit test for the empty-string case and one for a 255-character address so the RFC limit is covered.</div>
 </div>
 <div style="position:fixed;${col};bottom:0;padding:16px 20px"><div style="max-width:720px;margin:0 auto;background:${s2};border:1px solid ${bd};border-radius:14px;padding:14px 16px;color:${tm}">Reply to Claude…</div></div>
</main>`
}

const pw = require('playwright')
const browser = await pw.chromium.launch()
const shots = { dark: [], light: [] }
console.log(`glass: opacity ${OPACITY}, blur ${BLUR}px${DARK_ONLY ? ', dark only' : ''}`)
for (const mode of MODES) {
  for (const [name, w, h] of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: mode, deviceScaleFactor: 1 })
    const p = await ctx.newPage()
    await p.goto('file://' + `${outDir}/scene.svg`)
    await p.waitForTimeout(700)
    const raw = `${mode}-${name}-raw.png`
    await p.screenshot({ path: `${outDir}/${raw}` })
    shots[mode].push([`${name} ${w}x${h} raw`, raw])
    const kind = name.startsWith('phone') || name === 'tablet' || name === 'ipad' ? 'mobile' : 'desktop'
    writeFileSync(`${outDir}/mock-${mode}-${kind}.html`, mock(mode, kind))
    await p.goto('file://' + `${outDir}/mock-${mode}-${kind}.html`)
    await p.waitForTimeout(700)
    const mk = `${mode}-${name}-mock.png`
    await p.screenshot({ path: `${outDir}/${mk}` })
    shots[mode].push([`${name} ${w}x${h} under app (${kind})`, mk])
    await ctx.close()
  }
}

// motion + reduced motion, desktop size, dark
const frames = async reduced => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'dark', reducedMotion: reduced ? 'reduce' : 'no-preference' })
  const p = await ctx.newPage()
  await p.goto('file://' + `${outDir}/scene.svg`)
  // Irregular gaps, so a loop whose period divides the gap can't look still.
  await p.waitForTimeout(300)
  const a = await p.screenshot()
  await p.waitForTimeout(1370)
  const b1 = await p.screenshot()
  await p.waitForTimeout(1130)
  const b2 = await p.screenshot()
  const b = a.equals(b1) ? b2 : b1
  const info = await p.evaluate(() => {
    const all = document.querySelectorAll('*')
    let animated = 0
    for (const el of all) if (getComputedStyle(el).animationName !== 'none') animated++
    return { nodes: all.length, animated }
  })
  await ctx.close()
  return { differ: !a.equals(b), ...info }
}
const moving = await frames(false)
const still = await frames(true)
console.log(`nodes: ${moving.nodes}, animated elements: ${moving.animated}`)
console.log(moving.differ ? 'ok   motion: frames differ over 2.5s' : 'FAIL motion: frames over 2.5s are identical (nothing animates?)')
console.log(!still.differ && still.animated === 0 ? 'ok   reduced motion: still, no animations running'
  : `FAIL reduced motion: ${still.differ ? 'frames differ' : 'frames same'}, ${still.animated} elements still animated`)

// contact sheets
for (const mode of MODES) {
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;background:#222;color:#eee;font:13px system-ui;display:grid;grid-template-columns:repeat(2,1fr);gap:10px;padding:10px}
figure{margin:0}img{width:100%;display:block;border:1px solid #444}figcaption{padding:4px 0}</style>
${shots[mode].map(([cap, f]) => `<figure><figcaption>${mode} · ${cap}</figcaption><img src="${f}"></figure>`).join('')}`
  writeFileSync(`${outDir}/sheet-${mode}.html`, html)
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 800 } })
  const p = await ctx.newPage()
  await p.goto('file://' + `${outDir}/sheet-${mode}.html`)
  await p.waitForTimeout(300)
  await p.screenshot({ path: `${outDir}/sheet-${mode}.png`, fullPage: true })
  await ctx.close()
}
await browser.close()
console.log(`\nwrote ${MODES.map(m => `${outDir}/sheet-${m}.png`).join(' and ')} (plus each shot as <mode>-<size>-{raw,mock}.png)`)
console.log(fails.length ? `RESULT: ${fails.length} static FAIL(s)` : 'RESULT: static checks pass')
