# 存储目的地多后端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让选项页支持配置多个存储目的地（本地文件 / S3），每个目的地可自定义名称与类型专属字段，导出时所有仓库条目引用全部目的地。

**Architecture:** 将设置模型从扁平单后端（`storageBackend` + `s3*` 字段）改为 `storageDestinations` 数组。选项页用 JS 渲染目的地卡片编辑器；`configGenerator.js` 与 `background.js` 两处生成逻辑各自从数组构建 storage 段与仓库引用。数据模型在三个文件（options.js / configGenerator.js / background.js）各自维护 `DEFAULT_SETTINGS`，内容保持一致。

**Tech Stack:** Vanilla JS、Chrome MV3 扩展、`chrome.storage.sync`、Node.js（仅用于运行 `src/utils/test.js`）。

## Global Constraints

- **Node 不在 bash PATH 中**：所有 Node 命令使用全路径 `"C:/Program Files/nodejs/node.exe"`（版本 v24.19.0）。
- **MV3 自包含**：`background.js` 不得引入 importScripts；`DEFAULT_SETTINGS` 在三处各自维护且内容一致，注释互相指向。
- **输出一致性**：`configGenerator.js` 与 `background.js` 生成的 YAML/JSON 必须一致。
- **YAML 引号**：目的地 `name` 可能含空格/特殊字符，storage 段的 `name:` 与仓库条目的 `storage:` 引用均须经 `yamlQuote()` 处理。
- **数据约束**：至少保留 1 个目的地（最后一个不可删除）；名称必填且唯一；`type=file` 需 `path`，`type=s3` 需 `endpoint`/`bucket`。
- **默认值**：`storageDestinations` 缺失或为空时，生成端回退 `[{name:'localFile', type:'file', path:'./repo'}]`。
- **迁移仅在选项页触发**：升级后未打开选项页时，background/configGenerator 读到默认目的地；打开选项页一次即完成迁移并移除旧扁平字段。

---

### Task 1: configGenerator.js 多目的地支持

**Files:**
- Modify: `chrome-extension/src/utils/configGenerator.js`
- Test: `chrome-extension/src/utils/test.js`

**Interfaces:**
- Produces: `ConfigGenerator.resolveDestinations(destinations)` → `Array<{name,type,path?|endpoint?,region?,bucket?,accessKeyID?,secretAccessKey?}>`（缺失/为空回退默认）。
- Consumes: `settings.storageDestinations`（数组，每项含 `name`、`type`，及类型专属字段）。

- [ ] **Step 1: 更新 test.js 的 configGenerator 断言为多目的地结构（先红）**

将 `chrome-extension/src/utils/test.js` 中 `customSettings`（当前第 184-194 行）替换为：

```js
    const customSettings = {
      cronExpression: '0 6 * * *',
      storageDestinations: [
        { name: 'archive-local', type: 'file', path: '/data/repos' },
        {
          name: 'public-s3',
          type: 's3',
          endpoint: 's3.example.com',
          region: 'us-east-1',
          bucket: 'my-bucket',
          accessKeyID: 'AKIAEXAMPLE',
          secretAccessKey: 'secret-key'
        }
      ],
      downloadReleases: false,
      server: { host: '127.0.0.1', port: '9000', dbPath: 'gitrieve.db', authEnabled: true, authToken: 'tok"en' }
    };
```

将配置生成断言块（当前第 196-211 行）中 `storageBackend`/s3 相关断言替换为：

```js
    const yamlCustom = ConfigGenerator.generateYAML(uniqueUrls, customSettings);
    assert(yamlCustom.includes('server:'), 'YAML 包含 server: 段');
    assert(yamlCustom.includes('  host: 127.0.0.1'), 'YAML server.host 生效');
    assert(yamlCustom.includes('  port: "9000"'), 'YAML server.port 带引号');
    assert(yamlCustom.includes('  authEnabled: true'), 'YAML server.authEnabled 小写 true');
    assert(yamlCustom.includes('  authToken: "tok\\"en"'), 'YAML server.authToken 引号转义');
    assert(yamlCustom.includes('cron: "0 6 * * *"'), '自定义 cron 生效');
    assert(yamlCustom.includes('    storage:\n      - archive-local\n      - public-s3'), '仓库条目引用全部目的地');
    assert(yamlCustom.includes('  - name: archive-local'), 'storage 段包含本地目的地');
    assert(yamlCustom.includes('    type: file'), 'storage 段 file 类型');
    assert(yamlCustom.includes('    path: /data/repos'), '本地路径生效');
    assert(yamlCustom.includes('  - name: public-s3'), 'storage 段包含 s3 目的地');
    assert(yamlCustom.includes('    type: s3'), 'storage 段 s3 类型');
    assert(yamlCustom.includes('    endpoint: s3.example.com'), 'storage 段 endpoint');
    assert(yamlCustom.includes('    bucket: my-bucket'), 'storage 段 bucket');
    assert(yamlCustom.includes('downloadReleases: False'), 'downloadReleases=false 生效');
```

在默认配置断言块末尾（`assert(yamlDefault.includes('  port: "8080"'), '默认 server.port 为 "8080"');` 之后）追加：

```js
    assert(yamlDefault.includes('  - name: localFile'), '默认 storage 段含本地目的地');
    assert(yamlDefault.includes('    path: ./repo'), '默认本地路径 ./repo');
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `"C:/Program Files/nodejs/node.exe" chrome-extension/src/utils/test.js`
Expected: configGenerator 新断言 FAIL（`仓库条目引用全部目的地`、`storage 段包含本地目的地` 等），background 冒烟断言仍通过，退出码 1。

- [ ] **Step 3: 实现 configGenerator.js**

在 `chrome-extension/src/utils/configGenerator.js` 的 `DEFAULT_SETTINGS`（第 37-67 行）中，删除以下旧字段：

```js
      storageBackend: 'localFile',
      s3Endpoint: '',
      s3Region: '',
      s3Bucket: '',
      s3AccessKeyID: '',
      s3SecretAccessKey: '',
```

替换为：

```js
      storageDestinations: [
        {
          name: 'localFile',
          type: 'file',
          path: './repo',
          endpoint: '',
          region: '',
          bucket: '',
          accessKeyID: '',
          secretAccessKey: ''
        }
      ],
```

在 `DEFAULT_SETTINGS` getter 之后、`generateRepoConfig` 之前，新增静态方法：

```js
  /**
   * 从设置中解析存储目的地列表，缺失/为空/畸形时回退默认
   * @param {Array} destinations - 设置中的 storageDestinations
   * @returns {Array} 标准化后的目的地列表
   */
  static resolveDestinations(destinations) {
    const valid = Array.isArray(destinations)
      ? destinations.filter(d => d && typeof d.name === 'string' && d.name.trim() && typeof d.type === 'string')
      : [];
    return valid.length > 0 ? valid : [{ name: 'localFile', type: 'file', path: './repo' }];
  }
```

`generateRepoConfig`（第 87 行与第 93 行）：将

```js
    const backend = settings.storageBackend || 'localFile';
```
```js
      storage: [backend],
```

替换为：

```js
    const destinations = this.resolveDestinations(settings.storageDestinations);
```
```js
      storage: destinations.map(d => d.name),
```

`generateFullConfig`（第 131-141 行）：将

```js
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
```

替换为：

```js
      storage: this.resolveDestinations(merged.storageDestinations).map(d => {
        const base = { name: d.name, type: d.type };
        if (d.type === 's3') {
          return {
            ...base,
            endpoint: d.endpoint || '',
            region: d.region || '',
            bucket: d.bucket || '',
            accessKeyID: d.accessKeyID || '',
            secretAccessKey: d.secretAccessKey || ''
          };
        }
        return { ...base, path: d.path || './repo' };
      }),
```

`toYAML`：仓库条目 storage 引用（第 168 行）`yamlLines.push('      - ' + storage);` 改为：

```js
          yamlLines.push('      - ' + this.yamlQuote(storage));
```

storage 段 name（第 186 行）`yamlLines.push('  - name: ' + storage.name);` 改为：

```js
          yamlLines.push('  - name: ' + this.yamlQuote(storage.name));
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `"C:/Program Files/nodejs/node.exe" chrome-extension/src/utils/test.js`
Expected: 全部配置生成断言通过，退出码 0。

- [ ] **Step 5: 提交**

```bash
git add chrome-extension/src/utils/configGenerator.js chrome-extension/src/utils/test.js
git commit -m "feat(config): storageDestinations 数组支持多存储目的地
- configGenerator 按数组生成 storage 段，仓库条目引用全部目的地
- resolveDestinations 缺失/畸形时回退默认本地目的地
- toYAML 目的地名称经 yamlQuote 处理

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: background.js 多目的地支持

**Files:**
- Modify: `chrome-extension/src/background/background.js`
- Test: `chrome-extension/src/utils/test.js`

**Interfaces:**
- Produces: `buildStorage(settings)` → storage 段数组；`generateRepoConfig` 的 `storage` 为全部目的地 name 列表。与 Task 1 输出必须一致。
- Consumes: `settings.storageDestinations`（同 Task 1 结构）。

- [ ] **Step 1: 更新 test.js 的 background 冒烟 mock 与断言（先红）**

在 `chrome-extension/src/utils/test.js` 中，将 background 冒烟 mock 的 `storage.sync.get`（当前第 246-250 行）：

```js
      get: (defaults) => Promise.resolve({
        ...defaults,
        server: { ...defaults.server, port: '9000', authEnabled: true }
      })
```

替换为：

```js
      get: (defaults) => Promise.resolve({
        ...defaults,
        storageDestinations: [
          { name: 'archive-local', type: 'file', path: '/data/repos' },
          { name: 'public-s3', type: 's3', endpoint: 's3.example.com', region: 'us-east-1', bucket: 'my-bucket', accessKeyID: 'AKIA', secretAccessKey: 'sk' }
        ],
        server: { ...defaults.server, port: '9000', authEnabled: true }
      })
```

在冒烟断言块（第 261-277 行）`assert(resp.data.yaml.includes('cron: "0 * * * *"'), 'background 默认 cron');` 之后追加：

```js
  assert(resp.data.yaml.includes('    storage:\n      - archive-local\n      - public-s3'), 'background 仓库条目引用全部目的地');
  assert(resp.data.yaml.includes('  - name: public-s3'), 'background storage 段包含 s3 目的地');
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `"C:/Program Files/nodejs/node.exe" chrome-extension/src/utils/test.js`
Expected: background 冒烟新断言 FAIL（`background 仓库条目引用全部目的地`），退出码 1。

- [ ] **Step 3: 实现 background.js**

在 `chrome-extension/src/background/background.js` 的 `DEFAULT_SETTINGS`（第 8-30 行）中，删除：

```js
  storageBackend: 'localFile',
  s3Endpoint: '',
  s3Region: '',
  s3Bucket: '',
  s3AccessKeyID: '',
  s3SecretAccessKey: '',
```

替换为：

```js
  storageDestinations: [
    {
      name: 'localFile',
      type: 'file',
      path: './repo',
      endpoint: '',
      region: '',
      bucket: '',
      accessKeyID: '',
      secretAccessKey: ''
    }
  ],
```

在 `DEFAULT_SETTINGS` 之后新增模块级函数：

```js
function resolveDestinations(destinations) {
  const valid = Array.isArray(destinations)
    ? destinations.filter(d => d && typeof d.name === 'string' && d.name.trim() && typeof d.type === 'string')
    : [];
  return valid.length > 0 ? valid : [{ name: 'localFile', type: 'file', path: './repo' }];
}
```

`generateRepoConfig`（第 95 行与第 100 行）：将

```js
  const backend = settings.storageBackend || 'localFile';
```
```js
    storage: [backend],
```

替换为：

```js
  const destinations = resolveDestinations(settings.storageDestinations);
```
```js
    storage: destinations.map(d => d.name),
```

`buildStorage`（第 111-124 行）：整体替换为：

```js
function buildStorage(settings) {
  return resolveDestinations(settings.storageDestinations).map(d => {
    const base = { name: d.name, type: d.type };
    if (d.type === 's3') {
      return {
        ...base,
        endpoint: d.endpoint || '',
        region: d.region || '',
        bucket: d.bucket || '',
        accessKeyID: d.accessKeyID || '',
        secretAccessKey: d.secretAccessKey || ''
      };
    }
    return { ...base, path: d.path || './repo' };
  });
}
```

`toYAML`：仓库条目 storage 引用（第 141 行）`r.storage.forEach(s => lines.push(`      - ${s}`));` 改为：

```js
    r.storage.forEach(s => lines.push(`      - ${yamlQuote(s)}`));
```

storage 段 name（第 155 行）`lines.push('storage:', `  - name: ${s.name}`, `    type: ${s.type}`);` 改为：

```js
    lines.push('storage:', `  - name: ${yamlQuote(s.name)}`, `    type: ${s.type}`);
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `"C:/Program Files/nodejs/node.exe" chrome-extension/src/utils/test.js`
Expected: 全部断言通过，退出码 0。

- [ ] **Step 5: 提交**

```bash
git add chrome-extension/src/background/background.js chrome-extension/src/utils/test.js
git commit -m "feat(background): storageDestinations 数组支持多存储目的地
- background 同步 configGenerator 的多目的地生成逻辑
- 冒烟测试 mock 与断言改为多目的地结构

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: 选项页目的地卡片编辑器 + 旧设置迁移

**Files:**
- Modify: `chrome-extension/src/options/options.html`
- Modify: `chrome-extension/src/options/options.js`
- Modify: `chrome-extension/src/options/options.css`

**Interfaces:**
- Produces: `settings.storageDestinations` 数组（选项页保存的数据，结构同 Task 1/2）。
- Consumes: 旧扁平字段（`storageBackend`/`s3Endpoint` 等）用于一次性迁移。

- [ ] **Step 1: 更新 options.html**

在 `chrome-extension/src/options/options.html` 中，将「gitrieve配置模板」区的存储后端下拉框与 `#s3-fields` 块（第 79-111 行，从 `<label for="storage-backend">存储后端</label>` 到 `</div>` 的 s3-fields 结束）整体替换为：

```html
                    <div class="config-item">
                        <label>存储目的地</label>
                        <p class="help-text">gitrieve 会将数据归档到以下目的地，每个仓库条目引用全部目的地。名称必填且唯一，导出后作为配置中的 name 字段。</p>
                        <div id="storage-destinations"></div>
                        <button type="button" id="add-destination-btn" class="btn btn-secondary btn-small">＋ 添加目的地</button>
                    </div>
```

- [ ] **Step 2: 更新 options.css**

在 `chrome-extension/src/options/options.css` 末尾追加：

```css
/* 存储目的地卡片 */
.dest-card {
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background-color: white;
}

.dest-card-row {
    display: flex;
    gap: var(--spacing-md);
    align-items: flex-end;
    margin-bottom: var(--spacing-sm);
}

.dest-card-row .config-item {
    flex: 1;
    margin-bottom: 0;
}

.dest-card-row .config-item input[type="text"],
.dest-card-row .config-item select {
    width: 100%;
}

.dest-remove-btn {
    flex-shrink: 0;
}
```

- [ ] **Step 3: 更新 options.js**

**3a. DEFAULT_SETTINGS**：删除 `storageBackend`/`s3Endpoint`/`s3Region`/`s3Bucket`/`s3AccessKeyID`/`s3SecretAccessKey`，替换为：

```js
    storageDestinations: [
        {
            name: 'localFile',
            type: 'file',
            path: './repo',
            endpoint: '',
            region: '',
            bucket: '',
            accessKeyID: '',
            secretAccessKey: ''
        }
    ],
```

**3b. 模块级变量**：在 `const elements = {...}` 之后新增：

```js
// 当前正在编辑的目的地列表（渲染期间的数据源）
let destinationState = [];

// 旧扁平存储字段（一次性迁移用）
const LEGACY_STORAGE_KEYS = ['storageBackend', 's3Endpoint', 's3Region', 's3Bucket', 's3AccessKeyID', 's3SecretAccessKey'];
```

**3c. elements 引用**：删除 `storageBackend`/`s3Fields`/`s3Endpoint`/`s3Region`/`s3Bucket`/`s3AccessKeyID`/`s3SecretAccessKey` 引用，替换为：

```js
    storageDestinations: document.getElementById('storage-destinations'),
    addDestinationBtn: document.getElementById('add-destination-btn'),
```

**3d. bindEvents**：将「存储后端切换时显示/隐藏 s3 字段」监听（`elements.storageBackend.addEventListener('change', updateS3FieldsVisibility);`）替换为：

```js
    // 添加存储目的地
    elements.addDestinationBtn.addEventListener('click', () => {
        destinationState = collectDestinations();
        destinationState.push({ name: '', type: 'file', path: './repo', endpoint: '', region: '', bucket: '', accessKeyID: '', secretAccessKey: '' });
        renderDestinations();
    });
```

**3e. 删除 `updateS3FieldsVisibility` 函数**（整个函数体）。

**3f. 新增目的地渲染/收集/校验/迁移函数**（放在 `updateS3FieldsVisibility` 原位置附近）：

```js
/**
 * 从设置中解析目的地列表，缺失/为空/畸形时回退默认
 */
function resolveDestinations(destinations) {
    const valid = Array.isArray(destinations)
        ? destinations.filter(d => d && typeof d.name === 'string' && typeof d.type === 'string')
        : [];
    return valid.length > 0 ? valid : [{ name: 'localFile', type: 'file', path: './repo' }];
}

/**
 * 将旧扁平存储字段迁移为 storageDestinations 数组
 */
function migrateLegacyStorage(settings) {
    if (settings.storageBackend === 's3') {
        return [{
            name: 's3',
            type: 's3',
            endpoint: settings.s3Endpoint || '',
            region: settings.s3Region || '',
            bucket: settings.s3Bucket || '',
            accessKeyID: settings.s3AccessKeyID || '',
            secretAccessKey: settings.s3SecretAccessKey || ''
        }];
    }
    return [{ name: 'localFile', type: 'file', path: './repo' }];
}

/**
 * 渲染存储目的地卡片列表
 */
function renderDestinations() {
    const container = elements.storageDestinations;
    container.innerHTML = '';
    const list = resolveDestinations(destinationState);
    destinationState = list;
    list.forEach((dest, index) => {
        container.appendChild(buildDestinationCard(dest, index, list.length));
    });
}

/**
 * 构建单个目的地卡片 DOM
 */
function buildDestinationCard(dest, index, total) {
    const card = document.createElement('div');
    card.className = 'dest-card';
    card.dataset.index = index;

    // 第一行：名称 + 类型 + 删除按钮
    const row = document.createElement('div');
    row.className = 'dest-card-row';

    const nameItem = document.createElement('div');
    nameItem.className = 'config-item';
    const nameLabel = document.createElement('label');
    nameLabel.htmlFor = `dest-name-${index}`;
    nameLabel.textContent = '名称';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.id = `dest-name-${index}`;
    nameInput.value = dest.name || '';
    nameInput.placeholder = '如 archive-local';
    nameItem.appendChild(nameLabel);
    nameItem.appendChild(nameInput);
    row.appendChild(nameItem);

    const typeItem = document.createElement('div');
    typeItem.className = 'config-item';
    const typeLabel = document.createElement('label');
    typeLabel.htmlFor = `dest-type-${index}`;
    typeLabel.textContent = '类型';
    const typeSelect = document.createElement('select');
    typeSelect.id = `dest-type-${index}`;
    const optFile = document.createElement('option');
    optFile.value = 'file';
    optFile.textContent = '本地文件';
    const optS3 = document.createElement('option');
    optS3.value = 's3';
    optS3.textContent = 'S3兼容存储';
    typeSelect.appendChild(optFile);
    typeSelect.appendChild(optS3);
    typeSelect.value = dest.type === 's3' ? 's3' : 'file';
    typeSelect.addEventListener('change', () => {
        destinationState = collectDestinations();
        destinationState[index].type = typeSelect.value;
        renderDestinations();
    });
    typeItem.appendChild(typeLabel);
    typeItem.appendChild(typeSelect);
    row.appendChild(typeItem);

    const removeBtn = document.createElement('button');
    removeBtn.type = 'button';
    removeBtn.className = 'btn btn-secondary btn-small dest-remove-btn';
    removeBtn.textContent = '删除';
    removeBtn.disabled = total <= 1;
    removeBtn.addEventListener('click', () => {
        destinationState = collectDestinations();
        if (destinationState.length <= 1) return;
        destinationState.splice(index, 1);
        renderDestinations();
    });
    row.appendChild(removeBtn);

    card.appendChild(row);

    // 类型专属字段
    if (typeSelect.value === 's3') {
        card.appendChild(buildTextField(`dest-endpoint-${index}`, 'Endpoint', dest.endpoint || '', 'S3 兼容存储 endpoint（如 s3.us-west-000.backblazeb2.com）'));
        card.appendChild(buildTextField(`dest-region-${index}`, 'Region', dest.region || ''));
        card.appendChild(buildTextField(`dest-bucket-${index}`, 'Bucket', dest.bucket || ''));
        card.appendChild(buildTextField(`dest-access-key-${index}`, 'Access Key ID', dest.accessKeyID || ''));
        card.appendChild(buildPasswordField(`dest-secret-key-${index}`, 'Secret Access Key', dest.secretAccessKey || '', '此密钥通过 chrome.storage.sync 同步，并会嵌入导出的配置中'));
    } else {
        card.appendChild(buildTextField(`dest-path-${index}`, '路径', dest.path || './repo', '本地归档目录路径'));
    }

    return card;
}

/**
 * 构建文本输入项
 */
function buildTextField(id, labelText, value, help) {
    const item = document.createElement('div');
    item.className = 'config-item';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'text';
    input.id = id;
    input.value = value;
    item.appendChild(label);
    item.appendChild(input);
    if (help) {
        const helpEl = document.createElement('p');
        helpEl.className = 'help-text';
        helpEl.textContent = help;
        item.appendChild(helpEl);
    }
    return item;
}

/**
 * 构建密码输入项
 */
function buildPasswordField(id, labelText, value, help) {
    const item = document.createElement('div');
    item.className = 'config-item';
    const label = document.createElement('label');
    label.htmlFor = id;
    label.textContent = labelText;
    const input = document.createElement('input');
    input.type = 'password';
    input.id = id;
    input.value = value;
    item.appendChild(label);
    item.appendChild(input);
    if (help) {
        const helpEl = document.createElement('p');
        helpEl.className = 'help-text';
        helpEl.textContent = help;
        item.appendChild(helpEl);
    }
    return item;
}

/**
 * 从 DOM 卡片收集目的地列表
 */
function collectDestinations() {
    const cards = elements.storageDestinations.querySelectorAll('.dest-card');
    const list = [];
    cards.forEach((card, index) => {
        const name = card.querySelector(`#dest-name-${index}`).value.trim();
        const type = card.querySelector(`#dest-type-${index}`).value;
        const dest = { name, type, path: './repo', endpoint: '', region: '', bucket: '', accessKeyID: '', secretAccessKey: '' };
        if (type === 's3') {
            dest.endpoint = card.querySelector(`#dest-endpoint-${index}`).value.trim();
            dest.region = card.querySelector(`#dest-region-${index}`).value.trim();
            dest.bucket = card.querySelector(`#dest-bucket-${index}`).value.trim();
            dest.accessKeyID = card.querySelector(`#dest-access-key-${index}`).value.trim();
            dest.secretAccessKey = card.querySelector(`#dest-secret-key-${index}`).value.trim();
        } else {
            dest.path = card.querySelector(`#dest-path-${index}`).value.trim();
        }
        list.push(dest);
    });
    return list;
}

/**
 * 校验目的地列表，返回错误消息数组（空数组=通过）
 */
function validateDestinations(list) {
    const errors = [];
    if (list.length === 0) {
        errors.push('至少需要一个存储目的地');
        return errors;
    }
    const names = new Set();
    list.forEach((d, i) => {
        const label = `目的地 ${i + 1}`;
        if (!d.name) {
            errors.push(`${label}：名称必填`);
        } else if (names.has(d.name)) {
            errors.push(`${label}：名称「${d.name}」重复，名称需唯一`);
        } else {
            names.add(d.name);
        }
        if (d.type === 's3') {
            if (!d.endpoint) errors.push(`${label}（${d.name || '未命名'}）：Endpoint 必填`);
            if (!d.bucket) errors.push(`${label}（${d.name || '未命名'}）：Bucket 必填`);
        } else if (d.type === 'file' && !d.path) {
            errors.push(`${label}（${d.name || '未命名'}）：路径必填`);
        }
    });
    return errors;
}
```

**3g. loadSettings**：将 `elements.storageBackend.value = settings.storageBackend;` 至 `elements.s3SecretAccessKey.value = settings.s3SecretAccessKey;` 以及行尾 `updateS3FieldsVisibility();` 替换为：

```js
        // 存储目的地：迁移旧扁平字段或读取数组
        if (settings.storageBackend !== undefined) {
            destinationState = migrateLegacyStorage(settings);
            await chrome.storage.sync.set({ storageDestinations: destinationState });
            await chrome.storage.sync.remove(LEGACY_STORAGE_KEYS);
        } else {
            destinationState = resolveDestinations(settings.storageDestinations);
        }
        renderDestinations();
```

**3h. saveSettings**：将设置对象中的 `storageBackend: elements.storageBackend.value,`、`s3Endpoint: ...` 等 6 个字段删除。在构建 `settings` 对象之前插入校验：

```js
        const destinations = collectDestinations();
        const validationErrors = validateDestinations(destinations);
        if (validationErrors.length > 0) {
            showStatusMessage('存储目的地配置有误：' + validationErrors.join('；'), true);
            return;
        }
```

并将 `storageBackend`/`s3*` 字段的位置替换为：

```js
            storageDestinations: destinations,
```

**3i. resetSettings**：删除 `elements.storageBackend.value = DEFAULT_SETTINGS.storageBackend;` 至 `elements.s3SecretAccessKey.value = DEFAULT_SETTINGS.s3SecretAccessKey;` 及行尾 `updateS3FieldsVisibility();`，替换为：

```js
        destinationState = DEFAULT_SETTINGS.storageDestinations.map(d => ({ ...d }));
        renderDestinations();
```

- [ ] **Step 4: 语法检查**

Run:
```bash
"C:/Program Files/nodejs/node.exe" --check chrome-extension/src/options/options.js
```
Expected: 无输出，退出码 0。

- [ ] **Step 5: 手动验证（Chrome 扩展）**

在 Chrome 中 `chrome://extensions` 开启开发者模式 → 「加载已解压的扩展程序」→ 选择 `chrome-extension` 目录。验证：

1. **默认渲染**：打开选项页，「存储目的地」区显示一张「本地文件」卡片，路径为 `./repo`，删除按钮置灰。
2. **添加与类型切换**：点「＋ 添加目的地」新增一张卡片；将其类型切换为「S3兼容存储」，字段变为 Endpoint/Region/Bucket/Access Key/Secret；再切回「本地文件」，字段变为路径。
3. **校验**：清空某卡片名称后保存 → 状态消息显示「名称必填」，未保存；清空 S3 的 Bucket 后保存 → 提示 Bucket 必填。
4. **多目的地导出**：配置两张卡片（如 `archive-local` 本地文件 + `public-s3` S3），保存；打开 popup → 「提取GitHub仓库」→ 「预览」，切换 YAML/JSON，确认 storage 段含两条目的地、每个仓库条目 `storage` 引用两个名称。
5. **旧设置迁移**：若此前曾保存过旧扁平设置（storageBackend=s3），升级后首次打开选项页应显示一张自动迁移的 S3 卡片，且旧字段从 storage 中移除（可通过扩展的存储检查或再次保存后 popup 输出确认）。

- [ ] **Step 6: 提交**

```bash
git add chrome-extension/src/options/options.html chrome-extension/src/options/options.js chrome-extension/src/options/options.css
git commit -m "feat(options): 存储目的地卡片编辑器与旧设置迁移
- 支持配置多个存储目的地（本地文件/S3），名称自定义
- 类型切换显示对应字段，保存时校验名称唯一与必填字段
- 旧扁平存储字段自动迁移为 storageDestinations 并移除旧键

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: 全量验证与收尾

**Files:**
- Verify: 全部修改文件

**Interfaces:**
- 无新接口。确认 Task 1-3 输出一致。

- [ ] **Step 1: 运行完整测试**

Run: `"C:/Program Files/nodejs/node.exe" chrome-extension/src/utils/test.js`
Expected: 退出码 0，全部断言通过。

- [ ] **Step 2: 语法检查全部修改的 JS**

Run:
```bash
"C:/Program Files/nodejs/node.exe" --check chrome-extension/src/options/options.js
"C:/Program Files/nodejs/node.exe" --check chrome-extension/src/utils/configGenerator.js
"C:/Program Files/nodejs/node.exe" --check chrome-extension/src/background/background.js
"C:/Program Files/nodejs/node.exe" --check chrome-extension/src/utils/test.js
```
Expected: 均无输出，退出码 0。

- [ ] **Step 3: 核对一致性**

对照 spec 逐条核对（自检清单）：
- [ ] 三处 `DEFAULT_SETTINGS` 均含 `storageDestinations` 且结构一致，无旧扁平字段残留。
- [ ] `configGenerator.js` 与 `background.js` 的 `resolveDestinations`/`buildStorage` 生成逻辑一致。
- [ ] 两个 `toYAML` 均对目的地名称与仓库 storage 引用应用 `yamlQuote`。
- [ ] 迁移逻辑仅在 `options.js`，含 `remove(LEGACY_STORAGE_KEYS)`。
- [ ] 至少 1 个目的地、名称唯一、类型必填字段校验已实现。

- [ ] **Step 4: 提交收尾（若本任务产生改动）**

```bash
git add -A
git commit -m "chore: 存储目的地多后端验证收尾

Co-Authored-By: Claude <noreply@anthropic.com>"
```
（若 Step 1-3 无改动则跳过本步。）
