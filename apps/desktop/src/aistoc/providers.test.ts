import { describe, expect, it } from 'vitest'

import { AISTOC_PRESETS, presetToEndpoint } from './providers'

describe('AISTOC presets', () => {
  it('exposes the five vendor presets', () => {
    expect(AISTOC_PRESETS.map(p => p.id)).toEqual(['deepseek', 'qwen', 'zhipu', 'doubao', 'kimi'])
  })

  it('maps a preset to a custom endpoint payload', () => {
    const endpoint = presetToEndpoint(AISTOC_PRESETS[0], 'sk-test')
    expect(endpoint.base_url).toBe('https://api.deepseek.com/v1')
    expect(endpoint.model).toBe('deepseek-chat')
    expect(endpoint.api_key).toBe('sk-test')
    expect(endpoint.api_mode).toBe('chat_completions')
  })
})
