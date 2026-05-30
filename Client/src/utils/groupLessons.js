import { sortDays, sortHours } from './parseSchedule';

export const mergeCellEntries = (entries, viewMode = 'class') => {
  if (viewMode === 'teacher' || !entries?.length) return entries || [];

  const merged = new Map();
  entries.forEach((entry) => {
    const key = entry.subject;
    if (!merged.has(key)) {
      merged.set(key, {
        ...entry,
        teacher: entry.teacher || '',
        className: entry.className || '',
      });
      return;
    }

    const current = merged.get(key);
    const teachers = `${current.teacher},${entry.teacher || ''}`
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    current.teacher = [...new Set(teachers)].join(', ');
  });

  return Array.from(merged.values());
};

export const groupLessonsToGrid = (groupedSchedule, viewMode = 'class') => {
  if (!Array.isArray(groupedSchedule)) {
    return { days: [], hours: [], grid: {} };
  }

  const days = sortDays(groupedSchedule.map((d) => d.day));
  const hours = sortHours(
    groupedSchedule.flatMap((d) => (d.entries || []).map((e) => e.hour ?? e.time))
  );

  const grid = {};
  groupedSchedule.forEach((dayBlock) => {
    const day = dayBlock.day;
    grid[day] = grid[day] || {};
    (dayBlock.entries || []).forEach((entry) => {
      const hour = String(entry.hour ?? entry.time);
      grid[day][hour] = grid[day][hour] || [];
      grid[day][hour].push(entry);
    });
  });

  if (viewMode === 'class') {
    Object.keys(grid).forEach((day) => {
      Object.keys(grid[day]).forEach((hour) => {
        grid[day][hour] = mergeCellEntries(grid[day][hour], 'class');
      });
    });
  }

  return { days, hours, grid };
};

export const groupLessonsByDayHour = (lessons) => {
  const grid = {};
  lessons.forEach((lesson) => {
    const { day } = lesson;
    const hour = String(lesson.hour);
    grid[day] = grid[day] || {};
    grid[day][hour] = grid[day][hour] || [];
    grid[day][hour].push(lesson);
  });

  return {
    days: sortDays(Object.keys(grid)),
    hours: sortHours(
      Object.values(grid).flatMap((dayMap) => Object.keys(dayMap))
    ),
    grid,
  };
};
