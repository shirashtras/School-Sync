import { sortDays } from './parseSchedule';

export const filterByDay = (lessons, dayName) =>
  (lessons || []).filter((l) => l.day === dayName);

export const getDayNames = (lessons) =>
  sortDays((lessons || []).map((l) => l.day));

export const sortDayLessons = (lessons) =>
  [...lessons].sort((a, b) => {
    if (a.hour !== b.hour) return a.hour - b.hour;
    return a.className.localeCompare(b.className, 'he');
  });
