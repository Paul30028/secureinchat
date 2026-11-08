import test from 'node:test';
import assert from 'node:assert/strict';

import {
  addBusinessDays,
  addCalendarDays,
  computeDeadlines,
  effectiveDueDate,
  isPastDue,
  isReminderDue,
  isValidIsoDate,
  subtractCalendarDays
} from '../../extension/optout/src/rights/deadlines.js';

test('calendar deadlines cross a month and a year', () => {
  assert.equal(addCalendarDays('2027-01-31', 30), '2027-03-02');
  assert.equal(addCalendarDays('2027-12-20', 30), '2028-01-19');
  assert.equal(addCalendarDays('2028-02-29', 1), '2028-03-01');
  assert.equal(addCalendarDays('2028-01-31', 30), '2028-03-01');
  assert.equal(subtractCalendarDays('2028-01-01', 3), '2027-12-29');
});

test('leap day 2028-02-29 is accepted and 2027/2028 invalid dates are rejected', () => {
  assert.equal(isValidIsoDate('2028-02-29'), true);
  assert.equal(isValidIsoDate('2027-02-29'), false);
  assert.equal(isValidIsoDate('2028-13-01'), false);
  assert.equal(isValidIsoDate('2028-2-29'), false);
  assert.throws(
    () => computeDeadlines({ sentDate: '2027-02-29', responseDays: 30 }),
    (error) => error.code === 'INVALID_DATE'
  );
});

test('business days skip weekends across a leap year', () => {
  // 2028-02-25 is a Friday.
  assert.equal(addBusinessDays('2028-02-25', 10), '2028-03-10');
  assert.equal(addBusinessDays('2028-03-10', 1), '2028-03-13');
  assert.equal(addBusinessDays('2028-03-11', 1), '2028-03-13');
});

test('business days also skip supplied holidays', () => {
  assert.equal(
    addBusinessDays('2028-02-25', 10, ['2028-03-01']),
    '2028-03-13'
  );
  assert.equal(
    addBusinessDays('2028-02-25', 10, ['2028-02-28', '2028-03-01']),
    '2028-03-14'
  );
});

test('computeDeadlines returns due, extended due and reminder dates', () => {
  const calendar = computeDeadlines({
    sentDate: '2027-12-20',
    responseDays: 30,
    extendableDays: 30,
    dayType: 'calendar'
  });
  assert.deepEqual(calendar, {
    sentDate: '2027-12-20',
    dayType: 'calendar',
    responseDays: 30,
    extendableDays: 30,
    dueDate: '2028-01-19',
    extendedDueDate: '2028-02-18',
    reminderDate: '2028-01-16'
  });
  assert.equal(effectiveDueDate(calendar), '2028-02-18');
  assert.equal(isPastDue(calendar, '2028-02-18'), false);
  assert.equal(isPastDue(calendar, '2028-02-19'), true);
  assert.equal(isReminderDue(calendar, '2028-01-15'), false);
  assert.equal(isReminderDue(calendar, '2028-01-16'), true);
  assert.equal(isReminderDue(calendar, '2028-02-19'), false);
});

test('business deadlines with an extension are counted from the first due date', () => {
  const result = computeDeadlines({
    sentDate: '2028-02-25',
    responseDays: 10,
    extendableDays: 5,
    dayType: 'business',
    holidays: ['2028-03-01']
  });
  assert.equal(result.dueDate, '2028-03-13');
  assert.equal(result.extendedDueDate, '2028-03-20');
  assert.equal(result.reminderDate, '2028-03-10');
});

test('extension is optional and zero means no extended date', () => {
  const result = computeDeadlines({
    sentDate: '2028-02-29',
    responseDays: 10,
    dayType: 'business'
  });
  assert.equal(result.extendedDueDate, null);
  assert.equal(result.dueDate, '2028-03-14');
});

test('invalid deadline inputs are rejected', () => {
  assert.throws(
    () => computeDeadlines({ sentDate: '2028-01-01', responseDays: 0 }),
    (error) => error.code === 'INVALID_RESPONSE_DAYS'
  );
  assert.throws(
    () => computeDeadlines({ sentDate: '2028-01-01', responseDays: 30, dayType: 'lunar' }),
    (error) => error.code === 'INVALID_DAY_TYPE'
  );
  assert.throws(
    () => addBusinessDays('2028-01-01', 3, ['not-a-date']),
    (error) => error.code === 'INVALID_DATE'
  );
});
