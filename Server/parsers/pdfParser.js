import {
  WEEK_DAYS,
  SUBJECT_KEYWORDS,
  parseCellContent,
  normalizeClassToken,
  extractClassTokens,
} from './cellParser.js';

const SUBJECT_CONTINUATION = new Set([
  'הנקרא', 'ומשתנה', 'יהדות', 'אנגלית', 'מדוברת', 'פרקי', 'אבות',
  'שבוע', 'ישראל', 'תפילה', 'חיים', 'סיפור1', 'סיפור2', 'סיפור3', 'סיפור4',
]);

const isPageMarker = (line) => /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line);
const isHourLine = (line) => /^[1-8]$/.test(line);
const isWeekdayLine = (line) => WEEK_DAYS.includes(line);
const isClassToken = (line) => /^[א-ת]\d+$/.test(line);

const normalizeLines = (text) =>
  (text || '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line && !isPageMarker(line));

const isClassHeaderLine = (line) => extractClassTokens(line).length >= 4;

const shouldSkipLine = (line) =>
  !line ||
  isWeekdayLine(line) ||
  isHourLine(line) ||
  isClassHeaderLine(line) ||
  /^לוח/.test(line) ||
  /^כיתה/.test(line);

const isLikelySubjectLine = (line) =>
  SUBJECT_KEYWORDS.some((kw) => (line || '').includes(kw));

const isLikelyTeacherLine = (line) => {
  if (!line || shouldSkipLine(line)) return false;
  if (isLikelySubjectLine(line)) return false;
  if (/^[א-ת]\d+(?:\s*,\s*[א-ת]\d+)*$/.test(line)) return false;
  return /[א-ת]/.test(line);
};

const shouldMergeSubject = (parts, candidate) => {
  if (!candidate || shouldSkipLine(candidate)) return false;
  if (SUBJECT_CONTINUATION.has(candidate)) return true;
  if (/^סיפור[1-9]$/.test(candidate)) return true;
  const prev = parts[parts.length - 1] || '';
  if (prev.endsWith(',')) return true;
  return isLikelySubjectLine(candidate);
};

const parseLessonTriples = (lines) => {
  const triples = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    if (shouldSkipLine(line)) {
      index += 1;
      continue;
    }

    const subjectParts = [line];
    while (index + 1 < lines.length && shouldMergeSubject(subjectParts, lines[index + 1])) {
      subjectParts.push(lines[index + 1]);
      index += 1;
    }
    const subject = subjectParts.join(' ').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();

    let teacher = '';
    if (index + 1 < lines.length && isLikelyTeacherLine(lines[index + 1])) {
      teacher = lines[index + 1];
      index += 1;
    }

    triples.push({ subject, teacher });
    index += 1;
  }

  return triples;
};

const findTableSections = (lines) => {
  const sections = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!isClassHeaderLine(lines[i])) continue;

    const classes = extractClassTokens(lines[i]);
    if (!classes.length) continue;

    let end = lines.length;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (isClassHeaderLine(lines[j]) && j > i + 20) {
        end = j;
        break;
      }
      if (isWeekdayLine(lines[j]) && j > i + 30) {
        end = j;
        break;
      }
    }

    const daysInSection = [];
    for (let k = Math.max(0, i - 25); k < i; k += 1) {
      if (isWeekdayLine(lines[k])) daysInSection.push(lines[k]);
    }

    sections.push({
      classes,
      days: daysInSection.length ? daysInSection : null,
      contentLines: lines.slice(i + 1, end),
      startIndex: i,
    });
    i = end - 1;
  }

  return sections;
};

/**
 * PDF: columns = classes, rows = hours, days = blocks (by order per spec).
 */
export const parsePdfText = (pdfText) => {
  const lines = normalizeLines(pdfText);
  const sections = findTableSections(lines);
  const lessons = [];
  let globalDayBlockIndex = 0;

  sections.forEach((section) => {
    const triples = parseLessonTriples(section.contentLines);
    const days = section.days?.length
      ? section.days
      : assignDaysByBlock(globalDayBlockIndex, section.classes.length);

    if (!section.days?.length) {
      globalDayBlockIndex += days.length;
    }

    let tripleIndex = 0;
    days.forEach((day) => {
      for (let hour = 1; hour <= 8; hour += 1) {
        let col = 0;
        while (col < section.classes.length && tripleIndex < triples.length) {
          const { subject, teacher } = triples[tripleIndex];
          tripleIndex += 1;

          if (!subject) {
            col += 1;
            continue;
          }

          const className = section.classes[col];
          const cellLessons = parseCellContent(
            teacher ? `${subject}\n${teacher}` : subject,
            className,
            day,
            hour
          );
          lessons.push(...cellLessons);
          col += 1;
        }
      }
    });
  });

  return lessons;
};

const assignDaysByBlock = (startBlockIndex, classCount) => {
  const daysPerTable = classCount > 10 ? 2 : 1;
  const result = [];
  for (let i = 0; i < daysPerTable; i += 1) {
    const dayIndex = startBlockIndex + i;
    if (dayIndex < WEEK_DAYS.length) result.push(WEEK_DAYS[dayIndex]);
  }
  return result.length ? result : [WEEK_DAYS[0]];
};
