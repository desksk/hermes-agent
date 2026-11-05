import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

// Build-time catalog snapshots for the offline (AISTOC) distribution.
//
// The upstream docs site publishes plugins.json/skills.json from the checkout's
// own plugin-catalog/*.yaml and SKILL.md files, so generating them locally is
// the same data without a network dependency. Falls back to the hosted copy
// only when local extraction cannot run (e.g. no Python with ruamel.yaml).
const BASE = 'https://nousresearch.github.io/hermes-agent/docs/api'
const OUT = path.resolve('apps/desktop/public/aistoc-catalog')
const STATIC_API = path.resolve('website/static/api')
const EXTRACTORS = {
  plugins: path.resolve('website/scripts/extract-plugins.py'),
  skills: path.resolve('website/scripts/extract-skills.py')
}

function pythonWithRuamel() {
  const candidates = [
    process.env.AISTOC_CATALOG_PYTHON,
    process.env.HERMES_PYTHON,
    path.resolve('.venv/Scripts/python.exe'),
    path.resolve('.venv/bin/python'),
    'python3',
    'python'
  ].filter(Boolean)

  for (const candidate of candidates) {
    if (candidate.includes('/') || candidate.includes('\\')) {
      if (!existsSync(candidate)) continue
    }

    try {
      execFileSync(candidate, ['-c', 'import ruamel.yaml'], { stdio: 'ignore' })
      return candidate
    } catch {
      // try the next interpreter
    }
  }

  throw new Error('no Python with ruamel.yaml found for catalog extraction')
}

async function generateLocally(kind) {
  execFileSync(pythonWithRuamel(), [EXTRACTORS[kind]], { cwd: path.resolve('.'), stdio: 'inherit' })
  return fs.readFile(path.join(STATIC_API, `${kind}.json`), 'utf8')
}

async function fetchUpstream(kind) {
  const response = await fetch(`${BASE}/${kind}.json`)
  if (!response.ok) throw new Error(`${kind}.json: HTTP ${response.status}`)
  return response.text()
}

await fs.mkdir(OUT, { recursive: true })
for (const kind of ['plugins', 'skills']) {
  let body
  try {
    body = await generateLocally(kind)
    console.log(`generated ${kind}.json from the checkout`)
  } catch (error) {
    console.warn(`local ${kind}.json extraction failed (${error.message}); fetching upstream`)
    body = await fetchUpstream(kind)
  }
  await fs.writeFile(path.join(OUT, `${kind}.json`), body)
  console.log(`cached ${kind}.json`)
}
