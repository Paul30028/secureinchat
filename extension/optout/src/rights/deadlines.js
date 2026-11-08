// Pure date arithmetic for statutory response deadlines.
//
// All dates are ISO calendar dates (YYYY-MM-DD) handled as UTC epoch days, so
// no local timezone or DST rule can shift a deadline. Holidays are optional
// ISO date strings supplied by verified jurisdiction data; this module never
// invents holidays.

const DAY_MS = 86400000;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export class DeadlineError extends Error {
  constructor(code, message) {
    super(message || code);
    this.name = 'DeadlineError';
    this.code = code;
  }
}

function parseDateParts(value) {
  if (typeof value !== 'string') {
    throw new DeadlineError('INVALID_DATE', 'Date must be a YYYY-MM-DD string');
  }
  const match = ISO_DATE.exec(value);
  if (!match) {
    throw new DeadlineError('INVALID_DATE', `Invalid ISO date: ${value}`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const epoch = Date.UTC(year, month - 1, day);
  const check = new Date(epoch);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    throw new DeadlineError('INVALID_DATE', `Invalid calendar date: ${value}`);
  }
  return { year, month, day, epochDay: Math.floor(epoch / DAY_MS) };
}

export function isValidIsoDate(value) {
  try {
    parseDateParts(value);
    return true;
  } catch {
    return false;
  }
}

function isoFromEpochDay(epochDay) {
  return new Date(epochDay * DAY_MS).toISOString().slice(0, 10);
}

function weekday(epochDay) {
  // 1970-01-01 was a Thursday (4).
  return (((epochDay + 4) % 7) + 7) % 7;
}

function normalizeHolidays(holidays) {
  if (holidays === undefined || holidays === null) {
    return new Set();
  }
  if (!Array.isArray(holidays)) {
    throw new DeadlineError('INVALID_HOLIDAYS', 'holidays must be an array');
  }
  const set = new Set();
  for (const holiday of holidays) {
    parseDateParts(holiday);
    set.add(holiday);
  }
  return set;
}

export function addCalendarDays(date, days) {
  if (!Number.isInteger(days) || days < 0) {
    throw new DeadlineError('INVALID_DAYS', 'days must be a non-negative integer');
  }
  const { epochDay } = parseDateParts(date);
  return isoFromEpochDay(epochDay + days);
}

export function subtractCalendarDays(date, days) {
  if (!Number.isInteger(days) || days < 0) {
    throw new DeadlineError('INVALID_DAYS', 'days must be a non-negative integer');
  }
  const { epochDay } = parseDateParts(date);
  return isoFromEpochDay(epochDay - days);
}

export function addBusinessDays(date, days, holidays = []) {
  if (!Number.isInteger(days) || days < 0) {
    throw new DeadlineError('INVALID_DAYS', 'days must be a non-negative integer');
  }
  const closed = normalizeHolidays(holidays);
  let { epochDay } = parseDateParts(date);
  let remaining = days;
  while (remaining > 0) {
    epochDay += 1;
    const dayOfWeek = weekday(epochDay);
    const current = isoFromEpochDay(epochDay);
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !closed.has(current)) {
      remaining -= 1;
    }
  }
  return isoFromEpochDay(epochDay);
}

export function addDaysOfType(date, days, dayType, holidays = []) {
  if (dayType === 'calendar') {
    return addCalendarDays(date, days);
  }
  if (dayType === 'business') {
    return addBusinessDays(date, days, holidays);
  }
  throw new DeadlineError('INVALID_DAY_TYPE', 'dayType must be calendar or business');
}

/**
 * @param {object} input
 * @param {string} input.sentDate ISO date the request was sent
 * @param {number} input.responseDays initial response window
 * @param {'calendar'|'business'} [input.dayType]
 * @param {number} [input.extendableDays] additional days the controller may take
 * @param {string[]} [input.holidays] optional holidays for business-day counting
 * @returns {{sentDate:string,dayType:string,responseDays:number,extendableDays:number,dueDate:string,extendedDueDate:string|null,reminderDate:string}}
 */
export function computeDeadlines({
  sentDate,
  responseDays,
  dayType = 'calendar',
  extendableDays = 0,
  holidays = []
}) {
  parseDateParts(sentDate);
  if (!Number.isInteger(responseDays) || responseDays <= 0) {
    throw new DeadlineError('INVALID_RESPONSE_DAYS', 'responseDays must be a positive integer');
  }
  if (!Number.isInteger(extendableDays) || extendableDays < 0) {
    throw new DeadlineError('INVALID_EXTENSION', 'extendableDays must be a non-negative integer');
  }
  if (dayType !== 'calendar' && dayType !== 'business') {
    throw new DeadlineError('INVALID_DAY_TYPE', 'dayType must be calendar or business');
  }
  // Validate holidays even when there is no extension, so bad data is caught.
  normalizeHolidays(holidays);

  const dueDate = addDaysOfType(sentDate, responseDays, dayType, holidays);
  const extendedDueDate =
    extendableDays > 0
      ? addDaysOfType(dueDate, extendableDays, dayType, holidays)
      : null;
  const reminderDate = subtractCalendarDays(dueDate, 3);

  return {
    sentDate,
    dayType,
    responseDays,
    extendableDays,
    dueDate,
    extendedDueDate,
    reminderDate
  };
}

/** The latest date on which a response is still on time. */
export function effectiveDueDate(deadlines) {
  if (!deadlines || typeof deadlines !== 'object') {
    throw new DeadlineError('INVALID_DEADLINES', 'deadlines object is required');
  }
  return deadlines.extendedDueDate || deadlines.dueDate;
}

/** True when `today` is after the response deadline. */
export function isPastDue(deadlines, today) {
  parseDateParts(today);
  return today > effectiveDueDate(deadlines);
}

/** True when the reminder date has arrived and the deadline has not passed. */
export function isReminderDue(deadlines, today) {
  parseDateParts(today);
  return today >= deadlines.reminderDate && today <= effectiveDueDate(deadlines);
}
