import { describe, expect, it } from 'vitest'

import { catalogBaseUrl } from './catalog-data'

describe('AISTOC catalog base', () => {
  it('uses the bundled snapshot directory in branded builds', () => {
    expect(catalogBaseUrl(true)).toBe('./aistoc-catalog')
    expect(catalogBaseUrl(false)).toBe('https://nousresearch.github.io/hermes-agent/docs/api')
  })
})
