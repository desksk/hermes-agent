import assert from 'node:assert/strict'
import test from 'node:test'

import { rewriteBrandText } from './apply-brand.mjs'

test('rewrites standalone Hermes but not identifiers', () => {
  assert.equal(rewriteBrandText('Hermes 正在启动', { name: 'AISTOC' }), 'AISTOC 正在启动')
  assert.equal(rewriteBrandText('HermesDesktop', { name: 'AISTOC' }), 'HermesDesktop')
  assert.equal(rewriteBrandText('Hermes Agent', { name: 'AISTOC' }), 'AISTOC Agent')
})

test('rewrites Nous Research but leaves URLs untouched', () => {
  assert.equal(rewriteBrandText('Nous Research Inc.', { name: 'AISTOC' }), 'AISTOC Inc.')
  assert.equal(
    rewriteBrandText('https://nousresearch.github.io/hermes-agent', { name: 'AISTOC' }),
    'https://nousresearch.github.io/hermes-agent'
  )
})
