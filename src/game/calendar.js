// The calendar the game runs on.
//
// Time is a whole number of days since 1 September 1939, and nothing else. No
// Date object, no timezone, no clock — a game day is an integer, and the civil
// date is only ever computed on the way out to be read. That keeps the rules
// deterministic and identical on the server and in every browser, which matters
// because both build the same world independently.

export const EPOCH = { year: 1939, month: 9, day: 1 };

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Integer division that floors towards negative infinity. */
function floorDiv(a, b) {
  return Math.floor(a / b);
}

/**
 * Days from 1970-01-01 for a proleptic Gregorian date.
 *
 * Howard Hinnant's algorithm: pure integer arithmetic, correct for any year,
 * and exactly invertible by civilFromDays below.
 */
function daysFromCivil(year, month, day) {
  const y = year - (month <= 2 ? 1 : 0);
  const era = floorDiv(y >= 0 ? y : y - 399, 400);
  const yoe = y - era * 400; // [0, 399]
  const doy = floorDiv(153 * (month + (month > 2 ? -3 : 9)) + 2, 5) + day - 1; // [0, 365]
  const doe = yoe * 365 + floorDiv(yoe, 4) - floorDiv(yoe, 100) + doy; // [0, 146096]
  return era * 146097 + doe - 719468;
}

function civilFromDays(z0) {
  const z = z0 + 719468;
  const era = floorDiv(z, 146097);
  const doe = z - era * 146097; // [0, 146096]
  const yoe = floorDiv(doe - floorDiv(doe, 1460) + floorDiv(doe, 36524) - floorDiv(doe, 146096), 365);
  const y = yoe + era * 400;
  const doy = doe - (365 * yoe + floorDiv(yoe, 4) - floorDiv(yoe, 100)); // [0, 365]
  const mp = floorDiv(5 * doy + 2, 153); // [0, 11]
  const d = doy - floorDiv(153 * mp + 2, 5) + 1; // [1, 31]
  const m = mp + (mp < 10 ? 3 : -9); // [1, 12]
  return { year: y + (m <= 2 ? 1 : 0), month: m, day: d };
}

const EPOCH_DAYS = daysFromCivil(EPOCH.year, EPOCH.month, EPOCH.day);

/** Game day number for a civil date. 1 September 1939 is day 0. */
export function dayOf(year, month, day) {
  return daysFromCivil(year, month, day) - EPOCH_DAYS;
}

/** Civil date for a game day, as { year, month, day }. */
export function dateOf(gameDay) {
  return civilFromDays(EPOCH_DAYS + gameDay);
}

/** "1 September 1939". */
export function formatDate(gameDay) {
  const { year, month, day } = dateOf(gameDay);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

/** "1 Sep 1939", for tighter spaces. */
export function formatDateShort(gameDay) {
  const { year, month, day } = dateOf(gameDay);
  return `${day} ${MONTHS[month - 1].slice(0, 3)} ${year}`;
}

/** How many days lie between two game days. */
export function daysBetween(from, to) {
  return to - from;
}
