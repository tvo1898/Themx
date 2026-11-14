// Computed animation state of both bands: normal, emulated reduced motion, and the mod's
// still mode (the one reduced-motion block re-scoped to @media all).
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const b = await chromium.launch()
for (const f of ['band-idle.svg', 'band-working.svg']) {
  const svg = readFileSync(new URL('./' + f, import.meta.url), 'utf8')
  for (const [mode, rm, src] of [
    ['motion', 'no-preference', svg],
    ['reduced', 'reduce', svg],
    ['still', 'no-preference', svg.replace('@media (prefers-reduced-motion: reduce)', '@media all')],
  ]) {
    const ctx = await b.newContext({ reducedMotion: rm })
    const pg = await ctx.newPage()
    await pg.setContent(`<body style="background:#000">${src}</body>`)
    const r = await pg.evaluate(() => {
      const seen = {}
      for (const e of document.querySelectorAll('svg [class]')) {
        const c = e.getAttribute('class')
        const cs = getComputedStyle(e)
        if (cs.animationName !== 'none' || /^(rn|p\d|cb|eo|es|ew|ht|rd|led)/.test(c)) {
          seen[c] = `${cs.animationName}/${cs.animationDuration} op=${cs.opacity} tf=${cs.transform === 'none' ? '-' : cs.transform}`
        }
      }
      return seen
    })
    const running = await pg.evaluate(() => document.getAnimations().length)
    console.log(f, mode, 'running animations:', running)
    for (const [k, v] of Object.entries(r)) console.log('   ', k.padEnd(10), v)
    await ctx.close()
  }
}
await b.close()
