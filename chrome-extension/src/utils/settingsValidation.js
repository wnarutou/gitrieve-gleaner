/**
 * Parse and validate global settings accepted by gitrieve.
 */
const SettingsValidation = (() => {
  const MAX_DURATION_NS = 9223372036854775807n;
  const UNIT_NS = {
    ns: 1n,
    us: 1000n,
    'µs': 1000n,
    'μs': 1000n,
    ms: 1000000n,
    s: 1000000000n,
    m: 60000000000n,
    h: 3600000000000n
  };

  function parseDurationNanoseconds(value) {
    let remaining = value;
    if (remaining.length > 128 || remaining.startsWith('-')) return null;
    if (remaining.startsWith('+')) remaining = remaining.slice(1);
    if (remaining === '0') return 0n;
    if (!remaining) return null;

    const token = /(\d+(?:\.\d*)?|\.\d+)(ns|us|µs|μs|ms|s|m|h)/gy;
    let position = 0;
    let total = 0n;

    while (position < remaining.length) {
      token.lastIndex = position;
      const match = token.exec(remaining);
      if (!match) return null;

      const [wholeText, fractionText = ''] = match[1].split('.');
      const unit = UNIT_NS[match[2]];
      const whole = BigInt(wholeText || '0') * unit;
      const fraction = fractionText
        ? (BigInt(fractionText) * unit) / (10n ** BigInt(fractionText.length))
        : 0n;

      total += whole + fraction;
      if (total > MAX_DURATION_NS) return null;
      position = token.lastIndex;
    }

    return total;
  }

  function isDuration(value, allowZero) {
    const nanoseconds = parseDurationNanoseconds(value);
    return nanoseconds !== null && (allowZero || nanoseconds > 0n);
  }

  function parsePositiveInteger(value, label, errors) {
    const parsed = Number(value);
    if (!Number.isSafeInteger(parsed) || parsed < 1) {
      errors.push(`${label}必须是大于等于 1 的整数`);
    }
    return parsed;
  }

  function parseGitHubSettings(input) {
    const errors = [];
    const githubApiConcurrency = parsePositiveInteger(
      input.githubApiConcurrency,
      'GitHub API 并发数',
      errors
    );
    const githubLowRemainingThreshold = parsePositiveInteger(
      input.githubLowRemainingThreshold,
      'GitHub API 低配额阈值',
      errors
    );
    const githubMinRequestInterval = String(input.githubMinRequestInterval || '').trim();
    const githubScheduleJitter = String(input.githubScheduleJitter || '').trim();

    if (!isDuration(githubMinRequestInterval, false)) {
      errors.push('GitHub API 最小请求间隔必须是正数 Go duration，例如 200ms、1.5s 或 1m');
    }
    if (!isDuration(githubScheduleJitter, true)) {
      errors.push('GitHub 定时任务错峰时间必须是非负 Go duration，例如 0s、30s 或 1m');
    }

    return {
      errors,
      value: {
        githubApiConcurrency,
        githubMinRequestInterval,
        githubLowRemainingThreshold,
        githubScheduleJitter
      }
    };
  }

  function parseRuntimeSettings(input) {
    const errors = [];
    const retryMaxCount = parsePositiveInteger(
      input.retryMaxCount,
      '最大重试次数',
      errors
    );
    const retryBaseDelay = String(input.retryBaseDelay || '').trim();
    const syncOverdueGrace = String(input.syncOverdueGrace || '').trim();
    const syncStuckThreshold = String(input.syncStuckThreshold || '').trim();

    if (!isDuration(retryBaseDelay, false)) {
      errors.push('重试基础延迟必须是正数 Go duration，例如 500ms、5s 或 1m');
    }
    if (!isDuration(syncOverdueGrace, false)) {
      errors.push('同步逾期宽限时间必须是正数 Go duration，例如 30m 或 1h');
    }
    if (!isDuration(syncStuckThreshold, false)) {
      errors.push('同步卡住阈值必须是正数 Go duration，例如 12h 或 24h');
    }

    return {
      errors,
      value: {
        retryMaxCount,
        retryBaseDelay,
        syncOverdueGrace,
        syncStuckThreshold
      }
    };
  }

  function parseServerSettings(input) {
    const errors = [];
    const logRetentionMonths = parsePositiveInteger(
      input.logRetentionMonths,
      '日志保留月数',
      errors
    );

    return {
      errors,
      value: { logRetentionMonths }
    };
  }

  function parseGitHubAccountSettings(input) {
    const errors = [];
    const githubAccountConcurrency = parsePositiveInteger(
      input.githubAccountConcurrency,
      'GitHub 单账号并发数',
      errors
    );
    const accounts = Array.isArray(input.githubAccounts) ? input.githubAccounts : [];
    if (!Array.isArray(input.githubAccounts)) {
      errors.push('GitHub 账号池必须是列表');
    }
    const names = new Set();
    const githubAccounts = accounts.map((account, index) => {
      const name = String(account?.name || '').trim();
      const token = String(account?.token || '').trim();
      const label = `GitHub 账号 ${index + 1}`;
      if (!name) {
        errors.push(`${label}：名称必填`);
      } else if (names.has(name)) {
        errors.push(`${label}：名称「${name}」重复，名称需唯一`);
      } else {
        names.add(name);
      }
      if (!token) {
        errors.push(`${label}：Token 必填`);
      }
      return { name, token };
    });

    return {
      errors,
      value: { githubAccounts, githubAccountConcurrency }
    };
  }

  return {
    parseGitHubSettings,
    parseRuntimeSettings,
    parseServerSettings,
    parseGitHubAccountSettings
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsValidation;
}
