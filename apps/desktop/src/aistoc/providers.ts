import type { CustomEndpointApiMode, CustomEndpointUpdate } from '@/types/hermes'

import brand from '../../../../aistoc/branding/brand.json'

export interface AistocPreset {
  id: string
  name: string
  baseUrl: string
  model: string
  apiMode: CustomEndpointApiMode
  docsUrl: string
}

export const AISTOC_PRESETS: readonly AistocPreset[] = brand.providers.map(provider => ({
  id: provider.id,
  name: provider.name,
  baseUrl: provider.baseUrl,
  model: provider.model,
  apiMode: provider.apiMode as CustomEndpointApiMode,
  docsUrl: provider.docsUrl
}))

export function presetToEndpoint(preset: AistocPreset, apiKey: string): CustomEndpointUpdate {
  return {
    name: preset.name,
    base_url: preset.baseUrl,
    model: preset.model,
    api_key: apiKey,
    api_mode: preset.apiMode,
    discover_models: true,
    make_default: true
  }
}
