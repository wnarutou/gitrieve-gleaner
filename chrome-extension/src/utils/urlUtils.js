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
   * @returns {boolean} 是否为GitHub仓库URL
   */
  static isGitHubRepoUrl(url) {
    if (!url || typeof url !== 'string') return false;
    return this.GITHUB_REPO_REGEX.test(this.cleanUrl(url));
  }

  /**
   * 清理URL
   * - 移除#片段标识符
   * - 移除尾部斜杠
   * - 转换为标准格式
   * @param {string} url - 要清理的URL
   * @returns {string} 清理后的URL
   */
  static cleanUrl(url) {
    if (!url || typeof url !== 'string') return '';

    // 移除#及后面的内容
    let cleaned = url.split('#')[0];

    // 移除尾部斜杠
    cleaned = cleaned.replace(/\/$/, '');

    // 确保使用https协议
    cleaned = cleaned.replace(/^http:/, 'https:');

    return cleaned;
  }

  /**
   * 从GitHub URL提取用户和仓库信息
   * @param {string} url - GitHub仓库URL
   * @returns {object|null} 包含owner和repo的对象，或null（如果不是GitHub URL）
   */
  static extractRepoInfo(url) {
    if (!this.isGitHubRepoUrl(url)) return null;

    const cleaned = this.cleanUrl(url);
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
   * @returns {string} 标准化后的URL
   */
  static normalizeGitHubUrl(url) {
    if (!this.isGitHubRepoUrl(url)) return url;

    const cleaned = this.cleanUrl(url);
    const info = this.extractRepoInfo(cleaned);

    if (!info) return cleaned;

    return `https://github.com/${info.owner}/${info.repo}`;
  }

  /**
   * 从书签节点中提取所有GitHub仓库URL
   * @param {Array} bookmarkNodes - 书签节点数组
   * @returns {Array} GitHub仓库URL数组
   */
  static extractGitHubUrlsFromBookmarks(bookmarkNodes) {
    const githubUrls = [];

    /**
     * 递归遍历书签树
     * @param {Array} nodes - 书签节点数组
     */
    function traverseNodes(nodes) {
      if (!nodes || !Array.isArray(nodes)) return;

      for (const node of nodes) {
        // 如果有URL且是GitHub仓库URL
        if (node.url && UrlUtils.isGitHubRepoUrl(node.url)) {
          const normalizedUrl = UrlUtils.normalizeGitHubUrl(node.url);
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
      if (!seen.has(urlObj.url)) {
        seen.add(urlObj.url);
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