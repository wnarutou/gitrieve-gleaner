const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ConfigGenerator = require('./configGenerator');

const urls = [{ url: 'https://github.com/owner/repo', title: 'Example' }];

test('unsupported storage blocks both exports instead of silently changing the destination', () => {
  for (const type of ['s3', 'ftp']) {
    for (const storageDestinations of [
      [{ name: 'old-backup', type }],
      [{ name: 'local', type: 'file', path: '/data' }, { name: 'old-backup', type }]
    ]) {
      for (const format of ['generateYAML', 'generateJSON']) {
        assert.throws(() => ConfigGenerator[format](urls, { storageDestinations }), /old-backup.*file/);
      }
    }
  }
});

test('legacy S3 settings block export until explicitly replaced', () => {
  assert.throws(() => ConfigGenerator.generateYAML(urls, { storageBackend: 's3' }), /s3.*file/);
  const config = ConfigGenerator.generateFullConfig(urls, {
    storageBackend: 's3',
    storageDestinations: [{ name: 'converted', type: 'file', path: '/archive' }]
  });
  assert.deepEqual(config.storage, [{ name: 'converted', type: 'file', path: '/archive' }]);
});

test('local destinations keep their paths and references and discard obsolete credentials', () => {
  const config = ConfigGenerator.generateFullConfig(urls, {
    storageDestinations: [
      { name: 'one', type: 'file', path: '/archive', endpoint: 'old.example', secretAccessKey: 'obsolete' },
      { name: 'two', type: 'file', path: '/backup' }
    ]
  });
  assert.deepEqual(config.storage, [
    { name: 'one', type: 'file', path: '/archive' },
    { name: 'two', type: 'file', path: '/backup' }
  ]);
  assert.deepEqual(config.repository[0].storage, ['one', 'two']);
});

test('YAML preserves strings that look like YAML scalars or contain special characters', () => {
  const yaml = ConfigGenerator.generateYAML([{ ...urls[0], title: 'true' }], {
    githubToken: 'token: value\nnext',
    storageDestinations: [{ name: 'null', type: 'file', path: 'C:\\backup # daily' }],
    server: { dbPath: '/data/db: archive.sqlite', authToken: 'line1\nline2' }
  });
  assert(yaml.includes('name: "true"'));
  assert(yaml.includes('      - "null"'));
  assert(yaml.includes('path: "C:\\\\backup # daily"'));
  assert(yaml.includes('githubToken: "token: value\\nnext"'));
  assert(yaml.includes('dbPath: "/data/db: archive.sqlite"'));
  assert(yaml.includes('authToken: "line1\\nline2"'));
});

test('server log retention uses the upstream default and is exported as a nested server setting', () => {
  const defaultConfig = ConfigGenerator.generateFullConfig(urls);
  assert.equal(defaultConfig.server.logRetentionMonths, 2);
  assert.match(ConfigGenerator.generateYAML(urls), /server:\n(?:.*\n)*?  logRetentionMonths: 2\n/);

  const customConfig = ConfigGenerator.generateFullConfig(urls, {
    server: { logRetentionMonths: 6 }
  });
  assert.equal(customConfig.server.logRetentionMonths, 6);
  assert.equal(JSON.parse(ConfigGenerator.generateJSON(urls, {
    server: { logRetentionMonths: 6 }
  })).server.logRetentionMonths, 6);
});

test('GitHub account pool defaults remain compatible and custom accounts reach YAML and JSON', () => {
  const defaults = ConfigGenerator.generateFullConfig(urls);
  assert.deepEqual(defaults.githubAccounts, []);
  assert.equal(defaults.githubAccountConcurrency, 2);
  assert.match(ConfigGenerator.generateYAML(urls), /githubAccounts: \[\]\ngithubAccountConcurrency: 2\n/);

  const settings = {
    githubAccounts: [
      { name: 'alice', token: 'alice:secret' },
      { name: 'bob', token: 'bob-secret' }
    ],
    githubAccountConcurrency: 3
  };
  const yaml = ConfigGenerator.generateYAML(urls, settings);
  assert.match(yaml, /githubAccounts:\n  - name: alice\n    token: "alice:secret"\n  - name: bob\n    token: "bob-secret"\ngithubAccountConcurrency: 3\n/);
  const json = JSON.parse(ConfigGenerator.generateJSON(urls, settings));
  assert.deepEqual(json.githubAccounts, settings.githubAccounts);
  assert.equal(json.githubAccountConcurrency, 3);
});

test('malformed GitHub account pools block export without exposing tokens', () => {
  for (const githubAccounts of [
    { name: 'not-a-list' },
    [{ name: '', token: 'ghp_sensitive-secret' }],
    [{ name: 'alice', token: '' }],
    [{ name: 'alice', token: 'one' }, { name: 'alice', token: 'ghp_sensitive-secret' }]
  ]) {
    assert.throws(
      () => ConfigGenerator.generateYAML(urls, { githubAccounts }),
      error => /GitHub 账号池|GitHub 账号.*账号池/.test(error.message) && !error.message.includes('ghp_sensitive-secret')
    );
  }
});

function loadWorker(stored) {
  let handler;
  const context = vm.createContext({
    console: { log() {} },
    chrome: {
      bookmarks: { getTree: callback => callback([{ children: urls }]) },
      storage: { sync: { get: async defaults => defaults === null ? stored : { ...defaults, ...stored } } },
      runtime: {
        onMessage: { addListener: callback => { handler = callback; } },
        onInstalled: { addListener() {} }
      }
    }
  });
  const backgroundDir = path.join(__dirname, '../background');
  context.importScripts = (...names) => names.forEach(name => {
    const file = path.resolve(backgroundDir, name);
    vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  });
  vm.runInContext(fs.readFileSync(path.join(backgroundDir, 'background.js'), 'utf8'), context);
  return () => new Promise(resolve => handler({ action: 'processBookmarks' }, {}, resolve));
}

test('real classic service worker reports incompatible saved storage instead of producing a download', async () => {
  for (const stored of [
    { storageBackend: 's3' },
    { storageDestinations: [{ name: 'old-backup', type: 's3' }] }
  ]) {
    const result = await loadWorker(stored)();
    assert.equal(result.success, false);
    assert.match(result.error, /file/);
    assert.equal(result.data, undefined);
  }
});

test('classic service worker uses saved settings, fills partial server defaults and matches the utility export', async () => {
  const stored = {
    server: { port: '9001', logRetentionMonths: 6 },
    githubAccounts: [{ name: 'alice', token: 'alice-secret' }],
    githubAccountConcurrency: 4,
    storageDestinations: [{ name: 'backup', type: 'file', path: '/data # archive' }],
    githubScheduleJitter: '0s', retryMaxCount: 8
  };
  const result = await loadWorker(stored)();
  assert.equal(result.success, true);
  const config = JSON.parse(result.data.json);
  assert.equal(config.server.port, '9001');
  assert.equal(config.server.dbPath, '/app/data/gitrieve.db');
  assert.equal(config.server.logRetentionMonths, 6);
  assert.deepEqual(config.githubAccounts, [{ name: 'alice', token: 'alice-secret' }]);
  assert.equal(config.githubAccountConcurrency, 4);
  assert.equal(config.retryMaxCount, 8);
  assert.equal(config.githubScheduleJitter, '0s');
  assert.deepEqual(config.storage, [{ name: 'backup', type: 'file', path: '/data # archive' }]);
  assert.equal(result.data.yaml, ConfigGenerator.generateYAML(urls, stored));
});
