# V3.0 综合优化进度

## 2026-05-06

- 完成 AI guardrail 检查脚本并让检查通过。
- 修改 `server/lighthouse-server.js`：新增 `/api/ai-provider/chat/completions`、`/api/ai-logs`、AI 请求日志、每日分类额度、重复请求 key、登录卡 IP 黑名单。
- 修改 `api/runtime-api.js`：默认 AI 走同源服务端代理，重复点击复用请求，自定义角色名字/术式/领域加入 UTF-8 字节限制。
- 修改 `modules/api/ai-prompt-builder.js`：新增 `MAX_AI_BATTLE_HISTORY = 20` 和战斗历史压缩。
- 迁移数值编辑器到 `V3.0/Helper/card-value-editor`，修正项目根路径并新增“添加手札”。
- 修改 `index.html` 与 `styles.css`：更新公告/日志，联机房间并排，追加黑白印花集 UI 与移动端轻量样式。
- 修复并验证上传 GUI 脚本 `-RestartOnly`。
- 修复上传 GUI 在远端文件 root-owned 时无法覆盖的问题，改为直传失败后走 `/tmp` + `sudo install`。
- 补充 Nginx `/api/` 代理，避免 AI 代理和日志接口被静态首页兜底。
- 已通过一键上传脚本发布并重启远端服务。
- 已运行语法检查、专项检查、本地服务端 AI 日志烟测、远端 health、远端 AI 日志、远端每日 5 次额度与重复请求检查。
