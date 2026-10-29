import { createElement as h, useLayoutEffect } from 'react'
import { t } from './i18n.js'
import { ChevronLeftIcon, PeopleIcon } from './icons.js'

export const BOT_PANEL_ID = 'mfx-ds-bot'
export const AGENT_PANEL_ID = 'mfx-ds-bot-classic'

export function BotEntryIcon({ size = 18 }) {
  return h('span', { 'aria-hidden': true, style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: size, height: size } }, h(PeopleIcon))
}

function BotEntryPanel({ openBot }) {
  useLayoutEffect(() => { openBot() }, [openBot])
  return null
}

// The shell owns the menu button and its page-leave guard. This short-lived
// destination enters the existing Bot conversation instead of cloning its UI.
export function installBotEntry(ctx, actions, surface, shell) {
  const openBot = () => {
    actions.setSurface('bot')
    ctx.layout.selectPanel(null)
  }
  const offPanel = ctx.slots.inject('main', () => ctx.slots.register({
    name: 'main', key: BOT_PANEL_ID, inject: () => ({ openBot }),
  }, BotEntryPanel))
  const offEntry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: BOT_PANEL_ID, order: 0, label: () => t('Agents'),
  }, BotEntryIcon))
  let offClassic
  const sync = () => {
    if (surface.getSnapshot().mode !== 'bot' || shell?.getSnapshot().integrated) {
      offClassic?.()
      offClassic = undefined
      return
    }
    if (offClassic) return
    const panel = ctx.slots.inject('main', () => ctx.slots.register({
      name: 'main', key: AGENT_PANEL_ID, inject: () => ({ openBot: () => {
        actions.setSurface('agent')
        ctx.layout.selectPanel(null)
        ctx.uiWorkspace.startSession()
      } }),
    }, BotEntryPanel))
    const entry = ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
      name: 'sidebar.panellist', id: AGENT_PANEL_ID, order: 1, label: () => t('Back to classic Agent'),
    }, ChevronLeftIcon))
    offClassic = () => { entry(); panel() }
  }
  const stop = surface.subscribe(sync)
  const stopShell = shell?.subscribe(sync)
  sync()
  const offNative = ctx.on('maofuxing-ui/native-navigation', () => actions.setSurface('agent'))
  // Standard DSH panels also need their own UI, including outside Maofuxing.
  const offLayout = ctx.layout.panelInfo.subscribe(() => {
    const id = ctx.layout.panelInfo.getSnapshot().activePanelId
    if (id !== null && id !== BOT_PANEL_ID && id !== AGENT_PANEL_ID) actions.setSurface('agent')
  })
  return () => { offNative(); offLayout(); stop(); stopShell?.(); offClassic?.(); offEntry(); offPanel() }
}
