# Gitrieve 配置结构对齐设计

日期：2026-08-09
状态：已批准

## 背景

本项目（gitrieve-gleaner）是 [wnarutou/gitrieve](https://github.com/wnarutou/gitrieve) 的配套 Chrome 扩展：从浏览器书签中提取 GitHub 仓库链接，生成 gitrieve 配置。

gitrieve 已更新配置文件格式，新增两项能力：

1. **仓库条目支持用户/组织类型**（`internal/typedef/repository.go`）：
   ```yaml
   - name: me
     orgName: wnarutou
     type: user      # repo / user / org，默认 repo
   ```
   `type: user|org` 会归档该用户/组织的全部仓库。

2. **新增 `server:` 段**（Web UI + API 配置）：
   ```yaml
   server:
     host: 0.0.0.0
     port: "8080"
     dbPath: /app/data/gitrieve.db
     authEnabled: false
     authToken: ""
   ```

## 决策（经用户确认）

- **用户/组织条目：本次不实现**，仅做结构对齐。生成器保持只输出 `url` 型仓库条目。
- **server 段：选项页可配置**，默认值对齐 gitrieve 官方示例，导出时始终包含。
- **方案：结构对齐 + 打通全部选项**（方案 B）。顺带修复"选项页设置不生效"的既有问题。

## 现状分析

- 生产生成路径在 `src/background/background.js`（MV3 service worker，自包含，无 importScripts）。
- `src/utils/configGenerator.js` 仅被 `src/utils/test.js` 使用，是 background.js 的重复实现。
- 两处生成逻辑互相独立，需同步修改以保持一致。
- 选项页（`options.js`）把设置存到 `chrome.storage.sync`，但 background.js 生成时从不读取——选项页当前是"摆设"。

## 设计

### 1. 设置数据模型

选项页与 background.js 各维护一份 `DEFAULT_SETTINGS`（受 MV3 自包含约束无法共享代码，内容保持一致，注释互相指向）。字段：

```js
filterGithub: true,              // 恒真（扩展定位即为 GitHub 专用），不改变行为
removeFragments: true,           // 接入 URL 清理
normalizeUrls: true,             // 接入 URL 规范化
defaultFormat: 'yaml',           // 接入预览初始格式
filenameTemplate: 'gitrieve-config-{date}',  // 接入下载文件名
cronExpression: '0 * * * *',     // 接入仓库条目 cron
storageBackend: 'localFile',     // 接入 storage 段
s3Endpoint: '', s3Region: '', s3Bucket: '',
s3AccessKeyID: '', s3SecretAccessKey: '',   // storageBackend=s3 时使用
downloadReleases: true,          // 以下四项接入仓库条目开关
downloadIssues: true,
downloadWiki: true,
downloadDiscussion: true,
githubToken: 'your_github_token_here',  // 接入全局配置
concurrencyNum: 6,
releaseSizeLimit: 300000000,
releaseNumLimit: 3,
server: {                        // 新增，对齐官方示例
  host: '0.0.0.0',
  port: '8080',
  dbPath: '/app/data/gitrieve.db',
  authEnabled: false,
  authToken: ''
}
```

`server` 段 YAML 按官方示例逐字输出（`port` 带引号、`authEnabled: false` 小写）；仓库条目布尔保持现有 `True/False` 风格（gitrieve 官方示例自身即混用两种风格，无需统一）。

### 2. 配置生成

**`src/utils/configGenerator.js`**：
- `DEFAULT_CONFIG` 增加 `server` 段。
- `generateFullConfig(urls, settings)`：仓库条目 cron/storage/下载开关取自 settings；storage 段按后端生成（localFile 或 s3 全字段）；全局字段与 server 取自 settings。
- `toYAML` 末尾追加 `server:` 段；JSON 路径自动包含（同一配置对象）。

**`src/background/background.js`**：
- 新增 `DEFAULT_SETTINGS`。
- `processBookmarks` 先 `await chrome.storage.sync.get(DEFAULT_SETTINGS)`，再据此生成。
- 内联的 `generateRepoConfig`/`toYAML`/JSON 构造同步改为读设置并输出 server 段。

两处输出必须一致（YAML 与 JSON 均含 server 段）。

### 3. 选项页

**`src/options/options.html`**：
- 新增「server 配置」区：host、port、dbPath 输入框，authEnabled 复选框，authToken 密码框。
- storageBackend 选择 `s3` 时展开 s3 字段输入区（endpoint/region/bucket/accessKeyID/secretAccessKey）。

**`src/options/options.js`**：
- `DEFAULT_SETTINGS`、元素引用、`loadSettings`/`saveSettings`/`resetSettings` 补全新增字段。

### 4. Popup 与 URL 过滤

- `src/popup/popup.js`：下载文件名使用 `filenameTemplate`（替换 `{date}/{time}/{count}`）；预览初始格式用 `defaultFormat`。
- `src/utils/urlUtils.js` 与 background.js 内联版：`removeFragments`/`normalizeUrls` 按设置条件生效（默认 true，行为不变）。
- `filterGithub` 保持恒真，不改变行为。

### 5. 文档与测试

- `README.md` 两处 `github.com/gitrieve/gitrieve` 改为 `github.com/wnarutou/gitrieve`。
- `src/utils/test.js`：更新以验证 YAML/JSON 均包含 server 段；用 `node test.js` 跑通。

## 错误处理

- `chrome.storage.sync.get` 失败时回退默认值继续生成，不阻断流程。
- server 字段为空/缺失时使用默认值。

## 涉及文件

1. `chrome-extension/src/utils/configGenerator.js`
2. `chrome-extension/src/background/background.js`
3. `chrome-extension/src/options/options.html`
4. `chrome-extension/src/options/options.js`
5. `chrome-extension/src/popup/popup.js`
6. `chrome-extension/src/utils/urlUtils.js`
7. `chrome-extension/src/utils/bookmarkProcessor.js`
8. `chrome-extension/src/utils/test.js`
9. `README.md`

## 不做的事

- 不实现 `type: user|org` / `orgName` 条目（后续迭代）。
- 不合并 background.js 与 utils 的重复逻辑（与自包含方向相悖）。
