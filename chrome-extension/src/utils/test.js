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

  console.log('\n=== Gitrieve 仓库身份去重测试 ===');
  const duplicateRepositoryVariants = [
    { url: 'https://github.com/chaitin/SafeLine', title: '保留的标题' },
    { url: 'http://github.com/chaitin/safeline/', title: '协议和尾斜杠变体' },
    { url: 'https://www.github.com/chaitin/safeline', title: 'www 变体' },
    { url: 'https://github.com/chaitin/safeline.git', title: '.git 变体' },
    { url: 'https://github.com/chaitin/safeline#readme', title: '片段变体' }
  ];
  const deduplicatedRepositoryVariants = UrlUtils.deduplicateUrls(duplicateRepositoryVariants);
  assert(
    deduplicatedRepositoryVariants.length === 1,
    '按 Gitrieve 的规范化 URL 身份合并同一仓库的所有 URL 变体'
  );
  assert(
    deduplicatedRepositoryVariants[0].title === '保留的标题',
    '仓库 URL 去重时保留第一次出现的书签'
  );

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
      githubApiConcurrency: 7,
      githubMinRequestInterval: '750ms',
      githubLowRemainingThreshold: 42,
      githubScheduleJitter: '0s',
      retryMaxCount: 5,
      retryBaseDelay: '2s',
      syncOverdueGrace: '45m',
      syncStuckThreshold: '12h',
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
    assert(yamlCustom.includes('githubApiConcurrency: 7'), 'YAML 输出自定义 GitHub API 并发数');
    assert(yamlCustom.includes('githubMinRequestInterval: 750ms'), 'YAML 输出自定义 GitHub API 最小请求间隔');
    assert(yamlCustom.includes('githubLowRemainingThreshold: 42'), 'YAML 输出自定义 GitHub API 低配额阈值');
    assert(yamlCustom.includes('githubScheduleJitter: 0s'), 'YAML 输出自定义 GitHub 定时任务错峰时间');
    assert(yamlCustom.includes('retryMaxCount: 5'), 'YAML 输出自定义最大重试次数');
    assert(yamlCustom.includes('retryBaseDelay: 2s'), 'YAML 输出自定义重试基础延迟');
    assert(yamlCustom.includes('syncOverdueGrace: 45m'), 'YAML 输出自定义同步逾期宽限时间');
    assert(yamlCustom.includes('syncStuckThreshold: 12h'), 'YAML 输出自定义同步卡住阈值');

    const jsonCustom = ConfigGenerator.generateJSON(uniqueUrls, customSettings);
    assert(jsonCustom.includes('"server"'), 'JSON 包含 server 段');
    assert(jsonCustom.includes('"cocurrencyNum": 6'), 'JSON 输出键为 cocurrencyNum');
    const parsedJsonCustom = JSON.parse(jsonCustom);
    assert(parsedJsonCustom.githubApiConcurrency === 7, 'JSON 输出自定义 GitHub API 并发数');
    assert(parsedJsonCustom.githubMinRequestInterval === '750ms', 'JSON 输出自定义 GitHub API 最小请求间隔');
    assert(parsedJsonCustom.githubLowRemainingThreshold === 42, 'JSON 输出自定义 GitHub API 低配额阈值');
    assert(parsedJsonCustom.githubScheduleJitter === '0s', 'JSON 输出自定义 GitHub 定时任务错峰时间');
    assert(parsedJsonCustom.retryMaxCount === 5, 'JSON 输出自定义最大重试次数');
    assert(parsedJsonCustom.retryBaseDelay === '2s', 'JSON 输出自定义重试基础延迟');
    assert(parsedJsonCustom.syncOverdueGrace === '45m', 'JSON 输出自定义同步逾期宽限时间');
    assert(parsedJsonCustom.syncStuckThreshold === '12h', 'JSON 输出自定义同步卡住阈值');

    const monthlyConfig = ConfigGenerator.generateFullConfig(uniqueUrls, { cronMode: 'monthly' });
    const monthlyCrons = monthlyConfig.repository.map(repo => repo.cron);
    assert(new Set(monthlyCrons).size === monthlyCrons.length, 'ConfigGenerator 月度模式使用不重复分钟槽');
    assert(monthlyCrons.every(expression => {
      const [minute, hour, day, month, weekday] = expression.split(' ');
      return Number(minute) >= 0 && Number(minute) <= 59 &&
        Number(hour) >= 0 && Number(hour) <= 23 &&
        Number(day) >= 1 && Number(day) <= 28 &&
        month === '*' && weekday === '*';
    }), 'ConfigGenerator 月度模式输出日、时、分 cron');

    const yamlDefault = ConfigGenerator.generateYAML(uniqueUrls);
    assert(yamlDefault.includes('server:'), '默认配置也包含 server: 段');
    assert(yamlDefault.includes('  host: 0.0.0.0'), '默认 server.host 为 0.0.0.0');
    assert(yamlDefault.includes('  port: "8080"'), '默认 server.port 为 "8080"');
    assert(yamlDefault.includes('  - name: localFile'), '默认 storage 段含本地目的地');
    assert(yamlDefault.includes('    path: /app/repo'), '默认本地路径 /app/repo');
    assert(yamlDefault.includes('githubApiConcurrency: 2'), '默认 GitHub API 并发数与 gitrieve 一致');
    assert(yamlDefault.includes('githubMinRequestInterval: 200ms'), '默认 GitHub API 最小请求间隔与 gitrieve 一致');
    assert(yamlDefault.includes('githubLowRemainingThreshold: 100'), '默认 GitHub API 低配额阈值与 gitrieve 一致');
    assert(yamlDefault.includes('githubScheduleJitter: 30s'), '默认 GitHub 定时任务错峰时间与 gitrieve 一致');
    assert(yamlDefault.includes('retryMaxCount: 3'), '默认最大重试次数与 gitrieve 一致');
    assert(yamlDefault.includes('retryBaseDelay: 5s'), '默认重试基础延迟与 gitrieve 一致');
    assert(yamlDefault.includes('syncOverdueGrace: 30m'), '默认同步逾期宽限时间与 gitrieve 一致');
    assert(yamlDefault.includes('syncStuckThreshold: 24h'), '默认同步卡住阈值与 gitrieve 一致');
    const yamlFallback = ConfigGenerator.generateYAML(uniqueUrls, { storageDestinations: [] });
    assert(yamlFallback.includes('  - name: localFile'), 'storageDestinations 为空时回退默认本地目的地');

    console.log('\n=== 反斜杠名称转义测试 ===');

    // 书签标题含字面反斜杠（如 "小狼毫\trime"、"简约皮肤\拼音"）时，
    // 双引号 YAML 字符串必须将 \ 转义为 \\，否则下游 yaml 解析器报
    // "found unknown escape character"。
    const backslashTitle = 'SivanLaai/rime-pure 【小狼毫\\trime 同文】【简约皮肤\\拼音搜狗词库】';
    const yamlBackslash = ConfigGenerator.generateYAML(
      [{ url: 'https://github.com/SivanLaai/rime-pure', title: backslashTitle }]
    );
    assert(yamlBackslash.includes('小狼毫\\\\trime'), 'YAML 中反斜杠被转义为 \\\\（t 前为两个反斜杠）');
    assert(yamlBackslash.includes('简约皮肤\\\\拼音'), '中文后紧跟的反斜杠也被转义');
    assert(!yamlBackslash.includes('小狼毫\\trime'), 'YAML 不再包含未转义的 \\t 序列');
    assert(ConfigGenerator.yamlQuote('a\\b') === '"a\\\\b"', 'yamlQuote 对含反斜杠的值加引号并转义');

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
        { id: '1', title: 'Vue', url: 'https://github.com/vuejs/vue' },
        { id: '2', title: 'React', url: 'https://github.com/facebook/react' },
        { id: '3', title: 'SafeLine first', url: 'https://github.com/chaitin/SafeLine' },
        { id: '4', title: 'SafeLine protocol variant', url: 'http://github.com/chaitin/safeline/' },
        { id: '5', title: 'SafeLine www variant', url: 'https://www.github.com/chaitin/safeline' },
        { id: '6', title: 'SafeLine git suffix variant', url: 'https://github.com/chaitin/safeline.git' },
        { id: '7', title: 'SafeLine fragment variant', url: 'https://github.com/chaitin/safeline#readme' }
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
        githubApiConcurrency: 5,
        githubMinRequestInterval: '500ms',
        githubLowRemainingThreshold: 75,
        githubScheduleJitter: '10s',
        retryMaxCount: 7,
        retryBaseDelay: '3s',
        syncOverdueGrace: '1h',
        syncStuckThreshold: '18h',
        cronMode: 'weekly',
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
  assert(resp.data.yaml.includes('    storage:\n      - "archive-local"\n      - "public-s3"'), 'background 仓库条目引用全部目的地');
  assert(resp.data.yaml.includes('  - name: "public-s3"'), 'background storage 段包含 s3 目的地');
  assert((resp.data.yaml.match(/^storage:/gm) || []).length === 1, 'background YAML 仅一个 storage: 头');
  assert(resp.data.json.includes('"server"'), 'background JSON 包含 server 段');
  assert(resp.data.yaml.includes('githubApiConcurrency: 5'), 'background YAML 输出保存的 GitHub API 并发数');
  assert(resp.data.yaml.includes('githubMinRequestInterval: 500ms'), 'background YAML 输出保存的 GitHub API 最小请求间隔');
  assert(resp.data.yaml.includes('githubLowRemainingThreshold: 75'), 'background YAML 输出保存的 GitHub API 低配额阈值');
  assert(resp.data.yaml.includes('githubScheduleJitter: 10s'), 'background YAML 输出保存的 GitHub 定时任务错峰时间');
  assert(resp.data.yaml.includes('retryMaxCount: 7'), 'background YAML 输出保存的最大重试次数');
  assert(resp.data.yaml.includes('retryBaseDelay: 3s'), 'background YAML 输出保存的重试基础延迟');
  assert(resp.data.yaml.includes('syncOverdueGrace: 1h'), 'background YAML 输出保存的同步逾期宽限时间');
  assert(resp.data.yaml.includes('syncStuckThreshold: 18h'), 'background YAML 输出保存的同步卡住阈值');
  const backgroundJson = JSON.parse(resp.data.json);
  assert(backgroundJson.repository.length === 3, 'background 按 Gitrieve URL 身份去除重复仓库');
  assert(backgroundJson.repository.some(repo => repo.name === 'SafeLine first'), 'background 去重保留首次出现的书签标题');
  assert(backgroundJson.githubApiConcurrency === 5, 'background JSON 输出保存的 GitHub API 并发数');
  assert(backgroundJson.githubMinRequestInterval === '500ms', 'background JSON 输出保存的 GitHub API 最小请求间隔');
  assert(backgroundJson.githubLowRemainingThreshold === 75, 'background JSON 输出保存的 GitHub API 低配额阈值');
  assert(backgroundJson.githubScheduleJitter === '10s', 'background JSON 输出保存的 GitHub 定时任务错峰时间');
  assert(backgroundJson.retryMaxCount === 7, 'background JSON 输出保存的最大重试次数');
  assert(backgroundJson.retryBaseDelay === '3s', 'background JSON 输出保存的重试基础延迟');
  assert(backgroundJson.syncOverdueGrace === '1h', 'background JSON 输出保存的同步逾期宽限时间');
  assert(backgroundJson.syncStuckThreshold === '18h', 'background JSON 输出保存的同步卡住阈值');
  const backgroundCrons = backgroundJson.repository.map(repo => repo.cron);
  assert(new Set(backgroundCrons).size === 3, 'background 每周模式为仓库分配不同分钟槽');
  assert(backgroundCrons.every(expression => {
    const [minute, hour, day, month, weekday] = expression.split(' ');
    return Number(minute) >= 0 && Number(minute) <= 59 &&
      Number(hour) >= 0 && Number(hour) <= 23 &&
      day === '*' && month === '*' && Number(weekday) >= 0 && Number(weekday) <= 6;
  }), 'background 每周模式输出星期、小时和分钟 cron');
  assert(!resp.data.yaml.includes('undefined'), 'background YAML 无 undefined');

  // 冒烟断言在异步回调内执行，退出码需在此设置
  if (failed.length > 0) {
    console.error('\n共 ' + failed.length + ' 项断言失败');
    process.exitCode = 1;
  } else {
    console.log('\nbackground 冒烟测试断言通过');
  }
});
