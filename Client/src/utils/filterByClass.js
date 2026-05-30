export const filterByClass = (lessons, className) =>
  (lessons || []).filter((l) => l.className === className);

export const getClassNames = (lessons) =>
  [...new Set((lessons || []).map((l) => l.className))].sort((a, b) =>
    a.localeCompare(b, 'he')
  );
