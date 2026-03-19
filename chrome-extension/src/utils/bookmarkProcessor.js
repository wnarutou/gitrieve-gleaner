/**
 * 书签处理模块
 * 提供Chrome书签API的封装和处理功能
 */

class BookmarkProcessor {
  /**
   * 获取所有书签
   * @returns {Promise<Array>} 书签节点树的Promise
   */
  static async getAllBookmarks() {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getTree((bookmarkTreeNodes) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(bookmarkTreeNodes);
        }
      });
    });
  }

  /**
   * 处理书签并提取GitHub仓库URL
   * @returns {Promise<object>} 处理结果对象
   */
  static async processBookmarks() {
    try {
      console.log('开始处理书签...');

      // 1. 获取所有书签
      const bookmarkTree = await this.getAllBookmarks();
      console.log('书签树获取成功，开始处理...');

      // 2. 提取GitHub URL（使用UrlUtils模块）
      const githubUrls = UrlUtils.extractGitHubUrlsFromBookmarks(bookmarkTree);
      console.log(`找到 ${githubUrls.length} 个GitHub仓库URL`);

      // 3. 去重
      const uniqueUrls = UrlUtils.deduplicateUrls(githubUrls);
      console.log(`去重后剩余 ${uniqueUrls.length} 个唯一URL`);

      // 4. 生成配置
      const yamlConfig = ConfigGenerator.generateYAML(uniqueUrls);
      const jsonConfig = ConfigGenerator.generateJSON(uniqueUrls);

      return {
        success: true,
        data: {
          yaml: yamlConfig,
          json: jsonConfig,
          urls: uniqueUrls,
          stats: {
            totalBookmarks: this.countBookmarks(bookmarkTree),
            githubUrlsFound: githubUrls.length,
            uniqueUrls: uniqueUrls.length
          }
        },
        message: `成功提取 ${uniqueUrls.length} 个GitHub仓库`
      };

    } catch (error) {
      console.error('处理书签时出错:', error);
      return {
        success: false,
        error: error.message,
        data: null,
        message: `处理失败: ${error.message}`
      };
    }
  }

  /**
   * 统计书签数量
   * @param {Array} bookmarkTree - 书签树
   * @returns {number} 书签总数
   */
  static countBookmarks(bookmarkTree) {
    let count = 0;

    function traverse(node) {
      if (node.url) {
        count++;
      }
      if (node.children) {
        node.children.forEach(traverse);
      }
    }

    if (bookmarkTree && bookmarkTree.length > 0) {
      bookmarkTree.forEach(traverse);
    }

    return count;
  }

  /**
   * 测试GitHub URL匹配
   * @param {string} url - 要测试的URL
   * @returns {boolean} 是否为GitHub仓库URL
   */
  static testGitHubUrl(url) {
    return UrlUtils.isGitHubRepoUrl(url);
  }

  /**
   * 清理和测试URL处理
   * @param {string} url - 原始URL
   * @returns {object} 处理结果
   */
  static testUrlProcessing(url) {
    const isGitHub = this.testGitHubUrl(url);
    const cleaned = isGitHub ? UrlUtils.cleanUrl(url) : url;
    const normalized = isGitHub ? UrlUtils.normalizeGitHubUrl(url) : url;
    const repoInfo = isGitHub ? UrlUtils.extractRepoInfo(url) : null;

    return {
      original: url,
      isGitHubRepo: isGitHub,
      cleaned: cleaned,
      normalized: normalized,
      repoInfo: repoInfo
    };
  }
}

// 确保依赖模块存在
// 注意：在Chrome扩展中，这些模块需要通过import或全局变量访问
// 这里我们假设UrlUtils和ConfigGenerator已经通过其他方式可用

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BookmarkProcessor;
}