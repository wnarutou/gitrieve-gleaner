const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Only the DOM operations used by destination cards; Chrome storage stays in memory.
class Element {
  constructor() {
    this.children = [];
    this.value = '';
    this.events = {};
    this.classes = new Set();
    this.classList = {
      toggle: (name, hidden) => hidden ? this.classes.add(name) : this.classes.delete(name),
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name)
    };
  }
  appendChild(child) { this.children.push(child); }
  set innerHTML(value) { this.children = []; }
  addEventListener(name, callback) { this.events[name] = callback; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => [
      ...(selector === `#${child.id}` || selector === `.${child.className}` ? [child] : []),
      ...child.querySelectorAll(selector)
    ]);
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function optionsPage(initial) {
  const stored = structuredClone(initial);
  const elements = new Map();
  const context = vm.createContext({
    console: { log() {}, error() {} }, setTimeout() {},
    document: {
      getElementById(id) {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
      },
      createElement: () => new Element(), addEventListener() {}
    },
    chrome: { storage: {
      sync: {
        get: async defaults => defaults === null ? structuredClone(stored)
          : Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, stored[key] ?? value])),
        set: async value => Object.assign(stored, JSON.parse(JSON.stringify(value))),
        remove: async keys => keys.forEach(key => delete stored[key])
      },
      onChanged: { addListener() {} }
    } }
  });
  for (const file of ['../utils/cronSchedule.js', '../utils/configGenerator.js', '../utils/settingsValidation.js', 'options.js']) {
    vm.runInContext(fs.readFileSync(path.join(__dirname, file), 'utf8'), context);
  }
  return { context, elements, stored };
}

test('legacy S3 is displayed without rewriting saved destinations and must be explicitly converted', async () => {
  const initial = { storageBackend: 's3', s3SecretAccessKey: 'old-secret', server: { port: '9000' } };
  const page = optionsPage(initial);
  await page.context.loadSettings();
  assert.deepEqual(page.stored, initial, 'opening options must not migrate or delete saved data');
  const container = page.elements.get('storage-destinations');
  const type = container.querySelector('#dest-type-0');
  assert.equal(type.value, 's3');
  assert(type.children.find(option => option.value === 's3').disabled);
  assert.equal(page.elements.get('server-dbpath').value, '/app/data/gitrieve.db');
  await page.context.saveSettings();
  assert.deepEqual(page.stored, initial, 'saving unsupported storage must be blocked');

  type.value = 'file';
  type.events.change();
  const pathInput = container.querySelector('#dest-path-0');
  assert.equal(pathInput.value, '', 'conversion requires the user to supply a destination path');
  await page.context.saveSettings();
  assert.deepEqual(page.stored, initial, 'empty converted path must be blocked');
  pathInput.value = '/converted';
  await page.context.saveSettings();
  assert.deepEqual(page.stored.storageDestinations, [{ name: 's3', type: 'file', path: '/converted' }]);
  assert.equal(page.stored.storageBackend, undefined);
  assert.equal(page.stored.s3SecretAccessKey, undefined);
});

test('mixed old destinations remain visible and local paths survive loading and conversion', async () => {
  const page = optionsPage({ storageDestinations: [
    { name: 'local', type: 'file', path: '/original' },
    { name: 'remote', type: 's3', bucket: 'old' }
  ] });
  await page.context.loadSettings();
  const container = page.elements.get('storage-destinations');
  assert.equal(container.querySelectorAll('.dest-card').length, 2);
  assert.equal(container.querySelector('#dest-path-0').value, '/original');
  const type = container.querySelector('#dest-type-1');
  type.value = 'file';
  type.events.change();
  assert.equal(container.querySelector('#dest-path-0').value, '/original');
  container.querySelector('#dest-path-1').value = '/second';
  await page.context.saveSettings();
  assert.deepEqual(page.stored.storageDestinations, [
    { name: 'local', type: 'file', path: '/original' },
    { name: 'remote', type: 'file', path: '/second' }
  ]);
});
