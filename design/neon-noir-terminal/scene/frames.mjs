// Capture a reduced-motion still and timed frames for review (seeks all animations).
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pw = require('playwright')
const dir = new URL('.', import.meta.url).pathname.replace(/\/$/, '')
const b = await pw.chromium.launch()
for (const [n, w, h] of [['desktop', 1440, 900], ['phone', 390, 844]]) {
  const c = await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })
  const p = await c.newPage(); await p.goto(`file://${dir}/scene.svg`); await p.waitForTimeout(300)
  await p.screenshot({ path: `${dir}/frames/still-${n}.png` }); await c.close()
}
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } })
const p = await ctx.newPage(); await p.goto(`file://${dir}/scene.svg`)
const times = (process.argv[2] ?? '1,2.2,5,33.5,35,36.6').split(',').map(Number)
for (const t of times) {
  // t is wall time since load: each animation's currentTime = t (delays still apply)
  await p.evaluate(t => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000 } }, t)
  await p.waitForTimeout(120)
  await p.screenshot({ path: `${dir}/frames/t${t}.png`, clip: { x: 1100, y: 0, width: 340, height: 200 } })
}
await b.close()
