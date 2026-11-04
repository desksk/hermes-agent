import fs from 'node:fs/promises'
import path from 'node:path'

const BASE = 'https://nousresearch.github.io/hermes-agent/docs/api'
const OUT = path.resolve('apps/desktop/public/aistoc-catalog')

await fs.mkdir(OUT, { recursive: true })
for (const kind of ['plugins', 'skills']) {
  const response = await fetch(`${BASE}/${kind}.json`)
  if (!response.ok) throw new Error(`${kind}.json: HTTP ${response.status}`)
  await fs.writeFile(path.join(OUT, `${kind}.json`), await response.text())
  console.log(`cached ${kind}.json`)
}
