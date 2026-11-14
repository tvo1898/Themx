import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, ThemeResult, ThemeSetArgs } from 'claude-code'

import type { NoirMode } from '../types'
import { BAND_IDLE, BAND_WORKING } from './band'
import { makeColors } from './make-colors.js'
import { PALETTE } from './palette'
import { SCENE } from './scene'

// Neon Noir Terminal: a dark, high-contrast green-phosphor terminal look for
// every surface and word of the app, a pixel-art noir city in the rain drawn
// behind the conversation as if on a CRT, and a pixel mascot with a terminal
// line in the band above the prompt.

const MODES: readonly NoirMode[] = ['rain', 'still', 'off']
const ALIASES: Readonly<Record<string, NoirMode>> = {
  on: 'rain',
  night: 'rain',
  animated: 'rain',
  calm: 'still',
  pause: 'still',
  static: 'still',
  clear: 'off',
}

// What the session holds, read while the band draws so a change redraws it.
const mode = atom({ plugin: 'neon-noir-terminal', key: 'mode' } as const, 'rain')
const band = atom({ plugin: 'neon-noir-terminal', key: 'band' } as const, true)

// Two scene names for one drawing: the backdrop hook draws the night, or the
// same night frozen, by the name the theme was set with.
const NIGHT = 'neon-noir-night'
const STILL = 'neon-noir-still'

// A frozen copy of an animated SVG: exactly what it draws for reduced motion,
// its prefers-reduced-motion rules applied always.
const REDUCED_MOTION = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g
const frozen = (svg: string): string => svg.replace(REDUCED_MOTION, '@media all')

const STILL_SCENE = frozen(SCENE)
const STILL_BAND_IDLE = frozen(BAND_IDLE)
const STILL_BAND_WORKING = frozen(BAND_WORKING)

// Frosted panels over the scene, opaque enough that every word stays at high
// contrast over the brightest neon. No tint: each panel keeps the app's own
// panel color, which is this palette's near-black. (The desktop app does not yet
// follow overrideColorScheme, so a fixed dark tint would put dark panels under
// the app's own light-mode text there.) 0.86 is the glass every contrast
// measurement of the scene was made at (render-scene.mjs --opacity=0.86): keep
// the two in step.
const GLASS = { blur: 14, opacity: 0.86 }

const { theme, problems } = makeColors(PALETTE)

// A dark look only: the palette gives the dark half alone, with stronger borders
// and focus rings (contrast: 'more'), and asks every surface for dark mode.
const lookFor = (on: 'rain' | 'still'): ThemeSetArgs => ({
  colors: theme,
  overrideColorScheme: 'dark',
  backdrop: { scene: on === 'rain' ? NIGHT : STILL, glass: GLASS },
})

const USAGE = [
  '/noir rain       the animated look: rain, neon, a typing boot log (default)',
  '/noir still      the same look, frozen',
  '/noir off        back to the app\'s own look',
  '/noir band off   hide the pixel band above the prompt (band on brings it back)',
  '/noir status     what is set, and whether this app draws it',
].join('\n')

// What the latest set or clear resolved to, for /noir status. A reload starts
// it over, and session.start sets it again.
let last: ThemeResult | undefined

async function storedMode($: EngineInterface): Promise<NoirMode> {
  const stored = await $.store.get('mode')

  return MODES.find(one => one === stored) ?? 'rain'
}

async function storedBand($: EngineInterface): Promise<boolean> {
  return (await $.store.get('band')) !== false
}

// Puts the look on, or takes it off; answers why not, if it could not.
async function apply($: EngineInterface, to: NoirMode): Promise<string | undefined> {
  try {
    last = to === 'off' ? await $.theme.clear() : await $.theme.set(lookFor(to))

    return undefined
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

function describe(now: NoirMode, isBandShown: boolean): string {
  if (now === 'off') {
    return 'Neon Noir Terminal is off. /noir rain brings it back.'
  }
  const what = now === 'rain' ? 'rain (animated)' : 'still (frozen)'
  const drawn =
    last === undefined
      ? 'Not set yet in this session.'
      : last.isDrawn
        ? 'An app that draws themes is attached.'
        : `Nothing draws it here: ${last.reason}`

  return `Neon Noir Terminal: ${what}, prompt band ${isBandShown ? 'on' : 'off'}. ${drawn}`
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'noir',
      description: 'Neon Noir Terminal: rain, still, off, band on|off, or status',
      argumentHint: 'rain | still | off | band on|off | status',
    })

    // The person's choices from earlier sessions.
    const now = await storedMode($)
    const isBandShown = await storedBand($)
    await update($, mode, () => now)
    await update($, band, () => isBandShown)

    // Never clear at session start: that would wipe another mod's look.
    if (now !== 'off') {
      const failed = await apply($, now)

      if (failed !== undefined) {
        $.ui.toast(`Neon Noir Terminal: ${failed}`)
      }
    }

    // The line that would stop Desktop painting the palette at all.
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))

    if (unpainted !== undefined) {
      $.ui.toast(unpainted)
    }

    return next(e)
  })

  on('command.run', { command: 'noir' }, async ($, e) => {
    const words = e.args.trim().toLowerCase().split(/\s+/).filter(Boolean)
    const [first = '', second] = words

    if (first === '' || first === 'status') {
      return { text: `${describe(await read($, mode), await read($, band))}\n\n${USAGE}` }
    }

    if (first === 'band') {
      if (second !== 'on' && second !== 'off') {
        return { text: `Say /noir band on or /noir band off.\n\n${USAGE}` }
      }
      const isBandShown = second === 'on'
      await $.store.set('band', isBandShown)
      await update($, band, () => isBandShown)

      return { text: `Prompt band ${second}.` }
    }

    const to = MODES.find(one => one === first) ?? ALIASES[first]

    if (to === undefined || words.length > 1) {
      return { text: `Unknown option "${words.join(' ')}".\n\n${USAGE}` }
    }

    await $.store.set('mode', to)
    await update($, mode, () => to)
    const failed = await apply($, to)

    if (failed !== undefined) {
      return { text: `Neon Noir Terminal could not switch to ${to}: ${failed}` }
    }

    return { text: describe(to, await read($, band)) }
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    const { scene } = e.props
    const isOurs = scene === NIGHT || scene === STILL

    if (!isOurs || (e.surface !== 'desktop' && e.surface !== 'mobile')) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)

    return (
      <Svg
        source={scene === STILL ? STILL_SCENE : SCENE}
        alt="A pixel-art noir city at night in the rain, drawn in green phosphor on a CRT"
        isInteractive
      />
    )
  })

  // This mod's row of the band above the prompt: the mascot and a terminal line,
  // waiting or working. The terminal draws no look, so it gets no row.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') {
      return next(e)
    }

    const now = await read($, mode)
    const isBandShown = await read($, band)

    if (now === 'off' || !isBandShown || e.props.hasSurvey) {
      return next(e)
    }

    const { Svg } = $.ui.resolve(e)
    const isStill = now === 'still'
    const source = e.props.isWorking
      ? isStill ? STILL_BAND_WORKING : BAND_WORKING
      : isStill ? STILL_BAND_IDLE : BAND_IDLE

    return (
      <Svg
        source={source}
        alt={e.props.isWorking ? 'Terminal line: running' : 'Terminal line: ready'}
        isInteractive
      />
    )
  })
}
