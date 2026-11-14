// Mascot variant sheet: runs gen.mjs with env switches into a temp dir and shows each
// variant's tile at 12x (paused, eyes open), plus the whole strip at actual size (dsf 2).
// usage: node variants.mjs <tag> 'NAME:K=V,K=V' 'NAME2:...'   (gen.mjs reads TH, TH2, SCAN)
// STATE=working and T=<seconds> pick the state and the paused moment.
import { createRequire } from 'node:module'
import { readFileSync, mkdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const { chromium } = require('playwright')
const here = dirname(fileURLToPath(import.meta.url))
const [tag, ...specs] = process.argv.slice(2)
const out = join(here, 'shots-refine', tag)
mkdirSync(out, { recursive: true })
const state = process.env.STATE || 'idle'
const T = +(process.env.T || 0.2)

const vars = specs.map(spec => {
  const [name, kv = ''] = spec.split(':')
  const env = { ...process.env }
  for (const pair of kv.split(',').filter(Boolean)) {
    const [k, v] = pair.split('=')
    env[k] = v
  }
  const dir = join(out, 'v-' + name)
  mkdirSync(dir, { recursive: true })
  env.OUT = dir
  execFileSync('node', [join(here, 'gen.mjs')], { env })
  return { name, svg: readFileSync(join(dir, `band-${state}.svg`), 'utf8') }
})
const uri = s => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(s)
const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 1200, height: 100 }, deviceScaleFactor: 2 })
const page = await ctx.newPage()
const cell = (v, i) => {
  const big = v.svg.replace('viewBox="0 0 180 14" width="360" height="28"', 'viewBox="0 0 20 14" width="240" height="168"')
  return `<div style="display:inline-block;vertical-align:top;margin:8px;width:380px;font:12px monospace;color:#58bd75">
  <div>${v.name}</div><div id="f${i}" style="line-height:0;margin:4px 0">${big}</div>
  <img src="${uri(v.svg)}" width="360" height="28" style="display:block;margin:6px 0"></div>`
}
await page.setContent(`<!doctype html><body style="margin:0;background:#061008">${vars.map(cell).join('')}</body>`)
await page.evaluate(T => {
  for (const a of document.getAnimations()) { a.pause(); a.currentTime = T * 1000 }
}, T)
await page.waitForTimeout(200)
const h = await page.evaluate(() => document.body.scrollHeight)
await page.setViewportSize({ width: 1200, height: h + 10 })
await page.screenshot({ path: join(out, `sheet-${state}.png`) })
await browser.close()
console.log(join(out, `sheet-${state}.png`))
