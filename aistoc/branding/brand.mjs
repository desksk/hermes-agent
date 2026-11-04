import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const BRAND_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), 'brand.json')

export function loadBrand(file = BRAND_PATH) {
  const brand = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const key of ['name', 'productName', 'appId', 'appSlug', 'appNamePascal', 'userDataName']) {
    if (typeof brand[key] !== 'string' || brand[key].length === 0) {
      throw new Error(`brand.json: missing ${key}`)
    }
  }
  if (!Array.isArray(brand.providers) || brand.providers.length === 0) {
    throw new Error('brand.json: providers must be a non-empty array')
  }
  return brand
}

export function providerPresets(brand) {
  return brand.providers.map(provider => ({
    ...provider,
    extraHeaders: provider.extraHeaders ?? {},
    sslVerify: provider.sslVerify ?? true,
    sslCaCert: provider.sslCaCert ?? ''
  }))
}
