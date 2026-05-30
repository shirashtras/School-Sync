export const DAY_ORDER = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

export const sortDays = (days) =>
  [...new Set(days)].sort((a, b) => {
    const ai = DAY_ORDER.indexOf(a);
    const bi = DAY_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b, 'he');
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

export const sortHours = (hours) =>
  [...new Set(hours.map(Number))].sort((a, b) => a - b);

export const normalizeGroupedSchedule = (grouped) => {
  if (!Array.isArray(grouped)) return [];
  return grouped.map((dayBlock) => ({
    day: dayBlock.day,
    entries: (dayBlock.entries || []).map((entry) => ({
      ...entry,
      hour: Number(entry.hour ?? entry.time),
      time: String(entry.hour ?? entry.time),
    })),
  }));
};

export const flatLessonsFromGrouped = (grouped, className = null) => {
  const normalized = normalizeGroupedSchedule(grouped);
  return normalized.flatMap((dayBlock) =>
    dayBlock.entries.map((entry) => ({
      className: className || entry.className,
      day: dayBlock.day,
      hour: entry.hour,
      subject: entry.subject,
      teacher: entry.teacher || null,
      group: entry.group || null,
    }))
  );
};
