/**
 * 测试文件 - 验证URL处理和配置生成功能
 */

// 模拟Chrome API（用于测试环境）
global.chrome = {
  bookmarks: {
    getTree: (callback) => {
      const mockBookmarks = [
        {
          id: "0",
          title: "",
          children: [
            {
              id: "1",
              title: "GitHub Bookmarks",
              children: [
                {
                  id: "2",
                  title: "Vue.js",
                  url: "https://github.com/vuejs/vue"
                },
                {
                  id: "3",
                  title: "React",
                  url: "https://github.com/facebook/react"
                },
                {
                  id: "4",
                  title: "Angular",
                  url: "https://github.com/angular/angular"
                },
                {
                  id: "5",
                  title: "Invalid Repo",
                  url: "https://github.com/user"
                },
                {
                  id: "6",
                  title: "With Fragment",
                  url: "https://github.com/nodejs/node#readme"
                },
                {
                  id: "7",
                  title: "Duplicate Vue",
                  url: "https://github.com/vuejs/vue/"
                },
                {
                  id: "8",
                  title: "Non-GitHub Site",
                  url: "https://google.com"
                }
              ]
            },
            {
              id: "9",
              title: "Other Bookmarks",
              children: [
                {
                  id: "10",
                  title: "Express.js",
                  url: "https://github.com/expressjs/express"
                }
              ]
            }
          ]
        }
      ];

      callback(mockBookmarks);
    }
  }
};

// 加载工具模块
const UrlUtils = require('./urlUtils.js');
const ConfigGenerator = require('./configGenerator.js');

const failed = [];
function assert(condition, message) {
  if (condition) {
    console.log('  PASS: ' + message);
  } else {
    failed.push(message);
    console.error('  FAIL: ' + message);
  }
}

try {
  console.log('=== URL处理测试 ===');

  const testUrls = [
    'https://github.com/user/repo',
    'http://github.com/user/repo',
    'https://www.github.com/user/repo',
    'https://github.com/user/repo/',
    'https://github.com/user/repo#readme',
    'https://github.com/user',
    'https://google.com',
    'https://github.com/user/repo/subpage'
  ];

  console.log('URL过滤测试:');
  testUrls.forEach(url => {
    const isGitHub = UrlUtils.isGitHubRepoUrl(url);
    console.log(`  ${url} -> ${isGitHub ? '✓' : '✗'}`);
  });

  console.log('\n=== URL清理测试 ===');
  const urlsToClean = [
    'https://github.com/user/repo#readme',
    'https://github.com/user/repo/',
    'http://github.com/user/repo',
    'https://github.com/user/repo/path/'
  ];

  console.log('URL清理结果:');
  urlsToClean.forEach(url => {
    const cleaned = UrlUtils.cleanUrl(url);
    const normalized = UrlUtils.normalizeGitHubUrl(url);
    console.log(`  原始: ${url}`);
    console.log(`  清理: ${cleaned}`);
    console.log(`  标准化: ${normalized}\n`);
  });

  console.log('\n=== URL 过滤设置测试 ===');
  const flagTests = [
    {
      url: 'https://github.com/user/repo#readme',
      settings: { removeFragments: true, normalizeUrls: true },
      isRepo: true,
      desc: 'removeFragments=true 时带#片段识别为仓库'
    },
    {
      url: 'https://github.com/user/repo#readme',
      settings: { removeFragments: false, normalizeUrls: true },
      isRepo: false,
      desc: 'removeFragments=false 时带#片段不识别为仓库'
    },
    {
      url: 'http://github.com/user/repo/',
      settings: { removeFragments: true, normalizeUrls: false },
      normalized: 'http://github.com/user/repo/',
      desc: 'normalizeUrls=false 时保留http与尾斜杠'
    }
  ];
  flagTests.forEach(t => {
    const isRepo = UrlUtils.isGitHubRepoUrl(t.url, t.settings);
    if (t.isRepo !== undefined) {
      assert(isRepo === t.isRepo, t.desc);
    } else {
      assert(UrlUtils.normalizeGitHubUrl(t.url, t.settings) === t.normalized, t.desc);
    }
  });

  console.log('=== 书签处理模拟测试 ===');

  chrome.bookmarks.getTree((bookmarkTree) => {
    console.log('书签树获取成功');

    const githubUrls = UrlUtils.extractGitHubUrlsFromBookmarks(bookmarkTree);
    console.log(`提取到 ${githubUrls.length} 个GitHub URL:`);
    githubUrls.forEach((urlObj, index) => {
      console.log(`  ${index + 1}. ${urlObj.title}: ${urlObj.url}`);
    });

    const uniqueUrls = UrlUtils.deduplicateUrls(githubUrls);
    console.log(`\n去重后剩余 ${uniqueUrls.length} 个唯一URL:`);
    uniqueUrls.forEach((urlObj, index) => {
      console.log(`  ${index + 1}. ${urlObj.title}: ${urlObj.url}`);
    });

    console.log('\n=== 配置生成测试 ===');
    const yamlConfig = ConfigGenerator.generateYAML(uniqueUrls);
    console.log('生成的YAML配置:');
    console.log(yamlConfig);

    const jsonConfig = ConfigGenerator.generateJSON(uniqueUrls);
    console.log('\n生成的JSON配置:');
    console.log(jsonConfig);

    console.log('\n=== 配置生成断言（server 段 / s3 / 自定义设置）===');

    const customSettings = {
      cronExpression: '0 6 * * *',
      storageDestinations: [
        { name: 'archive-local', type: 'file', path: '/data/repos' },
        {
          name: 'public-s3',
          type: 's3',
          endpoint: 's3.example.com',
          region: 'us-east-1',
          bucket: 'my-bucket',
          accessKeyID: 'AKIAEXAMPLE',
          secretAccessKey: 'secret-key'
        }
      ],
      downloadReleases: false,
      server: { host: '127.0.0.1', port: '9000', dbPath: 'gitrieve.db', authEnabled: true, authToken: 'tok"en' }
    };

    const yamlCustom = ConfigGenerator.generateYAML(uniqueUrls, customSettings);
    assert(yamlCustom.includes('server:'), 'YAML 包含 server: 段');
    assert(yamlCustom.includes('  host: 127.0.0.1'), 'YAML server.host 生效');
    assert(yamlCustom.includes('  port: "9000"'), 'YAML server.port 带引号');
    assert(yamlCustom.includes('  authEnabled: true'), 'YAML server.authEnabled 小写 true');
    assert(yamlCustom.includes('  authToken: "tok\\"en"'), 'YAML server.authToken 引号转义');
    assert(yamlCustom.includes('cron: "0 6 * * *"'), '自定义 cron 生效');
    // 目的地名称含连字符（archive-local/public-s3），yamlQuote 会为其加引号
    assert(yamlCustom.includes('    storage:\n      - "archive-local"\n      - "public-s3"'), '仓库条目引用全部目的地');
    assert(yamlCustom.includes('  - name: "archive-local"'), 'storage 段包含本地目的地');
    assert(yamlCustom.includes('    type: file'), 'storage 段 file 类型');
    assert(yamlCustom.includes('    path: /data/repos'), '本地路径生效');
    assert(yamlCustom.includes('  - name: "public-s3"'), 'storage 段包含 s3 目的地');
    assert(yamlCustom.includes('    type: s3'), 'storage 段 s3 类型');
    assert(yamlCustom.includes('    endpoint: s3.example.com'), 'storage 段 endpoint');
    assert(yamlCustom.includes('    bucket: my-bucket'), 'storage 段 bucket');
    assert(yamlCustom.includes('downloadReleases: False'), 'downloadReleases=false 生效');

    const jsonCustom = ConfigGenerator.generateJSON(uniqueUrls, customSettings);
    assert(jsonCustom.includes('"server"'), 'JSON 包含 server 段');
    assert(jsonCustom.includes('"cocurrencyNum": 6'), 'JSON 输出键为 cocurrencyNum');

    const yamlDefault = ConfigGenerator.generateYAML(uniqueUrls);
    assert(yamlDefault.includes('server:'), '默认配置也包含 server: 段');
    assert(yamlDefault.includes('  host: 0.0.0.0'), '默认 server.host 为 0.0.0.0');
    assert(yamlDefault.includes('  port: "8080"'), '默认 server.port 为 "8080"');
    assert(yamlDefault.includes('  - name: localFile'), '默认 storage 段含本地目的地');
    assert(yamlDefault.includes('    path: /app/repo'), '默认本地路径 /app/repo');
    const yamlFallback = ConfigGenerator.generateYAML(uniqueUrls, { storageDestinations: [] });
    assert(yamlFallback.includes('  - name: localFile'), 'storageDestinations 为空时回退默认本地目的地');

    if (failed.length > 0) {
      console.error('\n共 ' + failed.length + ' 项断言失败');
      process.exitCode = 1;
    } else {
      console.log('\n全部配置生成断言通过');
    }

    console.log('\n=== 测试完成 ===');
  });

} catch (error) {
  console.error('测试过程中出现错误:', error);
}

console.log('\n=== background.js 冒烟测试 ===');

// 模拟 chrome API，捕获 message 处理器
let backgroundHandler = null;
global.chrome = {
  bookmarks: {
    getTree: (cb) => cb([
      { id: '0', title: '', children: [
        { id: '1', title: 'Vue', url: 'https://github.com/vuejs/vue' }
      ] }
    ])
  },
  storage: {
    sync: {
      get: (defaults) => Promise.resolve({
        ...defaults,
        storageDestinations: [
          { name: 'archive-local', type: 'file', path: '/data/repos' },
          { name: 'public-s3', type: 's3', endpoint: 's3.example.com', region: 'us-east-1', bucket: 'my-bucket', accessKeyID: 'AKIA', secretAccessKey: 'sk' }
        ],
        server: { ...defaults.server, port: '9000', authEnabled: true }
      })
    }
  },
  runtime: {
    lastError: null,
    onMessage: { addListener: (fn) => { backgroundHandler = fn; } },
    onInstalled: { addListener: () => {} }
  }
};

require('../background/background.js');

backgroundHandler({ action: 'processBookmarks' }, {}, (resp) => {
  assert(resp && resp.success, 'background processBookmarks 成功');
  assert(resp.data.yaml.includes('server:'), 'background YAML 包含 server:');
  assert(resp.data.yaml.includes('  port: "9000"'), 'background 读取 storage 中的 server.port');
  assert(resp.data.yaml.includes('  authEnabled: true'), 'background server.authEnabled 输出');
  assert(resp.data.yaml.includes('cron: "0 * * * *"'), 'background 默认 cron');
  assert(resp.data.yaml.includes('    storage:\n      - "archive-local"\n      - "public-s3"'), 'background 仓库条目引用全部目的地');
  assert(resp.data.yaml.includes('  - name: "public-s3"'), 'background storage 段包含 s3 目的地');
  assert((resp.data.yaml.match(/^storage:/gm) || []).length === 1, 'background YAML 仅一个 storage: 头');
  assert(resp.data.json.includes('"server"'), 'background JSON 包含 server 段');
  assert(!resp.data.yaml.includes('undefined'), 'background YAML 无 undefined');

  // 冒烟断言在异步回调内执行，退出码需在此设置
  if (failed.length > 0) {
    console.error('\n共 ' + failed.length + ' 项断言失败');
    process.exitCode = 1;
  } else {
    console.log('\nbackground 冒烟测试断言通过');
  }
});