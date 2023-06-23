import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import { UNSUPPORTED_EXPIRATION_ERROR } from '../exceptions'
import { secondsPerDay } from '../constants/time'

dayjs.extend(utc)
dayjs.extend(customParseFormat)

/****************************************
 *           TIME FUNCTIONS             *
 ****************************************/

/**
 * Get readable timestamp from millisecond timestamp.
 *
 * @param millisTimestamp Millisecond timestamp in UTC. For example, 1654848000000 for Jun 10 2022 08:00:00.
 * @returns Readable timestamp in the "MMDDYYYY" format.
 */
export function getReadableTimestamp(
  millisTimestamp: number,
  includeSlashes = false
) {
  return dayjs(millisTimestamp)
    .utc()
    .format(includeSlashes ? 'MM/DD/YYYY' : 'MMDDYYYY')
}

/**
 * Get current time in UTC.
 *
 * @returns Object that contains a moment object & unix, millisecond, and readable timestamp representations of the current time.
 */
export function getCurrentTimeUTC() {
  const currentTime = dayjs().utc()

  return {
    dayJsTimestamp: currentTime,
    unixTimestamp: currentTime.unix(),
    millisTimestamp: currentTime.valueOf(),
    readableTimestamp: getReadableTimestamp(currentTime.valueOf())
  }
}

/**
 * Get unix, millisecond, and readable UTC timestamps from millisecond timestamp in any other time zone.
 *
 * @param millisTimestamp Millisecond timestamp in UTC. For example, 1654848000000 for Jun 10 2022 08:00:00.
 * @returns JSON object that contains a moment object as well as unix, millisecond, and readable UTC timestamp representations of millisTimestamp.
 */
export function getTimeUTC(millisTimestamp: number) {
  const time = dayjs(millisTimestamp)
  const utcMillisecondTimestamp = time.valueOf()

  return {
    dayJsTimestamp: time,
    unixTimestamp: time.unix(),
    millisTimestamp: utcMillisecondTimestamp,
    readableTimestamp: getReadableTimestamp(utcMillisecondTimestamp)
  }
}

/**
 * Get unix and millisecond timestamps from readable expiration. This works for any readable timestamp, not just expirations.
 *
 * @param readableExpiration Readable timestamp in the "MMDDYYYY" format.
 * @returns JSON object that contains a moment object as well as unix and millisecond timestamp representations of the readable timestamp.
 */
export function getExpirationTimestamp(
  readableExpiration: string
): Record<string, any> {
  const expiration = dayjs.utc(readableExpiration, 'MMDDYYYY').hour(8)

  if (!isFriday(expiration.unix())) throw UNSUPPORTED_EXPIRATION_ERROR

  return {
    dayJsTimestamp: expiration,
    unixTimestamp: expiration.unix(),
    millisTimestamp: expiration.valueOf()
  }
}

/**
 * Checks if a UNIX timestamp is a Friday (specifically, in the timezone from which the timestamp came).
 *
 * @param unixTimestamp UNIX timestamp.
 * @returns True if is a Friday, else returns False.
 */
export function isFriday(unixTimestamp: number): boolean {
  const dayOfTheWeek = (Math.floor(unixTimestamp / secondsPerDay) + 4) % 7
  return dayOfTheWeek === 5
}
