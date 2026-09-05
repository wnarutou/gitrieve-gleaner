/**
 * URL处理工具模块
 * 提供GitHub URL过滤、清理和验证功能
 */

class UrlUtils {
  /**
   * GitHub仓库URL正则表达式
   * 匹配格式：https://github.com/user/repo 或 http://github.com/user/repo
   * 支持可选的www前缀
   */
  static get GITHUB_REPO_REGEX() {
    return /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+(\/)?$/;
  }

  /**
   * 检查URL是否为GitHub仓库URL
   * @param {string} url - 要检查的URL
   * @param {Object} settings - 配置项
   * @returns {boolean} 是否为GitHub仓库URL
   */
  static isGitHubRepoUrl(url, settings = {}) {
    if (!url || typeof url !== 'string') return false;
    return this.GITHUB_REPO_REGEX.test(this.cleanUrl(url, settings));
  }

  /**
   * 清理URL
   * - 移除#片段标识符（removeFragments，默认开启）
   * - 移除尾部斜杠 / http→https 标准化（normalizeUrls，默认开启）
   * @param {string} url - 要清理的URL
   * @param {Object} settings - 配置项
   * @returns {string} 清理后的URL
   */
  static cleanUrl(url, settings = {}) {
    if (!url || typeof url !== 'string') return '';

    let cleaned = url;
    if (settings.removeFragments !== false) cleaned = cleaned.split('#')[0];
    if (settings.normalizeUrls !== false) {
      cleaned = cleaned.replace(/\/$/, '').replace(/^http:/, 'https:');
    }
    return cleaned;
  }

  /**
   * 从GitHub URL提取用户和仓库信息
   * @param {string} url - GitHub仓库URL
   * @param {Object} settings - 配置项
   * @returns {object|null} 包含owner和repo的对象，或null（如果不是GitHub URL）
   */
  static extractRepoInfo(url, settings = {}) {
    if (!this.isGitHubRepoUrl(url, settings)) return null;

    const cleaned = this.cleanUrl(url, settings);
    const parts = cleaned.split('/');

    // URL格式：https://github.com/owner/repo
    const domainIndex = parts.findIndex(part => part.includes('github.com'));
    if (domainIndex === -1 || domainIndex + 2 >= parts.length) return null;

    const owner = parts[domainIndex + 1];
    const repo = parts[domainIndex + 2];

    return { owner, repo };
  }

  /**
   * 标准化GitHub URL
   * 确保所有GitHub URL使用相同的格式
   * @param {string} url - 原始URL
   * @param {Object} settings - 配置项
   * @returns {string} 标准化后的URL
   */
  static normalizeGitHubUrl(url, settings = {}) {
    if (!this.isGitHubRepoUrl(url, settings)) return url;

    const cleaned = this.cleanUrl(url, settings);

    // normalizeUrls=false 时保留 http 协议与尾斜杠，不做标准化
    if (settings.normalizeUrls === false) return cleaned;

    const info = this.extractRepoInfo(cleaned, settings);

    if (!info) return cleaned;

    return `https://github.com/${info.owner}/${info.repo}`;
  }

  /**
   * 生成与 Gitrieve 一致的仓库身份键。
   * 去除空白、片段、协议、www、尾斜杠和 .git，并统一为小写。
   * @param {string} url - 仓库URL
   * @returns {string} 仓库身份键
   */
  static repositoryKey(url) {
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

  /**
   * 从书签节点中提取所有GitHub仓库URL
   * @param {Array} bookmarkNodes - 书签节点数组
   * @param {Object} settings - 配置项
   * @returns {Array} GitHub仓库URL数组
   */
  static extractGitHubUrlsFromBookmarks(bookmarkNodes, settings = {}) {
    const githubUrls = [];

    /**
     * 递归遍历书签树
     * @param {Array} nodes - 书签节点数组
     */
    function traverseNodes(nodes) {
      if (!nodes || !Array.isArray(nodes)) return;

      for (const node of nodes) {
        // 如果有URL且是GitHub仓库URL
        if (node.url && UrlUtils.isGitHubRepoUrl(node.url, settings)) {
          const normalizedUrl = UrlUtils.normalizeGitHubUrl(node.url, settings);
          githubUrls.push({
            url: normalizedUrl,
            title: node.title || '',
            originalUrl: node.url
          });
        }

        // 递归遍历子节点
        if (node.children && Array.isArray(node.children)) {
          traverseNodes(node.children);
        }
      }
    }

    traverseNodes(bookmarkNodes);
    return githubUrls;
  }

  /**
   * 去重URL数组
   * @param {Array} urls - URL数组
   * @returns {Array} 去重后的URL数组
   */
  static deduplicateUrls(urls) {
    const seen = new Set();
    const uniqueUrls = [];

    for (const urlObj of urls) {
      const key = this.repositoryKey(urlObj.url);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueUrls.push(urlObj);
      }
    }

    return uniqueUrls;
  }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = UrlUtils;
}
