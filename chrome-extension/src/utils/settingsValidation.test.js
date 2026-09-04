const assert = require('assert');

let SettingsValidation = null;
try {
  SettingsValidation = require('./settingsValidation');
} catch (_) {
  // RED phase: the implementation module does not exist yet.
}

assert(SettingsValidation, 'settings validation module is available');

const valid = SettingsValidation.parseGitHubSettings({
  githubApiConcurrency: '1e2',
  githubMinRequestInterval: ' 1.5s ',
  githubLowRemainingThreshold: '75',
  githubScheduleJitter: '1h30m'
});

assert.deepStrictEqual(valid.errors, []);
assert.deepStrictEqual(valid.value, {
  githubApiConcurrency: 100,
  githubMinRequestInterval: '1.5s',
  githubLowRemainingThreshold: 75,
  githubScheduleJitter: '1h30m'
});

const invalid = SettingsValidation.parseGitHubSettings({
  githubApiConcurrency: '1.5',
  githubMinRequestInterval: 'tomorrow',
  githubLowRemainingThreshold: '-1',
  githubScheduleJitter: '-10s'
});

assert.strictEqual(invalid.errors.length, 4);
assert(invalid.errors.some(error => error.includes('GitHub API 并发数')));
assert(invalid.errors.some(error => error.includes('GitHub API 最小请求间隔')));
assert(invalid.errors.some(error => error.includes('GitHub API 低配额阈值')));
assert(invalid.errors.some(error => error.includes('GitHub 定时任务错峰时间')));

const goCompatible = SettingsValidation.parseGitHubSettings({
  githubApiConcurrency: '2',
  githubMinRequestInterval: '+1s',
  githubLowRemainingThreshold: '100',
  githubScheduleJitter: '0'
});
assert.deepStrictEqual(goCompatible.errors, []);

const maxDuration = SettingsValidation.parseGitHubSettings({
  githubApiConcurrency: '2',
  githubMinRequestInterval: '1ns',
  githubLowRemainingThreshold: '100',
  githubScheduleJitter: '2562047h47m16.854775807s'
});
assert.deepStrictEqual(maxDuration.errors, []);

const overflow = SettingsValidation.parseGitHubSettings({
  githubApiConcurrency: '2',
  githubMinRequestInterval: '999999999999999999999999999999999999h',
  githubLowRemainingThreshold: '100',
  githubScheduleJitter: '30s'
});
assert.strictEqual(overflow.errors.length, 1);
assert(overflow.errors[0].includes('GitHub API 最小请求间隔'));

const subNanosecond = SettingsValidation.parseGitHubSettings({
  githubApiConcurrency: '2',
  githubMinRequestInterval: '0.1ns',
  githubLowRemainingThreshold: '100',
  githubScheduleJitter: '30s'
});
assert.strictEqual(subNanosecond.errors.length, 1);
assert(subNanosecond.errors[0].includes('GitHub API 最小请求间隔'));

const unsafeInteger = SettingsValidation.parseGitHubSettings({
  githubApiConcurrency: '1e100',
  githubMinRequestInterval: '200ms',
  githubLowRemainingThreshold: '100',
  githubScheduleJitter: '30s'
});
assert.strictEqual(unsafeInteger.errors.length, 1);
assert(unsafeInteger.errors[0].includes('GitHub API 并发数'));

assert.strictEqual(
  typeof SettingsValidation.parseRuntimeSettings,
  'function',
  '运行策略配置校验函数可用'
);

const validRuntime = SettingsValidation.parseRuntimeSettings({
  retryMaxCount: '5',
  retryBaseDelay: ' 2.5s ',
  syncOverdueGrace: '45m',
  syncStuckThreshold: '12h'
});
assert.deepStrictEqual(validRuntime.errors, []);
assert.deepStrictEqual(validRuntime.value, {
  retryMaxCount: 5,
  retryBaseDelay: '2.5s',
  syncOverdueGrace: '45m',
  syncStuckThreshold: '12h'
});

const invalidRuntime = SettingsValidation.parseRuntimeSettings({
  retryMaxCount: '0',
  retryBaseDelay: '0s',
  syncOverdueGrace: 'later',
  syncStuckThreshold: '-1h'
});
assert.strictEqual(invalidRuntime.errors.length, 4);
assert(invalidRuntime.errors.some(error => error.includes('最大重试次数')));
assert(invalidRuntime.errors.some(error => error.includes('重试基础延迟')));
assert(invalidRuntime.errors.some(error => error.includes('同步逾期宽限时间')));
assert(invalidRuntime.errors.some(error => error.includes('同步卡住阈值')));

console.log('全局配置输入校验断言通过');
