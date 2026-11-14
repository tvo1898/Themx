// Usage: node gen.mjs <palette.json> <scene.svg> <band-idle.svg> <band-working.svg> <modDir>
// Bakes the design files into the mod: hooks/palette.ts, hooks/scene.ts, hooks/band.ts.
import { readFileSync, writeFileSync } from 'node:fs'
const [paletteJson, sceneSvg, idleSvg, workingSvg, modDir] = process.argv.slice(2)
const def = JSON.parse(readFileSync(paletteJson, 'utf8'))
def.label = 'Neon Noir Terminal'
const lit = path => {
  const svg = readFileSync(path, 'utf8').trim()
  return { svg, text: '`' + svg.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$\{/g, '\\${') + '`' }
}
writeFileSync(`${modDir}/hooks/palette.ts`,
`import type { makeColors } from './make-colors.js'

// The look's seed colors: makeColors expands them into the design system's
// ~100 tokens. Dark only, high contrast: phosphor-green text in bright, normal
// and dim steps on green-black, with the city's neon in the role colors.
export const PALETTE: Parameters<typeof makeColors>[0] = ${JSON.stringify(def, null, 2)}
`)
const scene = lit(sceneSvg)
writeFileSync(`${modDir}/hooks/scene.ts`,
`// The backdrop: one self-contained SVG, pixel art animated with CSS in its own
// <style>, always the night. It answers prefers-reduced-motion with a still.
export const SCENE: string = ${scene.text}
`)
const idle = lit(idleSvg), working = lit(workingSvg)
writeFileSync(`${modDir}/hooks/band.ts`,
`// The strip above the prompt: the pixel mascot and a terminal line, one SVG
// while the session waits and one while a turn runs.
export const BAND_IDLE: string = ${idle.text}

export const BAND_WORKING: string = ${working.text}
`)
console.log(`palette.ts, scene.ts (${scene.svg.length} chars), band.ts (${idle.svg.length} + ${working.svg.length} chars) written`)
