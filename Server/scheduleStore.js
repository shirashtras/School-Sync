import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  WEEK_DAYS,
  splitTeacherNames,
  isValidTeacherName,
  normalizeSubjectTeacher,
} from './parsers/cellParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataFilePath = path.join(__dirname, 'data', 'schedule.json');

const DAY_ORDER = [...WEEK_DAYS];

const sortLessons = (lessons) =>
  [...lessons].sort((a, b) => {
    const dayDiff = DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day);
    if (dayDiff !== 0) return dayDiff;
    return a.hour - b.hour;
  });

const sortHebrew = (items) =>
  [...items].sort((a, b) => a.localeCompare(b, 'he', { sensitivity: 'base' }));

export const normalizeLesson = (row) => {
  const className = (row.className || '').toString().trim();
  const day = (row.day || '').toString().trim();
  const hour = Number(row.hour ?? row.time);
  const durationRaw = row.duration != null ? Number(row.duration) : null;
  const duration = durationRaw && durationRaw > 1 ? durationRaw : null;
  const { subject, teacher } = normalizeSubjectTeacher(
    (row.subject || '').toString().trim(),
    row.teacher ? row.teacher.toString().trim() : null
  );

  return {
    className,
    day,
    hour,
    subject,
    teacher,
    group: null,
    rawCellText: row.rawCellText != null ? String(row.rawCellText) : null,
    duration,
    source: row.source && typeof row.source === 'object' ? row.source : null,
  };
};

const lessonDisplayEntry = (lesson, teacherDisplay) => ({
  hour: lesson.hour,
  time: String(lesson.hour),
  subject: lesson.subject,
  teacher: teacherDisplay,
  duration: lesson.duration || null,
  rawCellText: lesson.rawCellText || null,
});

const getTeachersFromLesson = (lesson) => {
  const names = splitTeacherNames(lesson.teacher);
  return names.length ? names : (lesson.teacher && isValidTeacherName(lesson.teacher) ? [lesson.teacher] : []);
};

const pushEntry = (target, key, day, entry) => {
  if (!target[key]) target[key] = [];
  let dayBucket = target[key].find((item) => item.day === day);
  if (!dayBucket) {
    dayBucket = { day, entries: [] };
    target[key].push(dayBucket);
  }
  dayBucket.entries.push(entry);
};

export const buildScheduleIndexes = (lessons) => {
  const classes = new Set();
  const teachers = new Set();
  const days = new Set();
  const scheduleByClass = {};
  const scheduleByTeacher = {};
  const scheduleByDay = {};

  lessons.forEach((lesson) => {
    const { className, day, hour, subject, teacher } = lesson;
    if (!className || !day || !hour || !subject) return;

    classes.add(className);
    days.add(day);

    const teacherNames = getTeachersFromLesson(lesson);
    teacherNames.forEach((name) => teachers.add(name));

    const teacherDisplay = teacherNames.length
      ? teacherNames.join(', ')
      : (teacher || '');

    pushEntry(scheduleByClass, className, day, lessonDisplayEntry(lesson, teacherDisplay));

    if (teacher && isValidTeacherName(teacher)) {
      pushEntry(scheduleByTeacher, teacher, day, {
        ...lessonDisplayEntry(lesson, teacher),
        teacher,
        className,
      });
    } else {
      teacherNames.forEach((teacherName) => {
        pushEntry(scheduleByTeacher, teacherName, day, {
          ...lessonDisplayEntry(lesson, teacherName),
          teacher: teacherName,
          className,
        });
      });
    }

    if (!scheduleByDay[day]) scheduleByDay[day] = [];
    let dayClass = scheduleByDay[day].find((d) => d.className === className);
    if (!dayClass) {
      dayClass = { className, entries: [] };
      scheduleByDay[day].push(dayClass);
    }
    dayClass.entries.push(lessonDisplayEntry(lesson, teacherDisplay));
  });

  const sortDayBuckets = (buckets) =>
    buckets.sort((a, b) => DAY_ORDER.indexOf(a.day) - DAY_ORDER.indexOf(b.day));

  Object.values(scheduleByClass).forEach(sortDayBuckets);
  Object.values(scheduleByTeacher).forEach(sortDayBuckets);

  return {
    lessons: sortLessons(lessons.map(normalizeLesson)),
    classes: sortHebrew(Array.from(classes)),
    teachers: sortHebrew(Array.from(teachers)),
    days: Array.from(days).sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b)),
    scheduleByClass,
    scheduleByTeacher,
    scheduleByDay,
  };
};

export const loadScheduleData = () => {
  if (!fs.existsSync(dataFilePath)) {
    return buildScheduleIndexes([]);
  }
  const raw = JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));

  const hadLegacyGroups = (rows) =>
    rows.some((row) => {
      const group = row?.group;
      return group && String(group).trim();
    });

  let rows = [];
  let stripGroupsOnDisk = false;

  if (Array.isArray(raw)) {
    rows = raw;
    stripGroupsOnDisk = hadLegacyGroups(raw);
  } else if (Array.isArray(raw.lessons)) {
    rows = raw.lessons;
    stripGroupsOnDisk = hadLegacyGroups(raw.lessons);
  } else {
    rows = Object.entries(raw.scheduleByClass || {}).flatMap(([className, daySchedules]) =>
      (daySchedules || []).flatMap((daySchedule) =>
        (daySchedule.entries || []).map((entry) => ({
          className,
          day: daySchedule.day,
          hour: entry.hour ?? entry.time,
          subject: entry.subject,
          teacher: entry.teacher,
          group: entry.group,
          rawCellText: entry.rawCellText,
          duration: entry.duration,
          source: entry.source,
        }))
      )
    );
    stripGroupsOnDisk = hadLegacyGroups(rows);
  }

  const data = buildScheduleIndexes(rows.map(normalizeLesson));
  if (stripGroupsOnDisk && data.lessons.length) {
    saveScheduleData(data);
  }
  return data;
};

export const saveScheduleData = (data) => {
  fs.writeFileSync(
    dataFilePath,
    JSON.stringify(
      {
        lessons: data.lessons,
        classes: data.classes,
        teachers: data.teachers,
        days: data.days,
      },
      null,
      2
    )
  );
};

export const getDataFilePath = () => dataFilePath;
