// The values this mod keeps for the session, read while drawing so a change
// redraws the band. Both are also kept across sessions in $.store.
export type NoirMode = 'rain' | 'still' | 'off'

declare module 'claude-code' {
  interface PluginState {
    'neon-noir-terminal': {
      /** rain: the animated look; still: the same look frozen; off: the app's own. */
      mode: NoirMode
      /** Whether the pixel prompt band shows above the prompt. */
      band: boolean
    }
  }
}
