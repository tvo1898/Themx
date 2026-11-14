# Neon Noir Terminal: design sources

The generators and checks behind the mod in `mods/neon-noir-terminal`. The mod
itself needs none of this: its art is baked into `hooks/scene.ts` and
`hooks/band.ts`, and its palette into `hooks/palette.ts`.

The scripts need Node 20 or later and Playwright with Chromium. Run each from
this folder.

## Palette

`palette/palette.json` holds the seed colors `makeColors` expands into the
app's tokens: dark only, `contrast: 'more'`.

```
node harness/palette-check.mjs palette/palette.json out/palette
```

This prints any problem that would stop the app painting the palette, and the
mod's own contrast goals: text at 7:1 or better (WCAG AAA) on every surface,
code colors included. It also writes `resolved.json`, the resolved tokens the
scene checker's mock uses, and a preview. `palette/resolved.json` is the
current one.

## Scene

`scene/gen.mjs` writes `scene/scene.svg`. `scene/layout.mjs` places the HOTEL
sign, the moon, the TTY and the JAZZ sign for each window size, clear of the
sidebar and the conversation column, and writes those rules into the SVG's
style as media queries.

```
node scene/gen.mjs > scene/scene.svg
node scene/verify-layout.mjs             # model vs browser, and a sweep of 70,000 window sizes
node harness/render-scene.mjs scene/scene.svg out/scene palette/resolved.json --dark-only --extra --opacity=0.86
node scene/shot.mjs out/shots 1440x900 1440x900:still 390x844:t=12
```

`render-scene.mjs` checks the engine's limits (size under 131,072 characters,
one reduced-motion block, no script, image or external load, animation of
transform and opacity only). Then it renders 14 window shapes, raw and under a
mock of the app at the mod's glass, 0.86 opacity with a 14px blur. Keep
`--opacity` equal to `GLASS.opacity` in `hooks/register.tsx`: every contrast
figure is measured at it.

`frames.mjs` and `frame-full.mjs` capture timed frames of the TTY.
`measure.mjs` and `sweep.mjs` measure the TTY and JAZZ against the column.

## Band

`band/gen.mjs` writes `band/band-idle.svg` and `band/band-working.svg`: the
detective and the terminal line above the prompt.

```
node band/gen.mjs
node band/check.mjs                      # size, durations, colors only from the shared variables
node band/rmtest.mjs                     # animations running: normal, reduced motion, still
node band/shoot.mjs out/band             # screenshots at 1x and 2x, alone and above a mock prompt
```

## Into the mod

```
node bake.mjs palette/palette.json scene/scene.svg band/band-idle.svg band/band-working.svg ../../mods/neon-noir-terminal
node make-icon.mjs band/band-idle.svg out/icon.png
claude plugin test ../../mods/neon-noir-terminal
```

## Rules the art keeps

- Plain SVG with CSS animation, of `transform` and `opacity` only, stepped so
  the pixels stay on the grid.
- Exactly one `@media (prefers-reduced-motion: reduce)` block per SVG. That
  block draws a composed still, and the mod's `/noir still` applies it always.
- Nothing flashes more than three times a second, and no large bright area
  changes quickly.
- The middle of the window, behind the conversation, stays calm, and the foot,
  behind the prompt, stays quiet.
