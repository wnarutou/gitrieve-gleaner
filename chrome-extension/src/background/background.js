/**
 * Gitrieve书签提取器 - 后台脚本
 */

const GITHUB_REPO_RE = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+(\/)?$/;

function cleanUrl(url) {
  if (!url || typeof url !== 'string') return '';
  let c = url.split('#')[0].replace(/\/$/, '');
  return c.replace(/^http:/, 'https:');
}

function isGitHubRepoUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return GITHUB_REPO_RE.test(cleanUrl(url));
}

function normalizeGitHubUrl(url) {
  if (!isGitHubRepoUrl(url)) return url;
  const cleaned = cleanUrl(url);
  const parts = cleaned.split('/');
  const idx = parts.findIndex(p => p.includes('github.com'));
  if (idx === -1 || idx + 2 >= parts.length) return cleaned;
  return `https://github.com/${parts[idx + 1]}/${parts[idx + 2]}`;
}

function extractGitHubUrls(bookmarkNodes) {
  const urls = [];
  (function walk(nodes) {
    if (!nodes || !Array.isArray(nodes)) return;
    for (const node of nodes) {
      if (node.url && isGitHubRepoUrl(node.url)) {
        urls.push({ url: normalizeGitHubUrl(node.url), title: node.title || '', originalUrl: node.url });
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

function generateRepoConfig(urlObj) {
  const parts = urlObj.url.split('/');
  const idx = parts.findIndex(p => p.includes('github.com'));
  const owner = parts[idx + 1];
  const repo = parts[idx + 2];
  return {
    name: sanitizeName(urlObj.title || repo),
    url: `github.com/${owner}/${repo}`,
    cron: '0 * * * *',
    storage: ['localFile'],
    useCache: true,
    allBranches: true,
    depth: 0,
    downloadReleases: true,
    downloadIssues: true,
    downloadWiki: true,
    downloadDiscussion: true
  };
}

function toYAML(repos) {
  const lines = ['repository:'];
  repos.forEach(r => {
    lines.push(`  - name: ${yamlQuote(r.name)}`, `    url: ${r.url}`, `    cron: "${r.cron}"`, '    storage:');
    r.storage.forEach(s => lines.push(`      - ${s}`));
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
  lines.push(
    'storage:', '  - name: localFile', '    type: file', '    path: ./repo', '',
    'githubToken: your_github_token_here', 'cocurrencyNum: 6',
    'releaseSizeLimit: 300000000', 'releaseNumLimit: 3'
  );
  return lines.join('\n');
}

async function processBookmarks() {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getTree((tree) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      try {
        const urls = extractGitHubUrls(tree);
        const unique = dedupeUrls(urls);
        const repos = unique.map(generateRepoConfig);
        resolve({
          success: true,
          data: {
            yaml: toYAML(repos),
            json: JSON.stringify({
              repository: repos,
              storage: [{ name: 'localFile', type: 'file', path: './repo' }],
              githubToken: 'your_github_token_here',
              cocurrencyNum: 6,
              releaseSizeLimit: 300000000,
              releaseNumLimit: 3
            }, null, 2),
            urls: unique,
            stats: { totalBookmarks: countBookmarks(tree), githubUrlsFound: urls.length, uniqueUrls: unique.length }
          },
          message: `成功提取 ${unique.length} 个GitHub仓库`
        });
      } catch (e) {
        reject(e);
      }
    });
  });
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