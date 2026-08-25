/**
 * Gitrieve书签提取器 - 选项页面逻辑
 */

// 与 src/utils/configGenerator.js 和 src/background/background.js 的 DEFAULT_SETTINGS 保持一致
// 默认设置
const DEFAULT_SETTINGS = {
    filterGithub: true,
    removeFragments: true,
    normalizeUrls: true,
    defaultFormat: 'yaml',
    filenameTemplate: 'gitrieve-config-{date}',
    cronExpression: '0 * * * *',
    storageDestinations: [
        {
            name: 'localFile',
            type: 'file',
            path: '/app/repo',
            endpoint: '',
            region: '',
            bucket: '',
            accessKeyID: '',
            secretAccessKey: ''
        }
    ],
    downloadReleases: true,
    downloadIssues: true,
    downloadWiki: true,
    downloadDiscussion: true,
    githubToken: 'your_github_token_here',
    githubApiConcurrency: 2,
    githubMinRequestInterval: '200ms',
    githubLowRemainingThreshold: 100,
    githubScheduleJitter: '30s',
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

// DOM元素引用
const elements = {
    // 设置项
    filterGithub: document.getElementById('filter-github'),
    removeFragments: document.getElementById('remove-fragments'),
    normalizeUrls: document.getElementById('normalize-urls'),
    defaultFormat: document.getElementById('default-format'),
    filenameTemplate: document.getElementById('filename-template'),
    cronExpression: document.getElementById('cron-expression'),
    storageDestinations: document.getElementById('storage-destinations'),
    addDestinationBtn: document.getElementById('add-destination-btn'),
    downloadReleases: document.getElementById('download-releases'),
    downloadIssues: document.getElementById('download-issues'),
    downloadWiki: document.getElementById('download-wiki'),
    downloadDiscussion: document.getElementById('download-discussion'),
    githubToken: document.getElementById('github-token'),
    githubApiConcurrency: document.getElementById('github-api-concurrency'),
    githubMinRequestInterval: document.getElementById('github-min-request-interval'),
    githubLowRemainingThreshold: document.getElementById('github-low-remaining-threshold'),
    githubScheduleJitter: document.getElementById('github-schedule-jitter'),
    concurrencyNum: document.getElementById('concurrency-num'),
    releaseSizeLimit: document.getElementById('release-size-limit'),
    releaseNumLimit: document.getElementById('release-num-limit'),
    serverHost: document.getElementById('server-host'),
    serverPort: document.getElementById('server-port'),
    serverDbPath: document.getElementById('server-dbpath'),
    serverAuthEnabled: document.getElementById('server-authenabled'),
    serverAuthToken: document.getElementById('server-authtoken'),

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

// 当前正在编辑的目的地列表（渲染期间的数据源）
let destinationState = [];

// 旧扁平存储字段（一次性迁移用）
const LEGACY_STORAGE_KEYS = ['storageBackend', 's3Endpoint', 's3Region', 's3Bucket', 's3AccessKeyID', 's3SecretAccessKey'];

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

    // 添加存储目的地
    elements.addDestinationBtn.addEventListener('click', () => {
        destinationState = collectDestinations();
        destinationState.push({ name: '', type: 'file', path: '/app/repo', endpoint: '', region: '', bucket: '', accessKeyID: '', secretAccessKey: '' });
        renderDestinations();
    });

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
 * 从设置中解析目的地列表，缺失/为空/畸形时回退默认
 */
function resolveDestinations(destinations) {
    // UI 变体故意不检查 name.trim()：编辑中的空名称卡片需保留以便继续填写
    const valid = Array.isArray(destinations)
        ? destinations.filter(d => d && typeof d.name === 'string' && (d.type === 'file' || d.type === 's3'))
        : [];
    return valid.length > 0 ? valid : [{ name: 'localFile', type: 'file', path: '/app/repo' }];
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
    return [{ name: 'localFile', type: 'file', path: '/app/repo' }];
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
        card.appendChild(buildTextField(`dest-path-${index}`, '路径', dest.path || '/app/repo', '本地归档目录路径'));
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
        const read = (id, def = '') => {
            const el = card.querySelector(id);
            return el ? el.value.trim() : def;
        };
        list.push({
            name,
            type,
            path: read(`#dest-path-${index}`, '/app/repo'),
            endpoint: read(`#dest-endpoint-${index}`),
            region: read(`#dest-region-${index}`),
            bucket: read(`#dest-bucket-${index}`),
            accessKeyID: read(`#dest-access-key-${index}`),
            secretAccessKey: read(`#dest-secret-key-${index}`)
        });
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
        // 存储目的地：迁移旧扁平字段或读取数组
        if (settings.storageBackend !== undefined && settings.storageDestinations === undefined) {
            destinationState = migrateLegacyStorage(settings);
            await chrome.storage.sync.set({ storageDestinations: destinationState });
            await chrome.storage.sync.remove(LEGACY_STORAGE_KEYS);
        } else {
            destinationState = resolveDestinations(settings.storageDestinations);
        }
        renderDestinations();
        elements.downloadReleases.checked = settings.downloadReleases;
        elements.downloadIssues.checked = settings.downloadIssues;
        elements.downloadWiki.checked = settings.downloadWiki;
        elements.downloadDiscussion.checked = settings.downloadDiscussion;
        elements.githubToken.value = settings.githubToken;
        elements.githubApiConcurrency.value = settings.githubApiConcurrency;
        elements.githubMinRequestInterval.value = settings.githubMinRequestInterval;
        elements.githubLowRemainingThreshold.value = settings.githubLowRemainingThreshold;
        elements.githubScheduleJitter.value = settings.githubScheduleJitter;
        elements.concurrencyNum.value = settings.concurrencyNum;
        elements.releaseSizeLimit.value = settings.releaseSizeLimit;
        elements.releaseNumLimit.value = settings.releaseNumLimit;
        elements.serverHost.value = settings.server.host;
        elements.serverPort.value = settings.server.port;
        elements.serverDbPath.value = settings.server.dbPath;
        elements.serverAuthEnabled.checked = settings.server.authEnabled;
        elements.serverAuthToken.value = settings.server.authToken;

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
        const destinations = collectDestinations();
        const validationErrors = validateDestinations(destinations);
        if (validationErrors.length > 0) {
            showStatusMessage('存储目的地配置有误：' + validationErrors.join('；'), true);
            return;
        }

        const githubSettings = SettingsValidation.parseGitHubSettings({
            githubApiConcurrency: elements.githubApiConcurrency.value,
            githubMinRequestInterval: elements.githubMinRequestInterval.value,
            githubLowRemainingThreshold: elements.githubLowRemainingThreshold.value,
            githubScheduleJitter: elements.githubScheduleJitter.value
        });
        if (githubSettings.errors.length > 0) {
            showStatusMessage('GitHub API 配置有误：' + githubSettings.errors.join('；'), true);
            return;
        }

        const settings = {
            filterGithub: elements.filterGithub.checked,
            removeFragments: elements.removeFragments.checked,
            normalizeUrls: elements.normalizeUrls.checked,
            defaultFormat: elements.defaultFormat.value,
            filenameTemplate: elements.filenameTemplate.value,
            cronExpression: elements.cronExpression.value,
            storageDestinations: destinations,
            downloadReleases: elements.downloadReleases.checked,
            downloadIssues: elements.downloadIssues.checked,
            downloadWiki: elements.downloadWiki.checked,
            downloadDiscussion: elements.downloadDiscussion.checked,
            githubToken: elements.githubToken.value,
            ...githubSettings.value,
            concurrencyNum: parseInt(elements.concurrencyNum.value, 10) || 6,
            releaseSizeLimit: parseInt(elements.releaseSizeLimit.value, 10) || 300000000,
            releaseNumLimit: parseInt(elements.releaseNumLimit.value, 10) || 3,
            server: {
                host: elements.serverHost.value,
                port: elements.serverPort.value,
                dbPath: elements.serverDbPath.value,
                authEnabled: elements.serverAuthEnabled.checked,
                authToken: elements.serverAuthToken.value
            }
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
        destinationState = DEFAULT_SETTINGS.storageDestinations.map(d => ({ ...d }));
        renderDestinations();
        elements.downloadReleases.checked = DEFAULT_SETTINGS.downloadReleases;
        elements.downloadIssues.checked = DEFAULT_SETTINGS.downloadIssues;
        elements.downloadWiki.checked = DEFAULT_SETTINGS.downloadWiki;
        elements.downloadDiscussion.checked = DEFAULT_SETTINGS.downloadDiscussion;
        elements.githubToken.value = DEFAULT_SETTINGS.githubToken;
        elements.githubApiConcurrency.value = DEFAULT_SETTINGS.githubApiConcurrency;
        elements.githubMinRequestInterval.value = DEFAULT_SETTINGS.githubMinRequestInterval;
        elements.githubLowRemainingThreshold.value = DEFAULT_SETTINGS.githubLowRemainingThreshold;
        elements.githubScheduleJitter.value = DEFAULT_SETTINGS.githubScheduleJitter;
        elements.concurrencyNum.value = DEFAULT_SETTINGS.concurrencyNum;
        elements.releaseSizeLimit.value = DEFAULT_SETTINGS.releaseSizeLimit;
        elements.releaseNumLimit.value = DEFAULT_SETTINGS.releaseNumLimit;
        elements.serverHost.value = DEFAULT_SETTINGS.server.host;
        elements.serverPort.value = DEFAULT_SETTINGS.server.port;
        elements.serverDbPath.value = DEFAULT_SETTINGS.server.dbPath;
        elements.serverAuthEnabled.checked = DEFAULT_SETTINGS.server.authEnabled;
        elements.serverAuthToken.value = DEFAULT_SETTINGS.server.authToken;

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
