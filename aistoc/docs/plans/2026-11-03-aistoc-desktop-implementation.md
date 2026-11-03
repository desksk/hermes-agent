# AISTOC Agent 桌面发行版 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 `NousResearch/hermes-agent` 打包成品牌为 AISTOC、完全离线安装、带首启模型配置向导的 Windows 桌面应用。

**Architecture:** 以 `aistoc/` 目录集中全部定制；对上游只做最小入口补丁。构建时把 Electron 桌面端与完整 Python 运行时载荷打包成 NSIS 单文件安装器；首启向导复用现有 onboarding overlay，新增厂商预设与高级端点字段。

**Tech Stack:** Electron + React + TypeScript + Vite（桌面端）、Python 3.14 + FastAPI（Agent 后端）、electron-builder + NSIS（Windows 打包）、Pillow（图标生成）、vitest（前端测试）、pytest（后端测试）。

**Spec:** `aistoc/docs/specs/2026-11-03-aistoc-hermes-desktop-design.md`

---

## 前置约定

- 所有命令从仓库根目录 `E:\Claude\hermes-agent` 执行，除非步骤里显式 `cd`。
- 构建用 Python 固定为 `C:\Python314\python.exe`（上游要求 `>=3.11,<3.15`，本机 3.15 不满足）。
- 定制分支为 `aistoc/main`；每个任务结束提交一次，不推送远程。
- 构建首次需要联网下载 npm 包、CPython 运行时和 Python 依赖；安装与运行不需要。
- 品牌开关统一用环境变量 `AISTOC_BRAND=1`；渲染层用 `import.meta.env.VITE_AISTOC_BRAND === '1'`。
- 上游 `.gitignore` 忽略 `docs/`，因此本项目文档放在 `aistoc/docs/`。

## 文件结构

| 路径 | 职责 |
|---|---|
| `aistoc/branding/brand.json` | 品牌、appId、默认语言、厂商预设的唯一来源 |
| `aistoc/branding/brand.mjs` | 读取并校验品牌配置的 ESM 模块 |
| `aistoc/branding/brand.test.mjs` | 品牌加载器单测 |
| `aistoc/branding/make_icons.py` | 从 `AISTOC.jpg` 生成 ico/png 与桌面端品牌图 |
| `aistoc/branding/icons/` | 生成的图标产物 |
| `aistoc/branding/installer/installer.nsh` | NSIS 自定义宏：管理员权限、安装目录、卸载数据询问 |
| `aistoc/desktop-patch/` | 对上游桌面端的最小补丁说明与测试 |
| `aistoc/build/apply-brand.mjs` | 构建期品牌文案替换与恢复 |
| `aistoc/build/build-installer.ps1` | 一键离线构建安装包 |
| `aistoc/build/verify-installer.ps1` | 产物校验与 SHA256 清单 |
| `aistoc/docs/` | 交付与运维文档 |
| `apps/desktop/product-identity.cjs` | 上游：产品身份派生（打补丁） |
| `apps/desktop/electron/product-identity.ts` | 上游：运行时 userData 固定（打补丁） |
| `apps/desktop/electron-builder.config.cjs` | 上游：打包配置（打补丁，增加 NSIS） |
| `apps/desktop/src/aistoc/AistocSetup.tsx` | 首启向导组件 |
| `apps/desktop/src/aistoc/providers.ts` | 厂商预设的类型与读取 |
| `apps/desktop/src/aistoc/AistocSetup.test.tsx` | 向导组件测试 |
| `apps/desktop/src/store/onboarding.ts` | 上游：首启保存逻辑（新增高级端点保存函数） |
| `hermes_cli/web_models.py` | 上游：自定义端点请求模型（增加高级字段） |
| `hermes_cli/web_routers/config_env.py` | 上游：自定义端点写入与探测（增加高级字段） |

---

## Phase P0：打包验证（先证明能做出来）

### Task 1: 建立构建环境并跑通桌面端开发构建

**Files:**
- 无代码改动

- [ ] **Step 1: 安装 JS 工作区依赖**

Run:
```bash
npm ci
```
Expected: 安装完成，`node_modules/` 存在，无 `ERESOLVE` 错误。

- [ ] **Step 2: 构建桌面端**

Run:
```bash
cd apps/desktop
npm run build
```
Expected: 输出 `dist/`，退出码 0。若报 Electron 原生依赖缺少 MSVC 工具链，先安装 Visual Studio Build Tools（C++ 工作负载）后重试。

- [ ] **Step 3: 记录基线**

Run:
```bash
git rev-parse --short HEAD
node -p "require('./apps/desktop/package.json').devDependencies.electron"
```
Expected: 打印当前 commit 与 `44.9.3`（或上游更新后的 Electron 版本）。

- [ ] **Step 4: 提交环境说明（如有额外安装步骤）**

```bash
git add aistoc/docs
git commit -m "docs: record desktop build prerequisites"
```

### Task 2: 验证 bundled 载荷 + NSIS 能产出可运行安装包

**Files:**
- Modify: `apps/desktop/electron-builder.config.cjs:235-244`
- Create: `aistoc/branding/installer/installer.nsh`

- [ ] **Step 1: 让 Windows 目标可由环境变量切换**

把 `apps/desktop/electron-builder.config.cjs` 中 `win.target` 从写死的 `['msix']` 改为：

```js
const aistocNsis = process.env.AISTOC_NSIS === '1'
...
  win: {
    executableName: windowsExecutableName,
    legalTrademarks: displayName,
    target: aistocNsis ? ['nsis'] : ['msix'],
    extraResources: [{ from: 'scripts/update-relaunch-waiter.ps1', to: 'update-relaunch-waiter.ps1' }],
    ...windowsSigning()
  },
```

并在 `msix` 配置块之后加入：

```js
  nsis: {
    oneClick: false,
    perMachine: true,
    allowElevation: true,
    allowToChangeInstallationDirectory: false,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: displayName,
    installerIcon: 'assets/icon.ico',
    uninstallerIcon: 'assets/icon.ico',
    installerHeaderIcon: 'assets/icon.ico',
    artifactName: 'AISTOC-Setup-${version}-${arch}.${ext}',
    include: '../../aistoc/branding/installer/installer.nsh',
    deleteAppDataOnUninstall: false
  },
```

- [ ] **Step 2: 创建 NSIS 自定义宏**

`aistoc/branding/installer/installer.nsh`：

```nsh
; AISTOC Agent installer overrides.
; perMachine: true gives the UAC prompt; preInit pins the actual install
; directory to the invoking user's LOCALAPPDATA as the product requires.
!macro preInit
  SetShellVarContext current
  StrCpy $INSTDIR "$LOCALAPPDATA\Programs\AISTOC Agent"
!macroend

; Ask before removing user data. Default is "No" (keep data).
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "是否删除 AISTOC Agent 的本地数据（会话、配置、密钥）？选择“否”将保留。" IDNO aistoc_keep_data
  RMDir /r "$APPDATA\AISTOC Agent"
  aistoc_keep_data:
!macroend
```

- [ ] **Step 3: 生成 bundled 载荷**

Run:
```bash
cd apps/desktop
export HERMES_PYTHON="C:/Python314/python.exe"
HERMES_DESKTOP_VARIANT=bundled npm run payload
```
Expected: `build/agent-payload/manifest.json` 存在，载荷目录大小为数百 MB。

- [ ] **Step 4: 打 NSIS 包**

Run:
```bash
cd apps/desktop
export HERMES_PYTHON="C:/Python314/python.exe"
AISTOC_NSIS=1 HERMES_DESKTOP_VARIANT=bundled CSC_IDENTITY_AUTO_DISCOVERY=false npm run builder -- --win nsis --publish never
```
Expected: `release/AISTOC-Setup-<version>-x64.exe` 生成。

- [ ] **Step 5: 在干净 Win10 x64 虚机验证**

断网，双击安装包，确认：
1. 出现 UAC 提权提示
2. 安装目录为 `%LOCALAPPDATA%\Programs\AISTOC Agent`
3. 应用能启动，后端不报缺失 Python
4. 卸载后用户数据默认保留

若 `preInit` 没能改变安装目录，记录实际目录，改用在 Task 4 中完全自定义的 `nsis.script` 方案；不要带病继续。

- [ ] **Step 6: 提交**

```bash
git add apps/desktop/electron-builder.config.cjs aistoc/branding/installer/installer.nsh
git commit -m "build: add AISTOC NSIS packaging target"
```

---

## Phase P1：品牌注入

### Task 3: 品牌配置与加载器

**Files:**
- Create: `aistoc/branding/brand.json`
- Create: `aistoc/branding/brand.mjs`
- Test: `aistoc/branding/brand.test.mjs`

- [ ] **Step 1: 写失败测试**

`aistoc/branding/brand.test.mjs`：

```js
import assert from 'node:assert/strict'
import test from 'node:test'

import { loadBrand, providerPresets } from './brand.mjs'

test('loadBrand returns the AISTOC identity', () => {
  const brand = loadBrand()
  assert.equal(brand.name, 'AISTOC')
  assert.equal(brand.productName, 'AISTOC Agent')
  assert.equal(brand.appId, 'com.aistoc.agent')
  assert.equal(brand.defaultLocale, 'zh')
})

test('providerPresets includes the five requested vendors', () => {
  const ids = providerPresets(loadBrand()).map(p => p.id)
  assert.deepEqual(ids, ['deepseek', 'qwen', 'zhipu', 'doubao', 'kimi'])
})

test('every preset has a base URL and model', () => {
  for (const preset of providerPresets(loadBrand())) {
    assert.ok(preset.baseUrl.startsWith('https://'), `${preset.id} baseUrl`)
    assert.ok(preset.model.length > 0, `${preset.id} model`)
  }
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
node --test aistoc/branding/brand.test.mjs
```
Expected: FAIL，`Cannot find module './brand.mjs'`。

- [ ] **Step 3: 写品牌配置**

`aistoc/branding/brand.json`：

```json
{
  "name": "AISTOC",
  "productName": "AISTOC Agent",
  "appId": "com.aistoc.agent",
  "appSlug": "aistoc",
  "appNamePascal": "AISTOCAgent",
  "artifactNamePascal": "AISTOC",
  "userDataName": "AISTOC Agent",
  "company": "AISTOC",
  "defaultLocale": "zh",
  "protocol": "aistoc",
  "installDirName": "AISTOC Agent",
  "version": "1.0.0",
  "providers": [
    {
      "id": "deepseek",
      "name": "DeepSeek",
      "baseUrl": "https://api.deepseek.com/v1",
      "model": "deepseek-chat",
      "apiMode": "chat_completions",
      "docsUrl": "https://platform.deepseek.com/api_keys"
    },
    {
      "id": "qwen",
      "name": "通义千问",
      "baseUrl": "https://dashscope.aliyuncs.com/compatible-mode/v1",
      "model": "qwen-plus",
      "apiMode": "chat_completions",
      "docsUrl": "https://bailian.console.aliyun.com/"
    },
    {
      "id": "zhipu",
      "name": "智谱 GLM",
      "baseUrl": "https://open.bigmodel.cn/api/paas/v4",
      "model": "glm-4.5",
      "apiMode": "chat_completions",
      "docsUrl": "https://open.bigmodel.cn/usercenter/apikeys"
    },
    {
      "id": "doubao",
      "name": "豆包 / 火山方舟",
      "baseUrl": "https://ark.cn-beijing.volces.com/api/v3",
      "model": "doubao-seed-1-6-250615",
      "apiMode": "chat_completions",
      "docsUrl": "https://console.volcengine.com/ark"
    },
    {
      "id": "kimi",
      "name": "Kimi",
      "baseUrl": "https://api.moonshot.cn/v1",
      "model": "moonshot-v1-8k",
      "apiMode": "chat_completions",
      "docsUrl": "https://platform.moonshot.cn/console/api-keys"
    }
  ]
}
```

- [ ] **Step 4: 写加载器**

`aistoc/branding/brand.mjs`：

```js
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
```

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
node --test aistoc/branding/brand.test.mjs
```
Expected: 3 tests PASS。

- [ ] **Step 6: 提交**

```bash
git add aistoc/branding/brand.json aistoc/branding/brand.mjs aistoc/branding/brand.test.mjs
git commit -m "feat: add AISTOC brand config and provider presets"
```

### Task 4: 产品身份注入

**Files:**
- Modify: `apps/desktop/product-identity.cjs:1-110`
- Modify: `apps/desktop/product-identity.d.cts:1-30`
- Modify: `apps/desktop/electron/product-identity.ts:25-45`
- Test: `aistoc/desktop-patch/product-identity.test.mjs`

- [ ] **Step 1: 写失败测试**

`aistoc/desktop-patch/product-identity.test.mjs`：

```js
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import test from 'node:test'

const require = createRequire(import.meta.url)
const identityPath = require.resolve('../../apps/desktop/product-identity.cjs')

function freshIdentity() {
  delete require.cache[identityPath]
  return require(identityPath)
}

test('bundled variant uses the AISTOC identity', () => {
  process.env.HERMES_DESKTOP_VARIANT = 'bundled'
  process.env.AISTOC_BRAND = '1'
  const identity = freshIdentity()
  assert.equal(identity.displayName, 'AISTOC Agent')
  assert.equal(identity.appId, 'com.aistoc.agent')
  assert.equal(identity.userDataName, 'AISTOC Agent')
  assert.equal(identity.channel, null)
  delete process.env.AISTOC_BRAND
  delete process.env.HERMES_DESKTOP_VARIANT
})

test('without the brand switch the upstream identity is unchanged', () => {
  process.env.HERMES_DESKTOP_VARIANT = 'bundled'
  delete process.env.AISTOC_BRAND
  const identity = freshIdentity()
  assert.equal(identity.displayName, 'Hermes Agent')
  assert.equal(identity.appId, 'com.nousresearch.hermes-bundled')
  delete process.env.HERMES_DESKTOP_VARIANT
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
node --test aistoc/desktop-patch/product-identity.test.mjs
```
Expected: FAIL，`identity.displayName` 仍为 `Hermes Agent`。

- [ ] **Step 3: 修改产品身份派生**

在 `apps/desktop/product-identity.cjs` 顶部加入：

```js
const fs = require('node:fs')
const path = require('node:path')

const brandEnabled = process.env.AISTOC_BRAND === '1'
const brandPath = path.join(__dirname, '..', '..', 'aistoc', 'branding', 'brand.json')
const brand = brandEnabled && fs.existsSync(brandPath)
  ? JSON.parse(fs.readFileSync(brandPath, 'utf8'))
  : null
```

把 `variants.bundled` 改为：

```js
  bundled: brand
    ? { display: brand.productName, kebab: brand.appSlug, pascal: brand.appNamePascal }
    : {
        display: 'Hermes Agent',
        kebab: 'hermes-bundled',
        pascal: 'HermesBundled'
      }
```

把 `identity` 对象中的相关字段改为：

```js
const identity = {
  store,
  light,
  displayName,
  appId: brand ? brand.appId : `com.nousresearch.${name.kebab}${kebabSuffix}`,
  channel: brand ? null : (store || buildCommit ? null : light ? (canary ? 'light-canary' : 'light') : (canary ? 'canary' : 'latest')),
  appNamePascal: `${name.pascal}${pascalSuffix}`,
  artifactNamePascal: brand ? brand.artifactNamePascal : name.pascal,
  windowsExecutableName: brand ? brand.productName : (kebabSuffix ? cliName : displayName),
  cliName: brand ? brand.appSlug : cliName,
  msixAppIdWithOrg: brand ? `AISTOC.${name.pascal}${pascalSuffix}` : `NousResearch.${name.pascal}${pascalSuffix}`,
  userDataName: brand ? brand.userDataName : undefined,
  ...(store
    ? {
        storeMsix: {
          identityName: 'NousResearchInc.HermesAgent',
          publisher: 'CN=EE6D86E4-606F-4E38-B940-AD7248C9D519',
          publisherDisplayName: 'Nous Research Inc.'
        }
      }
    : {})
}
```

- [ ] **Step 4: 更新类型定义**

在 `apps/desktop/product-identity.d.cts` 的 `ProductIdentity` 中加入：

```ts
  /** Electron userData folder name when it must be pinned (branded builds). */
  userDataName?: string
```

- [ ] **Step 5: 固定运行时 userData 目录**

在 `apps/desktop/electron/product-identity.ts` 的 `applyDesktopIdentity` 中，把开头的早退条件改为：

```ts
  if (!identity.token && !identity.userDataName && identity.appNamePascal === identity.artifactNamePascal) {
    return null
  }
```

把 `userData` 路径改为：

```ts
  const userData: string = path.join(app.getPath('appData'), identity.userDataName ?? identity.appNamePascal)
```

- [ ] **Step 6: 运行测试确认通过**

Run:
```bash
node --test aistoc/desktop-patch/product-identity.test.mjs
cd apps/desktop && npx vitest run electron/channel-build-version.test.ts
```
Expected: 新测试全部 PASS；上游身份测试仍 PASS。

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/product-identity.cjs apps/desktop/product-identity.d.cts apps/desktop/electron/product-identity.ts aistoc/desktop-patch/product-identity.test.mjs
git commit -m "feat: inject AISTOC product identity and pin userData"
```

### Task 5: 图标与品牌图生成

**Files:**
- Create: `aistoc/branding/make_icons.py`
- Test: `aistoc/branding/test_make_icons.py`
- Output: `aistoc/branding/icons/icon.ico`, `icon.png`

- [ ] **Step 1: 写失败测试**

`aistoc/branding/test_make_icons.py`：

```python
from pathlib import Path

from PIL import Image

from aistoc.branding.make_icons import make_icons


def test_make_icons_writes_expected_sizes(tmp_path: Path):
    source = Path(__file__).parent.parent.parent / "AISTOC.jpg"
    out = tmp_path / "icons"
    make_icons(source, out)
    assert (out / "icon.png").exists()
    assert (out / "icon.ico").exists()
    png = Image.open(out / "icon.png")
    assert png.size == (512, 512)
    ico = Image.open(out / "icon.ico")
    assert ico.size == (256, 256)
    assert (out / "icon.ico").stat().st_size > 10_000
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
.venv/Scripts/python.exe -m pytest aistoc/branding/test_make_icons.py -v
```
Expected: FAIL，`ModuleNotFoundError`。若 `.venv` 不存在，先按 `CONTRIBUTING.md` 执行：
```bash
C:\Python314\python.exe -m pm.build_env --source . --out .venv --group dev --group test
```

- [ ] **Step 3: 写生成脚本**

`aistoc/branding/make_icons.py`：

```python
"""Generate Windows icons and desktop brand images from the AISTOC logo."""

from __future__ import annotations

import argparse
from pathlib import Path

from PIL import Image

SIZES = (16, 24, 32, 48, 64, 128, 256)


def _square(image: Image.Image, size: int) -> Image.Image:
    canvas = Image.new("RGBA", (size, size), (255, 255, 255, 0))
    copy = image.convert("RGBA")
    copy.thumbnail((size, size), Image.Resampling.LANCZOS)
    left = (size - copy.width) // 2
    top = (size - copy.height) // 2
    canvas.paste(copy, (left, top), copy)
    return canvas


def make_icons(source: Path, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    image = Image.open(source)
    _square(image, 512).save(out_dir / "icon.png")
    _square(image, 256).save(out_dir / "icon.ico", sizes=[(s, s) for s in SIZES])


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", type=Path, default=Path("AISTOC.jpg"))
    parser.add_argument("--out", type=Path, default=Path("aistoc/branding/icons"))
    args = parser.parse_args()
    make_icons(args.source, args.out)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 运行测试确认通过**

Run:
```bash
.venv/Scripts/python.exe -m pytest aistoc/branding/test_make_icons.py -v
```
Expected: PASS。

- [ ] **Step 5: 生成实际图标**

Run:
```bash
.venv/Scripts/python.exe aistoc/branding/make_icons.py
```
Expected: `aistoc/branding/icons/icon.ico` 与 `icon.png` 存在，`icon.ico` 大于 10 KB。

- [ ] **Step 6: 提交**

```bash
git add aistoc/branding/make_icons.py aistoc/branding/test_make_icons.py aistoc/branding/icons
git commit -m "feat: generate AISTOC icons from the logo"
```

### Task 6: 构建期品牌文案替换

**Files:**
- Create: `aistoc/build/apply-brand.mjs`
- Test: `aistoc/build/apply-brand.test.mjs`
- Modify: `apps/desktop/src/components/update-status.tsx:328`
- Modify: `apps/desktop/src/app/settings/about-settings.tsx:59-66`
- Modify: `apps/desktop/src/i18n/languages.ts:15`

- [ ] **Step 1: 写失败测试**

`aistoc/build/apply-brand.test.mjs`：

```js
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
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
node --test aistoc/build/apply-brand.test.mjs
```
Expected: FAIL，模块不存在。

- [ ] **Step 3: 写替换与恢复脚本**

`aistoc/build/apply-brand.mjs`：

```js
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
  const files = fs.readdirSync(i18n)
    .filter(name => /^(en|zh)/.test(name) && name.endsWith('.ts'))
    .map(name => path.join(i18n, name))
  files.push(path.join(ROOT, 'apps', 'desktop', 'index.html'))
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
```

- [ ] **Step 4: 隐藏更新卡片**

在 `apps/desktop/src/components/update-status.tsx` 的 `UpdateStatusCard` 函数体开头加入：

```tsx
  if (import.meta.env.VITE_AISTOC_BRAND === '1') {
    return null
  }
```

- [ ] **Step 5: 关于页隐藏更新区**

在 `apps/desktop/src/app/settings/about-settings.tsx` 的 `AppUpdatesSettings` 中，把更新区块包起来：

```tsx
      {import.meta.env.VITE_AISTOC_BRAND !== '1' && (
        <>
          <SectionHeading icon={RefreshCw} title={t.settings.about.updates} />
          <div className="grid gap-3" id={settingElementId(SETTING_IDS.about.updates)}>
            <UpdateStatusCard target="client" version={version} />
            <UpdateChannelRow />
            {remote && <UpdateStatusCard showReleaseNotes={false} target="backend" version={version} />}
          </div>
        </>
      )}
```

- [ ] **Step 6: 默认语言改为中文**

把 `apps/desktop/src/i18n/languages.ts:15` 改为：

```ts
export const DEFAULT_LOCALE: BundledLocale =
  import.meta.env.VITE_AISTOC_BRAND === '1' ? 'zh' : 'en'
```

- [ ] **Step 7: 运行测试与类型检查**

Run:
```bash
node --test aistoc/build/apply-brand.test.mjs
cd apps/desktop && npm run typecheck
```
Expected: 测试 PASS，typecheck 退出码 0。

- [ ] **Step 8: 提交**

```bash
git add aistoc/build/apply-brand.mjs aistoc/build/apply-brand.test.mjs apps/desktop/src/components/update-status.tsx apps/desktop/src/app/settings/about-settings.tsx apps/desktop/src/i18n/languages.ts
git commit -m "feat: apply AISTOC brand copy and default Chinese locale"
```

---

## Phase P2：离线与模型接入

### Task 7: 离线默认配置（关闭更新检查与远程模型目录）

**Files:**
- Modify: `hermes_cli/config_defaults.py:2346-2352`
- Modify: `hermes_cli/config_defaults.py:2022-2034`
- Test: `tests/hermes_cli/test_aistoc_defaults.py`

- [ ] **Step 1: 写失败测试**

`tests/hermes_cli/test_aistoc_defaults.py`：

```python
from hermes_cli.config_defaults import DEFAULT_CONFIG


def test_updates_disabled_for_offline_distribution():
    assert DEFAULT_CONFIG["updates"]["check"] is False


def test_remote_model_catalog_disabled():
    assert DEFAULT_CONFIG["model_catalog"]["enabled"] is False


def test_telemetry_stays_off():
    metrics = DEFAULT_CONFIG["telemetry"]["shared_metrics"]
    assert metrics["enabled"] is False
    assert metrics["send"] is False
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
.venv/Scripts/python.exe -m pytest tests/hermes_cli/test_aistoc_defaults.py -v
```
Expected: FAIL（`updates.check` 为 True）。

- [ ] **Step 3: 修改默认值**

在 `hermes_cli/config_defaults.py` 中：

```python
    "updates": {
        # AISTOC offline distribution: never phone home for updates.
        "check": False,
```

```python
    "model_catalog": {
        # AISTOC offline distribution: use the in-repo snapshot only.
        "enabled": False,
        "url": "https://hermes-agent.nousresearch.com/docs/api/model-catalog.json",
```

- [ ] **Step 4: 运行测试确认通过**

Run:
```bash
.venv/Scripts/python.exe -m pytest tests/hermes_cli/test_aistoc_defaults.py -v
```
Expected: 3 tests PASS。

- [ ] **Step 5: 提交**

```bash
git add hermes_cli/config_defaults.py tests/hermes_cli/test_aistoc_defaults.py
git commit -m "feat: default offline distribution to no update checks or remote catalog"
```

### Task 8: 本地化插件/技能目录

**Files:**
- Modify: `apps/desktop/src/app/capabilities/catalog/catalog-data.ts:52`
- Create: `aistoc/build/fetch-catalog-snapshots.mjs`
- Test: `apps/desktop/src/app/capabilities/catalog/catalog-data.aistoc.test.ts`

- [ ] **Step 1: 写失败测试**

`apps/desktop/src/app/capabilities/catalog/catalog-data.aistoc.test.ts`：

```ts
import { describe, expect, it } from 'vitest'

import { catalogBaseUrl } from './catalog-data'

describe('AISTOC catalog base', () => {
  it('uses the bundled snapshot directory in branded builds', () => {
    expect(catalogBaseUrl(true)).toBe('./aistoc-catalog')
    expect(catalogBaseUrl(false)).toBe('https://nousresearch.github.io/hermes-agent/docs/api')
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/desktop && npx vitest run src/app/capabilities/catalog/catalog-data.aistoc.test.ts
```
Expected: FAIL，`catalogBaseUrl` 未导出。

- [ ] **Step 3: 导出可测试的基址函数并支持品牌构建**

在 `catalog-data.ts` 中把常量改为：

```ts
const UPSTREAM_CATALOG_BASE = 'https://nousresearch.github.io/hermes-agent/docs/api'

export function catalogBaseUrl(branded: boolean): string {
  return branded ? './aistoc-catalog' : UPSTREAM_CATALOG_BASE
}

const CATALOG_BASE = catalogBaseUrl(import.meta.env.VITE_AISTOC_BRAND === '1')
```

- [ ] **Step 4: 增加构建期快照下载脚本**

`aistoc/build/fetch-catalog-snapshots.mjs`：

```js
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
```

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
cd apps/desktop && npx vitest run src/app/capabilities/catalog/catalog-data.aistoc.test.ts
```
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/desktop/src/app/capabilities/catalog/catalog-data.ts apps/desktop/src/app/capabilities/catalog/catalog-data.aistoc.test.ts aistoc/build/fetch-catalog-snapshots.mjs
git commit -m "feat: serve plugin and skill catalog from bundled snapshots"
```

### Task 9: 后端自定义端点支持额外 Header 与 TLS

**Files:**
- Modify: `hermes_cli/web_models.py:46-59`
- Modify: `hermes_cli/web_routers/config_env.py:28-31, 578-660, 865-911, 1000-1007`
- Test: `tests/hermes_cli/test_custom_endpoint_advanced_fields.py`

- [ ] **Step 1: 写失败测试**

`tests/hermes_cli/test_custom_endpoint_advanced_fields.py`：

```python
from hermes_cli.web_models import CustomEndpointUpdate
from hermes_cli.web_routers.config_env import _write_custom_endpoint


def test_write_custom_endpoint_persists_headers_and_tls():
    cfg = {"providers": {}}
    body = CustomEndpointUpdate(
        name="internal-gateway",
        base_url="https://llm.internal.example.com/v1",
        model="qwen-plus",
        api_key="secret",
        extra_headers={"X-Org": "aistoc", "X-Unused": None},
        ssl_verify=False,
        ssl_ca_cert="/etc/ssl/internal-ca.pem",
    )
    endpoint_id, entry = _write_custom_endpoint(cfg, body)
    assert endpoint_id == "internal-gateway"
    assert entry["extra_headers"] == {"X-Org": "aistoc"}
    assert entry["ssl_verify"] is False
    assert entry["ssl_ca_cert"] == "/etc/ssl/internal-ca.pem"


def test_write_custom_endpoint_none_keeps_existing_fields():
    cfg = {
        "providers": {
            "gw": {
                "name": "gw",
                "base_url": "https://gw.example.com/v1",
                "model": "m",
                "extra_headers": {"X-Keep": "1"},
                "ssl_verify": True,
            }
        }
    }
    body = CustomEndpointUpdate(id="gw", name="gw", base_url="https://gw.example.com/v1", model="m2")
    _, entry = _write_custom_endpoint(cfg, body)
    assert entry["extra_headers"] == {"X-Keep": "1"}
    assert entry["ssl_verify"] is True
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
.venv/Scripts/python.exe -m pytest tests/hermes_cli/test_custom_endpoint_advanced_fields.py -v
```
Expected: FAIL，`CustomEndpointUpdate` 不接受 `extra_headers`。

- [ ] **Step 3: 扩展请求模型**

在 `hermes_cli/web_models.py` 的 `CustomEndpointUpdate` 中加入：

```python
    extra_headers: Optional[dict[str, str]] = None
    ssl_verify: Optional[bool] = None
    ssl_ca_cert: Optional[str] = None
```

- [ ] **Step 4: 写入配置**

在 `hermes_cli/web_routers/config_env.py` 的导入中加入 `normalize_extra_headers`：

```python
from hermes_cli.config import (
    DEFAULT_CONFIG, OPTIONAL_ENV_VARS, read_raw_config, require_readable_config_before_write,
    custom_endpoint_key_env, coerce_provider_id, find_provider_entry,
    get_compatible_custom_providers, _ENV_REF_RE, _deep_merge, normalize_extra_headers,
)
```

在 `_write_custom_endpoint` 的 `entry.update({...})` 之后加入：

```python
    if body.extra_headers is not None:
        normalized = normalize_extra_headers(body.extra_headers)
        if normalized:
            entry["extra_headers"] = normalized
        else:
            entry.pop("extra_headers", None)
    if body.ssl_verify is not None:
        entry["ssl_verify"] = bool(body.ssl_verify)
    if body.ssl_ca_cert is not None:
        cert = body.ssl_ca_cert.strip()
        if cert:
            entry["ssl_ca_cert"] = cert
        else:
            entry.pop("ssl_ca_cert", None)
```

- [ ] **Step 5: 返回高级字段给设置页**

在 `hermes_cli/web_routers/config_env.py` 的 `_endpoint_row` 返回对象中加入：

```python
        "extra_headers": key_entry.get("extra_headers") or {},
        "ssl_verify": key_entry.get("ssl_verify", True),
        "ssl_ca_cert": key_entry.get("ssl_ca_cert") or "",
```

- [ ] **Step 6: 探测请求应用 Header 与 TLS**

把 `validate_custom_endpoint` 中的 headers 构造改为：

```python
    headers = {"Accept": "application/json"}
    if body.api_key and body.api_key.strip():
        headers["Authorization"] = f"Bearer {body.api_key.strip()}"
    headers.update(normalize_extra_headers(body.extra_headers))

    verify: Any = True
    if body.ssl_ca_cert:
        verify = body.ssl_ca_cert.strip()
    elif body.ssl_verify is False:
        verify = False

    resolved, resp = await _probe_openai_compatible_models(base_url, headers, verify)
```

把 `_probe_openai_compatible_models` 签名改为：

```python
async def _probe_openai_compatible_models(base_url: str, headers: Optional[dict], verify: Any = True) -> tuple[str, Any]:
```

并把其中的 `_endpoint_probe_client(base, 8.0)` 改为 `_endpoint_probe_client(base, 8.0, verify)`；传输探测那处的 `_endpoint_probe_client(resolved, 8.0)` 同样传入 `verify`。

把 `_endpoint_probe_client` 改为：

```python
def _endpoint_probe_client(url: str, timeout: float, verify: Any = True):
    import httpx
    from agent.model_metadata import is_local_endpoint
    return httpx.AsyncClient(timeout=httpx.Timeout(timeout), trust_env=not is_local_endpoint(url), verify=verify)
```

- [ ] **Step 7: 运行测试确认通过**

Run:
```bash
.venv/Scripts/python.exe -m pytest tests/hermes_cli/test_custom_endpoint_advanced_fields.py tests/hermes_cli/test_custom_provider_extra_headers.py tests/hermes_cli/test_custom_provider_tls.py -v
```
Expected: 全部 PASS。

- [ ] **Step 8: 提交**

```bash
git add hermes_cli/web_models.py hermes_cli/web_routers/config_env.py tests/hermes_cli/test_custom_endpoint_advanced_fields.py
git commit -m "feat: accept extra headers and TLS settings on custom endpoints"
```

### Task 10: 前端类型与厂商预设

**Files:**
- Modify: `apps/desktop/src/types/hermes.ts:318-330`
- Create: `apps/desktop/src/aistoc/providers.ts`
- Test: `apps/desktop/src/aistoc/providers.test.ts`

- [ ] **Step 1: 写失败测试**

`apps/desktop/src/aistoc/providers.test.ts`：

```ts
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
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/desktop && npx vitest run src/aistoc/providers.test.ts
```
Expected: FAIL，模块不存在。

- [ ] **Step 3: 扩展类型**

在 `apps/desktop/src/types/hermes.ts` 的 `CustomEndpoint` 与 `CustomEndpointUpdate` 两个接口中都加入：

```ts
  extra_headers?: Record<string, string>
  ssl_verify?: boolean
  ssl_ca_cert?: string
```

- [ ] **Step 4: 写预设模块**

`apps/desktop/src/aistoc/providers.ts`：

```ts
import brand from '../../../../aistoc/branding/brand.json'
import type { CustomEndpointApiMode, CustomEndpointUpdate } from '@/types/hermes'

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
```

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
cd apps/desktop && npx vitest run src/aistoc/providers.test.ts
```
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/desktop/src/types/hermes.ts apps/desktop/src/aistoc/providers.ts apps/desktop/src/aistoc/providers.test.ts
git commit -m "feat: add AISTOC vendor presets to the desktop"
```

### Task 11: 首启向导组件

**Files:**
- Create: `apps/desktop/src/aistoc/AistocSetup.tsx`
- Test: `apps/desktop/src/aistoc/AistocSetup.test.tsx`

- [ ] **Step 1: 写失败测试**

`apps/desktop/src/aistoc/AistocSetup.test.tsx`：

```tsx
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AistocSetup } from './AistocSetup'

afterEach(cleanup)

describe('AistocSetup', () => {
  it('fills the form from a vendor preset and saves it', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    render(<AistocSetup save={save} />)

    fireEvent.click(screen.getByRole('button', { name: /DeepSeek/ }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(save.mock.calls[0][0]).toMatchObject({
      base_url: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      api_key: 'sk-test'
    })
  })

  it('shows a readable error when the endpoint fails', async () => {
    const save = vi.fn().mockResolvedValue({ ok: false, message: '证书无效' })
    render(<AistocSetup save={save} />)
    fireEvent.click(screen.getByRole('button', { name: /DeepSeek/ }))
    fireEvent.change(screen.getByLabelText('API Key'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))
    expect(await screen.findByText('证书无效')).toBeTruthy()
  })

  it('blocks plain HTTP unless explicitly allowed', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    render(<AistocSetup save={save} />)
    fireEvent.click(screen.getByRole('button', { name: /自定义/ }))
    fireEvent.change(screen.getByLabelText('接口地址'), { target: { value: 'http://10.0.0.2:8000/v1' } })
    fireEvent.change(screen.getByLabelText('模型名'), { target: { value: 'qwen-plus' } })
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))
    expect(await screen.findByText(/允许 HTTP/)).toBeTruthy()
    expect(save).not.toHaveBeenCalled()
  })

  it('sends custom headers and TLS settings', async () => {
    const save = vi.fn().mockResolvedValue({ ok: true })
    render(<AistocSetup save={save} />)
    fireEvent.click(screen.getByRole('button', { name: /自定义/ }))
    fireEvent.change(screen.getByLabelText('接口地址'), { target: { value: 'https://gw.internal/v1' } })
    fireEvent.change(screen.getByLabelText('模型名'), { target: { value: 'qwen-plus' } })
    fireEvent.click(screen.getByRole('button', { name: '高级选项' }))
    fireEvent.change(screen.getByLabelText('额外 Header'), { target: { value: 'X-Org: aistoc' } })
    fireEvent.click(screen.getByLabelText('校验 TLS 证书（内网自签证书可关闭）'))
    fireEvent.click(screen.getByRole('button', { name: '保存并测试' }))
    await waitFor(() => expect(save).toHaveBeenCalled())
    expect(save.mock.calls[0][0]).toMatchObject({
      extra_headers: { 'X-Org': 'aistoc' },
      ssl_verify: false
    })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/desktop && npx vitest run src/aistoc/AistocSetup.test.tsx
```
Expected: FAIL，模块不存在。

- [ ] **Step 3: 写向导组件**

`apps/desktop/src/aistoc/AistocSetup.tsx`：

```tsx
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { CustomEndpointUpdate } from '@/types/hermes'

import { AISTOC_PRESETS, presetToEndpoint, type AistocPreset } from './providers'

export interface AistocSetupResult {
  ok: boolean
  message?: string
  needsModelInput?: boolean
}

export function parseHeaders(text: string): Record<string, string> {
  const headers: Record<string, string> = {}
  for (const line of text.split('\n')) {
    const index = line.indexOf(':')
    if (index > 0) {
      headers[line.slice(0, index).trim()] = line.slice(index + 1).trim()
    }
  }
  return headers
}

export function AistocSetup({
  save
}: {
  save: (endpoint: CustomEndpointUpdate) => Promise<AistocSetupResult>
}) {
  const [preset, setPreset] = useState<AistocPreset | null>(null)
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [model, setModel] = useState('')
  const [extraHeaders, setExtraHeaders] = useState('')
  const [sslVerify, setSslVerify] = useState(true)
  const [sslCaCert, setSslCaCert] = useState('')
  const [allowHttp, setAllowHttp] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const choosePreset = (next: AistocPreset) => {
    setPreset(next)
    setBaseUrl(next.baseUrl)
    setModel(next.model)
    setError('')
  }

  const submit = async () => {
    const base: CustomEndpointUpdate = preset
      ? presetToEndpoint(preset, apiKey)
      : { name: '自定义端点', base_url: baseUrl, model, api_key: apiKey, make_default: true }

    const endpoint: CustomEndpointUpdate = {
      ...base,
      base_url: baseUrl.trim() || base.base_url,
      model: model.trim() || base.model,
      extra_headers: parseHeaders(extraHeaders),
      ssl_verify: sslVerify,
      ssl_ca_cert: sslCaCert.trim() || undefined
    }

    if (!endpoint.base_url || !endpoint.model) {
      setError('请填写接口地址和模型名')
      return
    }
    if (endpoint.base_url.startsWith('http://') && !allowHttp) {
      setError('HTTP 地址需要勾选“允许 HTTP（不加密传输）”')
      return
    }

    setSaving(true)
    setError('')
    const result = await save(endpoint)
    setSaving(false)
    if (!result.ok) setError(result.message ?? '保存失败')
  }

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-lg font-semibold">连接你的模型服务</h2>
        <p className="text-sm text-muted-foreground">选择厂商预设，或填写内网自建服务的 OpenAI 兼容地址。</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {AISTOC_PRESETS.map(item => (
          <Button
            key={item.id}
            onClick={() => choosePreset(item)}
            type="button"
            variant={preset?.id === item.id ? 'default' : 'outline'}
          >
            {item.name}
          </Button>
        ))}
        <Button
          onClick={() => {
            setPreset(null)
            setBaseUrl('')
            setModel('')
            setError('')
          }}
          type="button"
          variant={preset === null ? 'default' : 'outline'}
        >
          自定义 / 内网服务
        </Button>
      </div>

      <label className="grid gap-1 text-sm">
        <span>接口地址</span>
        <Input
          aria-label="接口地址"
          value={baseUrl}
          onChange={event => setBaseUrl(event.target.value)}
          placeholder="https://api.example.com/v1"
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input checked={allowHttp} onChange={event => setAllowHttp(event.target.checked)} type="checkbox" />
        允许 HTTP（不加密传输）
      </label>
      <label className="grid gap-1 text-sm">
        <span>API Key</span>
        <Input aria-label="API Key" value={apiKey} onChange={event => setApiKey(event.target.value)} type="password" />
      </label>
      <label className="grid gap-1 text-sm">
        <span>模型名</span>
        <Input
          aria-label="模型名"
          value={model}
          onChange={event => setModel(event.target.value)}
          placeholder="deepseek-chat"
        />
      </label>

      <Button onClick={() => setShowAdvanced(value => !value)} type="button" variant="text">
        {showAdvanced ? '收起高级选项' : '高级选项'}
      </Button>

      {showAdvanced ? (
        <div className="grid gap-3 rounded-lg border p-3">
          <label className="grid gap-1 text-sm">
            <span>额外 Header</span>
            <textarea
              aria-label="额外 Header"
              className="min-h-20 rounded-md border bg-background p-2 font-mono text-xs"
              onChange={event => setExtraHeaders(event.target.value)}
              placeholder={'X-Org: aistoc\nX-Env: prod'}
              value={extraHeaders}
            />
            <span className="text-xs text-muted-foreground">每行一个，格式：Header-Name: value</span>
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input checked={sslVerify} onChange={event => setSslVerify(event.target.checked)} type="checkbox" />
            校验 TLS 证书（内网自签证书可关闭）
          </label>
          <label className="grid gap-1 text-sm">
            <span>自定义 CA 证书路径（可选）</span>
            <Input
              aria-label="自定义 CA 证书路径"
              value={sslCaCert}
              onChange={event => setSslCaCert(event.target.value)}
              placeholder="C:\\certs\\internal-ca.pem"
            />
          </label>
        </div>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Button disabled={saving} onClick={() => void submit()} type="button">
        {saving ? '测试中…' : '保存并测试'}
      </Button>
    </div>
  )
}
```

- [ ] **Step 4: 运行测试确认通过**

Run:
```bash
cd apps/desktop && npx vitest run src/aistoc/AistocSetup.test.tsx
```
Expected: 4 tests PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/desktop/src/aistoc/AistocSetup.tsx apps/desktop/src/aistoc/AistocSetup.test.tsx
git commit -m "feat: add AISTOC first-run model setup component"
```

### Task 12: 保存逻辑并接入首启流程

**Files:**
- Modify: `apps/desktop/src/store/onboarding.ts`（新增导出函数）
- Modify: `apps/desktop/src/components/onboarding/index.tsx:462`
- Test: `apps/desktop/src/store/onboarding.aistoc.test.ts`

- [ ] **Step 1: 写失败测试**

`apps/desktop/src/store/onboarding.aistoc.test.ts`：

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { saveAistocEndpoint } from './onboarding'

vi.mock('@/hermes', async importOriginal => {
  const actual = await importOriginal<typeof import('@/hermes')>()
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
    vi.mocked(saveCustomEndpoint).mockResolvedValue({ ok: true, id: 'deepseek', endpoints: [] })
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
    vi.mocked(validateCustomEndpoint).mockResolvedValue({ ok: false, reachable: false, message: '证书无效' })
    const result = await saveAistocEndpoint(
      { name: 'x', base_url: 'https://x', model: 'm' },
      { requestGateway: async () => undefined as never }
    )
    expect(result).toEqual({ ok: false, message: '证书无效' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/desktop && npx vitest run src/store/onboarding.aistoc.test.ts
```
Expected: FAIL，`saveAistocEndpoint` 未导出。

- [ ] **Step 3: 新增保存函数**

在 `apps/desktop/src/store/onboarding.ts` 末尾加入：

```ts
export async function saveAistocEndpoint(
  endpoint: CustomEndpointUpdate,
  ctx: OnboardingContext
): Promise<{ message?: string; needsModelInput?: boolean; ok: boolean }> {
  try {
    const scope = ctx.scope
    const probe = await validateCustomEndpoint(endpoint, scope)
    const modelKnown = probe.models?.length ? probe.models : endpoint.model ? [endpoint.model] : []
    if (!probe.ok && !(probe.reachable && modelKnown.length > 0)) {
      return { ok: false, message: probe.message, needsModelInput: probe.reachable && modelKnown.length === 0 }
    }

    const saved = await saveCustomEndpoint(
      {
        ...endpoint,
        models: modelKnown,
        model_details: probe.model_details,
        make_default: true
      },
      scope
    )
    if (!saved.id) {
      return { ok: false, message: '保存端点失败：后端没有返回 id' }
    }

    await activateCustomEndpoint(saved.id, scope)
    await ctx.requestGateway('reload.env').catch(() => undefined)
    return { ok: true }
  } catch (error) {
    return { ok: false, message: errMessage(error) }
  }
}
```

并在文件顶部导入（合并到现有的 `@/hermes` 与 `@/types/hermes` import，不要产生重复导入）：

```ts
import { activateCustomEndpoint, saveCustomEndpoint, validateCustomEndpoint } from '@/hermes'
import type { CustomEndpointUpdate } from '@/types/hermes'
```

- [ ] **Step 4: 接入首启界面**

在 `apps/desktop/src/components/onboarding/index.tsx` 顶部加入：

```tsx
import { AistocSetup } from '@/aistoc/AistocSetup'
import { saveAistocEndpoint } from '@/store/onboarding'
```

把第 462 行的 `<Picker ctx={ctx} />` 改为：

```tsx
              {import.meta.env.VITE_AISTOC_BRAND === '1' && !onboarding.manual ? (
                <AistocSetup save={endpoint => saveAistocEndpoint(endpoint, ctx)} />
              ) : (
                <Picker ctx={ctx} />
              )}
```

并在保存成功后刷新首启状态。把 `AistocSetup` 的 `save` 回调改为：

```tsx
                <AistocSetup
                  save={async endpoint => {
                    const result = await saveAistocEndpoint(endpoint, ctx)
                    if (result.ok) {
                      await refreshOnboarding(ctx)
                    }
                    return result
                  }}
                />
```

- [ ] **Step 5: 运行测试确认通过**

Run:
```bash
cd apps/desktop && npx vitest run src/store/onboarding.aistoc.test.ts src/aistoc/AistocSetup.test.tsx src/components/onboarding/index.test.tsx
```
Expected: 新测试 PASS，上游 onboarding 测试仍 PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/desktop/src/store/onboarding.ts apps/desktop/src/components/onboarding/index.tsx apps/desktop/src/store/onboarding.aistoc.test.ts
git commit -m "feat: wire AISTOC setup into first-run onboarding"
```

### Task 13: 设置页支持高级端点字段

**Files:**
- Modify: `apps/desktop/src/app/settings/custom-endpoints-settings.tsx:36-110`
- Test: `apps/desktop/src/app/settings/custom-endpoints-settings.aistoc.test.tsx`

- [ ] **Step 1: 写失败测试**

`apps/desktop/src/app/settings/custom-endpoints-settings.aistoc.test.tsx`：

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { AdvancedEndpointFields } from './custom-endpoints-settings'

afterEach(cleanup)

describe('AdvancedEndpointFields', () => {
  it('parses header lines into a record', () => {
    const onChange = vi.fn()
    render(<AdvancedEndpointFields headers={'X-Org: aistoc'} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('额外 Header'), { target: { value: 'X-Org: aistoc\nX-Env: prod' } })
    expect(onChange).toHaveBeenCalledWith({ 'X-Org': 'aistoc', 'X-Env': 'prod' })
  })
})
```

- [ ] **Step 2: 运行测试确认失败**

Run:
```bash
cd apps/desktop && npx vitest run src/app/settings/custom-endpoints-settings.aistoc.test.tsx
```
Expected: FAIL，`AdvancedEndpointFields` 未导出。

- [ ] **Step 3: 新增高级字段组件**

在 `custom-endpoints-settings.tsx` 中加入：

```tsx
export function AdvancedEndpointFields({
  headers,
  onChange
}: {
  headers: string
  onChange: (headers: Record<string, string>) => void
}) {
  return (
    <div className="grid gap-2">
      <label className="grid gap-1.5 text-xs text-muted-foreground">
        额外 Header
        <textarea
          aria-label="额外 Header"
          className="min-h-20 rounded-md border bg-background p-2 font-mono text-xs"
          defaultValue={headers}
          onChange={event => {
            const parsed: Record<string, string> = {}
            for (const line of event.target.value.split('\n')) {
              const index = line.indexOf(':')
              if (index > 0) {
                parsed[line.slice(0, index).trim()] = line.slice(index + 1).trim()
              }
            }
            onChange(parsed)
          }}
        />
        <span className="text-xs text-muted-foreground">每行一个，格式：Header-Name: value</span>
      </label>
    </div>
  )
}
```

- [ ] **Step 4: 扩展表单状态与提交载荷**

在 `EndpointForm` 接口中加入：

```ts
  extraHeaders: Record<string, string>
  sslVerify: boolean
  sslCaCert: string
```

在 `EMPTY_FORM` 中加入：

```ts
  extraHeaders: {},
  sslVerify: true,
  sslCaCert: ''
```

在 `formFromEndpoint` 的返回对象中加入：

```ts
    extraHeaders: endpoint.extra_headers ?? {},
    sslVerify: endpoint.ssl_verify ?? true,
    sslCaCert: endpoint.ssl_ca_cert ?? ''
```

在 `toPayload` 的返回对象中加入：

```ts
    extra_headers: form.extraHeaders,
    ssl_verify: form.sslVerify,
    ssl_ca_cert: form.sslCaCert,
```

- [ ] **Step 5: 渲染高级字段**

在 `apiKey` 输入框的 `</label>` 之后、`makeDefault` 复选框之前插入：

```tsx
            <AdvancedEndpointFields
              headers={Object.entries(form.extraHeaders)
                .map(([key, value]) => `${key}: ${value}`)
                .join('\n')}
              onChange={headers => setForm(current => ({ ...current, extraHeaders: headers }))}
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={form.sslVerify}
                onCheckedChange={checked => setForm(current => ({ ...current, sslVerify: checked === true }))}
              />
              校验 TLS 证书（内网自签证书可关闭）
            </label>
            <label className="grid gap-1.5 text-xs text-muted-foreground">
              自定义 CA 证书路径（可选）
              <Input
                onChange={event => setForm(current => ({ ...current, sslCaCert: event.target.value }))}
                placeholder="C:\\certs\\internal-ca.pem"
                value={form.sslCaCert}
              />
            </label>
```

- [ ] **Step 6: 运行测试确认通过**

Run:
```bash
cd apps/desktop && npx vitest run src/app/settings/custom-endpoints-settings.aistoc.test.tsx src/app/settings/custom-endpoints-settings.test.tsx
```
Expected: 新测试 PASS，上游测试仍 PASS。

- [ ] **Step 7: 提交**

```bash
git add apps/desktop/src/app/settings/custom-endpoints-settings.tsx apps/desktop/src/app/settings/custom-endpoints-settings.aistoc.test.tsx
git commit -m "feat: edit custom endpoint headers and TLS from settings"
```

---

## Phase P3：一键构建与验收

### Task 14: 一键构建脚本

**Files:**
- Create: `aistoc/build/build-installer.ps1`
- Create: `aistoc/build/verify-installer.ps1`

- [ ] **Step 1: 写构建脚本**

`aistoc/build/build-installer.ps1`：

```powershell
<#
.SYNOPSIS
  Build the AISTOC Agent NSIS installer for this checkout.
.DESCRIPTION
  Stages the bundled Python payload, applies brand copy, builds the Electron
  renderer, then packages a per-machine NSIS installer whose install directory
  is the invoking user's LOCALAPPDATA.
#>
[CmdletBinding()]
param(
  [string]$Python = 'C:\Python314\python.exe',
  [switch]$SkipPayload
)

$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Desktop = Join-Path $Repo 'apps\desktop'
$Icons = Join-Path $Repo 'aistoc\branding\icons'
$Cache = Join-Path $Repo 'aistoc\.build-cache\assets'

function Step($Message) { Write-Host "==> $Message" -ForegroundColor Cyan }

function Backup-Asset($Relative) {
  $Source = Join-Path $Desktop $Relative
  $Target = Join-Path $Cache $Relative
  New-Item -ItemType Directory -Force (Split-Path $Target) | Out-Null
  Copy-Item $Source $Target -Force
}

function Restore-Asset($Relative) {
  $Source = Join-Path $Cache $Relative
  if (Test-Path $Source) {
    Copy-Item $Source (Join-Path $Desktop $Relative) -Force
  }
}

$Assets = @('assets\icon.ico', 'assets\icon.png', 'public\nous-girl.png', 'public\nous-girl-dark.png')

Push-Location $Repo
try {
  Step 'Check Python 3.14'
  & $Python --version

  Step 'Install JS workspaces when missing'
  if (-not (Test-Path (Join-Path $Repo 'node_modules'))) { npm ci }

  Step 'Back up upstream brand assets'
  New-Item -ItemType Directory -Force $Cache | Out-Null
  foreach ($asset in $Assets) { Backup-Asset $asset }

  Step 'Generate brand icons'
  & $Python (Join-Path $Repo 'aistoc\branding\make_icons.py')
  Copy-Item (Join-Path $Icons 'icon.ico') (Join-Path $Desktop 'assets\icon.ico') -Force
  Copy-Item (Join-Path $Icons 'icon.png') (Join-Path $Desktop 'assets\icon.png') -Force
  Copy-Item (Join-Path $Icons 'icon.png') (Join-Path $Desktop 'public\nous-girl.png') -Force
  Copy-Item (Join-Path $Icons 'icon.png') (Join-Path $Desktop 'public\nous-girl-dark.png') -Force

  Step 'Cache catalog snapshots'
  node (Join-Path $Repo 'aistoc\build\fetch-catalog-snapshots.mjs')

  Step 'Apply brand copy'
  node (Join-Path $Repo 'aistoc\build\apply-brand.mjs')

  try {
    $env:HERMES_PYTHON = $Python

    if (-not $SkipPayload) {
      Step 'Stage bundled Python payload'
      Push-Location $Desktop
      try {
        $env:HERMES_DESKTOP_VARIANT = 'bundled'
        npm run payload
      } finally { Pop-Location }
    }

    Step 'Build renderer'
    Push-Location $Desktop
    try {
      $env:VITE_AISTOC_BRAND = '1'
      $env:AISTOC_BRAND = '1'
      npm run build
    } finally { Pop-Location }

    Step 'Package NSIS installer'
    Push-Location $Desktop
    try {
      $env:AISTOC_NSIS = '1'
      $env:AISTOC_BRAND = '1'
      $env:HERMES_DESKTOP_VARIANT = 'bundled'
      $env:CSC_IDENTITY_AUTO_DISCOVERY = 'false'
      npm run builder -- --win nsis --publish never
    } finally { Pop-Location }
  } finally {
    Step 'Restore upstream source and assets'
    node (Join-Path $Repo 'aistoc\build\apply-brand.mjs') restore
    foreach ($asset in $Assets) { Restore-Asset $asset }
    Remove-Item (Join-Path $Desktop 'public\aistoc-catalog') -Recurse -Force -ErrorAction SilentlyContinue
  }

  Step 'Verify artifacts'
  & (Join-Path $PSScriptRoot 'verify-installer.ps1')

  Step 'Installer ready'
  Get-ChildItem (Join-Path $Desktop 'release') -Filter 'AISTOC-Setup-*.exe' |
    Select-Object Name, Length, LastWriteTime
} finally {
  Pop-Location
}
```

- [ ] **Step 2: 写产物校验脚本**

`aistoc/build/verify-installer.ps1`：

```powershell
$ErrorActionPreference = 'Stop'
$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Release = Join-Path $Repo 'apps\desktop\release'
$Installer = Get-ChildItem $Release -Filter 'AISTOC-Setup-*.exe' | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $Installer) { throw "No AISTOC-Setup-*.exe found in $Release" }
$Hash = (Get-FileHash $Installer.FullName -Algorithm SHA256).Hash
$Info = [ordered]@{
  artifact = $Installer.Name
  bytes = $Installer.Length
  sha256 = $Hash
  upstream_commit = (git -C $Repo rev-parse HEAD)
  built_at = (Get-Date).ToString('o')
  python = (& 'C:\Python314\python.exe' --version)
}
$Info | ConvertTo-Json | Set-Content (Join-Path $Release 'build-info.json') -Encoding UTF8
"$Hash  $($Installer.Name)" | Set-Content (Join-Path $Release 'SHA256SUMS.txt') -Encoding ASCII
Write-Host "OK: $($Installer.Name) ($($Installer.Length) bytes)" -ForegroundColor Green
```

- [ ] **Step 3: 干跑校验（不打包）**

Run:
```powershell
pwsh -File aistoc/build/build-installer.ps1 -SkipPayload
```
Expected: 图标生成、品牌替换/恢复、renderer 构建成功；最后打印安装包信息（若已存在上次产物）。

- [ ] **Step 4: 提交**

```bash
git add aistoc/build/build-installer.ps1 aistoc/build/verify-installer.ps1
git commit -m "build: add one-command AISTOC installer build"
```

### Task 15: 验收与交付文档

**Files:**
- Create: `aistoc/docs/install-guide.md`
- Create: `aistoc/docs/acceptance-checklist.md`
- Create: `aistoc/docs/upgrade-and-rollback.md`

- [ ] **Step 1: 写安装说明**

`aistoc/docs/install-guide.md` 必须包含：
- 系统要求：Windows 10 x64 19045+ / Windows 11 x64
- 双击安装、UAC 提权、安装目录 `%LOCALAPPDATA%\Programs\AISTOC Agent`
- 首启向导：五个厂商预设、自定义/内网端点、自签证书与 HTTP 开关
- 杀软/SmartScreen 未签名提示的处理方式
- 数据目录 `%APPDATA%\AISTOC Agent` 与备份方法

- [ ] **Step 2: 写验收清单**

`aistoc/docs/acceptance-checklist.md` 使用与设计文档第 9 节一致的条目，每条都必须可勾选：

```markdown
- [ ] 干净 Win10 x64 虚机断网安装成功
- [ ] 安装目录为 %LOCALAPPDATA%\Programs\AISTOC Agent
- [ ] 首启向导可用五个预设完成配置
- [ ] 自定义端点支持 HTTP、自签证书、自定义 Header
- [ ] 对话、读写文件、执行命令、技能列表可用
- [ ] 除模型端点外无主动出站请求
- [ ] 覆盖安装保留配置和会话
- [ ] 卸载默认保留用户数据，勾选删除后清理干净
```

- [ ] **Step 3: 写升级与回滚说明**

`aistoc/docs/upgrade-and-rollback.md` 必须说明：
- 升级 = 运行新版安装包覆盖安装，数据目录不动
- 回滚 = 运行旧版安装包覆盖安装
- 每次构建附带的 `build-info.json` 与 `SHA256SUMS.txt` 用于核对版本

- [ ] **Step 4: 跑完整验收**

在干净 Win10 x64 虚机按 `acceptance-checklist.md` 逐项验证，把实际结果记录在文档末尾（通过/失败 + 截图路径）。

- [ ] **Step 5: 提交**

```bash
git add aistoc/docs
git commit -m "docs: add AISTOC install, acceptance, and rollback guides"
```

---

## 计划自检

**Spec 覆盖检查**

| 设计要求 | 对应任务 |
|---|---|
| 单文件 exe、管理员权限、LOCALAPPDATA 安装 | Task 2、Task 14 |
| 完全离线安装 | Task 2、Task 7、Task 14 |
| 品牌 AISTOC、图标、默认中文 | Task 3、Task 4、Task 5、Task 6 |
| 五个厂商预设 | Task 3、Task 10、Task 11 |
| 内网/自定义端点、自定义 Header、HTTP、自签证书 | Task 9、Task 11、Task 13 |
| 首启向导 | Task 11、Task 12 |
| 关闭遥测/更新/远程目录 | Task 6、Task 7、Task 8 |
| 保留 MIT 与上游许可 | Task 15（交付文档） |
| 验收测试 | Task 15 |

**占位符扫描：** 无 TBD/TODO；所有代码步骤均给出可执行代码或明确命令。

**类型一致性：** `CustomEndpointUpdate` 在 Task 9（Python）与 Task 10（TypeScript）中字段名一致：`extra_headers`、`ssl_verify`、`ssl_ca_cert`；前端保存函数 `saveAistocEndpoint` 在 Task 12 中定义并在 Task 11 的调用处使用同一签名。
