# Gitrieve 配置结构对齐实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Gitrieve Gleaner 扩展生成的 gitrieve 配置对齐 gitrieve 更新的配置格式——输出 `server:` 段、支持 s3 存储后端输出，并打通选项页全部设置。

**Architecture:** 生产路径在自包含的 `background.js`（MV3 service worker），`src/utils/configGenerator.js` 是仅被 `test.js` 使用的重复实现。两处生成逻辑同步修改，保证 YAML/JSON 输出一致。选项页设置存于 `chrome.storage.sync`，`background.js` 生成时读取并据此生成配置。

**Tech Stack:** 原生 JavaScript（Chrome Extension Manifest V3）、`chrome.storage.sync`、Node 22（仅用于 `npm test` 验证，运行于 devcontainer）。

## Global Constraints

- **验证环境**：本机（Windows 宿主）未安装 Node.js。所有 `node` / `npm test` 步骤需在 devcontainer（Node 22）或用户的 Node 环境中运行。实现者若在本机无法执行，应在提交后说明"需在 devcontainer 运行 `npm test` 验证"。
- **`DEFAULT_SETTINGS` 三处同步**：`src/options/options.js`、`src/background/background.js`、`src/utils/configGenerator.js` 各维护一份相同的 `DEFAULT_SETTINGS`（MV3 自包含约束下无法共享），每份加注释 `// 与 .../DEFAULT_SETTINGS 保持一致`。
- **输出键名**：设置键为 `concurrencyNum`（选项 UI），输出配置键为 `cocurrencyNum`（gitrieve 结构体 yaml tag，拼写如此，勿改）。
- **`server:` 段 YAML 格式**（对齐 gitrieve `config/example.config.yaml`）：`port` 始终带双引号输出；`authEnabled` 用小写 `true`/`false`；`authToken` 带双引号并转义 `\` 和 `"`。仓库条目的布尔值保持现有 `True`/`False` 风格。
- **两处输出一致性**：`background.js` 与 `configGenerator.js` 生成的 YAML/JSON 必须逐字一致。
- **`filterGithub` 保持恒真**：扩展定位即 GitHub 专用，该设置不改变行为，不改动提取逻辑。
- **storage 后端命名**：后端名即 `storageBackend` 值本身（`localFile` 或 `s3`）。仓库条目 `storage:` 列表引用该名称，storage 段定义同名条目。
- **`server` 为嵌套对象**：`chrome.storage.sync.get` 按顶层键读写，`server` 作为单个对象键整体存储。读取后需与默认值浅合并：`{ ...DEFAULT_SETTINGS.server, ...(settings.server || {}) }`。
- 变更文件：9 个（见 spec `docs/superpowers/specs/2026-08-09-gitrieve-config-alignment-design.md`）。

---

### Task 1: configGenerator.js — 设置模型 + server 段 + s3 存储

**Files:**
- Modify: `chrome-extension/src/utils/configGenerator.js`
- Modify: `chrome-extension/src/utils/test.js`

**Interfaces:**
- Produces: `ConfigGenerator.DEFAULT_SETTINGS`（static getter，返回设置默认值对象）、`generateRepoConfig(url, title, settings)`（第三参数）、`generateFullConfig(githubUrls, settings)`（第二参数改为设置对象）、`toYAML(config)`（输出含 `server:` 段）、`generateYAML(githubUrls, settings)`、`generateJSON(githubUrls, settings)`。
- Consumes: 无（`test.js` 传入的 settings 对象为设置模型，见 Task 1 Step 1 代码）。

- [ ] **Step 1: 在 test.js 添加失败测试（配置生成断言）**

在 `src/utils/test.js` 末尾（`try { ... }` 块内，`=== 配置生成测试 ===` 之后）追加断言辅助函数与断言。先插入辅助函数（文件顶部 `const ConfigGenerator = require(...)` 之后）：

```js
const failed = [];
function assert(condition, message) {
  if (condition) {
    console.log('  PASS: ' + message);
  } else {
    failed.push(message);
    console.error('  FAIL: ' + message);
  }
}
```

在 `console.log('生成的JSON配置:'); console.log(jsonConfig);` 之后追加：

```js
console.log('\n=== 配置生成断言（server 段 / s3 / 自定义设置）===');

const customSettings = {
  cronExpression: '0 6 * * *',
  storageBackend: 's3',
  s3Endpoint: 's3.example.com',
  s3Region: 'us-east-1',
  s3Bucket: 'my-bucket',
  s3AccessKeyID: 'AKIAEXAMPLE',
  s3SecretAccessKey: 'secret-key',
  downloadReleases: false,
  server: { host: '127.0.0.1', port: '9000', dbPath: 'gitrieve.db', authEnabled: true, authToken: 'tok"en' }
};

const yamlCustom = ConfigGenerator.generateYAML(uniqueUrls, customSettings);
assert(yamlCustom.includes('server:'), 'YAML 包含 server: 段');
assert(yamlCustom.includes('  host: 127.0.0.1'), 'YAML server.host 生效');
assert(yamlCustom.includes('  port: "9000"'), 'YAML server.port 带引号');
assert(yamlCustom.includes('  authEnabled: true'), 'YAML server.authEnabled 小写 true');
assert(yamlCustom.includes('  authToken: "tok\\"en"'), 'YAML server.authToken 引号转义');
assert(yamlCustom.includes('cron: "0 6 * * *"'), '自定义 cron 生效');
assert(yamlCustom.includes('    storage:\n      - s3'), '仓库条目引用 s3 后端');
assert(yamlCustom.includes('  - name: s3'), 'storage 段包含 s3 条目');
assert(yamlCustom.includes('    type: s3'), 'storage 段 s3 类型');
assert(yamlCustom.includes('    endpoint: s3.example.com'), 'storage 段 endpoint');
assert(yamlCustom.includes('downloadReleases: False'), 'downloadReleases=false 生效');

const jsonCustom = ConfigGenerator.generateJSON(uniqueUrls, customSettings);
assert(jsonCustom.includes('"server"'), 'JSON 包含 server 段');
assert(jsonCustom.includes('"cocurrencyNum": 6'), 'JSON 输出键为 cocurrencyNum');

const yamlDefault = ConfigGenerator.generateYAML(uniqueUrls);
assert(yamlDefault.includes('server:'), '默认配置也包含 server: 段');
assert(yamlDefault.includes('  host: 0.0.0.0'), '默认 server.host 为 0.0.0.0');
assert(yamlDefault.includes('  port: "8080"'), '默认 server.port 为 "8080"');

if (failed.length > 0) {
  console.error('\n共 ' + failed.length + ' 项断言失败');
  process.exitCode = 1;
} else {
  console.log('\n全部配置生成断言通过');
}
```

- [ ] **Step 2: 运行测试确认失败**

Run（在 devcontainer 中）：`cd chrome-extension && npm test`

Expected: 输出大量 `FAIL`（`YAML 包含 server: 段` 等），最终 `共 N 项断言失败`，退出码非 0。

- [ ] **Step 3: 实现 configGenerator.js**

修改 `generateRepoConfig` 签名与内容：

```js
  static generateRepoConfig(url, title = '', settings = {}) {
    const urlParts = url.split('/');
    const domainIndex = urlParts.findIndex(part => part.includes('github.com'));

    if (domainIndex === -1 || domainIndex + 2 >= urlParts.length) {
      throw new Error(`无效的GitHub URL: ${url}`);
    }

    const owner = urlParts[domainIndex + 1];
    const repo = urlParts[domainIndex + 2];
    const name = title && title.trim() ? this.sanitizeName(title) : repo;
    const backend = settings.storageBackend || 'localFile';

    return {
      name: name,
      url: `github.com/${owner}/${repo}`,
      cron: settings.cronExpression || '0 * * * *',
      storage: [backend],
      useCache: true,
      allBranches: true,
      depth: 0,
      downloadReleases: settings.downloadReleases !== false,
      downloadIssues: settings.downloadIssues !== false,
      downloadWiki: settings.downloadWiki !== false,
      downloadDiscussion: settings.downloadDiscussion !== false
    };
  }
```

新增 `DEFAULT_SETTINGS` static getter（放在 `DEFAULT_CONFIG` 之后）：

```js
  /**
   * 默认设置模型（与 options.js / background.js 的 DEFAULT_SETTINGS 保持一致）
   */
  static get DEFAULT_SETTINGS() {
    return {
      filterGithub: true,
      removeFragments: true,
      normalizeUrls: true,
      defaultFormat: 'yaml',
      filenameTemplate: 'gitrieve-config-{date}',
      cronExpression: '0 * * * *',
      storageBackend: 'localFile',
      s3Endpoint: '',
      s3Region: '',
      s3Bucket: '',
      s3AccessKeyID: '',
      s3SecretAccessKey: '',
      downloadReleases: true,
      downloadIssues: true,
      downloadWiki: true,
      downloadDiscussion: true,
      githubToken: 'your_github_token_here',
      concurrencyNum: 6,
      releaseSizeLimit: 300000000,
      releaseNumLimit: 3,
      server: {
        host: '0.0.0.0',
        port: '8080',
        dbPath: '/app/data/gitrieve.db',
        authEnabled: false,
        authToken: ''
      }
    };
  }
```

在 `DEFAULT_CONFIG` 中追加 `server`（`releaseNumLimit` 之后）：

```js
      releaseNumLimit: 3,
      server: {
        host: '0.0.0.0',
        port: '8080',
        dbPath: '/app/data/gitrieve.db',
        authEnabled: false,
        authToken: ''
      }
```

替换 `generateFullConfig` 整个方法：

```js
  static generateFullConfig(githubUrls, settings = {}) {
    const merged = { ...this.DEFAULT_SETTINGS, ...settings };
    merged.server = { ...this.DEFAULT_SETTINGS.server, ...(settings.server || {}) };

    const config = {
      repository: githubUrls.map(urlObj =>
        this.generateRepoConfig(urlObj.url, urlObj.title, merged)
      ),
      storage: merged.storageBackend === 's3'
        ? [{
            name: 's3',
            type: 's3',
            endpoint: merged.s3Endpoint,
            region: merged.s3Region,
            bucket: merged.s3Bucket,
            accessKeyID: merged.s3AccessKeyID,
            secretAccessKey: merged.s3SecretAccessKey
          }]
        : [{ name: 'localFile', type: 'file', path: './repo' }],
      githubToken: merged.githubToken,
      cocurrencyNum: merged.concurrencyNum,
      releaseSizeLimit: merged.releaseSizeLimit,
      releaseNumLimit: merged.releaseNumLimit,
      server: { ...merged.server }
    };

    return config;
  }
```

在 `toYAML` 的 `releaseNumLimit` 一行之后、`return yamlLines.join('\n');` 之前追加 server 段：

```js
    const server = config.server || this.DEFAULT_CONFIG.server;
    yamlLines.push('server:');
    yamlLines.push('  host: ' + server.host);
    yamlLines.push('  port: "' + server.port + '"');
    yamlLines.push('  dbPath: ' + server.dbPath);
    yamlLines.push('  authEnabled: ' + (server.authEnabled ? 'true' : 'false'));
    yamlLines.push('  authToken: "' + String(server.authToken).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');
```

- [ ] **Step 4: 运行测试确认通过**

Run（devcontainer）：`cd chrome-extension && npm test`

Expected: 全部 `PASS`，末尾 `全部配置生成断言通过`，退出码 0。

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/utils/configGenerator.js chrome-extension/src/utils/test.js
git commit -m "feat(config): 配置生成对齐新格式，支持 server 段与 s3 存储"
```

---

### Task 2: urlUtils.js — removeFragments/normalizeUrls 设置接入

**Files:**
- Modify: `chrome-extension/src/utils/urlUtils.js`
- Modify: `chrome-extension/src/utils/test.js`

**Interfaces:**
- Consumes: Task 1 的 `ConfigGenerator.DEFAULT_SETTINGS` 字段名（`removeFragments`、`normalizeUrls`）。
- Produces: `UrlUtils.cleanUrl(url, settings)`、`isGitHubRepoUrl(url, settings)`、`extractRepoInfo(url, settings)`、`normalizeGitHubUrl(url, settings)`、`extractGitHubUrlsFromBookmarks(nodes, settings)`——均接受第二参数 `settings = {}`，缺省行为不变（默认 `removeFragments`/`normalizeUrls` 为 true）。

- [ ] **Step 1: 在 test.js 添加失败测试（URL 过滤设置）**

在 `=== URL清理测试 ===` 部分（`normalizeGitHubUrl` 的 forEach 之后）追加：

```js
console.log('\n=== URL 过滤设置测试 ===');
const flagTests = [
  {
    url: 'https://github.com/user/repo#readme',
    settings: { removeFragments: true, normalizeUrls: true },
    isRepo: true,
    desc: 'removeFragments=true 时带#片段识别为仓库'
  },
  {
    url: 'https://github.com/user/repo#readme',
    settings: { removeFragments: false, normalizeUrls: true },
    isRepo: false,
    desc: 'removeFragments=false 时带#片段不识别为仓库'
  },
  {
    url: 'http://github.com/user/repo/',
    settings: { removeFragments: true, normalizeUrls: false },
    normalized: 'http://github.com/user/repo/',
    desc: 'normalizeUrls=false 时保留http与尾斜杠'
  }
];
flagTests.forEach(t => {
  const isRepo = UrlUtils.isGitHubRepoUrl(t.url, t.settings);
  if (t.isRepo !== undefined) {
    assert(isRepo === t.isRepo, t.desc);
  } else {
    assert(UrlUtils.normalizeGitHubUrl(t.url, t.settings) === t.normalized, t.desc);
  }
});
```

（`assert` 辅助函数已在 Task 1 Step 1 中定义于文件顶部。）

- [ ] **Step 2: 运行测试确认失败**

Run（devcontainer）：`cd chrome-extension && npm test`

Expected: URL 过滤设置测试输出 `FAIL`（当前 `cleanUrl` 无条件剥离）。

- [ ] **Step 3: 实现 urlUtils.js**

替换 `cleanUrl`：

```js
  static cleanUrl(url, settings = {}) {
    if (!url || typeof url !== 'string') return '';

    let cleaned = url;
    if (settings.removeFragments !== false) cleaned = cleaned.split('#')[0];
    if (settings.normalizeUrls !== false) {
      cleaned = cleaned.replace(/\/$/, '').replace(/^http:/, 'https:');
    }
    return cleaned;
  }
```

替换 `isGitHubRepoUrl`、`extractRepoInfo`、`normalizeGitHubUrl` 的签名与内部调用（把 `cleanUrl(x)` 改为 `cleanUrl(x, settings)`，并让各方法接受 `settings = {}` 参数）：

```js
  static isGitHubRepoUrl(url, settings = {}) {
    if (!url || typeof url !== 'string') return false;
    return this.GITHUB_REPO_REGEX.test(this.cleanUrl(url, settings));
  }
```
```js
  static extractRepoInfo(url, settings = {}) {
    if (!this.isGitHubRepoUrl(url, settings)) return null;

    const cleaned = this.cleanUrl(url, settings);
    const parts = cleaned.split('/');

    const domainIndex = parts.findIndex(part => part.includes('github.com'));
    if (domainIndex === -1 || domainIndex + 2 >= parts.length) return null;

    return { owner: parts[domainIndex + 1], repo: parts[domainIndex + 2] };
  }
```
```js
  static normalizeGitHubUrl(url, settings = {}) {
    if (!this.isGitHubRepoUrl(url, settings)) return url;

    const cleaned = this.cleanUrl(url, settings);
    const info = this.extractRepoInfo(cleaned, settings);

    if (!info) return cleaned;

    return `https://github.com/${info.owner}/${info.repo}`;
  }
```

修改 `extractGitHubUrlsFromBookmarks` 签名并透传 settings（`traverseNodes` 内两处调用改为带 settings）：

```js
  static extractGitHubUrlsFromBookmarks(bookmarkNodes, settings = {}) {
    const githubUrls = [];

    function traverseNodes(nodes) {
      if (!nodes || !Array.isArray(nodes)) return;

      for (const node of nodes) {
        if (node.url && UrlUtils.isGitHubRepoUrl(node.url, settings)) {
          const normalizedUrl = UrlUtils.normalizeGitHubUrl(node.url, settings);
          githubUrls.push({
            url: normalizedUrl,
            title: node.title || '',
            originalUrl: node.url
          });
        }

        if (node.children && Array.isArray(node.children)) {
          traverseNodes(node.children);
        }
      }
    }

    traverseNodes(bookmarkNodes);
    return githubUrls;
  }
```

- [ ] **Step 4: 运行测试确认通过**

Run（devcontainer）：`cd chrome-extension && npm test`

Expected: URL 过滤设置测试全部 `PASS`，且此前配置断言仍通过。

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/utils/urlUtils.js chrome-extension/src/utils/test.js
git commit -m "feat(url): removeFragments/normalizeUrls 设置接入 URL 处理"
```

---

### Task 3: 选项页 — server 配置区 + s3 字段

**Files:**
- Modify: `chrome-extension/src/options/options.html`
- Modify: `chrome-extension/src/options/options.js`

**Interfaces:**
- Consumes: Task 1 定义的 `DEFAULT_SETTINGS` 字段名（server 对象、s3 各字段）。
- Produces: 扩展后的 `DEFAULT_SETTINGS`（含 `s3Endpoint` 等、`server` 对象）；`elements` 中新增 DOM 引用：`s3Fields`、`s3Endpoint`、`s3Region`、`s3Bucket`、`s3AccessKeyID`、`s3SecretAccessKey`、`serverHost`、`serverPort`、`serverDbPath`、`serverAuthEnabled`、`serverAuthToken`。供 Task 4（background.js 读取同一份 storage 键）使用。

- [ ] **Step 1: 更新 options.html**

在 `storage-backend` 的 `config-item`（`<p class="help-text">选择gitrieve使用的存储后端</p>` 之后、`</div>` 结束）之后追加 s3 字段块：

```html
                    <div id="s3-fields" class="hidden">
                        <div class="config-item">
                            <label for="s3-endpoint">Endpoint</label>
                            <input type="text" id="s3-endpoint" placeholder="如 s3.us-west-000.backblazeb2.com">
                            <p class="help-text">S3 兼容存储的 endpoint（Backblaze B2 等）</p>
                        </div>
                        <div class="config-item">
                            <label for="s3-region">Region</label>
                            <input type="text" id="s3-region" placeholder="如 us-west-000">
                        </div>
                        <div class="config-item">
                            <label for="s3-bucket">Bucket</label>
                            <input type="text" id="s3-bucket">
                        </div>
                        <div class="config-item">
                            <label for="s3-access-key">Access Key ID</label>
                            <input type="text" id="s3-access-key">
                        </div>
                        <div class="config-item">
                            <label for="s3-secret-key">Secret Access Key</label>
                            <input type="password" id="s3-secret-key">
                        </div>
                    </div>
```

在「全局配置选项」`config-group` 的闭合 `</div>`（release-num-limit 之后）之后、`<div class="action-buttons">` 之前追加 server 配置区：

```html
                <div class="config-group">
                    <h3>server 配置（Web UI）</h3>
                    <div class="config-item">
                        <label for="server-host">Host</label>
                        <input type="text" id="server-host" value="0.0.0.0">
                        <p class="help-text">Web UI 监听地址，默认 0.0.0.0</p>
                    </div>
                    <div class="config-item">
                        <label for="server-port">Port</label>
                        <input type="text" id="server-port" value="8080">
                        <p class="help-text">Web UI 端口，示例使用字符串 "8080"</p>
                    </div>
                    <div class="config-item">
                        <label for="server-dbpath">数据库路径 (dbPath)</label>
                        <input type="text" id="server-dbpath" value="/app/data/gitrieve.db">
                        <p class="help-text">SQLite 数据库路径，Docker 下建议指向挂载卷</p>
                    </div>
                    <div class="config-item">
                        <label>
                            <input type="checkbox" id="server-authenabled">
                            启用 API 认证 (authEnabled)
                        </label>
                        <p class="help-text">为 Web API 启用 bearer token 认证</p>
                    </div>
                    <div class="config-item">
                        <label for="server-authtoken">认证 Token (authToken)</label>
                        <input type="password" id="server-authtoken" value="">
                    </div>
                </div>
```

- [ ] **Step 2: 更新 options.js — DEFAULT_SETTINGS 与 elements**

在 `DEFAULT_SETTINGS` 中、`storageBackend: 'localFile',` 之后追加：

```js
    s3Endpoint: '',
    s3Region: '',
    s3Bucket: '',
    s3AccessKeyID: '',
    s3SecretAccessKey: '',
```

在 `DEFAULT_SETTINGS` 末尾（`releaseNumLimit: 3` 之后、闭合 `};` 之前）追加：

```js
    server: {
        host: '0.0.0.0',
        port: '8080',
        dbPath: '/app/data/gitrieve.db',
        authEnabled: false,
        authToken: ''
    }
```

（顶部加注释：`// 与 src/utils/configGenerator.js 和 src/background/background.js 的 DEFAULT_SETTINGS 保持一致`）

在 `elements` 对象中、`storageBackend` 之后追加：

```js
    s3Fields: document.getElementById('s3-fields'),
    s3Endpoint: document.getElementById('s3-endpoint'),
    s3Region: document.getElementById('s3-region'),
    s3Bucket: document.getElementById('s3-bucket'),
    s3AccessKeyID: document.getElementById('s3-access-key'),
    s3SecretAccessKey: document.getElementById('s3-secret-key'),
```

在 `elements` 对象中、`releaseNumLimit` 之后追加：

```js
    serverHost: document.getElementById('server-host'),
    serverPort: document.getElementById('server-port'),
    serverDbPath: document.getElementById('server-dbpath'),
    serverAuthEnabled: document.getElementById('server-authenabled'),
    serverAuthToken: document.getElementById('server-authtoken'),
```

- [ ] **Step 3: 更新 options.js — 绑定与切换**

在 `bindEvents` 中追加：

```js
    // 存储后端切换时显示/隐藏 s3 字段
    elements.storageBackend.addEventListener('change', updateS3FieldsVisibility);
```

新增函数（放在 `bindEvents` 之后）：

```js
function updateS3FieldsVisibility() {
    elements.s3Fields.classList.toggle('hidden', elements.storageBackend.value !== 's3');
}
```

- [ ] **Step 4: 更新 options.js — load/save/reset**

`loadSettings` 中、`elements.storageBackend.value = settings.storageBackend;` 之后追加：

```js
        elements.s3Endpoint.value = settings.s3Endpoint;
        elements.s3Region.value = settings.s3Region;
        elements.s3Bucket.value = settings.s3Bucket;
        elements.s3AccessKeyID.value = settings.s3AccessKeyID;
        elements.s3SecretAccessKey.value = settings.s3SecretAccessKey;
```

`loadSettings` 中、`elements.releaseNumLimit.value = settings.releaseNumLimit;` 之后追加：

```js
        elements.serverHost.value = settings.server.host;
        elements.serverPort.value = settings.server.port;
        elements.serverDbPath.value = settings.server.dbPath;
        elements.serverAuthEnabled.checked = settings.server.authEnabled;
        elements.serverAuthToken.value = settings.server.authToken;
        updateS3FieldsVisibility();
```

`saveSettings` 的 settings 对象中、`storageBackend` 之后追加：

```js
            s3Endpoint: elements.s3Endpoint.value,
            s3Region: elements.s3Region.value,
            s3Bucket: elements.s3Bucket.value,
            s3AccessKeyID: elements.s3AccessKeyID.value,
            s3SecretAccessKey: elements.s3SecretAccessKey.value,
```

`saveSettings` 的 settings 对象中、`releaseNumLimit` 之后追加：

```js
            server: {
                host: elements.serverHost.value,
                port: elements.serverPort.value,
                dbPath: elements.serverDbPath.value,
                authEnabled: elements.serverAuthEnabled.checked,
                authToken: elements.serverAuthToken.value
            }
```

`resetSettings` 中、`elements.storageBackend.value = DEFAULT_SETTINGS.storageBackend;` 之后追加 s3 与 server 重置：

```js
        elements.s3Endpoint.value = DEFAULT_SETTINGS.s3Endpoint;
        elements.s3Region.value = DEFAULT_SETTINGS.s3Region;
        elements.s3Bucket.value = DEFAULT_SETTINGS.s3Bucket;
        elements.s3AccessKeyID.value = DEFAULT_SETTINGS.s3AccessKeyID;
        elements.s3SecretAccessKey.value = DEFAULT_SETTINGS.s3SecretAccessKey;
```

`resetSettings` 中、`elements.releaseNumLimit.value = DEFAULT_SETTINGS.releaseNumLimit;` 之后追加：

```js
        elements.serverHost.value = DEFAULT_SETTINGS.server.host;
        elements.serverPort.value = DEFAULT_SETTINGS.server.port;
        elements.serverDbPath.value = DEFAULT_SETTINGS.server.dbPath;
        elements.serverAuthEnabled.checked = DEFAULT_SETTINGS.server.authEnabled;
        elements.serverAuthToken.value = DEFAULT_SETTINGS.server.authToken;
        updateS3FieldsVisibility();
```

更新 `testUrlProcessing`，把当前复选框状态透传给 UrlUtils（保持测试功能与设置一致）：

```js
function testUrlProcessing(url) {
    const settings = {
        removeFragments: elements.removeFragments.checked,
        normalizeUrls: elements.normalizeUrls.checked
    };
    const isGitHub = UrlUtils.isGitHubRepoUrl(url, settings);
    const cleaned = UrlUtils.cleanUrl(url, settings);
    const normalized = UrlUtils.normalizeGitHubUrl(url, settings);

    return {
        original: url,
        isGitHubRepo: isGitHub,
        cleaned: cleaned,
        normalized: normalized
    };
}
```

- [ ] **Step 5: 验证语法**

Run（devcontainer 或本机任一 Node）：`node --check src/options/options.js` 与 `node --check src/utils/urlUtils.js`

Expected: 无输出（语法通过）。本机无 Node 时改用 `npm test`（devcontainer）——`test.js` 会加载 `urlUtils.js`，语法错误会在此暴露。

- [ ] **Step 6: Commit**

```bash
git add chrome-extension/src/options/options.html chrome-extension/src/options/options.js
git commit -m "feat(options): 新增 server 配置区与 s3 存储字段"
```

---

### Task 4: background.js — 读取设置 + 输出 server 段

**Files:**
- Modify: `chrome-extension/src/background/background.js`
- Modify: `chrome-extension/src/utils/test.js`（追加 background 冒烟测试）

**Interfaces:**
- Consumes: Task 1 的 `DEFAULT_SETTINGS` 字段名、Task 3 存入 `chrome.storage.sync` 的键。
- Produces: `processBookmarks()`（async，内部读取设置）、`toYAML(config)`（接受完整 config 对象，输出含 server 段）。冒烟测试依赖 background.js 注册的 `chrome.runtime.onMessage` 处理器。

- [ ] **Step 1: 在 test.js 添加失败测试（background 冒烟）**

在 test.js 文件末尾（整个 `try/catch` 块之后，顶层作用域）追加：

```js
console.log('\n=== background.js 冒烟测试 ===');

// 模拟 chrome API，捕获 message 处理器
let backgroundHandler = null;
global.chrome = {
  bookmarks: {
    getTree: (cb) => cb([
      { id: '0', title: '', children: [
        { id: '1', title: 'Vue', url: 'https://github.com/vuejs/vue' }
      ] }
    ])
  },
  storage: {
    sync: {
      get: (defaults) => Promise.resolve({
        ...defaults,
        server: { ...defaults.server, port: '9000', authEnabled: true }
      })
    }
  },
  runtime: {
    lastError: null,
    onMessage: { addListener: (fn) => { backgroundHandler = fn; } },
    onInstalled: { addListener: () => {} }
  }
};

require('../background/background.js');

backgroundHandler({ action: 'processBookmarks' }, {}, (resp) => {
  assert(resp && resp.success, 'background processBookmarks 成功');
  assert(resp.data.yaml.includes('server:'), 'background YAML 包含 server:');
  assert(resp.data.yaml.includes('  port: "9000"'), 'background 读取 storage 中的 server.port');
  assert(resp.data.yaml.includes('  authEnabled: true'), 'background server.authEnabled 输出');
  assert(resp.data.yaml.includes('cron: "0 * * * *"'), 'background 默认 cron');
  assert(resp.data.json.includes('"server"'), 'background JSON 包含 server 段');
  assert(!resp.data.yaml.includes('undefined'), 'background YAML 无 undefined');

  // 冒烟断言在异步回调内执行，退出码需在此设置
  if (failed.length > 0) {
    console.error('\n共 ' + failed.length + ' 项断言失败');
    process.exitCode = 1;
  } else {
    console.log('\nbackground 冒烟测试断言通过');
  }
});
```

- [ ] **Step 2: 运行测试确认失败**

Run（devcontainer）：`cd chrome-extension && npm test`

Expected: background 冒烟测试输出 `FAIL`（`background processBookmarks 成功` 等——当前 background.js 无 server 段，且 `processBookmarks` 未导出、通过 stub 调用会返回不含 server 的旧结构）。

- [ ] **Step 3: 实现 background.js**

文件顶部（`const GITHUB_REPO_RE` 之后）追加 `DEFAULT_SETTINGS`：

```js
// 与 src/options/options.js 和 src/utils/configGenerator.js 的 DEFAULT_SETTINGS 保持一致
const DEFAULT_SETTINGS = {
  filterGithub: true,
  removeFragments: true,
  normalizeUrls: true,
  defaultFormat: 'yaml',
  filenameTemplate: 'gitrieve-config-{date}',
  cronExpression: '0 * * * *',
  storageBackend: 'localFile',
  s3Endpoint: '',
  s3Region: '',
  s3Bucket: '',
  s3AccessKeyID: '',
  s3SecretAccessKey: '',
  downloadReleases: true,
  downloadIssues: true,
  downloadWiki: true,
  downloadDiscussion: true,
  githubToken: 'your_github_token_here',
  concurrencyNum: 6,
  releaseSizeLimit: 300000000,
  releaseNumLimit: 3,
  server: { host: '0.0.0.0', port: '8080', dbPath: '/app/data/gitrieve.db', authEnabled: false, authToken: '' }
};
```

替换 `cleanUrl`、`isGitHubRepoUrl`、`normalizeGitHubUrl`、`extractGitHubUrls` 以透传 settings（与 Task 2 的 urlUtils.js 行为一致）：

```js
function cleanUrl(url, settings = {}) {
  if (!url || typeof url !== 'string') return '';
  let c = url;
  if (settings.removeFragments !== false) c = c.split('#')[0];
  if (settings.normalizeUrls !== false) c = c.replace(/\/$/, '').replace(/^http:/, 'https:');
  return c;
}

function isGitHubRepoUrl(url, settings = {}) {
  if (!url || typeof url !== 'string') return false;
  return GITHUB_REPO_RE.test(cleanUrl(url, settings));
}

function normalizeGitHubUrl(url, settings = {}) {
  if (!isGitHubRepoUrl(url, settings)) return url;
  const cleaned = cleanUrl(url, settings);
  const parts = cleaned.split('/');
  const idx = parts.findIndex(p => p.includes('github.com'));
  if (idx === -1 || idx + 2 >= parts.length) return cleaned;
  return `https://github.com/${parts[idx + 1]}/${parts[idx + 2]}`;
}

function extractGitHubUrls(bookmarkNodes, settings = {}) {
  const urls = [];
  (function walk(nodes) {
    if (!nodes || !Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node.url && isGitHubRepoUrl(node.url, settings)) {
        urls.push({ url: normalizeGitHubUrl(node.url, settings), title: node.title || '', originalUrl: node.url });
      }
      if (node.children) walk(node.children);
    }
  })(bookmarkNodes);
  return urls;
}
```

替换 `generateRepoConfig`：

```js
function generateRepoConfig(urlObj, settings = {}) {
  const parts = urlObj.url.split('/');
  const idx = parts.findIndex(p => p.includes('github.com'));
  const owner = parts[idx + 1];
  const repo = parts[idx + 2];
  const backend = settings.storageBackend || 'localFile';
  return {
    name: sanitizeName(urlObj.title || repo),
    url: `github.com/${owner}/${repo}`,
    cron: settings.cronExpression || '0 * * * *',
    storage: [backend],
    useCache: true,
    allBranches: true,
    depth: 0,
    downloadReleases: settings.downloadReleases !== false,
    downloadIssues: settings.downloadIssues !== false,
    downloadWiki: settings.downloadWiki !== false,
    downloadDiscussion: settings.downloadDiscussion !== false
  };
}
```

新增 `buildStorage` 与 `buildConfig`：

```js
function buildStorage(settings) {
  if (settings.storageBackend === 's3') {
    return [{
      name: 's3',
      type: 's3',
      endpoint: settings.s3Endpoint,
      region: settings.s3Region,
      bucket: settings.s3Bucket,
      accessKeyID: settings.s3AccessKeyID,
      secretAccessKey: settings.s3SecretAccessKey
    }];
  }
  return [{ name: 'localFile', type: 'file', path: './repo' }];
}

function buildConfig(repos, settings) {
  return {
    repository: repos,
    storage: buildStorage(settings),
    githubToken: settings.githubToken,
    cocurrencyNum: settings.concurrencyNum,
    releaseSizeLimit: settings.releaseSizeLimit,
    releaseNumLimit: settings.releaseNumLimit,
    server: { ...settings.server }
  };
}
```

替换 `toYAML` 为接受完整 config 对象：

```js
function toYAML(config) {
  const lines = ['repository:'];
  config.repository.forEach(r => {
    lines.push(`  - name: ${yamlQuote(r.name)}`, `    url: ${r.url}`, `    cron: "${r.cron}"`, '    storage:');
    r.storage.forEach(s => lines.push(`      - ${s}`));
    lines.push(
      `    useCache: ${r.useCache ? 'True' : 'False'}`,
      `    allBranches: ${r.allBranches ? 'True' : 'False'}`,
      `    depth: ${r.depth}`,
      `    downloadReleases: ${r.downloadReleases ? 'True' : 'False'}`,
      `    downloadIssues: ${r.downloadIssues ? 'True' : 'False'}`,
      `    downloadWiki: ${r.downloadWiki ? 'True' : 'False'}`,
      `    downloadDiscussion: ${r.downloadDiscussion ? 'True' : 'False'}`,
      ''
    );
  });
  config.storage.forEach(s => {
    lines.push('storage:', `  - name: ${s.name}`, `    type: ${s.type}`);
    if (s.path) lines.push(`    path: ${s.path}`);
    if (s.endpoint) lines.push(`    endpoint: ${s.endpoint}`);
    if (s.region) lines.push(`    region: ${s.region}`);
    if (s.bucket) lines.push(`    bucket: ${s.bucket}`);
    if (s.accessKeyID) lines.push(`    accessKeyID: ${s.accessKeyID}`);
    if (s.secretAccessKey) lines.push(`    secretAccessKey: ${s.secretAccessKey}`);
    lines.push('');
  });
  lines.push(
    `githubToken: ${config.githubToken}`,
    `cocurrencyNum: ${config.cocurrencyNum}`,
    `releaseSizeLimit: ${config.releaseSizeLimit}`,
    `releaseNumLimit: ${config.releaseNumLimit}`,
    'server:',
    `  host: ${config.server.host}`,
    `  port: "${config.server.port}"`,
    `  dbPath: ${config.server.dbPath}`,
    `  authEnabled: ${config.server.authEnabled ? 'true' : 'false'}`,
    `  authToken: "${String(config.server.authToken).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  );
  return lines.join('\n');
}
```

替换 `processBookmarks`（改为 async，读取设置）：

```js
function getBookmarkTree() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      resolve(tree);
    });
  });
}

async function processBookmarks() {
  try {
    const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);
    settings.server = { ...DEFAULT_SETTINGS.server, ...(settings.server || {}) };
    const tree = await getBookmarkTree();
    const urls = extractGitHubUrls(tree, settings);
    const unique = dedupeUrls(urls);
    const config = buildConfig(unique.map(u => generateRepoConfig(u, settings)), settings);
    return {
      success: true,
      data: {
        yaml: toYAML(config),
        json: JSON.stringify(config, null, 2),
        urls: unique,
        stats: { totalBookmarks: countBookmarks(tree), githubUrlsFound: urls.length, uniqueUrls: unique.length }
      },
      message: `成功提取 ${unique.length} 个GitHub仓库`
    };
  } catch (e) {
    return { success: false, error: e.message, message: `处理失败: ${e.message}` };
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run（devcontainer）：`cd chrome-extension && npm test`

Expected: background 冒烟测试全部 `PASS`，此前全部断言仍通过。

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/background/background.js chrome-extension/src/utils/test.js
git commit -m "feat(background): 读取选项设置并输出 server 段"
```

---

### Task 5: popup.js — 下载文件名模板 + 默认预览格式

**Files:**
- Modify: `chrome-extension/src/popup/popup.js`

**Interfaces:**
- Consumes: `chrome.storage.sync` 键 `filenameTemplate`、`defaultFormat`（由 Task 3 的选项页写入）。
- Produces: `getDisplaySettings()`（读取 `defaultFormat`/`filenameTemplate`）、`formatFilename(template, count, ext)`。

- [ ] **Step 1: 新增辅助函数**

在 `downloadConfig` 定义之前新增：

```js
async function getDisplaySettings() {
  return chrome.storage.sync.get({
    defaultFormat: 'yaml',
    filenameTemplate: 'gitrieve-config-{date}'
  });
}

function formatFilename(template, count, ext) {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);
  const time = now.toISOString().slice(11, 19).replace(/:/g, '');
  return template
    .replace('{date}', date)
    .replace('{time}', time)
    .replace('{count}', count) + '.' + ext;
}
```

- [ ] **Step 2: 更新 downloadConfig**

替换整个 `downloadConfig` 函数：

```js
async function downloadConfig(format) {
    const config = format === 'yaml' ? currentConfig.yaml : currentConfig.json;
    const ext = format === 'yaml' ? 'yaml' : 'json';
    const settings = await getDisplaySettings();
    const filename = formatFilename(settings.filenameTemplate, currentConfig.urls.length, ext);

    const blob = new Blob([config], { type: format === 'yaml' ? 'text/yaml' : 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
    showNotification(`配置文件已下载: ${filename}`);
}
```

- [ ] **Step 3: 更新 showConfigPreview**

替换 `showConfigPreview`：

```js
async function showConfigPreview() {
    const settings = await getDisplaySettings();
    switchConfigFormat(settings.defaultFormat === 'json' ? 'json' : 'yaml');
    elements.configPreview.classList.remove('hidden');
}
```

- [ ] **Step 4: 验证语法**

Run（devcontainer 或本机任一 Node）：`node --check src/popup/popup.js`

Expected: 无输出（语法通过）。

- [ ] **Step 5: Commit**

```bash
git add chrome-extension/src/popup/popup.js
git commit -m "feat(popup): 下载文件名使用模板，预览默认格式使用设置"
```

---

### Task 6: bookmarkProcessor.js 透传设置 + README 链接修正

**Files:**
- Modify: `chrome-extension/src/utils/bookmarkProcessor.js`
- Modify: `README.md`

**Interfaces:**
- Consumes: Task 1 的 `ConfigGenerator.generateYAML(urls, settings)` / `generateJSON(urls, settings)`、Task 2 的 `UrlUtils.extractGitHubUrlsFromBookmarks(nodes, settings)`。
- Produces: `BookmarkProcessor.processBookmarks()`（从 `chrome.storage.sync` 读取全部已存设置并透传）。

- [ ] **Step 1: 更新 bookmarkProcessor.js 的 processBookmarks**

替换 `processBookmarks` 方法体（`// 2. 提取GitHub URL` 起至 `// 4. 生成配置` 部分）：

```js
      // 2. 读取选项页已保存的设置（未设置项在生成器内部使用默认值）
      const stored = await chrome.storage.sync.get(null);

      // 3. 提取GitHub URL（使用UrlUtils模块，透传 URL 过滤设置）
      const githubUrls = UrlUtils.extractGitHubUrlsFromBookmarks(bookmarkTree, stored);
      console.log(`找到 ${githubUrls.length} 个GitHub仓库URL`);

      // 4. 去重
      const uniqueUrls = UrlUtils.deduplicateUrls(githubUrls);
      console.log(`去重后剩余 ${uniqueUrls.length} 个唯一URL`);

      // 5. 生成配置（透传设置）
      const yamlConfig = ConfigGenerator.generateYAML(uniqueUrls, stored);
      const jsonConfig = ConfigGenerator.generateJSON(uniqueUrls, stored);
```

（其余部分保持不变。`chrome.storage.sync.get(null)` 返回用户已保存的全部键，缺省键由 `generateFullConfig` 内部 `{...DEFAULT_SETTINGS, ...settings}` 补全，无需在此维护第二份默认值。）

- [ ] **Step 2: 修正 README 链接**

`README.md` 中两处 `https://github.com/gitrieve/gitrieve` 改为 `https://github.com/wnarutou/gitrieve`（第 3 行与第 183 行）。用编辑器逐处替换，勿用全局替换（只替换这两个确切链接）。

- [ ] **Step 3: 验证语法 + 全量测试**

Run（devcontainer）：`cd chrome-extension && npm test` 且 `node --check src/utils/bookmarkProcessor.js`

Expected: `npm test` 全部 `PASS`、退出码 0；`node --check` 无输出。

- [ ] **Step 4: Commit**

```bash
git add chrome-extension/src/utils/bookmarkProcessor.js README.md
git commit -m "chore: bookmarkProcessor 透传设置，修正 README gitrieve 链接"
```

---

## Self-Review 记录

**Spec 覆盖**：
- server 段输出（spec §2）→ Task 1（configGenerator）、Task 4（background）。
- 选项页可配置 server（spec §3）→ Task 3。
- 全部选项打通（spec §1/§2）→ Task 3 存、Task 1/4 读用；URL 过滤 Task 2。
- popup 模板/默认格式（spec §4）→ Task 5。
- 文档链接（spec §5）→ Task 6。
- 测试（spec §5）→ Task 1/2/4 内 test.js 断言。
- 用户/组织条目不实现（spec「不做的事」）→ 无对应任务，符合预期。

**Placeholder 扫描**：无 TBD/TODO；每个代码步骤均含完整可粘贴代码。

**类型一致性**：
- 设置键名 `concurrencyNum`（输入）→ `cocurrencyNum`（输出）在 Task 1/4 中一致映射。
- `DEFAULT_SETTINGS` 字段名在 Task 1/3/4 三处一致（server 对象、s3 各字段）。
- `generateRepoConfig(url, title, settings)` 签名在 Task 1 定义、Task 4（background 内联版）遵循。
- `toYAML(config)` 在 Task 4 改为接受完整 config 对象，与 buildConfig 输出对齐。
- `UrlUtils.*(url, settings)` 签名在 Task 2 定义，Task 3 的 `testUrlProcessing` 使用。
