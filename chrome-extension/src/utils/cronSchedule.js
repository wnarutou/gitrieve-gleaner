(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
  root.CronSchedule = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const MODES = new Set(['custom', 'daily', 'weekly', 'monthly', 'dailyRange']);
  const MINUTES_PER_DAY = 24 * 60;
  const MONTHLY_DAYS = 28;

  function parseTime(value) {
    const match = /^(?:[01]\d|2[0-3]):[0-5]\d$/.exec(String(value || '').trim());
    if (!match) return null;
    const [hour, minute] = String(value).split(':').map(Number);
    return hour * 60 + minute;
  }

  function validate(settings = {}) {
    const errors = [];
    const mode = settings.cronMode || 'custom';

    if (!MODES.has(mode)) {
      errors.push('定时任务模式无效');
      return { errors };
    }

    if (mode === 'dailyRange') {
      if (parseTime(settings.cronRangeStart) === null) {
        errors.push('开始时间必须使用 HH:mm 格式');
      }
      if (parseTime(settings.cronRangeEnd) === null) {
        errors.push('结束时间必须使用 HH:mm 格式');
      }
    }

    return { errors };
  }

  function visibleFields(mode) {
    return {
      expression: mode === 'custom',
      range: mode === 'dailyRange'
    };
  }

  function integerRange(size) {
    return Array.from({ length: size }, (_, index) => index);
  }

  function buildDailyRangeSlots(settings) {
    const start = parseTime(settings.cronRangeStart);
    const end = parseTime(settings.cronRangeEnd);
    if (start <= end) {
      return Array.from({ length: end - start + 1 }, (_, index) => start + index);
    }
    return [
      ...Array.from({ length: MINUTES_PER_DAY - start }, (_, index) => start + index),
      ...Array.from({ length: end + 1 }, (_, index) => index)
    ];
  }

  function buildSlots(mode, settings) {
    switch (mode) {
      case 'daily':
        return integerRange(MINUTES_PER_DAY);
      case 'weekly':
        return integerRange(7 * MINUTES_PER_DAY);
      case 'monthly':
        return integerRange(MONTHLY_DAYS * MINUTES_PER_DAY);
      case 'dailyRange':
        return buildDailyRangeSlots(settings);
      default:
        return [];
    }
  }

  function shuffle(values, random) {
    for (let index = values.length - 1; index > 0; index--) {
      const sample = Math.max(0, Math.min(0.9999999999999999, random()));
      const swapIndex = Math.floor(sample * (index + 1));
      [values[index], values[swapIndex]] = [values[swapIndex], values[index]];
    }
    return values;
  }

  function formatDaily(slot) {
    return `${slot % 60} ${Math.floor(slot / 60)} * * *`;
  }

  function formatWeekly(slot) {
    const minuteOfDay = slot % MINUTES_PER_DAY;
    const weekday = Math.floor(slot / MINUTES_PER_DAY);
    return `${minuteOfDay % 60} ${Math.floor(minuteOfDay / 60)} * * ${weekday}`;
  }

  function formatMonthly(slot) {
    const minuteOfDay = slot % MINUTES_PER_DAY;
    const day = Math.floor(slot / MINUTES_PER_DAY) + 1;
    return `${minuteOfDay % 60} ${Math.floor(minuteOfDay / 60)} ${day} * *`;
  }

  function formatSlot(mode, slot) {
    if (mode === 'weekly') return formatWeekly(slot);
    if (mode === 'monthly') return formatMonthly(slot);
    return formatDaily(slot);
  }

  function generate(count, settings = {}, random = Math.random) {
    const size = Math.max(0, Math.floor(Number(count) || 0));
    if (size === 0) return [];

    const mode = settings.cronMode || 'custom';
    const result = validate(settings);
    if (result.errors.length > 0) {
      throw new Error(result.errors.join('；'));
    }
    if (mode === 'custom') {
      const expression = String(settings.cronExpression || '').trim() || '0 * * * *';
      return Array(size).fill(expression);
    }

    const slots = shuffle(buildSlots(mode, settings), random);
    return Array.from({ length: size }, (_, index) => formatSlot(mode, slots[index % slots.length]));
  }

  return { generate, validate, visibleFields };
});
