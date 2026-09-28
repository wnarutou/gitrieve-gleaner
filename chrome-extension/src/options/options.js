/**
 * Gitrieve书签提取器 - 选项页面逻辑
 */

const DEFAULT_SETTINGS = ConfigGenerator.DEFAULT_SETTINGS;

// DOM元素引用
const elements = {
    // 设置项
    filterGithub: document.getElementById('filter-github'),
    removeFragments: document.getElementById('remove-fragments'),
    normalizeUrls: document.getElementById('normalize-urls'),
    defaultFormat: document.getElementById('default-format'),
    filenameTemplate: document.getElementById('filename-template'),
    cronMode: document.getElementById('cron-mode'),
    cronExpressionGroup: document.getElementById('cron-expression-group'),
    cronExpression: document.getElementById('cron-expression'),
    cronRangeGroups: [
        document.getElementById('cron-range-start-group'),
        document.getElementById('cron-range-end-group')
    ],
    cronRangeStart: document.getElementById('cron-range-start'),
    cronRangeEnd: document.getElementById('cron-range-end'),
    storageDestinations: document.getElementById('storage-destinations'),
    storageCompatibilityNotice: document.getElementById('storage-compatibility-notice'),
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
    retryMaxCount: document.getElementById('retry-max-count'),
    retryBaseDelay: document.getElementById('retry-base-delay'),
    syncOverdueGrace: document.getElementById('sync-overdue-grace'),
    syncStuckThreshold: document.getElementById('sync-stuck-threshold'),
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
    statusMessage: document.getElementById('status-message')
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

    elements.cronMode.addEventListener('change', updateCronFieldVisibility);

    // 恢复默认
    elements.resetBtn.addEventListener('click', resetSettings);

    // 添加存储目的地
    elements.addDestinationBtn.addEventListener('click', () => {
        destinationState = collectDestinations();
        destinationState.push({ name: '', type: 'file', path: '/app/repo' });
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

}

function updateCronFieldVisibility() {
    const visible = CronSchedule.visibleFields(elements.cronMode.value);
    elements.cronExpressionGroup.classList.toggle('hidden', !visible.expression);
    elements.cronRangeGroups.forEach(group => group.classList.toggle('hidden', !visible.range));
}

/**
 * 从设置中解析目的地列表，缺失/为空/畸形时回退默认
 */
function resolveDestinations(destinations) {
    // UI 变体故意不检查 name.trim()：编辑中的空名称卡片需保留以便继续填写
    const valid = Array.isArray(destinations)
        ? destinations.filter(d => d && typeof d.name === 'string' && typeof d.type === 'string')
        : [];
    return valid.length > 0 ? valid : [{ name: 'localFile', type: 'file', path: '/app/repo' }];
}

/**
 * 渲染存储目的地卡片列表
 */
function renderDestinations() {
    const container = elements.storageDestinations;
    container.innerHTML = '';
    const list = resolveDestinations(destinationState);
    destinationState = list;
    elements.storageCompatibilityNotice.classList.toggle('hidden', !list.some(d => d.type !== 'file'));
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
    typeSelect.appendChild(optFile);
    if (dest.type !== 'file') {
        const unsupported = document.createElement('option');
        unsupported.value = dest.type;
        unsupported.textContent = `${dest.type}（已不支持，请转换或删除）`;
        unsupported.disabled = true;
        typeSelect.appendChild(unsupported);
    }
    typeSelect.value = dest.type;
    typeSelect.addEventListener('change', () => {
        destinationState = collectDestinations();
        destinationState[index].type = typeSelect.value;
        destinationState[index].path = ''; // 转换旧存储时由用户明确填写新路径
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

    if (dest.type === 'file') {
        card.appendChild(buildTextField(`dest-path-${index}`, '路径', dest.path ?? '/app/repo', 'gitrieve 运行环境中的归档目录路径'));
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
            path: read(`#dest-path-${index}`)
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
        if (d.type !== 'file') {
            errors.push(`${label}（${d.name || '未命名'}）：新版 gitrieve 仅支持 file，请转换为本地文件并填写路径，或删除`);
        } else if (!d.path) {
            errors.push(`${label}（${d.name || '未命名'}）：路径必填`);
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
        const settings = ConfigGenerator.resolveSettings(await chrome.storage.sync.get(null));

        // 应用设置到UI
        elements.filterGithub.checked = settings.filterGithub;
        elements.removeFragments.checked = settings.removeFragments;
        elements.normalizeUrls.checked = settings.normalizeUrls;
        elements.defaultFormat.value = settings.defaultFormat;
        elements.filenameTemplate.value = settings.filenameTemplate;
        elements.cronMode.value = settings.cronMode;
        elements.cronExpression.value = settings.cronExpression;
        elements.cronRangeStart.value = settings.cronRangeStart;
        elements.cronRangeEnd.value = settings.cronRangeEnd;
        updateCronFieldVisibility();
        destinationState = resolveDestinations(settings.storageDestinations);
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
        elements.retryMaxCount.value = settings.retryMaxCount;
        elements.retryBaseDelay.value = settings.retryBaseDelay;
        elements.syncOverdueGrace.value = settings.syncOverdueGrace;
        elements.syncStuckThreshold.value = settings.syncStuckThreshold;
        elements.concurrencyNum.value = settings.concurrencyNum;
        elements.releaseSizeLimit.value = settings.releaseSizeLimit;
        elements.releaseNumLimit.value = settings.releaseNumLimit;
        elements.serverHost.value = settings.server.host;
        elements.serverPort.value = settings.server.port;
        elements.serverDbPath.value = settings.server.dbPath;
        elements.serverAuthEnabled.checked = settings.server.authEnabled;
        elements.serverAuthToken.value = settings.server.authToken;

        console.log('设置已加载');
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

        const runtimeSettings = SettingsValidation.parseRuntimeSettings({
            retryMaxCount: elements.retryMaxCount.value,
            retryBaseDelay: elements.retryBaseDelay.value,
            syncOverdueGrace: elements.syncOverdueGrace.value,
            syncStuckThreshold: elements.syncStuckThreshold.value
        });
        if (runtimeSettings.errors.length > 0) {
            showStatusMessage('运行策略配置有误：' + runtimeSettings.errors.join('；'), true);
            return;
        }

        const cronSettings = {
            cronMode: elements.cronMode.value,
            cronExpression: elements.cronExpression.value,
            cronRangeStart: elements.cronRangeStart.value,
            cronRangeEnd: elements.cronRangeEnd.value
        };
        const cronValidation = CronSchedule.validate(cronSettings);
        if (cronValidation.errors.length > 0) {
            showStatusMessage('定时任务配置有误：' + cronValidation.errors.join('；'), true);
            return;
        }

        const settings = {
            filterGithub: elements.filterGithub.checked,
            removeFragments: elements.removeFragments.checked,
            normalizeUrls: elements.normalizeUrls.checked,
            defaultFormat: elements.defaultFormat.value,
            filenameTemplate: elements.filenameTemplate.value,
            ...cronSettings,
            storageDestinations: destinations,
            downloadReleases: elements.downloadReleases.checked,
            downloadIssues: elements.downloadIssues.checked,
            downloadWiki: elements.downloadWiki.checked,
            downloadDiscussion: elements.downloadDiscussion.checked,
            githubToken: elements.githubToken.value,
            ...githubSettings.value,
            ...runtimeSettings.value,
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
        await chrome.storage.sync.remove(LEGACY_STORAGE_KEYS);
        showStatusMessage('设置已保存', false);
        console.log('设置已保存');
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
        elements.cronMode.value = DEFAULT_SETTINGS.cronMode;
        elements.cronExpression.value = DEFAULT_SETTINGS.cronExpression;
        elements.cronRangeStart.value = DEFAULT_SETTINGS.cronRangeStart;
        elements.cronRangeEnd.value = DEFAULT_SETTINGS.cronRangeEnd;
        updateCronFieldVisibility();
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
        elements.retryMaxCount.value = DEFAULT_SETTINGS.retryMaxCount;
        elements.retryBaseDelay.value = DEFAULT_SETTINGS.retryBaseDelay;
        elements.syncOverdueGrace.value = DEFAULT_SETTINGS.syncOverdueGrace;
        elements.syncStuckThreshold.value = DEFAULT_SETTINGS.syncStuckThreshold;
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
