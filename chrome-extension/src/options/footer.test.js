const assert = require('assert');

const { registerFooter } = require('./footer');

let domReadyHandler;

const elements = {
  'extension-version': { textContent: '' }
};

const documentStub = {
  addEventListener(eventName, handler) {
    assert.strictEqual(eventName, 'DOMContentLoaded');
    domReadyHandler = handler;
  },
  getElementById(id) {
    return elements[id];
  }
};

const runtimeStub = {
  getManifest() {
    return { version: '9.8.7' };
  }
};

registerFooter(documentStub, runtimeStub);

assert.strictEqual(
  elements['extension-version'].textContent,
  '',
  'DOM 就绪前不应初始化页脚'
);
assert.strictEqual(typeof domReadyHandler, 'function', '应注册 DOMContentLoaded 初始化处理器');

domReadyHandler();

assert.strictEqual(
  elements['extension-version'].textContent,
  '9.8.7',
  '页脚应显示 Chrome 当前加载的 manifest 版本'
);

console.log('选项页页脚行为断言通过');
