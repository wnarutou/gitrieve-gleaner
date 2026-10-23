# Gitrieve书签提取器

一个Chrome扩展程序，用于从您的书签中提取GitHub仓库链接，并将其转换为gitrieve配置格式。

## 功能特点

- **自动提取**：扫描您的所有Chrome书签，自动识别GitHub仓库链接
- **智能过滤**：只提取有效的GitHub仓库URL（格式：`github.com/user/repo`）
- **URL清理**：自动移除URL片段标识符（#后的内容）和尾部斜杠
- **去重处理**：自动去除重复的仓库链接
- **配置生成**：将提取的仓库转换为gitrieve YAML/JSON配置格式
- **一键导出**：支持复制到剪贴板或下载配置文件

## 安装方法

### 开发者模式安装

1. 下载或克隆此仓库
2. 打开Chrome浏览器，进入 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `chrome-extension` 文件夹

### 打包安装（推荐用于分发）

1. 在 `chrome://extensions/` 页面点击"打包扩展程序"
2. 选择 `chrome-extension` 文件夹作为扩展根目录
3. 点击"打包扩展程序"按钮生成 `.crx` 文件

## 使用方法

1. 安装扩展后，点击浏览器工具栏中的扩展图标
2. 点击"提取GitHub仓库"按钮
3. 等待处理完成，查看提取结果
4. 选择以下导出选项之一：
   - **复制YAML到剪贴板**：将YAML格式配置复制到剪贴板
   - **下载YAML文件**：下载YAML格式配置文件
   - **复制JSON到剪贴板**：将JSON格式配置复制到剪贴板
   - **预览配置**：在弹出窗口中预览生成的配置

## 配置选项

通过点击扩展弹出窗口中的"选项"按钮或在 `chrome://extensions/` 页面点击扩展详情中的"选项"链接，可以访问配置页面：

- **URL过滤设置**：控制URL提取和清理行为
- **导出设置**：配置默认导出格式和文件名模板
- **gitrieve配置模板**：设置生成的gitrieve配置参数

定时任务支持以下模式：

- **自定义 cron**：将表达式原样用于所有仓库，兼容已有设置
- **每天固定打散**：每个仓库每天执行一次，按仓库 URL 固定分配到全天的具体分钟
- **每周固定打散**：每个仓库每周执行一次，按仓库 URL 固定分配星期、小时和分钟
- **每月固定打散**：每个仓库每月执行一次，按仓库 URL 固定分配到 1–28 日的具体分钟，保证每个月都会执行
- **每日指定时段固定打散**：在用户指定的起止时间内按仓库 URL 固定分配，支持跨午夜

同一批仓库在相同模式和时间范围内会按 URL 得到固定 cron；重复生成配置或调整书签顺序不会改变对应关系。分钟槽足够时，同批仓库不会使用相同 cron；仓库数量超过可用分钟槽时，各槽位会被均衡复用。

生成配置还支持以下 gitrieve 全局运行策略：

- **最大重试次数**（`retryMaxCount`）：GitHub API 请求失败后的最大重试次数，默认 `3`
- **重试基础延迟**（`retryBaseDelay`）：指数退避的基础延迟，默认 `5s`
- **同步逾期宽限时间**（`syncOverdueGrace`）：超过计划执行时间后的逾期判定宽限，默认 `30m`
- **同步卡住阈值**（`syncStuckThreshold`）：`pending` 或 `running` 状态的卡住判定阈值，默认 `24h`
- **执行日志保留月数**（`server.logRetentionMonths`）：自动清理超过该期限的执行日志，默认 `2` 个月
- **GitHub 账号池**（`githubAccounts`）：配置多个不同 GitHub 用户的名称和 Token；非空账号池优先于兼容字段 `githubToken`
- **GitHub 单账号并发数**（`githubAccountConcurrency`）：账号池中每个账号的并发上限，默认 `2`

`retryBaseDelay`、`syncOverdueGrace` 和 `syncStuckThreshold` 使用 Go duration 格式，例如 `500ms`、`30m`、`12h`；`logRetentionMonths` 使用正整数月数。

### 与新版 gitrieve 的兼容性

已核对上游 [2026-10-23 的最新配置（4b7338d）](https://github.com/wnarutou/gitrieve/tree/4b7338d01cdf0b462955ac539eddc0ae2f286bb3)：

- 上游已移除 S3，只接受 `type: file`。扩展支持多个本地文件目的地，每个仓库引用全部目的地。
- 旧 S3 设置不会自动转成本地路径。导出时会提示打开选项页；将旧目的地切换为“本地文件”并填写路径，或删除该目的地，然后保存。打开选项页不会修改原设置，保存成功后才清理旧 S3 字段。
- 路径指向 **gitrieve 的运行环境**。Docker 部署请使用已挂载的容器目录；扩展保留默认 `/app/repo` 和 `/app/data/gitrieve.db`，上游示例的相对仓库路径为 `./repo`。
- GitHub 限流、错峰、重试、健康检查和 server 配置字段保持兼容；并发数的导出键继续使用上游现有拼写 `cocurrencyNum`。
- `server.logRetentionMonths` 与上游默认值 `2` 保持一致；旧版扩展保存的设置缺少该字段时会自动补默认值。
- `githubAccounts` 默认为空列表；每项名称和 Token 必填且名称唯一。非空账号池优先于 `githubToken`，REST、GraphQL 和 GitHub HTTPS Git 操作由 gitrieve 在账号间协调和回退。
- `githubAccountConcurrency` 默认值为 `2`，限制每个池账号的并发请求；`githubApiConcurrency` 仍是整个进程共享的并发上限。
- 上游双账号示例使用 `githubApiConcurrency: 4`、`cocurrencyNum: 12`，这些是示例取值。扩展继续默认输出 `2` 和 `6`，已有自定义设置不变；上游省略这两个字段时的程序默认值分别为 `2` 和 `3`。
- 账号池 Token 会通过 `chrome.storage.sync` 同步到登录 Chrome 的 Google 账号，并以明文嵌入导出的配置，请妥善保管导出文件。

10 月 14 日之后的上游更新未新增或删除上述配置字段。维护模式通过 gitrieve Web UI/API 操作，新增的 `stop_grace_period: 10m` 属于 Docker Compose 参数，不写入扩展生成的配置；Git 网络空闲超时和 Wiki/评论同步修复也无需新增配置项。容器升级流程见[上游维护说明](https://github.com/wnarutou/gitrieve/blob/4b7338d01cdf0b462955ac539eddc0ae2f286bb3/README_zh.md#升级前进入维护模式)。

本次兼容验证使用上游 `ParseImport`、`ValidateImport` 和实际配置读取流程，覆盖默认配置、旧单 Token 设置及含特殊字符的多账号池设置；YAML 与 JSON 的解析结果一致。

选项页与后台共用默认设置和配置生成器，YAML 会保护路径、名称和令牌中的特殊字符。

开发验证：在 `chrome-extension` 下运行 `npm test`，覆盖账号池与其他配置导出、旧设置转换、service worker 加载、URL 去重和 cron 分配。

## 权限说明

此扩展需要以下权限：

- `bookmarks`：读取您的书签数据以提取GitHub仓库链接
- `storage`：保存您的配置偏好设置

**注意**：扩展不会把书签或配置发送到自己的外部服务器；使用 `chrome.storage.sync` 保存的设置（包括 Token）可能由 Chrome 同步到您登录的 Google 账号。

## 开发

### 项目结构

```
chrome-extension/
├── manifest.json          # 扩展清单文件
├── src/
│   ├── background/
│   │   └── background.js # 后台脚本
│   ├── popup/
│   │   ├── popup.html    # 弹出窗口HTML
│   │   ├── popup.css     # 弹出窗口样式
│   │   └── popup.js      # 弹出窗口逻辑
│   ├── options/
│   │   ├── options.html  # 选项页面HTML
│   │   ├── options.css   # 选项页面样式
│   │   └── options.js    # 选项页面逻辑
│   └── utils/
│       ├── urlUtils.js   # URL处理工具
│       ├── configGenerator.js # 配置生成器
│       ├── cronSchedule.js # Cron 固定打散与校验
│       ├── cronSchedule.test.js # Cron 调度测试
│       ├── settingsValidation.js # 全局配置输入校验
│       └── settingsValidation.test.js # 全局配置校验测试
└── assets/
    └── icons/            # 扩展图标
```

### 开发环境

1. 确保已安装Node.js和npm
2. 在项目根目录运行 `npm install` 安装依赖
3. 使用 `npm run build` 构建生产版本
4. 使用 `npm run dev` 启动开发服务器

## 贡献

欢迎提交Issue和Pull Request来改进此扩展！

1. Fork此仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个Pull Request

## 许可证

本项目采用MIT许可证 - 查看[LICENSE](LICENSE)文件了解详情

## 支持

如果您遇到任何问题或有功能建议，请在GitHub Issues中提交。
