/**
 * Gitrieve书签提取器 - 后台脚本
 * 处理书签提取和配置生成的核心逻辑
 */

importScripts(
  'src/utils/urlUtils.js',
  'src/utils/configGenerator.js',
  'src/utils/bookmarkProcessor.js'
);

/**
 * 处理书签并生成配置
 */
async function processBookmarks() {
  const result = await BookmarkProcessor.processBookmarks();
  return result;
}

/**
 * 监听来自popup的消息
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'processBookmarks') {
    processBookmarks()
      .then(sendResponse)
      .catch((error) => {
        sendResponse({
          success: false,
          error: error.message,
          message: `处理失败: ${error.message}`
        });
      });
    return true;
  }

  sendResponse({ success: false, error: '未知的操作' });
});

/**
 * 扩展安装或更新时的处理
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('首次安装Gitrieve书签提取器');
  } else if (details.reason === 'update') {
    console.log('扩展已更新到新版本');
  }
});

/**
 * 监听书签变化
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