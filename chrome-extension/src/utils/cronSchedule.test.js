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

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function parseCron(expression) {
  const fields = expression.split(' ').map(Number);
  assert(fields.length === 5, `不是五字段 cron: ${expression}`);
  return fields;
}

console.log('=== Cron 自动打散测试 ===');

test('自定义模式为所有仓库保留原 cron', () => {
  const actual = CronSchedule.generate(3, {
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
  const actual = CronSchedule.generate(2, { cronExpression: '' });

  assert(JSON.stringify(actual) === JSON.stringify([
    '0 * * * *',
    '0 * * * *'
  ]), `得到 ${JSON.stringify(actual)}`);
});

test('每天模式在全天分钟槽中无碰撞分配', () => {
  const actual = CronSchedule.generate(100, { cronMode: 'daily' }, seededRandom(1));

  assert(new Set(actual).size === 100, '槽位足够时出现重复 cron');
  actual.forEach(expression => {
    const [minute, hour, day, month, weekday] = expression.split(' ');
    assert(Number(minute) >= 0 && Number(minute) <= 59, expression);
    assert(Number(hour) >= 0 && Number(hour) <= 23, expression);
    assert(day === '*' && month === '*' && weekday === '*', expression);
  });
});

test('每周模式为每个仓库分配星期、小时和分钟', () => {
  const actual = CronSchedule.generate(100, { cronMode: 'weekly' }, seededRandom(2));

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
  const actual = CronSchedule.generate(100, { cronMode: 'monthly' }, seededRandom(3));

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
  const actual = CronSchedule.generate(100, {
    cronMode: 'dailyRange',
    cronRangeStart: '22:30',
    cronRangeEnd: '01:15'
  }, seededRandom(4));

  assert(new Set(actual).size === 100, '跨午夜范围内出现槽位碰撞');
  actual.forEach(expression => {
    const [minute, hour, day, month, weekday] = expression.split(' ');
    const minuteOfDay = Number(hour) * 60 + Number(minute);
    assert(minuteOfDay >= 22 * 60 + 30 || minuteOfDay <= 75, expression);
    assert(day === '*' && month === '*' && weekday === '*', expression);
  });
});

test('仓库多于分钟槽时均衡复用槽位', () => {
  const actual = CronSchedule.generate(5, {
    cronMode: 'dailyRange',
    cronRangeStart: '09:00',
    cronRangeEnd: '09:01'
  }, seededRandom(5));
  const counts = [...actual.reduce((map, expression) => {
    map.set(expression, (map.get(expression) || 0) + 1);
    return map;
  }, new Map()).values()].sort();

  assert(JSON.stringify(counts) === JSON.stringify([2, 3]), `槽位计数为 ${counts}`);
});

test('不同随机序列会产生不同分配', () => {
  const first = CronSchedule.generate(10, { cronMode: 'daily' }, () => 0);
  const second = CronSchedule.generate(10, { cronMode: 'daily' }, () => 0.999999);

  assert(JSON.stringify(first) !== JSON.stringify(second), '两次随机分配完全相同');
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
