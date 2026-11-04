import assert from 'node:assert/strict'
import test from 'node:test'

import { loadBrand, providerPresets } from './brand.mjs'

test('loadBrand returns the AISTOC identity', () => {
  const brand = loadBrand()
  assert.equal(brand.name, 'AISTOC')
  assert.equal(brand.productName, 'AISTOC Agent')
  assert.equal(brand.appId, 'com.aistoc.agent')
  assert.equal(brand.defaultLocale, 'zh')
})

test('providerPresets includes the five requested vendors', () => {
  const ids = providerPresets(loadBrand()).map(p => p.id)
  assert.deepEqual(ids, ['deepseek', 'qwen', 'zhipu', 'doubao', 'kimi'])
})

test('every preset has a base URL and model', () => {
  for (const preset of providerPresets(loadBrand())) {
    assert.ok(preset.baseUrl.startsWith('https://'), `${preset.id} baseUrl`)
    assert.ok(preset.model.length > 0, `${preset.id} model`)
  }
})
