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

  function normalizeIdentifier(value) {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(?:www\.)?/, '')
      .replace(/^git@([^:]+):/, '$1/')
      .replace(/\.git\/?$/, '')
      .replace(/\/+$/, '');
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index++) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function compareRecords(first, second) {
    if (first.key < second.key) return -1;
    if (first.key > second.key) return 1;
    if (first.sourceKey < second.sourceKey) return -1;
    if (first.sourceKey > second.sourceKey) return 1;
    return first.index - second.index;
  }

  function allocationScope(mode, settings) {
    if (mode === 'dailyRange') {
      return `${mode}:${parseTime(settings.cronRangeStart)}-${parseTime(settings.cronRangeEnd)}`;
    }
    return mode;
  }

  function assignSlots(identifiers, slots, mode, settings) {
    const loads = Array(slots.length).fill(0);
    const assigned = Array(identifiers.length);
    const records = identifiers
      .map((identifier, index) => ({
        index,
        key: normalizeIdentifier(identifier) || `repository-${index}`,
        sourceKey: String(identifier || '').trim()
      }))
      .sort(compareRecords);
    const scope = allocationScope(mode, settings);

    records.forEach((record, ordinal) => {
      const targetLoad = Math.floor(ordinal / slots.length);
      const preferred = hashString(`${scope}|${record.key}`) % slots.length;
      let slotIndex = preferred;

      while (loads[slotIndex] > targetLoad) {
        slotIndex = (slotIndex + 1) % slots.length;
      }

      loads[slotIndex] += 1;
      assigned[record.index] = slots[slotIndex];
    });

    return assigned;
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

  function generate(identifiers, settings = {}) {
    if (!Array.isArray(identifiers)) {
      throw new TypeError('仓库标识必须是数组');
    }
    if (identifiers.length === 0) return [];

    const mode = settings.cronMode || 'custom';
    const result = validate(settings);
    if (result.errors.length > 0) {
      throw new Error(result.errors.join('；'));
    }
    if (mode === 'custom') {
      const expression = String(settings.cronExpression || '').trim() || '0 * * * *';
      return Array(identifiers.length).fill(expression);
    }

    const slots = buildSlots(mode, settings);
    return assignSlots(identifiers, slots, mode, settings)
      .map(slot => formatSlot(mode, slot));
  }

  return { generate, validate, visibleFields };
});
