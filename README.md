# bigdogwoofwoof

咒术转盘 / 咒术回战对战的最简静态运行项目。

这个仓库只保留浏览器运行所需的前端文件、数据文件和本地启动脚本。它不包含历史更新包、审查包、开发中间文件、日志或压缩包。

## 入口

- `index.html`：页面入口，可直接由静态服务器托管。
- `styles.css`：全站样式。
- `modules/main.js`：ESM 模块入口。
- `data/`：转盘、角色、对战、联机和 AI 配置 JSON。
- `api/`、`tool/`、`UI/`、`wheel/`：运行时脚本。

## 本地运行

Windows PowerShell：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\start-site.ps1
```

脚本会在 `4173..4180` 中选择可用端口，并输出访问地址。

停止本地服务器：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\stop-site.ps1
```

也可以使用任意静态服务器：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

然后访问：

```text
http://127.0.0.1:4173/
```

## GitHub Pages

这是纯静态站点，可以直接用 GitHub Pages 部署：

- Branch：`main`
- Folder：`/ (root)`

当前外部 GitHub Pages 地址：

```text
https://maopaotabby.github.io/bigdogwoofwoof/
```

## 联机后端与服务器状态

当前保留两套联机服务：

1. Cloudflare Worker

```text
https://jjk-online-battle.maopaotabby-jjk-life.workers.dev
```

- 用途：GitHub Pages 的默认 HTTPS 联机后端。
- 状态：仍可用，`main` 分支提交修改 Worker 文件后会由 `.githooks/post-commit` 自动部署。
- 监控：`monitor-worker.ps1` 会检查 build、AI timeout、KV 绑定和 AI 配置状态。
- 注意：联机回合裁判 AI 已取消；Worker 只保存房间、锁定行动、延迟 1 秒展示锁定反馈，并把回合交给前端本地规则引擎结算。

2. 腾讯云 Lighthouse

```text
http://119.91.224.223/
http://119.91.224.223/online-room
http://119.91.224.223/health
```

- 用途：国内访问的一体化入口，同时托管静态前端和联机后端。
- 状态：已部署到 Ubuntu 轻量服务器，Nginx 对外提供页面和 `/online-room`，Node systemd 服务负责协议后端。
- 服务名：`bigdogwoofwoof-online.service`
- 部署目录：`/opt/bigdogwoofwoof`
- 房间数据：`/opt/bigdogwoofwoof/server-data/online-rooms.json`
- 注意：当前是 HTTP。由于没有正式域名，Let's Encrypt 不能给裸 IP 发证书，`sslip.io` / `nip.io` 临时域名在当前网络环境不可用。国内用户可直接访问 `http://119.91.224.223/`；正式公开 HTTPS 需要绑定已解析到该服务器的域名后再配置证书。

## 腾讯云一键更新

修改本地代码后，可用以下命令把当前文件夹内容上传并重启腾讯云后端：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\update-tencent-server.ps1
```

默认使用：

```text
HostName = 119.91.224.223
User = ubuntu
KeyFile = C:\Users\15164\.ssh\JJXXiivv666.pem
```

如需跳过 Nginx 配置，只更新代码和 Node 服务：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\update-tencent-server.ps1 -SkipNginx
```

底层脚本是 `deploy-lighthouse.ps1`。它会打包当前项目、上传到服务器、执行 `npm ci --omit=dev`、重启 systemd 服务，并在需要时刷新 Nginx 配置。

## AI 调用状态

- 联机回合内的 AI 裁判已经取消。
- Ark / OpenAI-compatible 的调用逻辑仍保留在项目中：
  - `server/online-battle-worker.js` 里仍有 `resolveTurnWithAi` 等兼容函数，但当前联机回合不会调用。
  - 前端对战结束后的 `AI生成对战过程` 仍走现有 AI 辅助链路，会使用页面内 AI Provider / Ark 兼容配置。
- 因此，Ark AI 可以继续用于“对战结束后生成对战过程 / 对战总结”，但不再参与每回合裁定。

## 当前功能

- 咒术转盘流程抽取。
- 咒术回战对战与角色卡。
- 自定义角色编辑与导入。
- 手札、资源、领域、trial / jackpot 等对战模块。
- AI 辅助配置与本地 fallback。
- 联机 Alpha：房间码、角色选择、行动锁定、自动回合结算和房主踢人。

## 注意

- 默认不需要安装依赖。
- `package.json` 只声明 ESM 类型，方便本地语法检查。
- AI Key 不应提交到仓库；如需 AI 功能，建议使用自托管代理或页面内个人配置。
- 联机 Alpha 需要可用的房间同步后端；本地 mock 只适合同一浏览器或双标签页测试。
