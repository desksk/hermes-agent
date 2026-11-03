# 桌面端构建前置条件（Windows x64）

记录本机实测通过的构建环境。首次构建需要联网；安装与运行不需要。

## 版本要求

| 组件 | 要求 | 本机实测 |
|---|---|---|
| Node.js | `>=26`（见根 `package.json` engines 与 `.nvmrc`） | 26.12.1 |
| npm | `<11.10.0 \|\| >=11.17.0`（见根 engines，`engine-strict=true`） | 用 `npx npm@11.21.1` |
| Python | `>=3.11,<3.15`，固定 `C:\Python314\python.exe` | 3.14.7 |
| MSVC | Visual Studio Build Tools，C++ x64 工具集（node-pty 等原生依赖） | VS 18 BuildTools |

## npm 版本坑

Node 26.12.1 自带的 npm 11.12.1 落在 engines 排除区间（`>=11.10.0 <11.17.0`）。
该区间支持 `min-release-age` 但不支持 `min-release-age-exclude`，仓库 `.npmrc`
依赖 exclude 列表，直接 `npm ci` 会被引擎检查或 14 天冷却期卡住。

不改全局 npm，改用 npx 临时拉取满足要求的版本：

```bash
npx -y npm@11.21.1 ci
```

`npm run build` 不受 engine 检查影响，可继续用系统自带 npm。

## 桌面端构建

```bash
cd apps/desktop
npm run build
```

产物在 `apps/desktop/dist/`；原生依赖 staging 结果在 `apps/desktop/build/native-deps*`。

## 已验证基线（2026-11-03）

- commit：`4b261b8b`
- Electron：`44.9.3`
- `native-deps.prepared.json`：`platform=win32 arch=x64 degraded=false`
