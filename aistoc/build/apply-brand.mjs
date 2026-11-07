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

function sourceFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules' && entry.name !== 'dist') sourceFiles(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name)) {
      out.push(full)
    }
  }
  return out
}

function targets() {
  const files = new Set()
  const i18n = path.join(ROOT, 'apps', 'desktop', 'src', 'i18n')
  // Every locale, not just en/zh: the shipped app can switch languages, and a
  // leftover "Hermes Agent" is visible product naming, not a translation.
  for (const name of fs.readdirSync(i18n)) {
    if (name.endsWith('.ts')) files.add(path.join(i18n, name))
  }
  files.add(path.join(ROOT, 'apps', 'desktop', 'index.html'))
  files.add(path.join(ROOT, 'apps', 'desktop', 'src', 'components', 'chat', 'intro-copy.jsonl'))
  // Product naming also lives in hardcoded component copy and electron window
  // titles, not only in the i18n tables. `\bHermes\b` cannot touch identifiers
  // such as HermesGateway or useHermesConfig, so the whole source tree is safe.
  for (const dir of ['src', 'electron']) {
    for (const file of sourceFiles(path.join(ROOT, 'apps', 'desktop', dir))) files.add(file)
  }
  return [...files]
}

function cachePath(file) {
  return path.join(CACHE, path.relative(ROOT, file))
}

export function applyBrand() {
  const brand = loadBrand()
  for (const file of targets()) {
    const cached = cachePath(file)
    fs.mkdirSync(path.dirname(cached), { recursive: true })
    fs.copyFileSync(file, cached)
    fs.writeFileSync(file, rewriteBrandText(fs.readFileSync(file, 'utf8'), brand))
  }
}

export function restoreBrand() {
  if (!fs.existsSync(CACHE)) return
  const restoreTree = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) restoreTree(full)
      else fs.copyFileSync(full, path.join(ROOT, path.relative(CACHE, full)))
    }
  }
  for (const entry of fs.readdirSync(CACHE, { withFileTypes: true })) {
    const full = path.join(CACHE, entry.name)
    if (entry.isDirectory()) {
      restoreTree(full)
    } else {
      // Flat legacy cache from before the tree layout: separators were
      // encoded as "__".
      fs.copyFileSync(full, path.join(ROOT, entry.name.replaceAll('__', path.sep)))
    }
  }
  fs.rmSync(CACHE, { recursive: true, force: true })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === 'restore') restoreBrand()
  else applyBrand()
}
