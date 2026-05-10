// Type definitions for the School Schedule System

/**
 * @typedef {Object} ScheduleEntry
 * @property {string} time - Time slot (e.g., "08:00-09:00")
 * @property {string} subject - Subject name
 * @property {string} teacher - Teacher name
 * @property {string} group - Class group/section
 */

/**
 * @typedef {Object} DailySchedule
 * @property {string} day - Day of week
 * @property {ScheduleEntry[]} entries - Schedule entries for the day
 */

/**
 * @typedef {Object} ClassSchedule
 * @property {string} className - Class name
 * @property {DailySchedule[]} schedule - Weekly schedule
 */

/**
 * @typedef {Object} TeacherSchedule
 * @property {string} teacherName - Teacher name
 * @property {DailySchedule[]} schedule - Weekly schedule
 */

/**
 * @typedef {Object} GroupSchedule
 * @property {string} groupName - Group name
 * @property {DailySchedule[]} schedule - Weekly schedule
 */

/**
 * @typedef {Object} ScheduleData
 * @property {string[]} classes - List of all classes
 * @property {string[]} teachers - List of all teachers
 * @property {string[]} groups - List of all groups
 * @property {Object.<string, ClassSchedule>} scheduleByClass - Schedule indexed by class
 * @property {Object.<string, TeacherSchedule>} scheduleByTeacher - Schedule indexed by teacher
 * @property {Object.<string, GroupSchedule>} scheduleByGroup - Schedule indexed by group
 */

export {};
