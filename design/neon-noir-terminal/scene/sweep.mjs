// Sweep aspect ratios at a fixed height: report the terminal's right margin (u) and column clearance at k=3.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pw = require('playwright')
const b = await pw.chromium.launch(); const ctx = await b.newContext({ viewport: { width: 1400, height: 900 }, reducedMotion: 'reduce' }); const p = await ctx.newPage()
await p.goto('file://' + process.argv[2])
let worst = 99, out = []
for (let w = 1260; w <= 1760; w += 3) {
  await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(30)
  const r = await p.evaluate(() => document.querySelector('.bx').children[1].getBoundingClientRect().right)
  const k = w / 900 >= 1.6 ? w / 480 : 3, m = (w - r) / k
  worst = Math.min(worst, m); if (m < 1) out.push(`${w} a=${(w/900).toFixed(3)} margin ${m.toFixed(2)}u`)
}
console.log(out.join('\n') || 'no cut'); console.log('min right margin', worst.toFixed(2))
await b.close()
