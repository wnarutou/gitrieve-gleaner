/**
 * gitrieve配置生成器
 * 根据GitHub URL生成gitrieve YAML配置
 */

const CronScheduleApi = typeof globalThis !== 'undefined' && globalThis.CronSchedule
  ? globalThis.CronSchedule
  : require('./cronSchedule.js');

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
          path: '/app/repo'
        }
      ],
      githubToken: 'your_github_token_here',
      githubApiConcurrency: 2,
      githubMinRequestInterval: '200ms',
      githubLowRemainingThreshold: 100,
      githubScheduleJitter: '30s',
      retryMaxCount: 3,
      retryBaseDelay: '5s',
      syncOverdueGrace: '30m',
      syncStuckThreshold: '24h',
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
   * 选项页、后台和导出共用的默认设置模型
   */
  static get DEFAULT_SETTINGS() {
    return {
      filterGithub: true,
      removeFragments: true,
      normalizeUrls: true,
      defaultFormat: 'yaml',
      filenameTemplate: 'gitrieve-config-{date}',
      cronMode: 'custom',
      cronExpression: '0 * * * *',
      cronRangeStart: '09:00',
      cronRangeEnd: '17:00',
      storageDestinations: [
        {
          name: 'localFile',
          type: 'file',
          path: '/app/repo'
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
      retryMaxCount: 3,
      retryBaseDelay: '5s',
      syncOverdueGrace: '30m',
      syncStuckThreshold: '24h',
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
    const unsupported = Array.isArray(destinations)
      ? destinations.find(d => d && d.type !== 'file')
      : null;
    if (unsupported) {
      throw new Error(`存储目的地「${unsupported.name || '未命名'}」使用不支持的类型「${unsupported.type}」。新版 gitrieve 仅支持 file，请在选项页改为本地文件并确认路径，或删除该目的地。`);
    }
    const valid = Array.isArray(destinations)
      ? destinations.filter(d => d && typeof d.name === 'string' && d.name.trim() && d.type === 'file')
      : [];
    return valid.length > 0 ? valid : [{ name: 'localFile', type: 'file', path: '/app/repo' }];
  }

  // 只合并设置，不修改已保存数据；旧存储需要用户在选项页明确转换。
  static resolveSettings(settings = {}) {
    const defaults = this.DEFAULT_SETTINGS;
    const merged = { ...defaults, ...settings };
    merged.server = { ...defaults.server, ...(settings.server || {}) };
    if (settings.storageDestinations === undefined && settings.storageBackend) {
      merged.storageDestinations = settings.storageBackend === 'localFile'
        ? defaults.storageDestinations
        : [{ name: settings.storageBackend, type: settings.storageBackend }];
    }
    return merged;
  }

  /**
   * 从GitHub URL生成单个仓库配置
   * @param {string} url - GitHub仓库URL
   * @param {string} title - 书签标题（可选）
   * @param {object} settings - 设置模型对象
   * @returns {object} 仓库配置对象
   */
  static generateRepoConfig(url, title = '', settings = {}, cronExpression = null) {
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
      cron: cronExpression || settings.cronExpression || '0 * * * *',
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
    const value = String(name);
    // JSON 双引号转义兼容 YAML，同时保护布尔值、数字等易被误判的字符串。
    const plain = /^[a-zA-Z0-9_/][a-zA-Z0-9_./]*$/.test(value);
    const reserved = /^(?:null|true|false|yes|no|on|off|y|n)$/i.test(value);
    return plain && !reserved && !Number.isFinite(Number(value)) ? value : JSON.stringify(value);
  }

  /**
   * 生成完整的gitrieve配置
   * @param {Array} githubUrls - GitHub URL对象数组，包含url和title属性
   * @param {object} settings - 设置模型对象
   * @returns {object} 完整的配置对象
   */
  static generateFullConfig(githubUrls, settings = {}) {
    const merged = this.resolveSettings(settings);
    const destinations = this.resolveDestinations(merged.storageDestinations);
    const cronExpressions = CronScheduleApi.generate(
      githubUrls.map(urlObj => urlObj.url),
      merged
    );

    const config = {
      repository: githubUrls.map((urlObj, index) =>
        this.generateRepoConfig(urlObj.url, urlObj.title, merged, cronExpressions[index])
      ),
      storage: destinations.map(d => ({ name: d.name, type: 'file', path: d.path || '/app/repo' })),
      githubToken: merged.githubToken,
      githubApiConcurrency: merged.githubApiConcurrency,
      githubMinRequestInterval: merged.githubMinRequestInterval,
      githubLowRemainingThreshold: merged.githubLowRemainingThreshold,
      githubScheduleJitter: merged.githubScheduleJitter,
      retryMaxCount: merged.retryMaxCount,
      retryBaseDelay: merged.retryBaseDelay,
      syncOverdueGrace: merged.syncOverdueGrace,
      syncStuckThreshold: merged.syncStuckThreshold,
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
          yamlLines.push('    path: ' + this.yamlQuote(storage.path));
        }
        yamlLines.push('');
      });
    }

    // 添加全局配置
    yamlLines.push('githubToken: ' + this.yamlQuote(config.githubToken));
    yamlLines.push('githubApiConcurrency: ' + config.githubApiConcurrency);
    yamlLines.push('githubMinRequestInterval: ' + config.githubMinRequestInterval);
    yamlLines.push('githubLowRemainingThreshold: ' + config.githubLowRemainingThreshold);
    yamlLines.push('githubScheduleJitter: ' + config.githubScheduleJitter);
    yamlLines.push('retryMaxCount: ' + config.retryMaxCount);
    yamlLines.push('retryBaseDelay: ' + config.retryBaseDelay);
    yamlLines.push('syncOverdueGrace: ' + config.syncOverdueGrace);
    yamlLines.push('syncStuckThreshold: ' + config.syncStuckThreshold);
    yamlLines.push('cocurrencyNum: ' + config.cocurrencyNum);
    yamlLines.push('releaseSizeLimit: ' + config.releaseSizeLimit);
    yamlLines.push('releaseNumLimit: ' + config.releaseNumLimit);

    // 添加server配置
    const server = config.server || this.DEFAULT_CONFIG.server;
    yamlLines.push('server:');
    yamlLines.push('  host: ' + this.yamlQuote(server.host));
    yamlLines.push('  port: ' + JSON.stringify(String(server.port)));
    yamlLines.push('  dbPath: ' + this.yamlQuote(server.dbPath));
    yamlLines.push('  authEnabled: ' + (server.authEnabled ? 'true' : 'false'));
    yamlLines.push('  authToken: ' + JSON.stringify(String(server.authToken)));

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
if (typeof globalThis !== 'undefined') {
  globalThis.ConfigGenerator = ConfigGenerator;
}
