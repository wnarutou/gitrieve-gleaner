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

    console.log('\n=== 测试完成 ===');
  });

} catch (error) {
  console.error('测试过程中出现错误:', error);
}