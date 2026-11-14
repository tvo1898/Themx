// Static rule check for the band SVGs.
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
let bad = 0
for (const f of ['band-idle.svg', 'band-working.svg']) {
  const s = readFileSync(join(here, f), 'utf8')
  const errs = []
  if (s.length >= 20000) errs.push('size ' + s.length)
  if (!s.startsWith('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 14" width="360" height="28" shape-rendering="crispEdges">')) errs.push('root')
  for (const [re, what] of [
    [/<script/i, 'script'], [/\son[a-z]+\s*=/i, 'on* attr'], [/<image/i, 'image'],
    [/<foreignObject/i, 'foreignObject'], [/url\(/i, 'url('], [/href/i, 'href'],
    [/@import/i, '@import'], [/@font-face/i, '@font-face'], [/<text/i, 'text'],
    [/filter/i, 'filter'], [/\sstyle=/i, 'inline style attr'], [/<use/i, 'use'],
  ]) if (re.test(s)) errs.push(what)
  const styles = s.match(/<style>([\s\S]*?)<\/style>/g) || []
  if (styles.length !== 1) errs.push('style count ' + styles.length)
  const css = styles[0] || ''
  if (!/@media \(prefers-reduced-motion: reduce\)\{\*\{animation:none!important\}\}/.test(css)) errs.push('reduced-motion rule')
  // every color is a custom property declared first in the <style>, with the paired values
  const VARS = '<style>svg{--phos:#4dff70;--glow:#7dff3a;--phos-dim:#1d6b22;--tile:#0f3315;--pop:#ff1fd2;--ink:#020a05;--hi:#c9ffd6}'
  if (!css.startsWith(VARS)) errs.push('color vars block')
  const hexes = (s.replace(VARS, '').match(/#[0-9a-f]{3,8}\b/gi) || [])
  if (hexes.length) errs.push('color outside vars ' + hexes.join(','))
  if (/rgb|hsl/i.test(s)) errs.push('rgb/hsl literal')
  if (s.split('prefers-reduced-motion').length !== 2) errs.push('reduced-motion block count')
  if (/prefers-color-scheme/.test(s)) errs.push('prefers-color-scheme')
  // both states keep their rain streaks still (the band cannot share the scene's clock, so every step it
  // takes would be an extra composited frame)
  if (/\.rn\{[^}]*animation|\.r\d\{[^}]*animation|@keyframes rain/.test(css)) errs.push('rain animates')
  // keyframes animate only transform/opacity
  for (const kf of css.matchAll(/@keyframes\s+([\w-]+)\{((?:[^{}]*\{[^{}]*\})*)\}/g)) {
    for (const decl of kf[2].matchAll(/([a-z-]+)\s*:/g)) {
      if (!['transform', 'opacity'].includes(decl[1])) errs.push(`keyframes ${kf[1]} animates ${decl[1]}`)
    }
  }
  // every animation shorthand uses steps()
  for (const a of css.matchAll(/animation:([^;}]+)/g)) {
    if (a[1].startsWith('none')) continue
    if (!/steps\(/.test(a[1])) errs.push('no steps: ' + a[1])
  }
  // shortest on/off period (flash rate): durations of opacity animations
  const durs = [...css.matchAll(/animation:[^;}]*?([\d.]+)s/g)].map(m => +m[1])
  console.log(f, s.length, 'chars;', 'durations', durs.join(','), errs.length ? 'ERR ' + errs.join(' | ') : 'ok')
  bad += errs.length
}
process.exit(bad ? 1 : 0)
