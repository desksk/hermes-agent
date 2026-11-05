import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadBrand } from '../branding/brand.mjs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const CACHE = path.join(ROOT, 'aistoc', '.build-cache', 'brand-copy')

export function rewriteBrandText(text, brand) {
  return text
    .replace(/\bNous Research\b/g, brand.name)
    .replace(/\bHermes\b/g, brand.name)
}

function targets() {
  const i18n = path.join(ROOT, 'apps', 'desktop', 'src', 'i18n')
  // Every locale, not just en/zh: the shipped app can switch languages, and a
  // leftover "Hermes Agent" is visible product naming, not a translation.
  const files = fs.readdirSync(i18n)
    .filter(name => name.endsWith('.ts'))
    .map(name => path.join(i18n, name))
  files.push(path.join(ROOT, 'apps', 'desktop', 'index.html'))
  files.push(path.join(ROOT, 'apps', 'desktop', 'src', 'components', 'chat', 'intro-copy.jsonl'))
  return files
}

export function applyBrand() {
  const brand = loadBrand()
  fs.mkdirSync(CACHE, { recursive: true })
  for (const file of targets()) {
    const rel = path.relative(ROOT, file).replaceAll(path.sep, '__')
    fs.copyFileSync(file, path.join(CACHE, rel))
    const before = fs.readFileSync(file, 'utf8')
    fs.writeFileSync(file, rewriteBrandText(before, brand))
  }
}

export function restoreBrand() {
  if (!fs.existsSync(CACHE)) return
  for (const cached of fs.readdirSync(CACHE)) {
    const file = path.join(ROOT, cached.replaceAll('__', path.sep))
    fs.copyFileSync(path.join(CACHE, cached), file)
  }
  fs.rmSync(CACHE, { recursive: true, force: true })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'restore') restoreBrand()
  else applyBrand()
}
