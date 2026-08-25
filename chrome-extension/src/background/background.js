/**
 * Gitrieve书签提取器 - 后台脚本
 */

const GITHUB_REPO_RE = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+(\/)?$/;

// 与 src/options/options.js 和 src/utils/configGenerator.js 的 DEFAULT_SETTINGS 保持一致
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
  server: { host: '0.0.0.0', port: '8080', dbPath: '/app/data/gitrieve.db', authEnabled: false, authToken: '' }
};

function resolveDestinations(destinations) {
  const valid = Array.isArray(destinations)
    ? destinations.filter(d => d && typeof d.name === 'string' && d.name.trim() && (d.type === 'file' || d.type === 's3'))
    : [];
  return valid.length > 0 ? valid : [{ name: 'localFile', type: 'file', path: '/app/repo' }];
}

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
  // normalizeUrls=false 时保留 http 协议与尾斜杠，不做标准化
  if (settings.normalizeUrls === false) return cleaned;
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

function dedupeUrls(urls) {
  const seen = new Set();
  return urls.filter(u => seen.has(u.url) ? false : (seen.add(u.url), true));
}

function sanitizeName(name) {
  return name.replace(/[\x00-\x1f\x7f:{}[\],&*?|#<>!=%@`]/g, '').trim();
}

function yamlQuote(name) {
  return /[:\s"'{}\[\],&*?|#<>!=%@`-]/.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name;
}

function countBookmarks(tree) {
  let n = 0;
  function walk(node) { if (node.url) n++; if (node.children) node.children.forEach(walk); }
  if (tree && tree.length) tree.forEach(walk);
  return n;
}

function generateRepoConfig(urlObj, settings = {}) {
  const parts = urlObj.url.split('/');
  const idx = parts.findIndex(p => p.includes('github.com'));
  const owner = parts[idx + 1];
  const repo = parts[idx + 2];
  const destinations = resolveDestinations(settings.storageDestinations);
  return {
    name: sanitizeName(urlObj.title || repo),
    url: `github.com/${owner}/${repo}`,
    cron: settings.cronExpression || '0 * * * *',
    storage: destinations.map(d => d.name),
    useCache: true,
    allBranches: true,
    depth: 0,
    downloadReleases: settings.downloadReleases !== false,
    downloadIssues: settings.downloadIssues !== false,
    downloadWiki: settings.downloadWiki !== false,
    downloadDiscussion: settings.downloadDiscussion !== false
  };
}

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
    return { ...base, path: d.path || '/app/repo' };
  });
}

function buildConfig(repos, settings) {
  return {
    repository: repos,
    storage: buildStorage(settings),
    githubToken: settings.githubToken,
    githubApiConcurrency: settings.githubApiConcurrency,
    githubMinRequestInterval: settings.githubMinRequestInterval,
    githubLowRemainingThreshold: settings.githubLowRemainingThreshold,
    githubScheduleJitter: settings.githubScheduleJitter,
    cocurrencyNum: settings.concurrencyNum,
    releaseSizeLimit: settings.releaseSizeLimit,
    releaseNumLimit: settings.releaseNumLimit,
    server: { ...settings.server }
  };
}

function toYAML(config) {
  const lines = ['repository:'];
  config.repository.forEach(r => {
    lines.push(`  - name: ${yamlQuote(r.name)}`, `    url: ${r.url}`, `    cron: "${r.cron}"`, '    storage:');
    r.storage.forEach(s => lines.push(`      - ${yamlQuote(s)}`));
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
  lines.push('storage:');
  config.storage.forEach(s => {
    lines.push(`  - name: ${yamlQuote(s.name)}`, `    type: ${s.type}`);
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
    `githubApiConcurrency: ${config.githubApiConcurrency}`,
    `githubMinRequestInterval: ${config.githubMinRequestInterval}`,
    `githubLowRemainingThreshold: ${config.githubLowRemainingThreshold}`,
    `githubScheduleJitter: ${config.githubScheduleJitter}`,
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processBookmarks') {
    processBookmarks()
      .then(sendResponse)
      .catch(e => sendResponse({ success: false, error: e.message, message: `处理失败: ${e.message}` }));
    return true;
  }
});

chrome.runtime.onInstalled.addListener((details) => {
  console.log('扩展已安装/更新:', details.reason);
});

console.log('Gitrieve书签提取器后台脚本已启动');
