import assert from 'node:assert/strict'
import { test } from 'node:test'
import { botLanding } from '../src/client/bot-landing.js'

function fixture() {
  let mode = 'bot'
  const listeners = new Set()
  let finish
  let part = 'old-part'
  const opened = []
  const landing = botLanding({
    surface: { getSnapshot: () => ({ mode }), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) } },
    refresh: () => new Promise(resolve => { finish = resolve }),
    resolve: (id, last) => last ? part : id,
    open: id => opened.push(id),
  })
  return { landing, opened, listeners, setMode(next) { mode = next; listeners.forEach(fn => fn()) }, finish() { part = 'fresh-part'; finish() } }
}

test('a refresh completing after native navigation cannot reopen Chief', async () => {
  const f = fixture()
  const pending = f.landing.land('chief', { sessionId: 'old-part' })
  f.setMode('agent')
  f.finish()
  await pending
  await f.landing.land('chief')
  assert.deepEqual(f.opened, [])
})

test('leaving and re-entering does not revive the previous automatic navigation', async () => {
  const f = fixture()
  const pending = f.landing.land('chief', { sessionId: 'old-part' })
  f.setMode('agent')
  f.setMode('bot')
  await f.landing.land('chosen-bot')
  f.finish()
  await pending
  assert.deepEqual(f.opened, ['chosen-bot'])
})

test('normal Bot conversation rollover still opens its fresh part', async () => {
  const f = fixture()
  const pending = f.landing.land('chief', { sessionId: 'old-part' })
  f.finish()
  await pending
  assert.deepEqual(f.opened, ['fresh-part'])
})

test('unloading cancels pending landing and unsubscribes', async () => {
  const f = fixture()
  const pending = f.landing.land('chief', { sessionId: 'old-part' })
  f.landing.dispose()
  f.finish()
  await pending
  assert.deepEqual(f.opened, [])
  assert.equal(f.listeners.size, 0)
})
