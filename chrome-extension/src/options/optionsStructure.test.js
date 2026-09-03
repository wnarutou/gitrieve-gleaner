const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'options.html'), 'utf8');

function parentDivOpeningTag(inputId) {
  const inputIndex = html.indexOf(`id="${inputId}"`);
  if (inputIndex === -1) throw new Error(`找不到输入字段 ${inputId}`);
  const openingTagStart = html.lastIndexOf('<div', inputIndex);
  const openingTagEnd = html.indexOf('>', openingTagStart);
  return html.slice(openingTagStart, openingTagEnd + 1);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const filterTag = parentDivOpeningTag('filter-github');
assert(!filterTag.includes('hidden'), 'GitHub URL 过滤选项不应被 cron 模式隐藏');
assert(!filterTag.includes('cron-'), 'GitHub URL 过滤选项不应承载 cron 显示控制 ID');

const expressionTag = parentDivOpeningTag('cron-expression');
assert(expressionTag.includes('id="cron-expression-group"'), 'cron 表达式应位于自己的显示控制组');
assert(!expressionTag.includes('hidden'), '默认自定义模式应显示 cron 表达式');

const startTag = parentDivOpeningTag('cron-range-start');
const endTag = parentDivOpeningTag('cron-range-end');
assert(startTag.includes('id="cron-range-start-group"') && startTag.includes('hidden'), '开始时间应位于默认隐藏的时间段组');
assert(endTag.includes('id="cron-range-end-group"') && endTag.includes('hidden'), '结束时间应位于默认隐藏的时间段组');

console.log('选项页 Cron 字段结构断言通过');
