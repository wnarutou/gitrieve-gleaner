const CronSchedule = require('./cronSchedule.js');

const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS: ${name}`);
  } catch (error) {
    failures.push(name);
    console.error(`  FAIL: ${name}`);
    console.error(`        ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function repositoryUrls(count) {
  return Array.from({ length: count }, (_, index) => `https://github.com/example/repo-${index}`);
}

function parseCron(expression) {
  const fields = expression.split(' ').map(Number);
  assert(fields.length === 5, `不是五字段 cron: ${expression}`);
  return fields;
}

console.log('=== Cron 自动打散测试 ===');

test('自定义模式为所有仓库保留原 cron', () => {
  const actual = CronSchedule.generate(repositoryUrls(3), {
    cronMode: 'custom',
    cronExpression: '15 3 * * 1'
  });

  assert(JSON.stringify(actual) === JSON.stringify([
    '15 3 * * 1',
    '15 3 * * 1',
    '15 3 * * 1'
  ]), `得到 ${JSON.stringify(actual)}`);
});

test('旧设置中的空 cron 回退到历史默认值', () => {
  const actual = CronSchedule.generate(repositoryUrls(2), { cronExpression: '' });

  assert(JSON.stringify(actual) === JSON.stringify([
    '0 * * * *',
    '0 * * * *'
  ]), `得到 ${JSON.stringify(actual)}`);
});

test('每天模式在全天分钟槽中无碰撞分配', () => {
  const actual = CronSchedule.generate(repositoryUrls(100), { cronMode: 'daily' });

  assert(new Set(actual).size === 100, '槽位足够时出现重复 cron');
  actual.forEach(expression => {
    const [minute, hour, day, month, weekday] = expression.split(' ');
    assert(Number(minute) >= 0 && Number(minute) <= 59, expression);
    assert(Number(hour) >= 0 && Number(hour) <= 23, expression);
    assert(day === '*' && month === '*' && weekday === '*', expression);
  });
});

test('每周模式为每个仓库分配星期、小时和分钟', () => {
  const actual = CronSchedule.generate(repositoryUrls(100), { cronMode: 'weekly' });

  assert(new Set(actual).size === 100, '每周槽位出现碰撞');
  actual.forEach(expression => {
    const [minute, hour, day, month, weekday] = expression.split(' ');
    assert(Number(minute) >= 0 && Number(minute) <= 59, expression);
    assert(Number(hour) >= 0 && Number(hour) <= 23, expression);
    assert(day === '*' && month === '*', expression);
    assert(Number(weekday) >= 0 && Number(weekday) <= 6, expression);
  });
});

test('每月模式在 1 至 28 日的具体分钟槽中分配', () => {
  const actual = CronSchedule.generate(repositoryUrls(100), { cronMode: 'monthly' });

  assert(new Set(actual).size === 100, '每月槽位出现碰撞');
  assert(actual.some(expression => parseCron(expression)[0] !== 0), '没有分配到具体分钟');
  assert(actual.some(expression => parseCron(expression)[1] !== 0), '没有分配到具体小时');
  actual.forEach(expression => {
    const [minute, hour, day, month, weekday] = expression.split(' ');
    assert(Number(minute) >= 0 && Number(minute) <= 59, expression);
    assert(Number(hour) >= 0 && Number(hour) <= 23, expression);
    assert(Number(day) >= 1 && Number(day) <= 28, expression);
    assert(month === '*' && weekday === '*', expression);
  });
});

test('每日时间段支持跨午夜并精确到分钟', () => {
  const actual = CronSchedule.generate(repositoryUrls(100), {
    cronMode: 'dailyRange',
    cronRangeStart: '22:30',
    cronRangeEnd: '01:15'
  });

  assert(new Set(actual).size === 100, '跨午夜范围内出现槽位碰撞');
  actual.forEach(expression => {
    const [minute, hour, day, month, weekday] = expression.split(' ');
    const minuteOfDay = Number(hour) * 60 + Number(minute);
    assert(minuteOfDay >= 22 * 60 + 30 || minuteOfDay <= 75, expression);
    assert(day === '*' && month === '*' && weekday === '*', expression);
  });
});

test('仓库多于分钟槽时均衡复用槽位', () => {
  const actual = CronSchedule.generate(repositoryUrls(5), {
    cronMode: 'dailyRange',
    cronRangeStart: '09:00',
    cronRangeEnd: '09:01'
  });
  const counts = [...actual.reduce((map, expression) => {
    map.set(expression, (map.get(expression) || 0) + 1);
    return map;
  }, new Map()).values()].sort();

  assert(JSON.stringify(counts) === JSON.stringify([2, 3]), `槽位计数为 ${counts}`);
});

test('相同仓库重复生成保持相同 cron', () => {
  const urls = repositoryUrls(10);
  const first = CronSchedule.generate(urls, { cronMode: 'daily' });
  const second = CronSchedule.generate(urls, { cronMode: 'daily' });

  assert(first.length === urls.length, `生成数量为 ${first.length}`);
  assert(JSON.stringify(first) === JSON.stringify(second), '重复生成的分配发生变化');
});

test('调整仓库顺序不改变 URL 对应的 cron', () => {
  const urls = repositoryUrls(10);
  const reversed = [...urls].reverse();
  const first = CronSchedule.generate(urls, { cronMode: 'weekly' });
  const second = CronSchedule.generate(reversed, { cronMode: 'weekly' });
  const firstByUrl = new Map(urls.map((url, index) => [url, first[index]]));
  const secondByUrl = new Map(reversed.map((url, index) => [url, second[index]]));

  assert(first.length === urls.length, `生成数量为 ${first.length}`);
  urls.forEach(url => {
    assert(firstByUrl.get(url) === secondByUrl.get(url), `${url} 的 cron 发生变化`);
  });
});

test('规范化后相同的原始 URL 调整顺序仍保持各自 cron', () => {
  const urls = [
    'http://github.com/example/same-repo',
    'https://github.com/example/same-repo'
  ];
  const reversed = [...urls].reverse();
  const first = CronSchedule.generate(urls, { cronMode: 'daily' });
  const second = CronSchedule.generate(reversed, { cronMode: 'daily' });
  const firstByUrl = new Map(urls.map((url, index) => [url, first[index]]));
  const secondByUrl = new Map(reversed.map((url, index) => [url, second[index]]));

  urls.forEach(url => {
    assert(firstByUrl.get(url) === secondByUrl.get(url), `${url} 的 cron 发生变化`);
  });
});

test('时间段设置拒绝错误时间格式', () => {
  const result = CronSchedule.validate({
    cronMode: 'dailyRange',
    cronRangeStart: '24:00',
    cronRangeEnd: '9:30'
  });

  assert(result.errors.length === 2, `错误数为 ${result.errors.length}`);
});

test('不同模式只显示会生效的输入字段', () => {
  assert(JSON.stringify(CronSchedule.visibleFields('custom')) === JSON.stringify({
    expression: true,
    range: false
  }), '自定义模式字段可见性错误');
  assert(JSON.stringify(CronSchedule.visibleFields('dailyRange')) === JSON.stringify({
    expression: false,
    range: true
  }), '每日时段模式字段可见性错误');
  assert(JSON.stringify(CronSchedule.visibleFields('monthly')) === JSON.stringify({
    expression: false,
    range: false
  }), '每月模式字段可见性错误');
});

if (failures.length > 0) {
  console.error(`\n共 ${failures.length} 项 Cron 自动打散断言失败`);
  process.exitCode = 1;
} else {
  console.log('\n全部 Cron 自动打散断言通过');
}
