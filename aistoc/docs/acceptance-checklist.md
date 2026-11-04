# AISTOC Agent 验收清单

- 依据：`aistoc/docs/specs/2026-11-03-aistoc-hermes-desktop-design.md` 第 9 节
- 环境：干净 Windows 10 x64 虚拟机，**断网**
- 产物：`AISTOC-Setup-<version>-x64.exe`、`build-info.json`、`SHA256SUMS.txt`
- 记录：逐项验证后在方框中打勾，并在文末“验收记录”中写明结论和截图路径；未实际执行的条目不勾选

## 检查项

- [ ] 干净 Win10 x64 虚机断网安装成功
- [ ] 安装目录为 %LOCALAPPDATA%\Programs\AISTOC Agent
- [ ] 首启向导可用五个预设完成配置
- [ ] 自定义端点支持 HTTP、自签证书、自定义 Header
- [ ] 对话、读写文件、执行命令、技能列表可用
- [ ] 除模型端点外无主动出站请求
- [ ] 覆盖安装保留配置和会话
- [ ] 卸载默认保留用户数据，勾选删除后清理干净

## 验收记录

待人工在干净 Win10 x64 虚机断网执行（未开始，2026-11-04）。
