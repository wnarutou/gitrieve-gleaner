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
      releaseNumLimit: 3,
      server: {
        host: '0.0.0.0',
        port: '8080',
        dbPath: '/app/data/gitrieve.db',
        authEnabled: false,
        authToken: ''
      }
    };
  }

  /**
   * 默认设置模型（与 options.js / background.js 的 DEFAULT_SETTINGS 保持一致）
   */
  static get DEFAULT_SETTINGS() {
    return {
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
          path: './repo',
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
  }

  /**
   * 从设置中解析存储目的地列表，缺失/为空/畸形时回退默认
   * @param {Array} destinations - 设置中的 storageDestinations
   * @returns {Array} 标准化后的目的地列表
   */
  static resolveDestinations(destinations) {
    const valid = Array.isArray(destinations)
      ? destinations.filter(d => d && typeof d.name === 'string' && d.name.trim() && (d.type === 'file' || d.type === 's3'))
      : [];
    return valid.length > 0 ? valid : [{ name: 'localFile', type: 'file', path: './repo' }];
  }

  /**
   * 从GitHub URL生成单个仓库配置
   * @param {string} url - GitHub仓库URL
   * @param {string} title - 书签标题（可选）
   * @param {object} settings - 设置模型对象
   * @returns {object} 仓库配置对象
   */
  static generateRepoConfig(url, title = '', settings = {}) {
    const urlParts = url.split('/');
    const domainIndex = urlParts.findIndex(part => part.includes('github.com'));

    if (domainIndex === -1 || domainIndex + 2 >= urlParts.length) {
      throw new Error(`无效的GitHub URL: ${url}`);
    }

    const owner = urlParts[domainIndex + 1];
    const repo = urlParts[domainIndex + 2];
    const name = title && title.trim() ? this.sanitizeName(title) : repo;
    const destinations = this.resolveDestinations(settings.storageDestinations);

    return {
      name: name,
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
   * @param {object} settings - 设置模型对象
   * @returns {object} 完整的配置对象
   */
  static generateFullConfig(githubUrls, settings = {}) {
    const merged = { ...this.DEFAULT_SETTINGS, ...settings };
    merged.server = { ...this.DEFAULT_SETTINGS.server, ...(settings.server || {}) };

    const config = {
      repository: githubUrls.map(urlObj =>
        this.generateRepoConfig(urlObj.url, urlObj.title, merged)
      ),
      storage: this.resolveDestinations(merged.storageDestinations).map(d => {
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
        return { ...base, path: d.path || './repo' };
      }),
      githubToken: merged.githubToken,
      cocurrencyNum: merged.concurrencyNum,
      releaseSizeLimit: merged.releaseSizeLimit,
      releaseNumLimit: merged.releaseNumLimit,
      server: { ...merged.server }
    };

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
          yamlLines.push('      - ' + this.yamlQuote(storage));
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
        yamlLines.push('  - name: ' + this.yamlQuote(storage.name));
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

    // 添加server配置
    const server = config.server || this.DEFAULT_CONFIG.server;
    yamlLines.push('server:');
    yamlLines.push('  host: ' + server.host);
    yamlLines.push('  port: "' + server.port + '"');
    yamlLines.push('  dbPath: ' + server.dbPath);
    yamlLines.push('  authEnabled: ' + (server.authEnabled ? 'true' : 'false'));
    yamlLines.push('  authToken: "' + String(server.authToken).replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"');

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