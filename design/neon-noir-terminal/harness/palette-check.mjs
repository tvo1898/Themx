// Usage: node palette-check.mjs <definition.json> [outDir]
// Runs makeColors on a palette definition (the object passed to makeColors),
// prints blocking problems, our own contrast goals, resolved key tokens, and
// renders a mock chat preview (dark + light) to <outDir>/preview-{dark,light}.png.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { basename, resolve } from 'node:path'
import { makeColors, __evaluator, __GRAPH } from './make-colors.mjs'

const require = createRequire(import.meta.url)
const defPath = process.argv[2]
if (!defPath) { console.error('usage: node palette-check.mjs <definition.json> [outDir]'); process.exit(2) }
const outDir = resolve(process.argv[3] ?? defPath.replace(/\.json$/, '') + '-check')
mkdirSync(outDir, { recursive: true })
const def = JSON.parse(readFileSync(defPath, 'utf8'))
const HC = def.contrast === 'more'

let theme, problems
try {
  ;({ theme, problems } = makeColors(def))
} catch (err) {
  console.log('MAKECOLORS THREW:', err.message)
  process.exit(1)
}

const hex = c => {
  if (c.startsWith('#')) return c
  const m = c.match(/rgba?\(([^)]+)\)/)
  if (!m) return c
  const [r, g, b] = m[1].split(',').map(s => Number(s.trim()))
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
const lum = h => {
  const n = h.replace('#', '')
  const [r, g, b] = [0, 2, 4].map(i => parseInt(n.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
// A translucent color (rgba) is composited over the background first.
const over = (fg, bg) => {
  const m = fg.match(/rgba\(([^)]+)\)/)
  if (!m) return hex(fg)
  const [r, g, b, a = 1] = m[1].split(',').map(v => Number(v.trim()))
  const base = hex(bg).replace('#', '')
  const under = [0, 2, 4].map(i => parseInt(base.slice(i, i + 2), 16))
  return '#' + [r, g, b].map((v, i) => Math.round(v * a + under[i] * (1 - a)).toString(16).padStart(2, '0')).join('')
}
const ratio = (a, b) => {
  const [x, y] = [lum(over(a, b)), lum(hex(b))].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const TOKENS = [
  'surface-0', 'surface-1', 'surface-2', 'surface-3',
  'text-primary', 'text-secondary', 'text-muted', 'text-disabled',
  'border', 'border-strong', 'fill-primary', 'on-primary',
  'fill-accent', 'on-accent', 'text-accent', 'bg-accent', 'border-accent',
  'text-danger', 'text-success', 'text-warning', 'text-pro',
  'fill-danger', 'fill-success', 'fill-warning', 'fill-pro',
  'text-git-added', 'text-git-removed', 'text-git-modified', 'border-stronger', 'ring-color',
]

const blocking = problems.filter(l => l.startsWith("Desktop won't paint"))
console.log(`label: ${theme.label}${HC ? '  [high-contrast goals: contrast is "more"]' : ''}${def.only ? `  [only: ${def.only}]` : ''}`)
console.log(`problems: ${problems.length} total, ${blocking.length} BLOCKING (Desktop won't paint)`)
for (const l of blocking) console.log('  BLOCKING: ' + l)

const resolved = {}
let goalFails = 0
for (const mode of ['dark', 'light']) {
  const inputs = theme.inputs[mode]
  if (!inputs) { console.log(`\n[${mode}] not given`); continue }
  const get = __evaluator(__GRAPH, inputs, mode === 'dark')
  const r = {}
  for (const t of TOKENS) { try { r[t] = get(t) } catch { r[t] = undefined } }
  resolved[mode] = r
  console.log(`\n[${mode}] tokens:`)
  for (const t of TOKENS) console.log(`  ${t.padEnd(18)} ${r[t]}`)
  console.log(`[${mode}] contrast goals:`)
  const goal = (fg, bg, min) => {
    if (!r[fg] || !r[bg]) return
    const v = ratio(r[fg], r[bg])
    const ok = v >= min
    if (!ok) goalFails++
    console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${fg} on ${bg}: ${v.toFixed(2)}:1 (goal ${min})`)
  }
  if (HC) {
    // High contrast: well past WCAG AAA for words, AAA for every colored text.
    goal('text-primary', 'surface-0', 15)
    for (const s of ['surface-1', 'surface-2', 'surface-3']) goal('text-primary', s, 12)
    goal('text-secondary', 'surface-0', 9)
    goal('text-secondary', 'surface-2', 7)
    goal('text-muted', 'surface-0', 7)
    goal('text-muted', 'surface-2', 7)
    for (const t of ['text-accent', 'text-danger', 'text-success', 'text-warning', 'text-pro']) {
      goal(t, 'surface-0', 7)
      goal(t, 'surface-2', 7)
    }
    for (const t of ['text-git-added', 'text-git-removed', 'text-git-modified']) goal(t, 'surface-0', 7)
    goal('on-accent', 'fill-accent', 4.5)
    // Borders are translucent whites fixed by the design system's graph; no seed moves
    // them. contrast: 'more' is what strengthens borders and focus rings, at paint time.
    for (const b of ['border', 'border-strong', 'border-stronger']) {
      console.log(`  info ${b} on surface-0: ${ratio(r[b], r['surface-0']).toFixed(2)}:1 (the app strengthens borders under contrast: more)`)
    }
    console.log(`  info on-accent on fill-accent: ${ratio(r['on-accent'], r['fill-accent']).toFixed(2)}:1 (7+ is nicer)`)
  } else {
    for (const s of ['surface-0', 'surface-1', 'surface-2', 'surface-3']) goal('text-primary', s, 7)
    goal('text-secondary', 'surface-0', 4.5)
    goal('text-muted', 'surface-0', 4.5)
    goal('text-muted', 'surface-2', 4.5)
    for (const t of ['text-accent', 'text-danger', 'text-success', 'text-warning', 'text-pro']) goal(t, 'surface-0', 4.5)
    goal('on-accent', 'fill-accent', 4.5)
  }
}
console.log(`\nown goal failures: ${goalFails}`)
console.log(`other (non-blocking) problems: ${problems.length - blocking.length}`)
writeFileSync(`${outDir}/theme.json`, JSON.stringify(theme, null, 2))
writeFileSync(`${outDir}/problems.txt`, problems.join('\n'))
writeFileSync(`${outDir}/resolved.json`, JSON.stringify(resolved, null, 2))

// Mock chat preview: page, a card, a code block colored the way roles color code.
const page = r => `<!doctype html><meta charset=utf-8><style>
body{margin:0;background:${r['surface-0']};color:${r['text-primary']};font:15px/1.5 system-ui,sans-serif}
.wrap{max-width:720px;margin:0 auto;padding:24px}
.msg{background:${r['surface-1']};border:1px solid ${r['border']};border-radius:10px;padding:12px 16px;margin:10px 0}
.user{background:${r['surface-2']}}
.muted{color:${r['text-muted']}} .sec{color:${r['text-secondary']}}
a{color:${r['text-accent']}}
pre{background:${r['surface-2']};border:1px solid ${r['border']};border-radius:8px;padding:12px;font:13px/1.5 ui-monospace,monospace;overflow:auto}
.kw{color:${r['text-accent']}} .str{color:${r['text-success']}} .lit{color:${r['text-pro']}} .nm{color:${r['text-danger']}} .var{color:${r['text-warning']}}
.btn{display:inline-block;background:${r['fill-accent']};color:${r['on-accent']};padding:6px 14px;border-radius:8px;margin-right:8px}
.btn2{display:inline-block;background:${r['fill-primary']};color:${r['on-primary']};padding:6px 14px;border-radius:8px}
.add{color:${r['text-git-added']}} .rem{color:${r['text-git-removed']}} .mod{color:${r['text-git-modified']}}
.menu{background:${r['surface-3']};border:1px solid ${r['border-strong']};border-radius:8px;padding:8px 12px;display:inline-block}
.pill{display:inline-block;padding:2px 8px;border-radius:99px;margin-right:6px;border:1px solid}
</style><div class=wrap>
<div class="msg user">Make the login form validate emails before submit.</div>
<div class=msg>Sure. I updated <a href=#>src/auth/login.ts</a> so it checks the address first.
<p class=sec>Secondary text: the test suite passes.</p><p class=muted>Muted: 3 files changed · 2m ago</p>
<pre><span class=kw>export async function</span> <span class=nm>validate</span>(<span class=var>email</span>: <span class=kw>string</span>) {
  <span class=kw>const</span> <span class=var>re</span> = <span class=str>/^[^@\\s]+@[^@\\s]+$/</span>
  <span class=kw>if</span> (!<span class=var>re</span>.test(<span class=var>email</span>)) <span class=kw>return</span> <span class=lit>false</span>
  <span class=kw>return</span> <span class=var>email</span>.length &lt; <span class=lit>254</span> <span class=muted>// RFC limit</span>
}</pre>
<div><span class=add>+ 12 added</span> &nbsp; <span class=rem>- 3 removed</span> &nbsp; <span class=mod>~ 1 modified</span></div>
<p><span class=pill style="color:${r['text-danger']}">danger</span><span class=pill style="color:${r['text-success']}">success</span><span class=pill style="color:${r['text-warning']}">warning</span><span class=pill style="color:${r['text-pro']}">pro</span></p>
<p><span class=btn>Accept</span><span class=btn2>Primary</span> <span class=menu>Menu on surface-3</span></p>
</div></div>`

const pw = require('playwright')
const browser = await pw.chromium.launch()
for (const mode of Object.keys(resolved)) {
  const p = await browser.newPage({ viewport: { width: 760, height: 640 } })
  await p.setContent(page(resolved[mode]))
  await p.screenshot({ path: `${outDir}/preview-${mode}.png`, fullPage: true })
  await p.close()
}
await browser.close()
console.log(`\nwrote ${outDir}/{theme.json,problems.txt,resolved.json,preview-dark.png,preview-light.png}`)
console.log(`(definition: ${basename(defPath)})`)
