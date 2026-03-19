/**
 * 测试文件 - 验证URL处理和配置生成功能
 */

// 模拟Chrome API（用于测试环境）
global.chrome = {
  bookmarks: {
    getTree: (callback) => {
      // 模拟书签数据
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

// 导入我们的模块
const fs = require('fs');
const path = require('path');

// 读取我们的工具模块
const urlUtilsPath = path.join(__dirname, 'urlUtils.js');
const configGeneratorPath = path.join(__dirname, 'configGenerator.js');

// 简单的模块加载器
function loadModule(filePath) {
  const code = fs.readFileSync(filePath, 'utf8');
  const module = { exports: {} };
  eval(code);
  return module.exports;
}

try {
  // 加载模块
  global.UrlUtils = loadModule(urlUtilsPath);
  global.ConfigGenerator = loadModule(configGeneratorPath);

  console.log('=== URL处理测试 ===');

  // 测试URL过滤
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
    const isGitHub = global.UrlUtils.isGitHubRepoUrl(url);
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
    const cleaned = global.UrlUtils.cleanUrl(url);
    const normalized = global.UrlUtils.normalizeGitHubUrl(url);
    console.log(`  原始: ${url}`);
    console.log(`  清理: ${cleaned}`);
    console.log(`  标准化: ${normalized}\n`);
  });

  console.log('=== 书签处理模拟测试 ===');

  // 模拟处理书签
  chrome.bookmarks.getTree((bookmarkTree) => {
    console.log('书签树获取成功');

    // 提取GitHub URL
    const githubUrls = global.UrlUtils.extractGitHubUrlsFromBookmarks(bookmarkTree);
    console.log(`提取到 ${githubUrls.length} 个GitHub URL:`);
    githubUrls.forEach((urlObj, index) => {
      console.log(`  ${index + 1}. ${urlObj.title}: ${urlObj.url}`);
    });

    // 去重
    const uniqueUrls = global.UrlUtils.deduplicateUrls(githubUrls);
    console.log(`\n去重后剩余 ${uniqueUrls.length} 个唯一URL:`);
    uniqueUrls.forEach((urlObj, index) => {
      console.log(`  ${index + 1}. ${urlObj.title}: ${urlObj.url}`);
    });

    // 生成配置
    console.log('\n=== 配置生成测试 ===');
    const yamlConfig = global.ConfigGenerator.generateYAML(uniqueUrls);
    console.log('生成的YAML配置:');
    console.log(yamlConfig);

    const jsonConfig = global.ConfigGenerator.generateJSON(uniqueUrls);
    console.log('\n生成的JSON配置:');
    console.log(jsonConfig);

    console.log('\n=== 测试完成 ===');
  });

} catch (error) {
  console.error('测试过程中出现错误:', error);
}