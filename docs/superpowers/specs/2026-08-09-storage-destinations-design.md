# 存储目的地多后端设计

日期：2026-08-09
状态：已批准

## 背景

gitrieve 的配置支持多个存储目的地（`storage:` 数组），且每个仓库条目的 `storage:` 列表可按名字引用多个目的地：

```yaml
storage:
  - name: localFile
    type: file
    path: ./repo
  - name: s3
    type: s3
    endpoint: ...
    bucket: ...

repository:
  - name: vue
    url: github.com/vuejs/vue
    storage:
      - localFile
      - s3
```

当前选项页只允许选择一个存储后端，存在三个问题：

1. 只能选一个存储目的地，无法配置多个。
2. 选择本地文件时，没有填写本地路径的地方（路径被硬编码为 `./repo`）。
3. 选择 S3 时，信息字段是扁平单组、与单个后端选择绑定，无法按目的地独立配置。

## 决策（经用户确认）

- **多个目的地应用到所有仓库**：选项页配置一份目的地列表，导出时每个仓库条目的 `storage:` 都引用全部目的地。
- **目的地名称用户自定义**：每个目的地提供「名称」输入框，作为配置中的 `name` 字段，仓库条目按名称引用；要求必填且唯一。
- **布局：目的地卡片列表**：一个「存储目的地」区，每个目的地一张卡片（名称 + 类型 + 类型专属字段），可任意增删，通过 JS 渲染。
- **默认值**：默认单个本地文件目的地 `{name:'localFile', type:'file', path:'./repo'}`，保持现有行为不变。
- **迁移**：`loadSettings` 时若旧扁平字段存在且无 `storageDestinations`，自动转换为数组后写回。

## 设计

### 1. 设置数据模型

删除旧扁平字段：`storageBackend`、`s3Endpoint`、`s3Region`、`s3Bucket`、`s3AccessKeyID`、`s3SecretAccessKey`。

新增：

```js
storageDestinations: [
  {
    name: 'localFile',   // 用户自定义，必填、唯一
    type: 'file',        // 'file' | 's3'
    path: './repo',      // type=file 时必填
    endpoint: '',        // 以下仅 type=s3 时使用
    region: '',
    bucket: '',
    accessKeyID: '',
    secretAccessKey: ''
  }
]
```

`DEFAULT_SETTINGS` 在以下三处同步修改（MV3 自包含约束下无法共享，注释互相指向）：
- `src/options/options.js`
- `src/utils/configGenerator.js`
- `src/background/background.js`

**迁移逻辑**（`options.js` 的 `loadSettings`）：
- 存储中有旧扁平字段、且无 `storageDestinations` 时：
  - 旧 `storageBackend='localFile'` → `[{name:'localFile', type:'file', path:'./repo'}]`
  - 旧 `storageBackend='s3'` → `[{name:'s3', type:'s3', endpoint, region, bucket, accessKeyID, secretAccessKey}]`（取自旧字段）
  - 写回 `storageDestinations` 后 `storage.remove()` 移除旧扁平字段。
- 迁移仅在选项页触发。若升级后用户尚未打开选项页，background/configGenerator 读取时 `storageDestinations` 缺失 → 回退默认本地目的地；打开选项页一次即完成迁移。

**约束**：至少保留 1 个目的地（最后一个不可删除）；名称必填且唯一；文件类型路径必填，S3 类型 endpoint/bucket 必填。

### 2. 选项页 UI

**`options.html`**：删除「存储后端」下拉框（`#storage-backend`）与固定 `#s3-fields` 块，替换为「存储目的地」区：

```
存储目的地
┌ 目的地 1 ───────────────────────────────┐
│ 名称 [ archive-local ]  类型 [本地文件 ▾] │
│ 路径 [ /data/repos ]                    │
└─────────────────────────────── [删除] ┘
┌ 目的地 2 ───────────────────────────────┐
│ 名称 [ public-s3 ]     类型 [S3 ▾]      │
│ Endpoint [ s3.example.com ]  Region [ us-east-1 ] │
│ Bucket [ db ]  Access Key [ AKIA… ]  Secret [ •••• ] │
└─────────────────────────────── [删除] ┘
[＋ 添加目的地]
```

**`options.js`**：
- `renderDestinations()`：从 `settings.storageDestinations` 渲染卡片（DOM 构造）。
- `collectDestinations()`：保存时从卡片收集回数组。
- 类型切换时仅显示对应字段（file→路径；s3→五个字段）。
- 保存校验：名称必填/唯一、必填字段齐全，失败则显示状态错误、不保存。
- 事件绑定：添加目的地、删除目的地、类型切换、名称去重提示。

**`options.css`**：新增卡片样式（`.dest-card`、`.dest-actions` 等），沿用现有配色变量。

### 3. 配置生成

**`src/utils/configGenerator.js` 与 `src/background/background.js`**（两处同步改，输出必须一致）：

- `buildStorage(settings)`：`settings.storageDestinations` 缺失或为空时回退 `[{name:'localFile', type:'file', path:'./repo'}]`；否则逐条映射：
  - file → `{name, type:'file', path}`
  - s3 → `{name, type:'s3', endpoint, region, bucket, accessKeyID, secretAccessKey}`
- 仓库条目 `storage:` = `settings.storageDestinations.map(d => d.name)`（含回退时取回退列表的 name）。
- 防御：条目缺 `name`/`type` 时跳过，不中断导出。
- **YAML 引号**：目的地 name 可能含空格/特殊字符，`toYAML` 中 storage 段的 `name:` 与仓库条目 `storage:` 列表项均改用 `yamlQuote()` 处理。
- `DEFAULT_SETTINGS`、`generateRepoConfig`、`buildConfig` 相应更新；`toYAML`/JSON 的 storage 段遍历逻辑已通用，基本复用（空字段照旧跳过）。

### 4. 错误处理

- `chrome.storage.sync.get` 失败 → 沿用现有兜底：回退默认值继续生成，不阻断流程。
- 存储中 `storageDestinations` 畸形/为空 → 视为空，回退默认本地目的地。
- 选项页保存时校验失败 → 不保存，显示错误状态消息。

### 5. 测试

**`src/utils/test.js`**：
- 自定义设置改为 `storageDestinations` 数组，含 2 个目的地（file + s3，如 `archive-local` 与 `public-s3`）。
- 断言：仓库条目引用两个 name（`storage: [archive-local, public-s3]`）；storage 段含两条定义；各字段正确；YAML/JSON 均正确。
- background 冒烟测试的 storage mock 同步改为数组结构。
- 用 `node test.js` 跑通（本机 node 位于 `C:/Program Files/nodejs/node.exe`）。

## 涉及文件

1. `chrome-extension/src/options/options.html`
2. `chrome-extension/src/options/options.js`
3. `chrome-extension/src/options/options.css`
4. `chrome-extension/src/utils/configGenerator.js`
5. `chrome-extension/src/background/background.js`
6. `chrome-extension/src/utils/test.js`

不涉及：`src/popup/popup.js`（仅转发 background 输出，自动继承新结构）、`src/utils/urlUtils.js`、`src/utils/bookmarkProcessor.js`。

## 不做的事

- 不做按仓库分别指定目的地（用户已确认所有目的地应用到所有仓库）。
- 不引入前端框架，保持 vanilla JS + 静态 HTML 的现有风格。
- 不实现除 file/s3 之外的其他存储类型。
- 不合并 background.js 与 utils 的重复逻辑（与自包含方向相悖）。
