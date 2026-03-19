/**
 * Gitrieve书签提取器 - 后台脚本
 * 处理书签提取和配置生成的核心逻辑
 */

// 导入工具模块（在Chrome扩展中通过importScripts或全局变量访问）
// 注意：这里我们假设工具模块已经被加载，实际部署时需要调整

/**
 * 处理书签并生成配置
 */
async function processBookmarks() {
    console.log('后台脚本：开始处理书签...');

    try {
        // 获取所有书签
        const bookmarkTree = await getBookmarks();
        console.log(`获取到书签树，开始处理...`);

        // 提取GitHub URL
        const githubUrls = extractGitHubUrls(bookmarkTree);
        console.log(`找到 ${githubUrls.length} 个GitHub仓库URL`);

        // 去重
        const uniqueUrls = deduplicateUrls(githubUrls);
        console.log(`去重后剩余 ${uniqueUrls.length} 个唯一URL`);

        // 生成配置
        const yamlConfig = generateYamlConfig(uniqueUrls);
        const jsonConfig = generateJsonConfig(uniqueUrls);

        // 统计信息
        const stats = {
            totalBookmarks: countBookmarks(bookmarkTree),
            githubUrlsFound: githubUrls.length,
            uniqueUrls: uniqueUrls.length
        };

        return {
            success: true,
            data: {
                yaml: yamlConfig,
                json: jsonConfig,
                urls: uniqueUrls,
                stats: stats
            },
            message: `成功提取 ${uniqueUrls.length} 个GitHub仓库`
        };

    } catch (error) {
        console.error('后台脚本处理书签时出错:', error);
        return {
            success: false,
            error: error.message,
            data: null,
            message: `处理失败: ${error.message}`
        };
    }
}

/**
 * 获取所有书签
 */
function getBookmarks() {
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
 * 从书签树中提取GitHub仓库URL
 */
function extractGitHubUrls(bookmarkNodes) {
    const githubUrls = [];
    const githubRepoRegex = /^https?:\/\/(www\.)?github\.com\/[a-zA-Z0-9\-_.]+\/[a-zA-Z0-9\-_.]+(\/)?$/;

    function traverseNodes(nodes) {
        if (!nodes || !Array.isArray(nodes)) return;

        for (const node of nodes) {
            // 如果有URL且是GitHub仓库URL
            if (node.url && githubRepoRegex.test(node.url)) {
                // 清理URL
                let cleanedUrl = cleanUrl(node.url);

                // 确保使用https
                cleanedUrl = cleanedUrl.replace(/^http:/, 'https:');

                githubUrls.push({
                    url: cleanedUrl,
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
 * 清理URL
 */
function cleanUrl(url) {
    if (!url || typeof url !== 'string') return '';

    // 移除#及后面的内容
    let cleaned = url.split('#')[0];

    // 移除尾部斜杠
    cleaned = cleaned.replace(/\/$/, '');

    return cleaned;
}

/**
 * 去重URL数组
 */
function deduplicateUrls(urls) {
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

/**
 * 统计书签数量
 */
function countBookmarks(bookmarkTree) {
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
 * 生成YAML配置
 */
function generateYamlConfig(urls) {
    const config = {
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

    // 生成仓库配置
    config.repository = urls.map(urlObj => {
        const urlParts = urlObj.url.split('/');
        const domainIndex = urlParts.findIndex(part => part.includes('github.com'));

        if (domainIndex === -1 || domainIndex + 2 >= urlParts.length) {
            return null;
        }

        const owner = urlParts[domainIndex + 1];
        const repo = urlParts[domainIndex + 2];

        // 清理名称
        const name = sanitizeName(urlObj.title || repo);

        return {
            name: name,
            url: `github.com/${owner}/${repo}`,
            cron: '0 * * * *',
            storage: ['localFile'],
            useCache: true,
            allBranches: true,
            depth: 0,
            downloadReleases: true,
            downloadIssues: true,
            downloadWiki: true,
            downloadDiscussion: true
        };
    }).filter(repo => repo !== null);

    // 转换为YAML字符串
    return toYamlString(config);
}

/**
 * 生成JSON配置
 */
function generateJsonConfig(urls) {
    const config = generateYamlConfig(urls);
    // 这里我们实际上需要从YAML字符串解析为对象，然后转换为JSON
    // 为了简化，我们直接使用相同的配置对象
    const configObj = {
        repository: config.repository,
        storage: config.storage,
        githubToken: config.githubToken,
        cocurrencyNum: config.cocurrencyNum,
        releaseSizeLimit: config.releaseSizeLimit,
        releaseNumLimit: config.releaseNumLimit
    };

    return JSON.stringify(configObj, null, 2);
}

/**
 * 清理名称
 */
function sanitizeName(name) {
    return name
        .replace(/[^a-zA-Z0-9\-_]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_+|_+$/g, '');
}

/**
 * 将配置对象转换为YAML字符串
 */
function toYamlString(config) {
    const yamlLines = [];

    // 添加仓库配置
    if (config.repository && config.repository.length > 0) {
        yamlLines.push('repository:');
        config.repository.forEach(repo => {
            yamlLines.push('  - name: ' + repo.name);
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
 * 监听来自popup的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('后台脚本收到消息:', request);

    if (request.action === 'processBookmarks') {
        // 异步处理书签
        processBookmarks()
            .then(result => {
                sendResponse(result);
            })
            .catch(error => {
                sendResponse({
                    success: false,
                    error: error.message,
                    message: `处理失败: ${error.message}`
                });
            });

        // 返回true表示异步响应
        return true;
    }

    // 其他消息处理...
    sendResponse({ success: false, error: '未知的操作' });
});

/**
 * 扩展安装或更新时的处理
 */
chrome.runtime.onInstalled.addListener((details) => {
    console.log('扩展已安装/更新:', details.reason);

    if (details.reason === 'install') {
        // 首次安装时的初始化
        console.log('首次安装Gitrieve书签提取器');
    } else if (details.reason === 'update') {
        // 更新时的处理
        console.log('扩展已更新到新版本');
    }
});

/**
 * 监听书签变化（可选）
 */
chrome.bookmarks.onCreated.addListener((id, bookmark) => {
    console.log('书签已创建:', bookmark);
});

chrome.bookmarks.onRemoved.addListener((id, removeInfo) => {
    console.log('书签已删除:', id, removeInfo);
});

chrome.bookmarks.onChanged.addListener((id, changeInfo) => {
    console.log('书签已更改:', id, changeInfo);
});

console.log('Gitrieve书签提取器后台脚本已启动');