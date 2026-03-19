# Gitrieve Gleaner

一个 Chrome 扩展程序，用于从浏览器书签中提取 GitHub 仓库链接，并将其转换为 [gitrieve](https://github.com/gitrieve/gitrieve) 配置格式。

## 项目概述

Gitrieve Gleaner 是一个 Chrome 扩展程序，它可以帮助您：

- **自动提取**您的 Chrome 书签中的所有 GitHub 仓库链接
- **智能过滤**出有效的 GitHub 仓库 URL
- **生成配置**为 gitrieve 工具创建 YAML 或 JSON 配置文件
- **便捷导出**支持复制到剪贴板或下载配置文件

## 主要功能

### 1. 书签自动提取
- 扫描您的所有 Chrome 书签
- 识别符合 GitHub 仓库格式的 URL (`github.com/user/repo`)
- 支持私有仓库链接

### 2. URL 清理与处理
- 移除 URL 片段标识符（# 后的内容）
- 去除尾部斜杠
- 自动去重处理

### 3. 配置生成
- 生成 gitrieve 兼容的 YAML 配置文件
- 生成 gitrieve 兼容的 JSON 配置文件
- 支持自定义配置模板

### 4. 导出选项
- 复制 YAML 到剪贴板
- 下载 YAML 配置文件
- 复制 JSON 到剪贴板
- 预览生成的配置

## 快速开始

### 安装方法

#### 开发者模式安装（推荐用于开发）
1. 克隆此仓库：
   ```bash
   git clone https://github.com/yourusername/gitrieve-gleaner.git
   ```
2. 打开 Chrome 浏览器，访问 `chrome://extensions/`
3. 启用右上角的"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择 `chrome-extension` 文件夹

#### 打包安装（用于分发）
1. 在 `chrome://extensions/` 页面点击"打包扩展程序"
2. 选择 `chrome-extension` 文件夹作为扩展根目录
3. 点击"打包扩展程序"生成 `.crx` 文件

### 使用方法
1. 安装扩展后，点击浏览器工具栏中的扩展图标
2. 点击"提取GitHub仓库"按钮
3. 等待处理完成，查看提取结果
4. 选择适合的导出选项

## 开发环境设置

### 使用 Dev Container（推荐）
项目提供了开发容器配置，包含 Python 3.12 和 Node.js 22 环境：

1. 确保已安装 VS Code 和 Remote - Containers 扩展
2. 打开项目文件夹
3. VS Code 会提示"在容器中重新打开"，点击确认
4. 等待容器构建完成

### 本地开发环境
1. 确保已安装 Node.js 22+
2. 进入 `chrome-extension` 目录：
   ```bash
   cd chrome-extension
   ```
3. 安装依赖：
   ```bash
   npm install
   ```

## 项目结构

```
gitrieve-gleaner/
├── README.md                   # 项目主说明文档
├── CLAUDE.md                   # Claude Code 项目指令
├── .devcontainer/              # 开发容器配置
│   └── devcontainer.json
├── chrome-extension/           # Chrome 扩展主目录
│   ├── README.md              # 扩展使用说明
│   ├── manifest.json          # 扩展清单文件
│   ├── package.json           # Node.js 项目配置
│   ├── src/
│   │   ├── background/        # 后台脚本
│   │   │   └── background.js
│   │   ├── popup/            # 弹出窗口
│   │   │   ├── popup.html
│   │   │   ├── popup.css
│   │   │   └── popup.js
│   │   ├── options/          # 选项页面
│   │   │   ├── options.html
│   │   │   ├── options.css
│   │   │   └── options.js
│   │   └── utils/            # 工具函数
│   │       ├── urlUtils.js
│   │       ├── configGenerator.js
│   │       ├── bookmarkProcessor.js
│   │       └── test.js
│   └── assets/
│       └── icons/            # 扩展图标
└── .claude/
    └── settings.local.json   # Claude Code 本地设置
```

## 扩展组件说明

### 后台脚本 (background.js)
- 处理书签读取权限
- 协调扩展的各组件通信

### 弹出窗口 (popup)
- 用户主要交互界面
- 显示提取结果和导出选项
- 提供一键提取功能

### 选项页面 (options)
- 配置扩展行为
- 设置 URL 过滤规则
- 自定义导出格式

### 工具函数 (utils)
- `urlUtils.js`：URL 处理和验证
- `configGenerator.js`：gitrieve 配置生成
- `bookmarkProcessor.js`：书签数据处理

## 权限说明

此扩展需要以下权限：

- `bookmarks`：读取您的书签数据以提取 GitHub 仓库链接
- `storage`：保存您的配置偏好设置

**隐私保护**：此扩展不会上传您的任何数据到外部服务器，所有处理都在本地浏览器中进行。

## 技术栈

- **前端**：原生 JavaScript、HTML5、CSS3
- **打包**：Chrome Extension Manifest V3
- **开发工具**：Node.js、npm
- **容器化**：Dev Containers、Docker

## 贡献指南

欢迎提交 Issue 和 Pull Request 来改进此项目！

1. Fork 此仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 开发规范
- 遵循 JavaScript 标准代码风格
- 为重要功能添加注释
- 更新相关文档

## 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 支持与反馈

如果您遇到任何问题或有功能建议：

- 提交 GitHub Issue
- 查看 [Chrome-extension README](./chrome-extension/README.md) 获取详细扩展说明
- 参考现有代码和文档

## 相关项目

- [gitrieve](https://github.com/gitrieve/gitrieve)：Git 仓库检索和分析工具
- [Chrome Extensions API](https://developer.chrome.com/docs/extensions/)：官方扩展开发文档

---

**注意**：此项目正在积极开发中，API 和功能可能会发生变化。