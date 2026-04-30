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
