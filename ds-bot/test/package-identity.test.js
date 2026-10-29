import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { test } from 'node:test'

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const require = createRequire(new URL('../package.json', import.meta.url))

test('the install bundle resolves every plugin from the independently published package', () => {
  assert.equal(pkg.name, '@maofuxing/mfx-ds-bot')
  assert.match(pkg.version, /^\d+\.\d+\.\d+$/)
  assert.equal(pkg.repository.url, 'git+https://github.com/CJLLL/mfx-ds-bot.git')
  assert.equal(pkg.repository.directory, 'ds-bot')
  const patch = readFileSync(new URL(`../${pkg.dsh.bundle.patch}`, import.meta.url), 'utf8')
  const modules = [...patch.matchAll(/^\s+name: "([^"\n]+)"$/gm)].map(match => match[1])
  assert.deepEqual(modules, ['@maofuxing/mfx-ds-bot', '@maofuxing/mfx-ds-bot/web-search'])
  for (const specifier of modules) assert.equal(existsSync(require.resolve(specifier)), true)
  assert.match(patch, /id: bot\b/)
  assert.match(patch, /id: web-search-auto\b/)
  assert.equal(pkg.dsh.client.platform, 'web')
  assert.equal(existsSync(require.resolve(`${pkg.name}/client`)), true)
})
