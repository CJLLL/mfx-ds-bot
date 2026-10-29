import { BOT_PANEL_ID } from './bot-entry.js'

// Let a closing Bot dialog release its modal stack before the native shell opens.
export function openNativeSettings(ctx, fallback, onboardingId) {
  if (!ctx.get('maofuxingSettings')) { fallback(); return }
  requestAnimationFrame(() => {
    const settings = ctx.get('maofuxingSettings')
    if (!settings) { fallback(); return }
    if (onboardingId !== undefined) settings.openOnboarding(onboardingId)
    else settings.open()
  })
}

// Optional Maofuxing contract; ordinary DSH keeps the standalone Bot shell.
export function installNativeShell(ctx, surface, connect) {
  const fiber = ctx.inject(['maofuxingConversation'], scope => {
    scope.effect(() => {
      const client = scope.maofuxingConversation
      const entry = client.register(BOT_PANEL_ID)
      connect(client)
      const sync = () => entry.setActive(surface.getSnapshot().mode === 'bot')
      const stop = surface.subscribe(sync)
      sync()
      return () => { stop(); entry.dispose(); connect(null) }
    }, 'ds-bot: native conversation surface')
  })
  return () => fiber.dispose()
}

export const NATIVE_SIDEBAR_CSS = `
.bt-side.bt-native-side{--bt-ink:var(--dsw-alias-label-primary);--bt-ink-2:var(--dsw-alias-label-secondary);--bt-ink-3:var(--dsw-alias-label-tertiary);--bt-hover:var(--dsw-alias-interactive-bg-hover);--bt-active:var(--dsw-alias-interactive-bg-hover);box-sizing:border-box;display:flex;flex-direction:column;gap:0;padding:8px 0 0;margin:0;min-height:0;font-family:inherit;color:var(--bt-ink)}
.bt-native-tools{display:flex;align-items:center;gap:2px;min-height:38px;padding:0 4px;margin-bottom:4px}
.bt-native-tools .bt-native-back{display:inline-flex;align-items:center;gap:4px;min-width:0;margin-right:auto;padding:0 4px;width:auto;font-size:12px;white-space:nowrap}
.bt-native-tool,.bt-native-tools .bt-round{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;flex:none;padding:0;border:0;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;box-shadow:none}
.bt-native-tool svg,.bt-native-tools .bt-round svg{width:14px;height:14px}
.bt-native-tool:hover,.bt-native-tools .bt-round:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.bt-native-tool:focus-visible,.bt-native-side .bt-row:focus-visible{outline:2px solid var(--mfx-workspace-focus);outline-offset:2px}
.bt-side.bt-native-side>.bt-list{flex:none;overflow:visible;gap:2px;margin:0;scrollbar-gutter:auto}
.bt-native-side .bt-row{gap:8px;min-height:50px;padding:6px 8px;border-radius:8px;font-family:inherit}
.bt-native-side .bt-row[aria-current=page]{background:var(--dsw-alias-interactive-bg-hover)}
.bt-native-side .bt-row-name{gap:6px;font-size:var(--mfx-sidebar-item-font-size,13px);font-weight:400;line-height:20px}
.bt-native-side .bt-row-preview{font-size:12px;line-height:18px}
.bt-native-main{flex:none;margin-left:auto;color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:16px}
.bt-native-side .bt-agent-ava{width:28px;height:28px;border-radius:8px}
.bt-side.bt-native-side.bt-rail{gap:4px;padding-top:8px}
.bt-native-side.bt-rail .bt-native-tools{flex-direction:column;margin:0;padding:0;gap:4px}
.bt-native-side.bt-rail .bt-native-back{width:28px;margin:0;padding:0}
.bt-native-side.bt-rail .bt-row{min-height:36px;padding:4px;justify-content:center}
.bt-native-side.bt-rail>.bt-list{width:100%}
.bt-menu.bt-native-menu{width:216px;min-width:0;max-width:calc(100vw - 16px);padding:5px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font-family:inherit;box-shadow:0 6px 20px color-mix(in srgb,var(--dsw-alias-label-primary) 10%,transparent)}
.bt-native-menu button{min-height:32px;gap:8px;padding:6px 8px;color:var(--dsw-alias-label-primary);font-size:13px;font-weight:400;line-height:20px}
.bt-native-menu button:hover{background:var(--dsw-alias-interactive-bg-hover)}
.bt-native-menu button:focus-visible{outline:2px solid var(--mfx-workspace-focus);outline-offset:-2px}
.bt-native-menu button svg{width:14px;height:14px;color:var(--dsw-alias-label-secondary)}
`
