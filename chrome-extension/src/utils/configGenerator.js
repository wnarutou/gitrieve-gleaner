/**
 * gitrieve配置生成器
 * 根据GitHub URL生成gitrieve YAML配置
 */

class ConfigGenerator {
  /**
   * 默认配置模板
   */
  static get DEFAULT_CONFIG() {
    return {
      repository: [],
      storage: [
        {
          name: 'localFile',
          type: 'file',
          path: './repo'
        }
      ],
      githubToken: 'your_github_token_here',
      cocurrencyNum: 6,
      releaseSizeLimit: 300000000,
      releaseNumLimit: 3
    };
  }

  /**
   * 从GitHub URL生成单个仓库配置
   * @param {string} url - GitHub仓库URL
   * @param {string} title - 书签标题（可选）
   * @returns {object} 仓库配置对象
   */
  static generateRepoConfig(url, title = '') {
    // 从URL提取owner和repo
    const urlParts = url.split('/');
    const domainIndex = urlParts.findIndex(part => part.includes('github.com'));

    if (domainIndex === -1 || domainIndex + 2 >= urlParts.length) {
      throw new Error(`无效的GitHub URL: ${url}`);
    }

    const owner = urlParts[domainIndex + 1];
    const repo = urlParts[domainIndex + 2];

    // 使用标题或仓库名作为name
    const name = title && title.trim() ?
      this.sanitizeName(title) :
      repo;

    return {
      name: name,
      url: `github.com/${owner}/${repo}`,
      cron: '0 * * * *', // 每小时执行一次
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

  /**
   * 清理名称，移除特殊字符
   * @param {string} name - 原始名称
   * @returns {string} 清理后的名称
   */
  static sanitizeName(name) {
    return name.replace(/[\x00-\x1f\x7f:{}[\],&*?|#<>!=%@`]/g, '').trim();
  }

  static yamlQuote(name) {
    return /[:\s"'{}[\]\],&*?|#<>!=%@`-]/.test(name) ? `"${name.replace(/"/g, '\\"')}"` : name;
  }

  /**
   * 生成完整的gitrieve配置
   * @param {Array} githubUrls - GitHub URL对象数组，包含url和title属性
   * @param {object} options - 配置选项
   * @returns {object} 完整的配置对象
   */
  static generateFullConfig(githubUrls, options = {}) {
    const config = { ...this.DEFAULT_CONFIG };

    // 合并用户选项
    Object.assign(config, options);

    // 生成仓库配置
    config.repository = githubUrls.map(urlObj =>
      this.generateRepoConfig(urlObj.url, urlObj.title)
    );

    return config;
  }

  /**
   * 将配置对象转换为YAML字符串
   * @param {object} config - 配置对象
   * @returns {string} YAML格式字符串
   */
  static toYAML(config) {
    const yamlLines = [];

    // 添加仓库配置
    if (config.repository && config.repository.length > 0) {
      yamlLines.push('repository:');
      config.repository.forEach(repo => {
        yamlLines.push('  - name: ' + this.yamlQuote(repo.name));
        yamlLines.push('    url: ' + repo.url);
        yamlLines.push('    cron: "' + repo.cron + '"');
        yamlLines.push('    storage:');
        repo.storage.forEach(storage => {
          yamlLines.push('      - ' + storage);
        });
        yamlLines.push('    useCache: ' + (repo.useCache ? 'True' : 'False'));
        yamlLines.push('    allBranches: ' + (repo.allBranches ? 'True' : 'False'));
        yamlLines.push('    depth: ' + repo.depth);
        yamlLines.push('    downloadReleases: ' + (repo.downloadReleases ? 'True' : 'False'));
        yamlLines.push('    downloadIssues: ' + (repo.downloadIssues ? 'True' : 'False'));
        yamlLines.push('    downloadWiki: ' + (repo.downloadWiki ? 'True' : 'False'));
        yamlLines.push('    downloadDiscussion: ' + (repo.downloadDiscussion ? 'True' : 'False'));
        yamlLines.push('');
      });
    }

    // 添加存储配置
    if (config.storage && config.storage.length > 0) {
      yamlLines.push('storage:');
      config.storage.forEach(storage => {
        yamlLines.push('  - name: ' + storage.name);
        yamlLines.push('    type: ' + storage.type);
        if (storage.path) {
          yamlLines.push('    path: ' + storage.path);
        }
        if (storage.endpoint) {
          yamlLines.push('    endpoint: ' + storage.endpoint);
        }
        if (storage.region) {
          yamlLines.push('    region: ' + storage.region);
        }
        if (storage.bucket) {
          yamlLines.push('    bucket: ' + storage.bucket);
        }
        if (storage.accessKeyID) {
          yamlLines.push('    accessKeyID: ' + storage.accessKeyID);
        }
        if (storage.secretAccessKey) {
          yamlLines.push('    secretAccessKey: ' + storage.secretAccessKey);
        }
        yamlLines.push('');
      });
    }

    // 添加全局配置
    yamlLines.push('githubToken: ' + config.githubToken);
    yamlLines.push('cocurrencyNum: ' + config.cocurrencyNum);
    yamlLines.push('releaseSizeLimit: ' + config.releaseSizeLimit);
    yamlLines.push('releaseNumLimit: ' + config.releaseNumLimit);

    return yamlLines.join('\n');
  }

  /**
   * 从GitHub URL列表生成YAML配置
   * @param {Array} githubUrls - GitHub URL对象数组
   * @param {object} options - 配置选项
   * @returns {string} YAML配置字符串
   */
  static generateYAML(githubUrls, options = {}) {
    const config = this.generateFullConfig(githubUrls, options);
    return this.toYAML(config);
  }

  /**
   * 从GitHub URL列表生成JSON配置
   * @param {Array} githubUrls - GitHub URL对象数组
   * @param {object} options - 配置选项
   * @returns {string} JSON配置字符串
   */
  static generateJSON(githubUrls, options = {}) {
    const config = this.generateFullConfig(githubUrls, options);
    return JSON.stringify(config, null, 2);
  }
}

// 导出供其他模块使用
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ConfigGenerator;
}