import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const identityPath = require.resolve('../../apps/desktop/product-identity.cjs')

function freshIdentity() {
  delete require.cache[identityPath]
  return require(identityPath)
}

test('bundled variant uses the AISTOC identity', () => {
  process.env.HERMES_DESKTOP_VARIANT = 'bundled'
  process.env.AISTOC_BRAND = '1'
  const identity = freshIdentity()
  assert.equal(identity.displayName, 'AISTOC Agent')
  assert.equal(identity.appId, 'com.aistoc.agent')
  assert.equal(identity.userDataName, 'AISTOC Agent')
  assert.equal(identity.channel, null)
  delete process.env.AISTOC_BRAND
  delete process.env.HERMES_DESKTOP_VARIANT
})

test('without the brand switch the upstream identity is unchanged', () => {
  process.env.HERMES_DESKTOP_VARIANT = 'bundled'
  delete process.env.AISTOC_BRAND
  const identity = freshIdentity()
  assert.equal(identity.displayName, 'Hermes Agent')
  assert.equal(identity.appId, 'com.nousresearch.hermes-bundled')
  delete process.env.HERMES_DESKTOP_VARIANT
})
