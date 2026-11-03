# AISTOC Agent 桌面发行版 — 设计文档

- 日期：2026-11-03
- 状态：待评审
- 上游仓库：https://github.com/NousResearch/hermes-agent
- 上游基线：`main@ad2b705b`（2026-11-02）
- 上游许可：MIT
- 本地目录：`E:\Claude\hermes-agent`
- 定制分支：`aistoc/main`

## 1. 背景与目标

Hermes Agent 是 Nous Research 开源的、可自改进的 AI Agent，具备 CLI、TUI、消息网关和 Electron 桌面端，核心能力包括工具调用、跨会话记忆、Skill 自动生成、子 Agent、定时任务等。本项目基于上游源码，做一个**面向单位内网的 Windows 桌面发行版**：

- 产品名：**AISTOC Agent**
- 交付形态：单文件 `.exe` 安装包，双击安装，**需要管理员权限**
- 安装目录：`%LOCALAPPDATA%\Programs\AISTOC Agent`
- 完全离线安装：安装包内置完整运行时（Electron、Python、依赖、内置工具），目标机无需联网
- 首次启动通过向导弹出模型接入配置，支持国产厂商预设、OpenAI 兼容自定义端点、内网自建服务
- 品牌替换为 AISTOC，默认中文界面
- 第一版供单位内网自用；架构上为后续对外商业化交付留出空间

## 2. 非目标

- 不做多租户、计费、账号体系等 SaaS 能力
- 不重写 Hermes 桌面 UI，只做品牌、首启配置和打包层定制
- 不修改上游 Agent 核心行为；新增能力优先通过配置、插件或扩展点实现
- 第一版不实现具体的私有协议 provider（只预留适配接口与模板）
- 第一版不做代码签名，不接自动更新服务器

## 3. 关键决策

| 决策点 | 结论 |
|---|---|
| 技术路线 | 基于上游源码定制 + 官方构建链（方案 A），不自写 UI |
| 品牌 | AISTOC / AISTOC Agent；Logo 为 `E:\Claude\hermes-agent\AISTOC.jpg` |
| 安装包格式 | NSIS 单文件 exe，兼容 Win10 x64 与 Win11 x64 |
| 权限 | 安装与卸载需要管理员权限（UAC） |
| 安装目录 | `%LOCALAPPDATA%\Programs\AISTOC Agent` |
| 离线 | 安装包自包含运行时，安装过程零网络请求 |
| 模型预设 | DeepSeek、通义千问、智谱 GLM、豆包/火山方舟、Kimi |
| 自定义端点 | 任意 OpenAI 兼容 Base URL，支持自定义鉴权 Header、额外 Header、HTTP、自签证书 |
| 私有协议 | 通过上游 provider 插件扩展点预留，第一版不实现具体厂商 |
| 更新 | 关闭自动更新；新版安装包覆盖安装，保留用户数据 |
| 界面语言 | 默认简体中文，可切换 |

## 4. 总体架构

```
E:\Claude\hermes-agent\              # 上游代码，origin 只读同步
├── aistoc/                          # 全部定制集中在此
│   ├── branding/
│   │   ├── brand.json               # 品牌、appId、版本、厂商预设
│   │   ├── icons/                   # 由 AISTOC.jpg 生成的多尺寸 ico/png
│   │   └── installer/               # NSIS 文案、许可、横幅图
│   ├── desktop-patch/               # 对桌面端的最小入口补丁
│   ├── build/                       # 离线打包脚本
│   ├── patches/                     # 上游改动的可重放补丁
│   └── docs/                        # 交付、安装、运维文档
├── apps/desktop/                    # 上游 Electron 桌面端
├── agent/                           # 上游 Python Agent 核心
└── scripts/                         # 上游构建脚本
```

设计原则：

1. **定制集中**：品牌、向导、打包逻辑只放在 `aistoc/`，对上游文件的改动必须能用补丁重放。
2. **窄腰扩展**：模型私有协议走上游已有的 provider 插件机制，不改核心。
3. **可同步**：保持 `origin` 可拉取，定期把上游更新合入 `aistoc/main` 后重放补丁。
4. **离线优先**：所有运行时、依赖、默认技能随包分发；联网行为默认关闭或需显式开启。

## 5. 品牌系统

### 5.1 品牌源

`aistoc/branding/brand.json` 是唯一品牌来源，构建时读取并注入：

```json
{
  "name": "AISTOC",
  "productName": "AISTOC Agent",
  "appId": "com.aistoc.agent",
  "company": "AISTOC",
  "defaultLocale": "zh",
  "installDirName": "AISTOC Agent",
  "protocol": "aistoc",
  "version": "1.0.0"
}
```

注入范围：

- Electron 窗口标题、任务栏名称、单实例名、`userData` 目录名
- 安装器产品名、快捷方式、开始菜单、卸载项
- `aistoc://` 协议注册
- 关于页、首启向导、品牌外链

### 5.2 图标

- 源文件 `AISTOC.jpg`（354×354，JPEG）
- 构建前生成：
  - `icon.ico`：16/24/32/48/64/128/256 多尺寸
  - `icon.png`：512×512（用于 Electron / 安装器）
- 已知限制：源图分辨率偏低且非透明背景，高分屏可能略糊；后续有矢量图或 1024px 透明 PNG 时替换，不改代码

### 5.3 文案与链接

- 默认语言 `zh`，使用上游已内置的简体中文语言包
- 移除或隐藏：Nous Research 外链、捐赠、官方更新通道、官方 Discord/文档入口
- 保留：MIT LICENSE、上游版权声明、第三方依赖许可；新增 `NOTICE` 说明二次发行关系

## 6. 首启向导与模型接入

### 6.1 触发条件

首次启动且未检测到有效模型配置时，进入独立的首启向导；配置完成后进入上游桌面主界面。之后可在“设置 → 模型”中修改。不修改上游原有 onboarding 流程，二者互不依赖。

### 6.2 向导步骤

1. **欢迎页**：AISTOC Agent 简介、数据与隐私说明（仅向配置的模型端点发请求）
2. **模型接入页**
   - 厂商预设卡片：DeepSeek、通义千问、智谱 GLM、豆包/火山方舟、Kimi；选中后自动填 Base URL 与常用模型名
   - 自定义 / 内网服务：
     - Base URL
     - API Key
     - 模型名
     - API 模式：自动识别 / Chat Completions / Responses API / Anthropic Messages
     - 鉴权方式：Bearer / 自定义 Header 名 / 无鉴权
     - 额外 Header（键值对）
     - 允许 HTTP（默认关闭）
     - 忽略自签证书（默认关闭）
     - 自定义 CA 证书路径（可选）
3. **测试与完成**：发起最小请求验证连通性；成功才能完成。错误分类提示：DNS/连接超时、TLS/证书、401/403、404、模型名不存在、响应格式不符。

### 6.3 实现方式

- 复用上游桌面端已有的自定义端点能力：`getCustomEndpoints` / `saveCustomEndpoint` / `validateCustomEndpoint`，以及 `custom_providers` 配置中的 `base_url`、`api_key`、`api_mode`、`extra_headers`、`ssl_verify`、`ssl_ca_cert`
- 厂商预设存放在 `brand.json`，向导只负责排序、展示和填表
- 密钥保存到用户目录下的秘密文件（仅当前用户可读），不写入安装目录、不写日志
- 私有协议适配：使用上游 `providers/base.py` 的 ProviderProfile 插件机制，第一版提供适配模板与文档，后续按厂商补充

### 6.4 配置存储

- 用户数据根目录：`%APPDATA%\AISTOC Agent`（Electron userData）
- Hermes 运行时数据：`%APPDATA%\AISTOC Agent\hermes`（作为 `HERMES_HOME`）
- 行为配置：`%APPDATA%\AISTOC Agent\hermes\config.yaml`
- 密钥：`%APPDATA%\AISTOC Agent\hermes\.env` 或上游凭据存储，权限限制为当前用户
- 向导完成后写入主模型配置，重启后生效

## 7. 离线打包与安装

### 7.1 构建流水线

新增 `aistoc/build/build-installer.ps1`，职责：

1. 检查工作区干净、记录上游 commit 与定制版本
2. 生成品牌图标与安装器资源
3. 调用上游 `stage.py` 生成 `build/agent-payload`：固定版本 CPython、全部 Python 依赖、源码快照、ripgrep/ffmpeg/git
4. 以 `HERMES_DESKTOP_VARIANT=bundled` 调用 electron-builder，目标改为 `nsis`
5. 收集 `AISTOC-Setup-<version>.exe`，输出 SHA256 与构建清单

首次构建需要联网下载 npm 包、CPython 和 Python 依赖；构建完成后目标机安装全程离线。

### 7.2 NSIS 安装器

- 单文件 exe，`RequestExecutionLevel admin`
- 安装目录：`%LOCALAPPDATA%\Programs\AISTOC Agent`
- 当前用户桌面与开始菜单快捷方式；卸载程序同样需要管理员权限
- 可选开机自启，默认关闭
- 安装器不访问网络
- 覆盖安装保留 `%APPDATA%\AISTOC Agent` 下的全部用户数据
- 卸载时询问是否删除用户数据，默认保留

边界说明：通过 UAC 提权的同一用户安装时，`%LOCALAPPDATA%` 解析为该用户目录；若管理员为另一用户安装，会落到管理员自己的 `%LOCALAPPDATA%`，文档中明确要求“由使用该产品的账号执行安装”。

### 7.3 更新与签名

- 关闭 electron-updater 与所有官方更新通道
- 升级方式：分发新版安装包，覆盖安装
- 第一版不签名；SmartScreen 与杀软误报的处理方式写入交付文档
- 预留签名接入点：若单位提供代码签名证书或内网 CA，只需在构建脚本中启用，不改安装逻辑

### 7.4 体积预期

预计 600 MB ~ 1.2 GB，取决于 Python 依赖与内置工具规模。构建完成后记录实际体积。

## 8. 隐私、安全与默认配置

默认关闭：

- 遥测、崩溃上报、使用统计
- 自动更新检查
- 远程技能/插件目录拉取
- 非模型端点的出站连接

默认开启：

- 应用自身只向用户配置的模型端点发请求
- 本地会话与记忆存储
- 文件/命令工具（继承上游默认，首次使用高风险工具时保留确认机制）

说明：用户主动使用浏览器、联网技能或平台连接器时产生的网络请求属于用户操作，不计入“应用主动外联”，但需由用户显式触发。

安全约束：

- 不在代码、安装包、日志中硬编码任何密钥
- 安装包与用户数据分离
- 卸载不清除用户数据，除非用户显式勾选
- 使用“忽略自签证书”时在界面给出风险提示

### 8.1 内置技能与插件策略

- 内置上游 `skills/` 全量核心技能（14 个类别），随包分发，离线可用
- `optional-skills/` 只挑选不依赖外网和第三方密钥的条目内置；其余不随包分发，保留手动安装路径
- 内置上游 `plugins/` 中的核心插件（browser、computer_use、delegation、memory、model-providers、context_engine、cron_providers 等）
- 依赖外网或第三方账号的插件（如 google_meet、platforms、image_gen）随包保留但默认禁用，由用户显式启用
- 远程插件/技能目录：只读取随包分发的本地清单，禁止在线拉取

## 9. 测试与验收

### 9.1 打包与安装

- 干净 Win10 x64 虚机、断网，双击安装成功
- 安装目录、快捷方式、卸载项正确
- 覆盖安装后配置与会话保留
- 卸载后重装正常

### 9.2 功能

- 首启向导可完成配置并进入主界面
- 五个厂商预设分别连通（使用真实或模拟端点）
- 自定义端点覆盖：HTTP、自签证书、自定义 Header、无鉴权、错误凭据
- 对话、工具调用（读写文件、执行命令）、会话管理、记忆、技能列表可用
- 中文界面显示正常

### 9.3 离线与隐私

- 防火墙/抓包确认：除模型端点外无出站请求
- 断网状态下应用可启动、可查看历史会话；模型请求按预期失败并给出可读错误

### 9.4 回归

- 每次同步上游后运行冒烟：启动、配置读取、对话、工具调用、安装包生成
- 定制补丁应用失败时构建直接失败，不允许带病出包

## 10. 风险与回退

| 风险 | 影响 | 应对 |
|---|---|---|
| 上游变化快 | 补丁冲突、回归成本上升 | 定制集中在 `aistoc/`，补丁最小化，定期同步 |
| NSIS 非官方支持路径 | 可能打不出可运行安装包 | 先做打包 spike，验证 bundled 载荷 + NSIS；失败则退回 MSIX（仅 Win11）或便携版 |
| 安装包体积大 | 内网分发成本 | 提前告知；后续可拆分“核心包 + 可选技能包” |
| 未签名 | SmartScreen/杀软拦截 | 交付文档给出指引；预留签名接入 |
| 部分技能依赖外网 | 离线能力不完整 | 内置一组离线可用技能，联网技能标记为不可用或需显式开启 |
| 源 Logo 分辨率低 | 高分屏显示模糊 | 预留替换流程，后续换高清图 |

## 11. 维护与版本策略

- 上游：`origin` 只读同步；本地 `aistoc/main` 存定制
- 同步流程：拉取上游 → 合并 → 重放 `aistoc/patches/` → 构建 → 冒烟 → 出包
- 版本号：`1.0.0+aistoc.<构建号>`，关于页同时显示上游 commit
- 每个安装包附带 `build-info.json`：上游 commit、定制版本、构建时间、SHA256

## 12. 实施阶段

| 阶段 | 内容 | 完成标志 |
|---|---|---|
| P0 打包 spike | 验证 bundled 载荷 + NSIS 能产出可运行安装包 | 干净 Win10 虚机断网安装并启动 |
| P1 基础构建 | `aistoc/build/build-installer.ps1`、离线载荷、SHA256/构建清单 | 可重复出包 |
| P2 品牌 | 品牌注入、图标生成、文案与外链替换、默认中文 | 安装后全链路显示 AISTOC |
| P3 首启向导 | 厂商预设、自定义端点、连接测试、配置落盘 | 五个预设与自定义端点均可用 |
| P4 离线加固 | 关闭遥测/更新/在线目录、内置技能与插件策略、验收测试 | 断网验收全过 |

每个阶段结束产出可安装包，不等到最后一次性集成。

## 13. 交付物

1. `AISTOC-Setup-<version>.exe` 安装包
2. `SHA256SUMS.txt` 与 `build-info.json`
3. 安装与配置说明（含内网模型接入、自签证书、杀软处理）
4. 升级与回滚说明
5. 源码定制分支 `aistoc/main` 与补丁清单

## 14. 后续事项（不阻塞第一版）

- 代码签名：待单位提供证书或内网 CA 后接入构建脚本
- Logo 高清版：待提供矢量图或 1024px 以上透明 PNG 后替换
- 私有协议 provider：待确定具体厂商接口文档后按扩展点实现
- 对外商业化：多租户、许可、授权与技术支持体系另行设计
