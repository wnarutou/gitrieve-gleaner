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
- **每天随机打散**：每个仓库每天执行一次，随机分配到全天的具体分钟
- **每周随机打散**：每个仓库每周执行一次，随机分配星期、小时和分钟
- **每月随机打散**：每个仓库每月执行一次，随机分配到 1–28 日的具体分钟，保证每个月都会执行
- **每日指定时段随机打散**：在用户指定的起止时间内分配，支持跨午夜

每次提取并生成配置都会重新随机。分钟槽足够时，同批仓库不会使用相同 cron；仓库数量超过可用分钟槽时，各槽位会被均衡复用。

## 权限说明

此扩展需要以下权限：

- `bookmarks`：读取您的书签数据以提取GitHub仓库链接
- `storage`：保存您的配置偏好设置

**注意**：此扩展不会上传您的任何数据到外部服务器，所有处理都在本地浏览器中进行。

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
│       ├── cronSchedule.js # Cron 随机打散与校验
│       └── cronSchedule.test.js # Cron 调度测试
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
