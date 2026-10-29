// A roster refresh can finish after the user has left and re-entered Bot mode.
// Only the navigation that started in the current mode lifetime may land.
export function botLanding({ surface, refresh, resolve, open }) {
  let mode = surface.getSnapshot().mode
  let revision = 0
  const stop = surface.subscribe(() => {
    const next = surface.getSnapshot().mode
    if (next !== mode) { mode = next; revision += 1 }
  })
  return {
    async land(id, last) {
      if (mode !== 'bot') return
      const started = revision
      if (last) await refresh().catch(() => {})
      if (started !== revision || mode !== 'bot') return
      open(resolve(id, last))
    },
    dispose() { revision += 1; mode = 'agent'; stop() },
  }
}
