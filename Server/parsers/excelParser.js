import xlsx from 'xlsx';
import { WEEK_DAYS, parseCellContent, normalizeClassToken } from './cellParser.js';

const isHourCell = (value) => /^[1-8]$/.test((value ?? '').toString().trim());
const isEmptyRow = (row) => !row || row.every((cell) => !(cell ?? '').toString().trim());

const extractClassHeaders = (row) => {
  const headers = [];
  for (let col = 1; col < row.length; col += 1) {
    const token = normalizeClassToken(row[col]);
    if (token && /^[א-ת]\d+$/.test(token)) headers.push(token);
  }
  return headers;
};

const isClassHeaderRow = (row) => extractClassHeaders(row).length >= 3;

/**
 * Parse Excel matrix: header row = classes, col0 = hours, day blocks by empty rows or hour reset.
 */
export const parseExcelWorkbook = (filePath) => {
  const workbook = xlsx.readFile(filePath);
  const lessons = [];

  workbook.SheetNames.forEach((sheetName) => {
    const sheetLessons = parseMatrixSheet(workbook.Sheets[sheetName], sheetName);
    if (sheetLessons.length) {
      lessons.push(...sheetLessons);
      return;
    }
    const flatLessons = parseFlatSheet(workbook.Sheets[sheetName]);
    lessons.push(...flatLessons);
  });

  return lessons;
};

const parseMatrixSheet = (worksheet, sheetName) => {
  const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  if (!rows || rows.length < 2) return [];

  let classNames = [];
  let dayBlockIndex = 0;
  let lessons = [];

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex] || [];

    if (isEmptyRow(row)) {
      if (classNames.length) dayBlockIndex += 1;
      continue;
    }

    if (isClassHeaderRow(row)) {
      classNames = extractClassHeaders(row);
      continue;
    }

    const hourCell = (row[0] ?? '').toString().trim();
    if (!isHourCell(hourCell)) continue;

    const hour = Number(hourCell);
    const day = WEEK_DAYS[dayBlockIndex] || WEEK_DAYS[WEEK_DAYS.length - 1];

    if (!classNames.length) {
      const headerCandidate = rows.find((r) => isClassHeaderRow(r));
      if (headerCandidate) classNames = extractClassHeaders(headerCandidate);
    }

    for (let col = 1; col < row.length && col <= classNames.length; col += 1) {
      const className = classNames[col - 1];
      if (!className) continue;
      const cellLessons = parseCellContent(row[col], className, day, hour);
      lessons.push(...cellLessons);
    }

    if (hour === 8) dayBlockIndex += 1;
  }

  if (!lessons.length && sheetName && WEEK_DAYS.includes(sheetName)) {
    return parseMatrixSheetWithSheetAsDay(rows, sheetName);
  }

  return lessons;
};

const parseMatrixSheetWithSheetAsDay = (rows, day) => {
  const headerRow = rows.find((r) => isClassHeaderRow(r));
  if (!headerRow) return [];
  const classNames = extractClassHeaders(headerRow);
  const lessons = [];

  rows.forEach((row) => {
    const hourCell = (row[0] ?? '').toString().trim();
    if (!isHourCell(hourCell)) return;
    const hour = Number(hourCell);
    for (let col = 1; col < row.length && col <= classNames.length; col += 1) {
      const className = classNames[col - 1];
      if (!className) continue;
      lessons.push(...parseCellContent(row[col], className, day, hour));
    }
  });

  return lessons;
};

const mapFlatKey = (key) => {
  const k = (key || '').toString().trim().toLowerCase();
  const map = {
    class: 'className',
    'class name': 'className',
    classname: 'className',
    כיתה: 'className',
    יום: 'day',
    day: 'day',
    time: 'hour',
    שעה: 'hour',
    hour: 'hour',
    subject: 'subject',
    מקצוע: 'subject',
    teacher: 'teacher',
    מורה: 'teacher',
    group: 'group',
    קבוצה: 'group',
    הקבצה: 'group',
  };
  return map[k] || k;
};

const parseFlatSheet = (worksheet) => {
  const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
  const lessons = [];

  jsonData.forEach((rawRow) => {
    const row = {};
    Object.entries(rawRow).forEach(([rawKey, value]) => {
      const normalized = mapFlatKey(rawKey);
      if (normalized) row[normalized] = value;
    });

    const className = normalizeClassToken(row.className || row.class);
    const day = (row.day || '').toString().trim();
    const hour = Number(row.hour || row.time);
    if (!className || !day || !hour || !row.subject) return;

    lessons.push({
      className,
      day,
      hour,
      subject: row.subject.toString().trim(),
      teacher: row.teacher?.toString().trim() || null,
      group: row.group?.toString().trim() || null,
    });
  });

  return lessons;
};
