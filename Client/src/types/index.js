// Type definitions for the School Schedule System

/**
 * @typedef {Object} LessonSource
 * @property {string} fileName
 * @property {number|null} page
 * @property {number|null} rowIndex
 * @property {number|null} colIndex
 */

/**
 * @typedef {Object} Lesson
 * @property {string} className
 * @property {string} day
 * @property {number} hour
 * @property {string} subject
 * @property {string|null} teacher
 * @property {string|null} group
 * @property {string|null} rawCellText
 * @property {number|null} duration
 * @property {LessonSource|null} source
 */

/**
 * @typedef {Object} ScheduleEntry
 * @property {number} hour
 * @property {string} time
 * @property {string} subject
 * @property {string} teacher
 * @property {string|null} className
 * @property {string|null} group
 * @property {number|null} duration
 * @property {string|null} rawCellText
 */

/**
 * @typedef {Object} DailySchedule
 * @property {string} day
 * @property {ScheduleEntry[]} entries
 */

export {};
