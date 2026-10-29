import assert from 'node:assert/strict'
import { test } from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { build } from 'esbuild'

const { outputFiles } = await build({
  stdin: {
    contents: "export * from './src/client/bot-entry.js'\nexport { installLocale } from './src/client/i18n.js'\nexport { installNativeShell, openNativeSettings } from './src/client/native-shell.js'",
    resolveDir: fileURLToPath(new URL('../', import.meta.url)),
  },
  bundle: true, format: 'cjs', platform: 'browser', write: false, logLevel: 'silent',
  external: ['react', 'react-dom', '@deepseek-ai/dsh-client-ui-primitives'],
})

function fixture() {
  const effects = []
  const frames = []
  const module = { exports: {} }
  const react = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useLayoutEffect: effect => effects.push(effect),
  }
  runInNewContext(outputFiles[0].text, {
    module, exports: module.exports, require: name => name === 'react' ? react : {}, window: {},
    requestAnimationFrame: callback => { frames.push(callback) },
  })
  const declarations = new Map()
  const entries = new Map()
  const mounted = new Set()
  const listeners = new Set()
  const panels = new Set()
  const events = new Map()
  const keyOf = options => `${options.name}:${options.id ?? options.key}`
  const ctx = {
    slots: {
      inject(name, register) {
        const declaration = { name, register, dispose: null }
        declarations.set(declaration, declaration)
        if (mounted.has(name)) declaration.dispose = register()
        return () => { declaration.dispose?.(); declarations.delete(declaration) }
      },
      register(options, component) {
        const key = keyOf(options)
        assert.equal(entries.has(key), false, 'the same entry must not register twice')
        entries.set(key, { options, component })
        return () => entries.delete(key)
      },
    },
    on(event, listener) { events.set(event, listener); return () => events.delete(event) },
    uiWorkspace: { startSession() { calls.push(['startSession']) } },
    layout: {
      selectPanel(id) { calls.push(['panel', id]); panel = id; panels.forEach(fn => fn()) },
      panelInfo: { getSnapshot: () => ({ activePanelId: panel }), subscribe: fn => { panels.add(fn); return () => panels.delete(fn) } },
    },
  }
  const calls = []
  let mode = 'agent'
  let panel = 'plugins'
  const surface = { getSnapshot: () => ({ mode }), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) } }
  const actions = { setSurface(next) { calls.push(['mode', next]); mode = next; listeners.forEach(fn => fn()) } }
  const mount = name => {
    mounted.add(name)
    for (const declaration of declarations.values()) {
      if (declaration.name === name && !declaration.dispose) declaration.dispose = declaration.register()
    }
  }
  const select = (id = module.exports.BOT_PANEL_ID) => {
    const destination = entries.get(`main:${id}`)
    ctx.layout.selectPanel(id)
    destination.component(destination.options.inject())
    effects.splice(0).forEach(effect => effect())
  }
  return { ...module.exports, ctx, actions, surface, events, listeners, panels, calls, declarations, entries, mount, select, flushFrames: () => frames.splice(0).forEach(frame => frame()), get mode() { return mode }, get panel() { return panel } }
}

test('settings shortcuts prefer native settings after the Bot dialog closes, including explicit editors', () => {
  const f = fixture()
  const calls = []
  const settings = { open: () => calls.push('settings'), openOnboarding: id => calls.push(id) }
  const ctx = { get: name => name === 'maofuxingSettings' ? settings : null }
  const fallback = () => calls.push('fallback')
  f.openNativeSettings(ctx, fallback)
  assert.deepEqual(calls, [])
  f.flushFrames()
  f.openNativeSettings(ctx, fallback, 'deepseek-api-key')
  f.flushFrames()
  assert.deepEqual(calls, ['settings', 'deepseek-api-key'])
})

test('settings shortcuts keep the ordinary DSH fallback, including a native shell unloaded before the frame', () => {
  const f = fixture()
  const calls = []
  let settings = null
  const ctx = { get: () => settings }
  const fallback = () => calls.push('fallback')
  f.openNativeSettings(ctx, fallback)
  assert.deepEqual(calls, ['fallback'])
  settings = { open: () => calls.push('native') }
  f.openNativeSettings(ctx, fallback)
  settings = null
  f.flushFrames()
  assert.deepEqual(calls, ['fallback', 'fallback'])
})

test('Agents waits for the official slots and returns to the existing conversation from either mode', () => {
  const f = fixture()
  const dispose = f.installBotEntry(f.ctx, f.actions, f.surface)
  assert.equal(f.entries.size, 0)
  f.mount('sidebar.panellist')
  f.mount('main')
  assert.equal(f.entries.size, 2)
  const entry = f.entries.get(`sidebar.panellist:${f.BOT_PANEL_ID}`)
  assert.equal(entry.options.label(), 'Agents')
  assert.equal([...f.declarations.values()].some(d => d.name === 'sidebar.footer.action'), false)
  for (const mode of ['agent', 'bot']) {
    f.actions.setSurface(mode)
    f.select()
    assert.equal(f.mode, 'bot')
    assert.equal(f.panel, null, 'the launcher must not leave a blank custom panel selected')
    assert.deepEqual(f.calls.slice(-2), [['mode', 'bot'], ['panel', null]])
  }
  dispose()
  assert.equal(f.entries.size, 0)
  assert.equal(f.declarations.size, 0)
})

test('disabling and re-enabling the plugin leaves exactly one menu entry and panel', () => {
  const f = fixture()
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const dispose = f.installBotEntry(f.ctx, f.actions, f.surface)
    f.mount('main')
    f.mount('sidebar.panellist')
    assert.equal(f.entries.size, 2)
    dispose()
    assert.equal(f.entries.size, 0)
  }
  // Disable before the shell declares either slot: no delayed entry may appear.
  f.installBotEntry(f.ctx, f.actions, f.surface)()
  f.mount('main')
  f.mount('sidebar.panellist')
  assert.equal(f.entries.size, 0)
})

test('the menu label follows the shell language without re-registering the entry', () => {
  const f = fixture()
  f.installBotEntry(f.ctx, f.actions, f.surface)
  f.mount('sidebar.panellist')
  const entry = f.entries.get(`sidebar.panellist:${f.BOT_PANEL_ID}`)
  const dictionaries = new Map()
  const off = f.installLocale({
    register: (namespace, language, dictionary) => { dictionaries.set(language, dictionary); return () => dictionaries.delete(language) },
    bind: () => key => dictionaries.get('zh')?.[key] ?? key,
    getLocale: () => ({ active: 'zh' }),
  })
  assert.equal(entry.options.label(), '智能体')
  off()
  assert.equal(entry.options.label(), 'Agents')
})

test('the displayed package name is exported in both languages without changing its identity', () => {
  const manifest = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.equal(manifest.name, 'ds-bot')
  assert.ok(manifest.files.includes('locale/'))
  for (const language of ['en', 'zh']) {
    const resource = new URL(import.meta.resolve(`ds-bot/locale/${language}.json`))
    assert.equal(JSON.parse(readFileSync(resource, 'utf8')).meta.title, 'mfx-ds-bot')
  }
})

test('the upper return entry exists only in Bot mode and opens the classic draft', () => {
  const f = fixture()
  const off = f.installBotEntry(f.ctx, f.actions, f.surface)
  f.mount('main')
  f.mount('sidebar.panellist')
  f.select()
  assert.equal(f.entries.size, 4)
  assert.equal(f.entries.get(`sidebar.panellist:${f.AGENT_PANEL_ID}`).options.label(), 'Back to classic Agent')
  f.select(f.AGENT_PANEL_ID)
  assert.equal(f.mode, 'agent')
  assert.equal(f.panel, null)
  assert.deepEqual(f.calls.slice(-3), [['mode', 'agent'], ['panel', null], ['startSession']])
  assert.equal(f.entries.size, 2)
  f.select()
  assert.equal(f.entries.size, 4)
  off()
  assert.equal(f.entries.size + f.listeners.size + f.events.size + f.panels.size, 0)
})

test('confirmed native navigation exits Bot mode without clearing or opening any session', () => {
  const f = fixture()
  f.installBotEntry(f.ctx, f.actions, f.surface)
  f.mount('main')
  f.mount('sidebar.panellist')
  for (const target of ['websites', 'automations', 'plugins', 'workbench', 'settings', 'conversation']) {
    f.select()
    f.calls.length = 0
    f.events.get('maofuxing-ui/native-navigation')(target)
    assert.equal(f.mode, 'agent')
    assert.deepEqual(f.calls, [['mode', 'agent']])
  }
})

test('other standard panels exit Bot mode while its own launchers keep working', () => {
  const f = fixture()
  f.installBotEntry(f.ctx, f.actions, f.surface)
  f.mount('main')
  f.mount('sidebar.panellist')
  f.select()
  assert.equal(f.mode, 'bot')
  f.ctx.layout.selectPanel('plugins')
  assert.equal(f.mode, 'agent')
  assert.equal(f.panel, 'plugins')
  f.select()
  assert.equal(f.mode, 'bot')
})

test('native integration removes the duplicate return item, including when it appears late', () => {
  const f = fixture()
  let integrated = false
  const listeners = new Set()
  const shell = { getSnapshot: () => ({ integrated }), subscribe: fn => { listeners.add(fn); return () => listeners.delete(fn) } }
  const stop = f.installBotEntry(f.ctx, f.actions, f.surface, shell)
  f.mount('main')
  f.mount('sidebar.panellist')
  f.select()
  assert.equal(f.entries.size, 4)
  integrated = true
  listeners.forEach(fn => fn())
  assert.equal(f.entries.size, 2)
  assert.equal(f.entries.has(`sidebar.panellist:${f.AGENT_PANEL_ID}`), false)
  integrated = false
  listeners.forEach(fn => fn())
  assert.equal(f.entries.size, 4)
  stop()
  assert.equal(listeners.size, 0)
})

test('optional native connection publishes the active entry and releases it on unload', () => {
  const f = fixture()
  const calls = []
  let attach
  let teardown
  const client = { register: id => {
    assert.equal(id, f.BOT_PANEL_ID)
    return { setActive: active => calls.push(active), dispose: () => calls.push('disposed') }
  } }
  const stop = f.installNativeShell({ inject: (names, callback) => {
    assert.equal(names[0], 'maofuxingConversation')
    attach = () => callback({ maofuxingConversation: client, effect: run => { teardown = run() } })
    return { dispose: () => teardown?.() }
  } }, f.surface, connected => calls.push(connected === client ? 'connected' : 'disconnected'))
  assert.deepEqual(calls, [], 'ordinary DSH stays usable while this optional service is absent')
  attach()
  f.actions.setSurface('bot')
  f.actions.setSurface('agent')
  stop()
  f.actions.setSurface('bot')
  assert.deepEqual(calls, ['connected', false, true, false, 'disposed', 'disconnected'])
})
