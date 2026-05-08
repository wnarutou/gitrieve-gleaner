/**
 * Gitrieve书签提取器 - 选项页面逻辑
 */

// 默认设置
const DEFAULT_SETTINGS = {
    filterGithub: true,
    removeFragments: true,
    normalizeUrls: true,
    defaultFormat: 'yaml',
    filenameTemplate: 'gitrieve-config-{date}',
    cronExpression: '0 * * * *',
    storageBackend: 'localFile',
    downloadReleases: true,
    downloadIssues: true,
    downloadWiki: true,
    downloadDiscussion: true,
    githubToken: 'your_github_token_here',
    concurrencyNum: 6,
    releaseSizeLimit: 300000000,
    releaseNumLimit: 3
};

// DOM元素引用
const elements = {
    // 设置项
    filterGithub: document.getElementById('filter-github'),
    removeFragments: document.getElementById('remove-fragments'),
    normalizeUrls: document.getElementById('normalize-urls'),
    defaultFormat: document.getElementById('default-format'),
    filenameTemplate: document.getElementById('filename-template'),
    cronExpression: document.getElementById('cron-expression'),
    storageBackend: document.getElementById('storage-backend'),
    downloadReleases: document.getElementById('download-releases'),
    downloadIssues: document.getElementById('download-issues'),
    downloadWiki: document.getElementById('download-wiki'),
    downloadDiscussion: document.getElementById('download-discussion'),
    githubToken: document.getElementById('github-token'),
    concurrencyNum: document.getElementById('concurrency-num'),
    releaseSizeLimit: document.getElementById('release-size-limit'),
    releaseNumLimit: document.getElementById('release-num-limit'),

    // 按钮
    saveBtn: document.getElementById('save-btn'),
    resetBtn: document.getElementById('reset-btn'),
    testBtn: document.getElementById('test-btn'),
    runTestBtn: document.getElementById('run-test-btn'),

    // 测试区域
    testArea: document.getElementById('test-area'),
    testUrl: document.getElementById('test-url'),
    testResult: document.getElementById('test-result'),

    // 状态消息
    statusMessage: document.getElementById('status-message'),

    // 链接
    viewDocs: document.getElementById('view-docs'),
    reportIssue: document.getElementById('report-issue')
};

/**
 * 初始化选项页面
 */
function init() {
    console.log('初始化选项页面...');

    // 加载保存的设置
    loadSettings();

    // 绑定事件监听器
    bindEvents();

    // 隐藏状态消息
    hideStatusMessage();
}

/**
 * 绑定事件监听器
 */
function bindEvents() {
    // 保存设置
    elements.saveBtn.addEventListener('click', saveSettings);

    // 恢复默认
    elements.resetBtn.addEventListener('click', resetSettings);

    // 测试按钮
    elements.testBtn.addEventListener('click', toggleTestArea);

    // 运行测试
    elements.runTestBtn.addEventListener('click', runUrlTest);

    // 回车键运行测试
    elements.testUrl.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            runUrlTest();
        }
    });

    // 链接
    elements.viewDocs.addEventListener('click', (e) => {
        e.preventDefault();
        // 在新标签页中打开文档
        chrome.tabs.create({ url: 'https://github.com/wnarutou/gitrieve' });
    });

    elements.reportIssue.addEventListener('click', (e) => {
        e.preventDefault();
        // 在新标签页中打开问题报告页面
        chrome.tabs.create({ url: 'https://github.com/wnarutou/gitrieve/issues' });
    });
}

/**
 * 加载保存的设置
 */
async function loadSettings() {
    try {
        const settings = await chrome.storage.sync.get(DEFAULT_SETTINGS);

        // 应用设置到UI
        elements.filterGithub.checked = settings.filterGithub;
        elements.removeFragments.checked = settings.removeFragments;
        elements.normalizeUrls.checked = settings.normalizeUrls;
        elements.defaultFormat.value = settings.defaultFormat;
        elements.filenameTemplate.value = settings.filenameTemplate;
        elements.cronExpression.value = settings.cronExpression;
        elements.storageBackend.value = settings.storageBackend;
        elements.downloadReleases.checked = settings.downloadReleases;
        elements.downloadIssues.checked = settings.downloadIssues;
        elements.downloadWiki.checked = settings.downloadWiki;
        elements.downloadDiscussion.checked = settings.downloadDiscussion;
        elements.githubToken.value = settings.githubToken;
        elements.concurrencyNum.value = settings.concurrencyNum;
        elements.releaseSizeLimit.value = settings.releaseSizeLimit;
        elements.releaseNumLimit.value = settings.releaseNumLimit;

        console.log('设置已加载:', settings);
    } catch (error) {
        console.error('加载设置失败:', error);
        showStatusMessage('加载设置失败', true);
    }
}

/**
 * 保存设置
 */
async function saveSettings() {
    try {
        const settings = {
            filterGithub: elements.filterGithub.checked,
            removeFragments: elements.removeFragments.checked,
            normalizeUrls: elements.normalizeUrls.checked,
            defaultFormat: elements.defaultFormat.value,
            filenameTemplate: elements.filenameTemplate.value,
            cronExpression: elements.cronExpression.value,
            storageBackend: elements.storageBackend.value,
            downloadReleases: elements.downloadReleases.checked,
            downloadIssues: elements.downloadIssues.checked,
            downloadWiki: elements.downloadWiki.checked,
            downloadDiscussion: elements.downloadDiscussion.checked,
            githubToken: elements.githubToken.value,
            concurrencyNum: parseInt(elements.concurrencyNum.value, 10) || 6,
            releaseSizeLimit: parseInt(elements.releaseSizeLimit.value, 10) || 300000000,
            releaseNumLimit: parseInt(elements.releaseNumLimit.value, 10) || 3
        };

        await chrome.storage.sync.set(settings);
        showStatusMessage('设置已保存', false);
        console.log('设置已保存:', settings);
    } catch (error) {
        console.error('保存设置失败:', error);
        showStatusMessage('保存设置失败', true);
    }
}

/**
 * 恢复默认设置
 */
function resetSettings() {
    if (confirm('确定要恢复默认设置吗？')) {
        // 应用默认设置到UI
        elements.filterGithub.checked = DEFAULT_SETTINGS.filterGithub;
        elements.removeFragments.checked = DEFAULT_SETTINGS.removeFragments;
        elements.normalizeUrls.checked = DEFAULT_SETTINGS.normalizeUrls;
        elements.defaultFormat.value = DEFAULT_SETTINGS.defaultFormat;
        elements.filenameTemplate.value = DEFAULT_SETTINGS.filenameTemplate;
        elements.cronExpression.value = DEFAULT_SETTINGS.cronExpression;
        elements.storageBackend.value = DEFAULT_SETTINGS.storageBackend;
        elements.downloadReleases.checked = DEFAULT_SETTINGS.downloadReleases;
        elements.downloadIssues.checked = DEFAULT_SETTINGS.downloadIssues;
        elements.downloadWiki.checked = DEFAULT_SETTINGS.downloadWiki;
        elements.downloadDiscussion.checked = DEFAULT_SETTINGS.downloadDiscussion;
        elements.githubToken.value = DEFAULT_SETTINGS.githubToken;
        elements.concurrencyNum.value = DEFAULT_SETTINGS.concurrencyNum;
        elements.releaseSizeLimit.value = DEFAULT_SETTINGS.releaseSizeLimit;
        elements.releaseNumLimit.value = DEFAULT_SETTINGS.releaseNumLimit;

        showStatusMessage('已恢复默认设置', false);
    }
}

/**
 * 切换测试区域显示
 */
function toggleTestArea() {
    elements.testArea.classList.toggle('hidden');
    if (!elements.testArea.classList.contains('hidden')) {
        elements.testUrl.focus();
    }
}

/**
 * 运行URL测试
 */
function runUrlTest() {
    const url = elements.testUrl.value.trim();
    if (!url) {
        showTestResult('请输入要测试的URL', 'error');
        return;
    }

    try {
        // 测试结果
        const result = testUrlProcessing(url);
        displayTestResult(result);
    } catch (error) {
        showTestResult(`测试失败: ${error.message}`, 'error');
    }
}

/**
 * 测试URL处理
 */
function testUrlProcessing(url) {
    const isGitHub = UrlUtils.isGitHubRepoUrl(url);
    const cleaned = UrlUtils.cleanUrl(url);
    const normalized = UrlUtils.normalizeGitHubUrl(url);

    return {
        original: url,
        isGitHubRepo: isGitHub,
        cleaned: cleaned,
        normalized: normalized
    };
}

/**
 * 显示测试结果
 */
function displayTestResult(result) {
    let output = '';

    output += `原始URL: ${result.original}\n`;
    output += `是否为GitHub仓库: ${result.isGitHubRepo ? '是' : '否'}\n`;

    if (result.isGitHubRepo) {
        output += `清理后URL: ${result.cleaned}\n`;
        output += `标准化URL: ${result.normalized}\n`;
    }

    showTestResult(output, result.isGitHubRepo ? 'success' : 'info');
}

/**
 * 显示测试结果
 */
function showTestResult(message, type) {
    elements.testResult.textContent = message;
    elements.testResult.className = `test-result ${type}`;
}

/**
 * 显示状态消息
 */
function showStatusMessage(message, isError = false) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.className = `status-message ${isError ? 'error' : 'success'}`;
    elements.statusMessage.classList.remove('hidden');

    // 3秒后自动隐藏
    setTimeout(() => {
        hideStatusMessage();
    }, 3000);
}

/**
 * 隐藏状态消息
 */
function hideStatusMessage() {
    elements.statusMessage.classList.add('hidden');
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);

// 监听存储变化以同步设置
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
        // 重新加载设置
        loadSettings();
    }
});