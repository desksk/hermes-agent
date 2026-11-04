# AISTOC Agent 安装说明

本文面向单位内网的部署与使用人员，说明 AISTOC Agent Windows 桌面版的安装、首次模型配置、数据备份和卸载。安装包为单文件 exe，已内置运行时，**安装过程不需要联网**。

## 1. 交付产物

每次构建在 `apps/desktop/release` 下生成以下文件，分发时应一起提供：

| 文件 | 用途 |
|---|---|
| `AISTOC-Setup-<version>-x64.exe` | 安装包，单文件、自包含运行时 |
| `build-info.json` | 构建信息：产物名、字节数、SHA256、上游 commit、构建时间、Python 版本 |
| `SHA256SUMS.txt` | 安装包 SHA256 校验值，格式为 `<hash>  <文件名>` |

当前开发构建的安装包为 `AISTOC-Setup-0.0.0-x64.exe`；正式发布版本号按 `1.0.0+aistoc.<构建号>` 规划，以实际产物名为准。

## 2. 系统要求

- Windows 10 x64 19045（22H2）或更高版本
- Windows 11 x64
- 仅支持 x64，不支持 32 位系统和 ARM64
- 安装、卸载需要管理员权限（UAC 提权）
- 安装包体积较大（当前构建约 2 GB），请预留足够的磁盘空间
- **必须由将来使用该产品的 Windows 账号执行安装**

关于最后一条：安装程序通过 UAC 提权，但安装目录固定在当前用户的 `%LOCALAPPDATA%` 下。如果弹 UAC 时输入的是另一个管理员账号，程序会装到那个管理员账号的 `%LOCALAPPDATA%`，实际使用账号可能看不到或无法正常使用。请始终由使用产品的账号发起安装。

## 3. 安装步骤

1. 用将来使用产品的账号登录 Windows。
2. 校验安装包（PowerShell）：

   ```powershell
   Get-FileHash .\AISTOC-Setup-<version>-x64.exe -Algorithm SHA256
   Get-Content .\SHA256SUMS.txt
   ```

   两者的 SHA256 应完全一致。不一致时不要安装，重新从可信渠道获取安装包，并向构建人员反馈。
3. 双击 `AISTOC-Setup-<version>-x64.exe`。
4. Windows 弹出 UAC 提示时选择“是”。安装程序为 per-machine 模式，会请求管理员权限；安装目录由安装脚本固定为：

   ```text
   %LOCALAPPDATA%\Programs\AISTOC Agent
   ```

   即当前用户目录下的 `C:\Users\<用户名>\AppData\Local\Programs\AISTOC Agent`。安装程序会创建当前用户的桌面快捷方式和开始菜单项。
5. 等待安装完成并启动。整个安装过程不访问网络。

## 4. 首次启动与模型配置

首次启动且未检测到有效模型配置时，会显示“连接你的模型服务”向导。配置完成前无法进入主界面；之后可在“设置 → 模型”中修改。

### 4.1 五个厂商预设

选择预设后，接口地址和默认模型名会自动填入，通常只需填写 API Key。接口地址和模型名仍可按需修改。

| 预设 | 默认接口地址 | 默认模型 |
|---|---|---|
| DeepSeek | `https://api.deepseek.com/v1` | `deepseek-chat` |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | `qwen-plus` |
| 智谱 GLM | `https://open.bigmodel.cn/api/paas/v4` | `glm-4.5` |
| 豆包 / 火山方舟 | `https://ark.cn-beijing.volces.com/api/v3` | `doubao-seed-1-6-250615` |
| Kimi | `https://api.moonshot.cn/v1` | `moonshot-v1-8k` |

以上预设使用厂商公网地址，适用于可访问互联网的环境。内网或自建服务请使用下一节的“自定义 / 内网服务”。

### 4.2 自定义 / 内网服务

选择“自定义 / 内网服务”，填写以下内容：

- **接口地址**：OpenAI 兼容的 Base URL，通常以 `/v1` 结尾。
- **API Key**：该端点的密钥，保存到用户数据目录。若内网服务不校验鉴权，可留空，以服务端要求为准。
- **模型名**：服务端实际提供的模型标识，不能为空。
- **允许明文 HTTP（不加密传输）**：默认关闭。仅当端点只提供 `http://` 且位于可信内网时勾选；勾选后 API Key 和对话内容会以明文传输。

展开“高级选项”可配置：

- **额外 Header**：每行一个，格式为 `Header-Name: value`，例如：

  ```text
  X-Org: aistoc
  X-Env: prod
  ```

- **校验 TLS 证书**：默认开启。内网自签证书优先使用下面的 CA 证书路径，不建议直接关闭校验。
- **自定义 CA 证书路径**：填写内网 CA 的 `.pem` 文件完整路径，例如 `C:\certs\internal-ca.pem`。

关闭 TLS 校验会失去对中间人攻击的防护，仅在确认网络环境可信且无法配置 CA 时临时使用。

### 4.3 测试与完成

点击“保存并测试”。向导会向配置的端点发起最小请求，成功后才进入主界面。常见失败原因：

- DNS 解析失败或连接超时：检查地址、端口、防火墙和代理。
- TLS/证书错误：确认是否自签证书；优先补全 CA 路径，而不是关闭校验。
- 401/403：API Key 无效、过期或权限不足。
- 404：Base URL 路径不正确（是否缺少或多余 `/v1`）。
- 模型名不存在：以服务端返回的模型列表为准。
- 响应格式不符：端点不是 OpenAI 兼容接口，或返回了网关错误页。

### 4.4 配置存放位置

- 用户数据根目录：`%APPDATA%\AISTOC Agent`
- Hermes 运行时数据：`%APPDATA%\AISTOC Agent\hermes`
- 行为配置：`%APPDATA%\AISTOC Agent\hermes\config.yaml`
- 密钥：`%APPDATA%\AISTOC Agent\hermes\.env` 或上游凭据存储，权限限制为当前用户

密钥不会写入安装目录，也不应出现在日志中。不要把该目录或其中的 `.env` 文件外发。

## 5. 未签名程序的提示处理

第一版安装包未做代码签名，Windows SmartScreen 和部分杀毒软件可能拦截或报警。这是未签名程序的预期行为，不代表安装包一定有问题；但**必须先核对 SHA256**，并确认安装包来自单位可信分发渠道。

### 5.1 SmartScreen：Windows 已保护你的电脑

1. 点击提示框中的“更多信息”。
2. 核对显示的应用程序名称与来源。
3. 确认 SHA256 与 `SHA256SUMS.txt` 一致后，点击“仍要运行”。

若没有“仍要运行”按钮，或提示来源明显异常，停止安装并联系分发人员。

### 5.2 UAC：未知发布者

安装和卸载时出现“未知发布者”属于未签名程序的正常提示。确认 exe 来源和哈希无误后选择“是”。

### 5.3 杀毒软件误报

安装包内含 Python 运行时和大量脚本，未签名时可能被启发式引擎误报。

1. 先核对安装包 SHA256。
2. 若文件被隔离，从隔离区恢复；由管理员对**本次分发的安装包**和安装目录 `%LOCALAPPDATA%\Programs\AISTOC Agent` 添加排除项。
3. 若仍被拦截，把安装包、`build-info.json` 和报警截图提交给杀毒软件厂商做误报申诉。
4. 不建议关闭实时防护，也不建议为整个磁盘添加排除。

后续若单位提供代码签名证书或内网 CA，构建侧可直接启用签名，届时 SmartScreen 和“未知发布者”提示会减少或消失，安装流程不变。

## 6. 数据目录与备份

安装目录与用户数据分离。用户数据位于：

```text
%APPDATA%\AISTOC Agent
```

其中包含 `hermes\config.yaml`、密钥文件、会话和记忆等。覆盖安装和回滚不会修改该目录；卸载时是否删除由用户在卸载向导中选择。

### 6.1 备份

1. 完全退出 AISTOC Agent，包括托盘中的后台进程。
2. 在 PowerShell 中执行：

   ```powershell
   $src = Join-Path $env:APPDATA 'AISTOC Agent'
   $dst = Join-Path $env:USERPROFILE ("Desktop\AISTOC-Agent-backup-" + (Get-Date -Format 'yyyyMMdd-HHmmss') + ".zip")
   Compress-Archive -Path $src -DestinationPath $dst
   ```

3. 将生成的 zip 保存到受控位置。备份中包含 API Key 等敏感信息，应按敏感文件保管，不要通过普通聊天工具外发。

备份前应确认程序已退出，否则可能得到不一致的会话文件。

### 6.2 恢复

1. 完全退出程序。
2. 将现有 `%APPDATA%\AISTOC Agent` 改名保留，例如 `AISTOC Agent.old`。
3. 解压备份到 `%APPDATA%`，确认恢复后的路径为 `%APPDATA%\AISTOC Agent`：

   ```powershell
   Expand-Archive -Path .\AISTOC-Agent-backup-<时间戳>.zip -DestinationPath $env:APPDATA -Force
   ```

4. 启动程序并检查模型配置与历史会话。

## 7. 卸载

1. 打开“设置 → 应用 → 已安装的应用”，找到 AISTOC Agent 并选择卸载；也可运行安装目录下的卸载程序。
2. UAC 提示时选择“是”。
3. 卸载程序会询问是否删除本地数据：

   - 选择“否”：保留 `%APPDATA%\AISTOC Agent`，之后重装可继续使用原有配置和会话。
   - 选择“是”：删除 `%APPDATA%\AISTOC Agent`，配置、会话和密钥全部清除，**不可恢复**。

建议在卸载前按第 6 节备份数据。无论是否删除数据，安装目录和快捷方式都会由卸载程序清理。

## 8. 常见问题

| 现象 | 处理 |
|---|---|
| 安装到了错误账号的目录 | 用管理员账号卸载后，由实际使用账号重新安装 |
| 双击无反应或被杀软拦截 | 核对 SHA256，检查隔离区，按 5.3 处理 |
| 首启向导一直提示连接失败 | 按 4.3 的错误分类逐项排查；确认目标机到模型端点的网络可达 |
| 断网时无法对话 | 预期行为；断网时应用仍可启动和查看历史会话，但模型请求会失败并提示错误 |
| 内网自签证书报错 | 优先在高级选项中填写 CA 证书路径，保持 TLS 校验开启 |
| 忘记备份就卸载了 | 若卸载时选择了“否”，数据仍在 `%APPDATA%\AISTOC Agent`；若选择了“是”，无法恢复 |
