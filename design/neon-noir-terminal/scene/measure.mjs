// Measure the terminal box and JAZZ sign against the mock's chat column across window shapes.
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const pw = require('playwright')
const file = process.argv[2]
const b = await pw.chromium.launch()
const sizes = [[1440,900],[1280,800],[1366,768],[1920,1080],[1680,1050],[1536,864],[1440,875],[1512,950],[1470,940],[1440,940],[1440,960],[1600,900],[1728,1080],[1500,790],[1520,800],[2560,1080],[3440,1440],[1200,1000],[1024,768]]
for (const [w, h] of sizes) {
  const p = await (await b.newContext({ viewport: { width: w, height: h }, reducedMotion: 'reduce' })).newPage()
  await p.goto('file://' + file)
  const r = await p.evaluate(() => {
    const box = document.querySelector('.bx').children[1].getBoundingClientRect()
    const jz = [...document.querySelectorAll('.rf .hm2')][0].nextElementSibling.getBoundingClientRect()
    return { l: box.left, r: box.right, t: box.top, jl: jz.left, jr: jz.right }
  })
  const col = w - 260 >= 760 ? w / 2 + 490 : w - 20
  const k = w / h >= 1.6 ? w / 480 : h / 300
  console.log(`${w}x${h} a=${(w/h).toFixed(3)} k=${k.toFixed(2)} box ${r.l.toFixed(0)}..${r.r.toFixed(0)} top ${r.t.toFixed(0)} | col ${col} clear ${((r.l - col)/k).toFixed(1)}u | right margin ${((w - r.r)/k).toFixed(1)}u | jazz ${r.jl.toFixed(0)}..${r.jr.toFixed(0)} (jazz-box ${((r.jl-r.l)/k).toFixed(1)}u)`)
  await p.context().close()
}
await b.close()
