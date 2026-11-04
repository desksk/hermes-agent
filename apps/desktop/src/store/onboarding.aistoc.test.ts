import { beforeEach, describe, expect, it, vi } from 'vitest'

import type * as HermesApi from '@/hermes'

import { saveAistocEndpoint } from './onboarding'

vi.mock('@/hermes', async importOriginal => {
  const actual = await importOriginal<typeof HermesApi>()

  return {
    ...actual,
    validateCustomEndpoint: vi.fn(),
    saveCustomEndpoint: vi.fn(),
    activateCustomEndpoint: vi.fn()
  }
})

import { activateCustomEndpoint, saveCustomEndpoint, validateCustomEndpoint } from '@/hermes'

describe('saveAistocEndpoint', () => {
  beforeEach(() => vi.clearAllMocks())

  it('validates, saves and activates the endpoint', async () => {
    vi.mocked(validateCustomEndpoint).mockResolvedValue({ ok: true, reachable: true, message: '', models: ['deepseek-chat'] })
    vi.mocked(saveCustomEndpoint).mockResolvedValue({
      ok: true,
      id: 'deepseek',
      endpoints: [],
      current: { base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', provider: 'deepseek' }
    })
    vi.mocked(activateCustomEndpoint).mockResolvedValue({ ok: true, provider: 'deepseek', model: 'deepseek-chat' })

    const result = await saveAistocEndpoint(
      { name: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', api_key: 'sk', make_default: true },
      { requestGateway: async () => undefined as never }
    )

    expect(result.ok).toBe(true)
    expect(saveCustomEndpoint).toHaveBeenCalled()
    expect(activateCustomEndpoint).toHaveBeenCalledWith('deepseek', undefined)
  })

  it('returns the probe message when validation fails', async () => {
    vi.mocked(validateCustomEndpoint).mockResolvedValue({ ok: false, reachable: false, message: '证书无效', models: [] })

    const result = await saveAistocEndpoint(
      { name: 'x', base_url: 'https://x', model: 'm' },
      { requestGateway: async () => undefined as never }
    )

    expect(result).toEqual({ ok: false, message: '证书无效' })
  })
})
