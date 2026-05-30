export const filterByTeacher = (lessons, teacherName) =>
  (lessons || []).filter((l) => l.teacher === teacherName);

export const getTeacherNames = (lessons) =>
  [...new Set((lessons || []).map((l) => l.teacher).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'he')
  );
