const WEEK_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

const SUBJECT_KEYWORDS = [
  'תורה', 'דינים', 'יהדות', 'חשבון', 'אנגלית', 'נביא', 'ספרות', 'קריאה',
  'הבנת', 'הנקרא', 'הבעה', 'דקדוק', 'טבע', 'מולדת', 'היסטוריה', 'גאוגרפיה',
  'הנדסה', 'מלאכה', 'ציור', 'זמרה', 'התעמלות', 'כישורי חיים', 'פרשת שבוע',
  'באורי תפילה', 'פרקי אבות', 'העשרה', 'תגבור', 'שעת סיפור', 'זהב', 'חברה',
  'גדולי ישראל', 'מהנה', 'ומשתנה', 'מיומנויות', 'ריתמיקה', 'פעילות', 'שבת',
  'השלמה', 'מדוברת', 'שבוע', 'תפילה', 'ישראל', 'חיים', 'סיפור', 'כתיבה',
  'פרשת', 'נושא',
];

const SUBJECT_LINE_CONTINUATIONS = new Set([
  'יהדות', 'הנקרא', 'ומשתנה', 'מדוברת', 'אבות', 'שבוע', 'ישראל', 'תפילה', 'חיים',
  'סיפור1', 'סיפור2', 'סיפור3', 'סיפור4',
]);

const CLASS_TOKEN = /[א-ת]\d+/g;

export { WEEK_DAYS, SUBJECT_KEYWORDS };

export const normalizeClassToken = (token) => {
  const cleaned = (token || '').toString().trim();
  if (!cleaned) return '';
  const match = cleaned.match(/[א-ת]\d+/);
  return match ? match[0] : cleaned;
};

export const extractClassTokens = (text) => {
  const matches = (text || '').toString().match(CLASS_TOKEN) || [];
  return [...new Set(matches.map(normalizeClassToken))].filter((t) => /^[א-ת]\d+$/.test(t));
};

export const splitByComma = (value) =>
  (value || '')
    .toString()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export const isValidTeacherName = (name) => {
  const text = (name || '').toString().trim();
  if (!text || text.length < 2) return false;
  if (isLikelySubject(text)) return false;
  if (/^[א-ת]\d+$/.test(text)) return false;
  if (/^\d+$/.test(text)) return false;
  if (SUBJECT_KEYWORDS.includes(text)) return false;
  if (SUBJECT_LINE_CONTINUATIONS.has(text)) return false;
  if (/^קבוצה\s*\d+$/i.test(text)) return false;
  if (SUBJECT_KEYWORDS.some((kw) => text.includes(kw))) return false;
  if (/^(פרקי|באורי|גדולי|הבנת|שעת|פרשת)\s/.test(text)) return false;
  return /[א-ת]/.test(text);
};

export const cleanTeacherName = (teacherPart) => {
  let text = (teacherPart || '').toString().trim();
  if (!text) return '';

  for (const keyword of [...SUBJECT_KEYWORDS].sort((a, b) => b.length - a.length)) {
    if (text.startsWith(`${keyword} `)) {
      text = text.slice(keyword.length).trim();
    }
  }

  text = text.replace(/^פרקי אבות\s+/, '').trim();
  text = text.replace(/^באורי תפילה\s+/, '').trim();
  text = text.replace(/^גדולי ישראל\s+/, '').trim();
  return text;
};

export const normalizeSubjectTeacher = (subject, teacher) => {
  let normalizedSubject = (subject || '').trim();
  let normalizedTeacher = cleanTeacherName(teacher);

  if (normalizedTeacher && /^פרקי אבות\s+/.test(teacher || '')) {
    normalizedTeacher = cleanTeacherName(teacher);
    if (normalizedSubject === 'באורי') {
      normalizedSubject = 'באורי תפילה, פרקי אבות';
    }
  }

  if (normalizedSubject === 'באורי' && (teacher || '').includes('פרקי אבות')) {
    normalizedSubject = 'באורי תפילה, פרקי אבות';
    normalizedTeacher = cleanTeacherName(teacher);
  }

  return {
    subject: normalizedSubject,
    teacher: normalizedTeacher || null,
  };
};

export const splitTeacherNames = (value) =>
  splitByComma(value).filter(isValidTeacherName);

const isLikelySubject = (word) =>
  SUBJECT_KEYWORDS.some((kw) => word.includes(kw) || kw.includes(word));

const isSubjectContinuationLine = (line) => {
  const text = (line || '').toString().trim();
  if (!text) return false;
  if (SUBJECT_LINE_CONTINUATIONS.has(text)) return true;
  if (isLikelySubject(text) && !isValidTeacherName(text)) return true;
  return false;
};

const splitSubjectAndTeacherLines = (lines) => {
  if (!lines.length) return { subject: '', teacherPart: '' };

  const subjectParts = [lines[0]];
  let index = 1;

  while (index < lines.length) {
    const current = lines[index];
    const pirkeiTeacherMatch = current.match(/^פרקי אבות\s+([א-ת].+)$/);
    if (pirkeiTeacherMatch) {
      subjectParts.push('פרקי אבות');
      return {
        subject: subjectParts.join(' ').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim(),
        teacherPart: pirkeiTeacherMatch[1].trim(),
      };
    }

    const previous = subjectParts[subjectParts.length - 1];
    if (previous.endsWith(',') || isSubjectContinuationLine(current)) {
      subjectParts.push(current);
      index += 1;
      continue;
    }
    break;
  }

  const subject = subjectParts
    .join(' ')
    .replace(/\s+,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const teacherPart = cleanTeacherName(lines.slice(index).join(' ').trim());
  return { subject, teacherPart };
};

const stripClassesFromText = (text) =>
  (text || '')
    .toString()
    .replace(CLASS_TOKEN, '')
    .replace(/,/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const buildLesson = (className, day, hour, subject, teacher) => {
  const normalized = normalizeSubjectTeacher(subject, teacher);
  return {
    className,
    day,
    hour: Number(hour),
    subject: normalized.subject,
    teacher: normalized.teacher,
    group: null,
  };
};

const expandMultipleTeachers = (className, day, hour, subject, teacherPart) => {
  const teachers = splitTeacherNames(teacherPart);
  if (!teachers.length) {
    return [buildLesson(className, day, hour, subject, null)];
  }
  return teachers.map((teacher) => buildLesson(className, day, hour, subject, teacher));
};

const expandMultipleClasses = (classes, day, hour, subject, teacherPart, allowedClasses = null) => {
  const validClasses = allowedClasses
    ? classes.filter((className) => allowedClasses.has(className))
    : classes;

  if (!validClasses.length) {
    return [buildLesson(classes[0] || '', day, hour, subject, teacherPart)];
  }

  const teachers = splitTeacherNames(teacherPart);
  if (!teachers.length) {
    return validClasses.map((className) => buildLesson(className, day, hour, subject, null));
  }
  return validClasses.flatMap((className) =>
    teachers.map((teacher) => buildLesson(className, day, hour, subject, teacher))
  );
};

const parseSingleLineCell = (text) => {
  const trimmed = (text || '').trim();
  if (!trimmed || !trimmed.includes(' ')) return null;

  for (const keyword of [...SUBJECT_KEYWORDS].sort((a, b) => b.length - a.length)) {
    if (trimmed.startsWith(`${keyword} `)) {
      return { subject: keyword, teacherPart: trimmed.slice(keyword.length).trim() };
    }
  }

  const { subject, teacherPart } = splitSubjectAndTeacherLines([trimmed]);
  if (subject && teacherPart) return { subject, teacherPart };

  const words = trimmed.split(/\s+/);
  if (words.length >= 2 && isLikelySubject(words[0])) {
    return { subject: words[0], teacherPart: words.slice(1).join(' ') };
  }

  return null;
};

const detectTeacherFirstLines = (lines) => {
  if (lines.length < 2) return null;

  if (
    isValidTeacherName(lines[0]) &&
    (isLikelySubject(lines[1]) || SUBJECT_KEYWORDS.some((kw) => lines.slice(1).join(' ').includes(kw)))
  ) {
    return {
      subject: lines.slice(1).filter((line) => !/^נושא$/i.test(line)).join(' ').trim(),
      teacherPart: lines[0],
    };
  }

  return null;
};

export const parseCellContent = (rawValue, className, day, hour, allowedClasses = null) => {
  const rawText = (rawValue ?? '').toString().trim();
  if (!rawText) return [];

  const lines = rawText.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
  const filterClasses = (classes) =>
    allowedClasses ? classes.filter((name) => allowedClasses.has(name)) : classes;

  if (lines.length === 1) {
    const onlyClassTokens = filterClasses(extractClassTokens(lines[0]));
    if (onlyClassTokens.length && stripClassesFromText(lines[0]) === '') {
      return [];
    }
    if (isValidTeacherName(lines[0])) {
      return [];
    }
    const inline = parseSingleLineCell(lines[0]);
    if (inline) {
      return expandMultipleTeachers(className, day, hour, inline.subject, inline.teacherPart);
    }
  }

  const teacherFirst = detectTeacherFirstLines(lines);
  if (teacherFirst) {
    return expandMultipleTeachers(
      className,
      day,
      hour,
      teacherFirst.subject,
      teacherFirst.teacherPart
    );
  }

  if (lines.length >= 2) {
    const firstClasses = filterClasses(extractClassTokens(lines[0]));
    if (firstClasses.length >= 2 && lines.length >= 3) {
      const { subject, teacherPart } = splitSubjectAndTeacherLines(lines.slice(1));
      return expandMultipleClasses(firstClasses, day, hour, subject, teacherPart, allowedClasses);
    }

    const { subject, teacherPart } = splitSubjectAndTeacherLines(lines);
    const explicitClasses = filterClasses(extractClassTokens(teacherPart));
    if (explicitClasses.length >= 2) {
      const teacher = stripClassesFromText(teacherPart.replace(/[–\-].*/, '').trim());
      const dashMatch = teacherPart.match(/[–\-]\s*(.+)$/);
      const finalTeacher = dashMatch ? dashMatch[1].trim() : teacher;
      return expandMultipleClasses(explicitClasses, day, hour, subject, finalTeacher, allowedClasses);
    }
    return expandMultipleTeachers(className, day, hour, subject, teacherPart);
  }

  const dashParts = rawText.split(/\s*[–\-]\s*/);
  if (dashParts.length >= 2) {
    const left = dashParts[0].trim();
    const teacherPart = dashParts.slice(1).join(' - ').trim();
    const classes = filterClasses(extractClassTokens(left));
    const { subject } = splitSubjectAndTeacherLines([left]);
    if (classes.length >= 2) {
      return expandMultipleClasses(classes, day, hour, subject, teacherPart, allowedClasses);
    }
    return expandMultipleTeachers(className, day, hour, subject, teacherPart);
  }

  const classesInCell = filterClasses(extractClassTokens(rawText));
  const { subject, teacherPart } = splitSubjectAndTeacherLines([rawText]);

  if (classesInCell.length >= 2) {
    return expandMultipleClasses(classesInCell, day, hour, subject, teacherPart || null, allowedClasses);
  }

  if (classesInCell.length === 1 && classesInCell[0] !== className) {
    return expandMultipleTeachers(classesInCell[0], day, hour, subject, teacherPart);
  }

  if (teacherPart.includes(',')) {
    return expandMultipleTeachers(className, day, hour, subject, teacherPart);
  }

  const slashParts = rawText.split('/').map((p) => p.trim()).filter(Boolean);
  if (slashParts.length === 2 && !classesInCell.length) {
    return [buildLesson(className, day, hour, slashParts[0], slashParts[1])];
  }

  if (!subject) return [];
  return [buildLesson(className, day, hour, subject, teacherPart || null)];
};
