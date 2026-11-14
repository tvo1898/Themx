// Screenshots the band SVGs into shots-refine/ (or shots-refine/<tag>/):
//   <state>-alone-dsf{1,2}-{a,b}.png   the strip alone on the page color, two moments
//   <state>-mock-dsf{1,2}-{a,b}.png    above a mock prompt box (1px #2f9a16 border, #7dff3a halo)
//   <state>-reduced-dsf{1,2}.png       inline, prefers-reduced-motion: reduce emulated
//   <state>-still-dsf{1,2}.png         the mod's still mode: the reduced block re-scoped to @media all
//   <state>-close.png                  mascot tile at 15x, paused at key frames
//   <state>-zoom.png                   whole strip at 4x, paused at key frames
//   <state>-events.png                 mascot at 6x through the state's beats (blink, glance, wink, reading)
//   compare.png                        the reference crop above both states in the mock, same scale
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')

const here = dirname(fileURLToPath(import.meta.url))
// no tag: the current set, straight into shots-refine/; a tag keeps an iteration in shots-refine/<tag>/
const tag = process.argv[2]
const out = tag ? (tag.startsWith('/') ? tag : join(here, 'shots-refine', tag)) : join(here, 'shots-refine')
mkdirSync(out, { recursive: true })

// An optional reference screenshot to compare against: REF_IMAGE=path node shoot.mjs
const REF = process.env.REF_IMAGE

const svgs = {
  idle: readFileSync(join(here, 'band-idle.svg'), 'utf8'),
  working: readFileSync(join(here, 'band-working.svg'), 'utf8'),
}
const RM = '@media (prefers-reduced-motion: reduce)'
const still = s => {
  if (s.split(RM).length !== 2) throw new Error('expected exactly one reduced-motion block')
  return s.replace(RM, '@media all')
}
const dataUri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)

const BG = '#061008'
const page0 = body => `<!doctype html><html><head><style>
html,body{margin:0;background:${BG};}
.wrap{padding:14px 18px 12px;width:720px}
.band{display:block;margin:0 0 6px 6px}
.prompt{height:52px;border:1px solid #2f9a16;border-radius:8px;background:#101f14;
 box-shadow:0 0 0 1px rgba(125,255,58,.18),0 0 10px rgba(125,255,58,.45),0 0 24px rgba(125,255,58,.16);
 font:14px ui-monospace,Menlo,Consolas,monospace;color:#58bd75;display:flex;align-items:center;padding:0 14px;box-sizing:border-box;gap:10px}
.prompt b{color:#80ff98;font-weight:400;font-size:18px}
.prompt i{display:inline-block;width:8px;height:16px;background:#7dff3a;margin-right:-6px}
.prompt span{flex:1}
.foot{font:11px ui-monospace,Menlo,monospace;color:#58bd75;margin:8px 4px 0;display:flex;justify-content:space-between}
.lbl{font:11px ui-monospace,monospace;color:#58bd75;margin:10px 18px 2px}
</style></head><body>${body}</body></html>`

const band = (svg, inline) => inline
  ? `<div class="band" style="width:360px;height:28px">${svg}</div>`
  : `<img class="band" src="${dataUri(svg)}" width="360" height="28">`
const mock = (svg, inline) => `<div class="wrap">${band(svg, inline)}
<div class="prompt"><b>+</b><i></i><span>Describe a task or ask a question</span><b>&#9679;</b></div>
<div class="foot"><span>&#9633; my-project</span><span>Model &middot; Auto</span></div></div>`
const alone = (svg, inline) => `<div style="padding:8px">${inline
  ? `<div style="width:360px;height:28px">${svg}</div>`
  : `<img src="${dataUri(svg)}" width="360" height="28" style="display:block">`}</div>`

const browser = await chromium.launch()

async function shoot(name, html, size, dsf, { reduced = false, moments = true } = {}) {
  const ctx = await browser.newContext({
    viewport: size, deviceScaleFactor: dsf,
    reducedMotion: reduced ? 'reduce' : 'no-preference',
  })
  const page = await ctx.newPage()
  await page.setContent(html)
  await page.waitForTimeout(300)
  if (!moments) {
    await page.screenshot({ path: join(out, `${name}.png`) })
  } else {
    await page.screenshot({ path: join(out, `${name}-a.png`) })
    await page.waitForTimeout(1300)
    await page.screenshot({ path: join(out, `${name}-b.png`) })
  }
  await ctx.close()
}

const MOCK = { width: 756, height: 132 }
const ALONE = { width: 376, height: 44 }
for (const [name, svg] of Object.entries(svgs)) {
  for (const dsf of [1, 2]) {
    await shoot(`${name}-alone-dsf${dsf}`, page0(alone(svg)), ALONE, dsf)
    await shoot(`${name}-mock-dsf${dsf}`, page0(mock(svg)), MOCK, dsf)
    // an <img> SVG does not see emulated media, so the reduced shot inlines the SVG
    await shoot(`${name}-reduced-dsf${dsf}`, page0(mock(svg, true)), MOCK, dsf, { reduced: true, moments: false })
    await shoot(`${name}-still-dsf${dsf}`, page0(mock(still(svg))), MOCK, dsf, { moments: false })
  }
}

// paused at chosen times (inline SVGs), scaled up for inspection
async function scrub(name, svg, times, { viewBox, w, h }) {
  const ctx = await browser.newContext({ viewport: { width: (w + 10) * (h > 120 ? times.length : 1) + 20, height: h > 120 ? h + 20 : (h + 8) * times.length + 20 }, deviceScaleFactor: 1 })
  const page = await ctx.newPage()
  const big = svg.replace('viewBox="0 0 180 14" width="360" height="28"', `viewBox="${viewBox}" width="${w}" height="${h}"`)
  const dir = h > 120 ? 'row' : 'column'
  const body = `<div style="display:flex;flex-direction:${dir};gap:8px;padding:10px">` +
    times.map((t, i) => `<div id="f${i}" style="line-height:0">${big}</div>`).join('') + '</div>'
  await page.setContent(page0(body))
  await page.evaluate(times => {
    times.forEach((t, i) => {
      for (const a of document.getElementById('f' + i).getAnimations({ subtree: true })) {
        a.pause()
        a.currentTime = t * 1000
      }
    })
  }, times)
  await page.waitForTimeout(100)
  await page.screenshot({ path: join(out, `${name}.png`) })
  await ctx.close()
}
const IDLE_T = [0.2, 1.4, 2.9, 5.8]
const WORK_T = [0.1, 0.7, 1.3, 1.9]
await scrub('idle-close', svgs.idle, IDLE_T, { viewBox: '0 0 22 14', w: 330, h: 210 })
await scrub('working-close', svgs.working, WORK_T, { viewBox: '0 0 22 14', w: 330, h: 210 })
await scrub('idle-zoom', svgs.idle, IDLE_T, { viewBox: '0 0 180 14', w: 1440, h: 112 })
await scrub('working-zoom', svgs.working, WORK_T, { viewBox: '0 0 180 14', w: 1440, h: 112 })

// the mascot through its beats, labelled with the time of each frame
async function events(name, svg, times) {
  const ctx = await browser.newContext({ viewport: { width: 140 * times.length + 20, height: 140 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const big = svg.replace('viewBox="0 0 180 14" width="360" height="28"', 'viewBox="-1 -1 22 16" width="132" height="96"')
  await page.setContent(page0(`<div style="display:flex;gap:8px;padding:10px;font:10px monospace;color:#58bd75">` +
    times.map((t, i) => `<div><div id="f${i}" style="line-height:0">${big}</div>${t}s</div>`).join('') + '</div>'))
  await page.evaluate(times => times.forEach((t, i) => {
    for (const a of document.getElementById('f' + i).getAnimations({ subtree: true })) { a.pause(); a.currentTime = t * 1000 }
  }), times)
  await page.waitForTimeout(100)
  await page.screenshot({ path: join(out, `${name}-events.png`) })
  await ctx.close()
}
// idle: open, glance at the text, back, blink, open, wink + hat tip (up 1, up 2, up 1), settle
await events('idle', svgs.idle, [0.5, 1.1, 1.95, 2.85, 2.99, 5.65, 5.75, 6.25, 6.35])
// working: one frame per 0.6 s step: eyes left/centre/right/right, LED with the cursor
await events('working', svgs.working, [0.1, 0.7, 1.3, 1.9, 2.5, 3.1])

// the reference prompt area next to both states at dsf 2
if (REF) {
  const ref = 'data:image/jpeg;base64,' + readFileSync(REF).toString('base64')
  const ctx = await browser.newContext({ viewport: { width: 756, height: 560 }, deviceScaleFactor: 2 })
  const page = await ctx.newPage()
  const refBox = `<div class="lbl">reference (cropped, 1.4x)</div><div style="margin:0 18px;width:720px;height:120px;overflow:hidden;position:relative;border:1px solid #1d6b22">
<img src="${ref}" style="position:absolute;width:${1206 * 1.4}px;left:${-410 * 1.4}px;top:${-195 * 1.4}px"></div>`
  const refBox2 = `<div style="margin:6px 18px 0;width:720px;height:62px;overflow:hidden;position:relative;border:1px solid #1d6b22">
<img src="${ref}" style="position:absolute;width:${1206 * 1.4}px;left:${-410 * 1.4}px;top:${-570 * 1.4}px"></div>`
  await page.setContent(page0(refBox + refBox2 + '<div class="lbl">idle</div>' + mock(svgs.idle) + '<div class="lbl">working</div>' + mock(svgs.working)))
  await page.waitForTimeout(300)
  await page.screenshot({ path: join(out, 'compare.png') })
  await ctx.close()
}

await browser.close()
console.log('shots in', out)
