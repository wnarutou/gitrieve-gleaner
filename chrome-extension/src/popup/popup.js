/**
 * Gitrieve书签提取器 - 弹出窗口主逻辑
 */

// 状态管理
const State = {
    IDLE: 'idle',
    PROCESSING: 'processing',
    SUCCESS: 'success',
    ERROR: 'error'
};

// 全局变量
let currentState = State.IDLE;
let processingResult = null;
let currentConfig = {
    yaml: '',
    json: '',
    urls: []
};

// DOM元素引用
const elements = {
    // 状态区域
    statusMessage: document.getElementById('status-message'),
    progressBar: document.getElementById('progress-bar'),
    progressFill: document.getElementById('progress-fill'),

    // 控制按钮
    extractBtn: document.getElementById('extract-btn'),
    btnText: document.getElementById('btn-text'),
    btnSpinner: document.getElementById('btn-spinner'),
    optionsBtn: document.getElementById('options-btn'),

    // 结果区域
    resultArea: document.getElementById('result-area'),
    resultCount: document.getElementById('result-count'),
    urlList: document.getElementById('url-list'),

    // 导出按钮
    copyYamlBtn: document.getElementById('copy-yaml-btn'),
    downloadYamlBtn: document.getElementById('download-yaml-btn'),
    copyJsonBtn: document.getElementById('copy-json-btn'),
    previewConfigBtn: document.getElementById('preview-config-btn'),

    // 配置预览
    configPreview: document.getElementById('config-preview'),
    configContent: document.getElementById('config-content'),
    closePreviewBtn: document.getElementById('close-preview-btn'),
    formatButtons: document.querySelectorAll('.format-btn'),

    // 错误区域
    errorArea: document.getElementById('error-area'),
    errorMessage: document.getElementById('error-message'),
    closeErrorBtn: document.getElementById('close-error-btn')
};

/**
 * 初始化应用
 */
function init() {
    console.log('初始化Gitrieve书签提取器...');

    // 绑定事件监听器
    bindEvents();

    // 更新初始状态
    updateState(State.IDLE);
}

/**
 * 绑定所有事件监听器
 */
function bindEvents() {
    // 提取按钮
    elements.extractBtn.addEventListener('click', handleExtractClick);

    // 选项按钮
    elements.optionsBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // 导出按钮
    elements.copyYamlBtn.addEventListener('click', () => copyToClipboard('yaml'));
    elements.downloadYamlBtn.addEventListener('click', () => downloadConfig('yaml'));
    elements.copyJsonBtn.addEventListener('click', () => copyToClipboard('json'));
    elements.previewConfigBtn.addEventListener('click', showConfigPreview);

    // 配置预览相关
    elements.closePreviewBtn.addEventListener('click', hideConfigPreview);
    elements.formatButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const format = e.target.dataset.format;
            switchConfigFormat(format);
        });
    });

    // 错误区域
    elements.closeErrorBtn.addEventListener('click', hideError);
}

/**
 * 处理提取按钮点击
 */
async function handleExtractClick() {
    if (currentState === State.PROCESSING) return;

    updateState(State.PROCESSING);
    showProgress(true);

    try {
        // 调用后台脚本处理书签
        const result = await processBookmarks();

        if (result.success) {
            processingResult = result;
            currentConfig = {
                yaml: result.data.yaml,
                json: result.data.json,
                urls: result.data.urls
            };

            updateState(State.SUCCESS);
            showResults(result.data);
        } else {
            updateState(State.ERROR);
            showError(result.message);
        }
    } catch (error) {
        console.error('处理过程中出错:', error);
        updateState(State.ERROR);
        showError(`处理失败: ${error.message}`);
    } finally {
        showProgress(false);
    }
}

/**
 * 处理书签提取
 */
async function processBookmarks() {
    return new Promise((resolve, reject) => {
        // 发送消息给后台脚本
        chrome.runtime.sendMessage(
            { action: 'processBookmarks' },
            (response) => {
                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                } else {
                    resolve(response);
                }
            }
        );
    });
}

/**
 * 更新应用状态
 */
function updateState(newState) {
    currentState = newState;

    switch (newState) {
        case State.IDLE:
            elements.statusMessage.textContent = '准备开始提取...';
            elements.statusMessage.className = 'status-message';
            elements.extractBtn.disabled = false;
            elements.btnText.textContent = '提取GitHub仓库';
            break;

        case State.PROCESSING:
            elements.statusMessage.textContent = '正在处理书签...';
            elements.statusMessage.className = 'status-message';
            elements.extractBtn.disabled = true;
            elements.btnText.textContent = '处理中...';
            break;

        case State.SUCCESS:
            elements.statusMessage.textContent = processingResult?.message || '处理成功！';
            elements.statusMessage.className = 'status-message success';
            elements.extractBtn.disabled = false;
            elements.btnText.textContent = '重新提取';
            break;

        case State.ERROR:
            elements.statusMessage.textContent = '处理失败';
            elements.statusMessage.className = 'status-message error';
            elements.extractBtn.disabled = false;
            elements.btnText.textContent = '重试';
            break;
    }

    // 更新UI元素可见性
    elements.btnSpinner.classList.toggle('hidden', newState !== State.PROCESSING);
}

/**
 * 显示/隐藏进度条
 */
function showProgress(show) {
    elements.progressBar.classList.toggle('hidden', !show);
    if (show) {
        elements.progressFill.style.width = '0%';
        // 模拟进度动画
        let progress = 0;
        const interval = setInterval(() => {
            progress += 0.5;
            elements.progressFill.style.width = `${Math.min(progress, 90)}%`;
            if (progress >= 90 || !show) {
                clearInterval(interval);
            }
        }, 50);
    } else {
        elements.progressFill.style.width = '100%';
        setTimeout(() => {
            elements.progressFill.style.width = '0%';
        }, 300);
    }
}

/**
 * 显示处理结果
 */
function showResults(data) {
    // 更新统计信息
    elements.resultCount.textContent = data.stats.uniqueUrls;

    // 清空URL列表
    elements.urlList.innerHTML = '';

    // 添加URL项目
    data.urls.forEach((urlObj, index) => {
        const urlItem = document.createElement('div');
        urlItem.className = 'url-item';

        // 提取owner信息
        const urlParts = urlObj.url.split('/');
        const owner = urlParts.length > 3 ? urlParts[3] : '';

        urlItem.innerHTML = `
            <div class="url-icon">${index + 1}.</div>
            <div class="url-text" title="${urlObj.url}">
                ${urlObj.title || urlObj.url.split('/').pop()}
            </div>
            ${owner ? `<div class="url-owner">${owner}</div>` : ''}
        `;

        elements.urlList.appendChild(urlItem);
    });

    // 显示结果区域
    elements.resultArea.classList.remove('hidden');
}

/**
 * 显示错误信息
 */
function showError(message) {
    elements.errorMessage.textContent = message;
    elements.errorArea.classList.remove('hidden');
    elements.resultArea.classList.add('hidden');
}

/**
 * 隐藏错误信息
 */
function hideError() {
    elements.errorArea.classList.add('hidden');
}

/**
 * 复制配置到剪贴板
 */
async function copyToClipboard(format) {
    const config = format === 'yaml' ? currentConfig.yaml : currentConfig.json;

    try {
        await navigator.clipboard.writeText(config);
        showNotification(`${format.toUpperCase()}配置已复制到剪贴板`);
    } catch (error) {
        console.error('复制到剪贴板失败:', error);
        showNotification('复制失败，请手动复制', true);
    }
}

/**
 * 下载配置文件
 */
function downloadConfig(format) {
    const config = format === 'yaml' ? currentConfig.yaml : currentConfig.json;
    const filename = `gitrieve-config.${format === 'yaml' ? 'yaml' : 'json'}`;

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

/**
 * 显示配置预览
 */
function showConfigPreview() {
    switchConfigFormat('yaml');
    elements.configPreview.classList.remove('hidden');
}

/**
 * 隐藏配置预览
 */
function hideConfigPreview() {
    elements.configPreview.classList.add('hidden');
}

/**
 * 切换配置格式显示
 */
function switchConfigFormat(format) {
    // 更新按钮状态
    elements.formatButtons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.format === format);
    });

    // 配置显示（无语法高亮）
    highlightConfig(format);
}

/**
 * 配置显示（无语法高亮）
 */
function highlightConfig(format) {
    const content = elements.configContent;
    const config = format === 'yaml' ? currentConfig.yaml : currentConfig.json;

    // 简单显示配置内容，避免任何复杂的语法高亮导致问题
    content.textContent = config;
}

/**
 * 显示通知消息
 */
function showNotification(message, isError = false) {
    const notification = document.createElement('div');
    notification.className = `notification ${isError ? 'error' : 'success'}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 16px;
        background-color: ${isError ? '#fcf2f2' : '#f0fff4'};
        color: ${isError ? '#cf222e' : '#1a7f37'};
        border: 1px solid ${isError ? '#f8d0d3' : '#dafbe1'};
        border-radius: 6px;
        box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        z-index: 1000;
        font-size: 13px;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // 3秒后移除
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);

    // 添加动画关键帧
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);