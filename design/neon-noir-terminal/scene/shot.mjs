// node shot.mjs <outDir> <WxH[:still][:t=sec]> ...
// Raw scene and the checker's mock (desktop >= 1000px wide, else the mobile veil) at chosen sizes.
// ":still" re-scopes the reduced-motion block to @media all (the mod's still mode); ":t=5" pauses
// every animation at 5s after load.
import { createRequire } from 'node:module'
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2]
mkdirSync(out, { recursive: true })
const src = readFileSync(join(here, 'scene.svg'), 'utf8')
writeFileSync(join(out, 'scene.svg'), src)
writeFileSync(join(out, 'still.svg'), src.replace('@media (prefers-reduced-motion: reduce)', '@media all'))
const mockSrc = kind => readFileSync(join(here, 'render-fix1', `mock-dark-${kind}.html`), 'utf8')
const b = await chromium.launch()
for (const spec of process.argv.slice(3)) {
  const [size, ...opts] = spec.split(':')
  const [W, H] = size.split('x').map(Number)
  const still = opts.includes('still'), t = opts.find(o => o.startsWith('t='))?.slice(2)
  const svg = still ? 'still.svg' : 'scene.svg'
  const kind = W >= 1000 ? 'desktop' : 'mobile'
  writeFileSync(join(out, `mock-${kind}-${svg}.html`), mockSrc(kind).replace('src="scene.svg"', `src="${svg}"`))
  const tag = `${W}x${H}${still ? '-still' : ''}${t ? '-t' + t : ''}`
  const ctx = await b.newContext({ viewport: { width: W, height: H } })
  const p = await ctx.newPage()
  const pause = async frame => { if (t != null) await frame.evaluate(t => { for (const a of document.getAnimations()) { a.pause(); a.currentTime = t * 1000 } }, +t) }
  await p.goto('file://' + join(out, svg)); await p.waitForTimeout(300); await pause(p)
  await p.waitForTimeout(100); await p.screenshot({ path: join(out, `${tag}-raw.png`) })
  await p.goto('file://' + join(out, `mock-${kind}-${svg}.html`)); await p.waitForTimeout(400)
  if (t != null) await pause(p.frames()[1])
  await p.waitForTimeout(150); await p.screenshot({ path: join(out, `${tag}-mock.png`) })
  await ctx.close()
}
await b.close()
