/**
 * Gitrieve书签提取器 - 后台脚本
 */

if (typeof importScripts === 'function') {
  importScripts('../utils/cronSchedule.js', '../utils/configGenerator.js');
}
const configGeneratorApi = globalThis.ConfigGenerator || require('../utils/configGenerator.js');

const GITHUB_REPO_RE = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+(\/)?$/;

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

function repositoryKey(url) {
  if (!url || typeof url !== 'string') return '';
  let key = url.trim();
  if (!key) return '';
  const fragmentIndex = key.indexOf('#');
  if (fragmentIndex >= 0) key = key.slice(0, fragmentIndex);
  key = key.toLowerCase();
  key = key.replace(/^https?:\/\//, '');
  key = key.replace(/^www\./, '');
  key = key.replace(/\/$/, '');
  key = key.replace(/\.git$/, '');
  return key;
}

function dedupeUrls(urls) {
  const seen = new Set();
  return urls.filter(u => {
    const key = repositoryKey(u.url);
    return seen.has(key) ? false : (seen.add(key), true);
  });
}

function countBookmarks(tree) {
  let n = 0;
  function walk(node) { if (node.url) n++; if (node.children) node.children.forEach(walk); }
  if (tree && tree.length) tree.forEach(walk);
  return n;
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
    const settings = await chrome.storage.sync.get(null);
    const tree = await getBookmarkTree();
    const urls = extractGitHubUrls(tree, settings);
    const unique = dedupeUrls(urls);
    const config = configGeneratorApi.generateFullConfig(unique, settings);
    return {
      success: true,
      data: {
        yaml: configGeneratorApi.toYAML(config),
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
