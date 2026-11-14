import type { On, ThemeSetArgs } from 'claude-code'
import { expect, mock, test } from 'claude-code/testing'

import { BAND_IDLE, BAND_WORKING } from '../hooks/band'
import { makeColors } from '../hooks/make-colors.js'
import { PALETTE } from '../hooks/palette'
import { SCENE } from '../hooks/scene'

const MOD = 'neon-noir-terminal'
const GLASS = { blur: 14, opacity: 0.86 }

// The engine beneath the mod: it records each theme set and clear, and
// answers the calls session.start makes.
const engine = (on: On, store: Record<string, unknown> = {}) => {
  const sets: ThemeSetArgs[] = []
  let clears = 0
  mock.store(on, store)
  on('command.register', () => ({ value: { command: 'noir' } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('theme.set', (_, e) => {
    sets.push(e)

    return { value: { isDrawn: true, requestId: `theme-${sets.length}` } }
  })
  on('theme.clear', () => {
    clears += 1

    return { value: { isDrawn: false, reason: 'cleared' } }
  })

  return { sets, clears: () => clears }
}

const start = { cwd: '/', surface: 'desktop', isInteractive: true } as const

// /noir <args>, as the person types it at the prompt.
const noir = (args: string) =>
  ({
    command: 'noir',
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  }) as const

const backdrop = (scene: string) =>
  ({
    plugin: MOD,
    component: 'Backdrop',
    requestId: 'backdrop',
    props: { scene, plugin: MOD, glass: GLASS },
  }) as const

const prompt = (isWorking: boolean) =>
  ({
    plugin: MOD,
    component: 'AbovePrompt',
    requestId: 'band',
    props: {
      hasSurvey: false,
      isCollapsed: false,
      isWorking,
      maxRows: 6,
      bodyColumns: 80,
      scroll: { offset: 0, bodyRows: 6 },
      view: {},
    },
  }) as const

// Freezing applies the art's own reduced-motion rules always, and changes nothing else.
const REDUCED = /@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g
const expectFrozen = (source: unknown, of: string) => {
  const text = String(source)
  expect(text).not.toMatch(/prefers-reduced-motion/)
  expect(text).toBe(of.replace(REDUCED, '@media all'))
  expect(text).not.toBe(of)
}

test('the palette is dark, high contrast and paints on Desktop; the art fits the engine', () => {
  const { theme, problems } = makeColors(PALETTE)
  expect(problems.filter(line => line.startsWith("Desktop won't paint"))).toEqual([])
  expect(Object.keys(theme.inputs)).toEqual(['dark'])
  expect(theme.contrast).toBe('more')

  for (const svg of [SCENE, BAND_IDLE, BAND_WORKING]) {
    expect(svg.length).toBeLessThan(131072)
    // One reduced-motion block: the still mode applies it always.
    expect(svg.match(/@media\s*\(\s*prefers-reduced-motion\s*:\s*reduce\s*\)/g)).toHaveLength(1)
    expect(svg).toContain('</style>')
    expect(svg).not.toMatch(/<script|<image|<foreignObject|\son[a-z]+=|prefers-color-scheme/i)
  }
  expect(SCENE).toMatch(/preserveAspectRatio="xMidYMid slice"/)
})

test('a new session puts on the animated look, dark', async ($, on) => {
  const seen = engine(on)
  await $.session.start(start)

  expect(seen.sets).toHaveLength(1)
  expect(seen.sets[0]?.backdrop).toEqual({ scene: 'neon-noir-night', glass: GLASS })
  expect(seen.sets[0]?.colors?.label).toBe('Neon Noir Terminal')
  expect(seen.sets[0]?.overrideColorScheme).toBe('dark')
  expect(seen.clears()).toBe(0)
})

test('the backdrop draws the scene on desktop and mobile', async $ => {
  for (const surface of ['desktop', 'mobile'] as const) {
    const ui = await $.ui.mount({ ...backdrop('neon-noir-night'), surface })
    expect((await ui.find({ type: 'Svg' }))?.props).toMatchObject({ source: SCENE, isInteractive: true })
    await ui.unmount()
  }
})

test('the still scene is the same art with its animation stopped', async $ => {
  const ui = await $.ui.mount({ ...backdrop('neon-noir-still'), surface: 'desktop' })
  expectFrozen((await ui.find({ type: 'Svg' }))?.props.source, SCENE)
  await ui.unmount()
})

test('another mod\'s backdrop is left to it', async ($, on) => {
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)

    return <Text>someone else</Text>
  })
  const ui = await $.ui.mount({ ...backdrop('lagoon'), surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  expect((await ui.find({ type: 'Text' }))?.text).toBe('someone else')
  await ui.unmount()
})

test('the band shows ready while waiting and running while a turn runs', async ($, on) => {
  engine(on)
  await $.session.start(start)

  for (const surface of ['desktop', 'mobile'] as const) {
    const idle = await $.ui.mount({ ...prompt(false), surface })
    expect((await idle.find({ type: 'Svg' }))?.props).toMatchObject({ source: BAND_IDLE })
    await idle.unmount()

    const working = await $.ui.mount({ ...prompt(true), surface })
    expect((await working.find({ type: 'Svg' }))?.props).toMatchObject({ source: BAND_WORKING })
    await working.unmount()
  }

  // The terminal draws no look: no row there.
  const terminal = await $.ui.mount({ ...prompt(false), surface: 'terminal' })
  expect(await terminal.find({ type: 'Svg' })).toBeUndefined()
  await terminal.unmount()
})

test('/noir band off hides the band at once, and the choice outlives the session', async ($, on) => {
  engine(on)
  await $.session.start(start)
  const ui = await $.ui.mount({ ...prompt(false), surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeDefined()

  expect((await $.command.run(noir('band off'))).text).toBe('Prompt band off.')
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()

  await $.session.start(start)
  const later = await $.ui.mount({ ...prompt(false), surface: 'desktop' })
  expect(await later.find({ type: 'Svg' })).toBeUndefined()
  await $.command.run(noir('band on'))
  expect((await later.find({ type: 'Svg' }))?.props).toMatchObject({ source: BAND_IDLE })
  await later.unmount()
})

test('/noir still freezes the scene and the band, and outlives the session', async ($, on) => {
  const seen = engine(on)
  await $.session.start(start)

  const ran = await $.command.run(noir('still'))
  expect(ran.text).toContain('still')
  expect(seen.sets.at(-1)?.backdrop).toEqual({ scene: 'neon-noir-still', glass: GLASS })

  const ui = await $.ui.mount({ ...prompt(true), surface: 'desktop' })
  expectFrozen((await ui.find({ type: 'Svg' }))?.props.source, BAND_WORKING)
  await ui.unmount()

  // The next session reads the stored choice and starts still.
  await $.session.start(start)
  expect(seen.sets.at(-1)?.backdrop).toEqual({ scene: 'neon-noir-still', glass: GLASS })
})

test('/noir off clears the look and the band, and a session after it sets none', async ($, on) => {
  const seen = engine(on)
  await $.session.start(start)
  const before = seen.sets.length

  const ran = await $.command.run(noir('off'))
  expect(ran.text).toContain('off')
  expect(seen.clears()).toBe(1)
  const ui = await $.ui.mount({ ...prompt(false), surface: 'desktop' })
  expect(await ui.find({ type: 'Svg' })).toBeUndefined()
  await ui.unmount()

  await $.session.start(start)
  expect(seen.sets.length).toBe(before)
  // Starting a session never clears: that would wipe another mod's look.
  expect(seen.clears()).toBe(1)
})

test('/noir with an alias, a status and stray words', async ($, on) => {
  const seen = engine(on, { mode: 'still', band: false })
  await $.session.start(start)
  expect(seen.sets.at(-1)?.backdrop).toEqual({ scene: 'neon-noir-still', glass: GLASS })

  await $.command.run(noir(' Night '))
  expect(seen.sets.at(-1)?.backdrop).toEqual({ scene: 'neon-noir-night', glass: GLASS })

  const status = await $.command.run(noir(''))
  expect(status.text).toContain('rain (animated), prompt band off')
  expect(status.text).toContain('An app that draws themes is attached.')

  expect((await $.command.run(noir('disco'))).text).toContain('Unknown option "disco"')
  expect((await $.command.run(noir('rain please'))).text).toContain('Unknown option "rain please"')
  expect((await $.command.run(noir('band maybe'))).text).toContain('/noir band on')

  // The stray words stored nothing: the next session is the animated night.
  const count = seen.sets.length
  await $.session.start(start)
  expect(seen.sets.length).toBe(count + 1)
  expect(seen.sets.at(-1)?.backdrop).toEqual({ scene: 'neon-noir-night', glass: GLASS })
})
