// Renders the band's mascot tile, frozen, as a square 1024px listing icon.
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const { chromium } = createRequire(import.meta.url)('playwright')
const [bandPath, out] = process.argv.slice(2)
let band = readFileSync(bandPath, 'utf8').replace(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g, '@media all')
band = band.replace(/viewBox="0 0 180 14" width="360" height="28"/, 'x="0" y="0" width="20" height="14" viewBox="0 0 20 14"')
if (!band.includes('viewBox="0 0 20 14"')) throw new Error('band root not as expected')
// 24 units square at 40px a unit, padded to 1024: every art pixel lands on whole device pixels.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -5 24 24" width="960" height="960" shape-rendering="crispEdges"><rect x="-2" y="-5" width="24" height="24" fill="#061008"/>${band}</svg>`
writeFileSync(out.replace(/\.png$/, '.svg'), svg)
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 960, height: 960 }, deviceScaleFactor: 1 })
await page.setContent(`<!doctype html><html><body style="margin:0;background:#061008">${svg}</body></html>`)
await page.locator('body > svg').screenshot({ path: out })
await browser.close()
