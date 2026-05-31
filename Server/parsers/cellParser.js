const WEEK_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];

const SUBJECT_KEYWORDS = [
  'תורה', 'דינים', 'יהדות', 'חשבון', 'אנגלית', 'נביא', 'ספרות', 'קריאה',
  'הבנת', 'הנקרא', 'הבעה', 'דקדוק', 'טבע', 'מולדת', 'היסטוריה', 'גאוגרפיה',
  'הנדסה', 'מלאכה', 'ציור', 'זמרה', 'התעמלות', 'כישורי חיים', 'פרשת שבוע',
  'באורי תפילה', 'פרקי אבות', 'העשרה', 'תגבור', 'שעת סיפור', 'זהב', 'חברה',
  'גדולי ישראל', 'מהנה', 'ומשתנה', 'מיומנויות', 'ריתמיקה', 'פעילות', 'שבת',
  'השלמה', 'מדוברת', 'שבוע', 'תפילה', 'ישראל', 'חיים', 'סיפור', 'כתיבה',
  'פרשת', 'נושא', 'כתיב', 'התעמלות',
];

const SUBJECT_LINE_CONTINUATIONS = new Set([
  'יהדות', 'הנקרא', 'ומשתנה', 'מדוברת', 'אבות', 'שבוע', 'ישראל', 'תפילה', 'חיים',
  'סיפור1', 'סיפור2', 'סיפור3', 'סיפור4',
]);

export { WEEK_DAYS, SUBJECT_KEYWORDS };

export const isClassNameToken = (token) => {
  const text = (token || '').toString().trim();
  if (!text) return false;
  if (/^[א-ת]\d+$/.test(text)) return true;
  if (/^[א-ת]$/.test(text)) return true;
  if (/^[A-Z]$/.test(text)) return true;
  if (/^\d{1,2}$/.test(text)) return true;
  return false;
};

export const normalizeClassToken = (token) => {
  const cleaned = (token || '').toString().trim();
  if (!cleaned) return '';
  if (isClassNameToken(cleaned)) return cleaned;
  const match = cleaned.match(/[א-ת]\d+/);
  return match ? match[0] : cleaned;
};

export const extractClassTokens = (text) => {
  const source = (text || '').toString();
  const found = new Set();

  (source.match(/[א-ת]\d+/g) || []).forEach((match) => {
    const normalized = normalizeClassToken(match);
    if (isClassNameToken(normalized)) found.add(normalized);
  });

  source.split(/[\s,]+/).forEach((token) => {
    const trimmed = token.trim();
    const normalized = normalizeClassToken(trimmed);
    if (isClassNameToken(normalized) && trimmed === normalized) {
      found.add(normalized);
    }
  });

  return [...found];
};

export const splitByComma = (value) =>
  (value || '')
    .toString()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const isLikelySubject = (word) =>
  SUBJECT_KEYWORDS.some((kw) => word.includes(kw) || kw.includes(word));

export const isValidTeacherName = (name) => {
  const text = (name || '').toString().trim();
  if (!text || text.length < 2) return false;
  if (isLikelySubject(text)) return false;
  if (isClassNameToken(text)) return false;
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

  if (normalizedSubject === 'באורי' && (teacher || '').includes('פרקי אבות')) {
    normalizedSubject = 'באורי תפילה, פרקי אבות';
    normalizedTeacher = cleanTeacherName(teacher);
  }

  if (/^פרקי אבות\s+/.test(teacher || '')) {
    normalizedTeacher = cleanTeacherName(teacher);
    if (normalizedSubject === 'באורי') {
      normalizedSubject = 'באורי תפילה, פרקי אבות';
    }
  }

  return {
    subject: normalizedSubject,
    teacher: normalizedTeacher || null,
  };
};

export const splitTeacherNames = (value) =>
  splitByComma(value).map(cleanTeacherName).filter(isValidTeacherName);

const stripClassTokensFromText = (text, classes) => {
  let result = (text || '').toString();
  classes.forEach((className) => {
    result = result.replace(new RegExp(`\\b${className.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g'), '');
  });
  return result.replace(/\s+,/g, ',').replace(/,\s+/g, ', ').replace(/\s{2,}/g, ' ').trim();
};

const extractLeadingClasses = (text, allowedClasses = null) => {
  const trimmed = (text || '').toString().trim();
  const commaParts = splitByComma(trimmed);
  const classes = [];
  const remainderParts = [];

  if (commaParts.length >= 2) {
    commaParts.forEach((part) => {
      const token = normalizeClassToken(part.trim().split(/\s+/)[0]);
      const isAllowed = !allowedClasses || allowedClasses.has(token);
      if (isClassNameToken(token) && isAllowed && classes.length < commaParts.length) {
        classes.push(token);
      } else {
        remainderParts.push(part);
      }
    });

    if (classes.length >= 2) {
      return { classes, remainder: remainderParts.join(', ').trim() };
    }
  }

  const tokens = trimmed.split(/\s+/);
  if (tokens.length >= 2 && isClassNameToken(normalizeClassToken(tokens[0]))) {
    const first = normalizeClassToken(tokens[0]);
    const isAllowed = !allowedClasses || allowedClasses.has(first);
    if (isAllowed) {
      return { classes: [first], remainder: tokens.slice(1).join(' ') };
    }
  }

  return { classes: [], remainder: trimmed };
};

const parseSubjectAndTeachers = (text) => {
  const merged = (text || '').toString().trim();
  if (!merged) return { subject: '', teachers: [] };

  for (const keyword of [...SUBJECT_KEYWORDS].sort((a, b) => b.length - a.length)) {
    if (merged.startsWith(`${keyword} `)) {
      const rest = merged.slice(keyword.length).trim();
      return { subject: keyword, teachers: splitTeacherNames(rest) };
    }
    if (merged === keyword) {
      return { subject: keyword, teachers: [] };
    }
  }

  const lines = merged.split(/\s+/);
  let splitAt = lines.length;

  for (let index = 0; index < lines.length; index += 1) {
    const token = lines[index];
    if (isValidTeacherName(token) && index > 0) {
      splitAt = index;
      break;
    }
    if (index > 0) {
      const partial = lines.slice(0, index + 1).join(' ');
      if (SUBJECT_KEYWORDS.includes(partial)) {
        continue;
      }
      if (partial.endsWith(',') || SUBJECT_LINE_CONTINUATIONS.has(token)) {
        continue;
      }
    }
  }

  if (splitAt === lines.length && lines.length === 1) {
    if (isLikelySubject(lines[0])) {
      return { subject: lines[0], teachers: [] };
    }
    if (isValidTeacherName(lines[0])) {
      return { subject: '', teachers: [lines[0]] };
    }
    return { subject: lines[0], teachers: [] };
  }

  const subject = lines.slice(0, splitAt).join(' ').replace(/\s+,/g, ',').trim();
  const teacherText = lines.slice(splitAt).join(' ').trim();
  return { subject, teachers: splitTeacherNames(teacherText) };
};

const parseMultilineCell = (lines) => {
  if (lines.length >= 2 && isValidTeacherName(lines[0]) && !isLikelySubject(lines[0])) {
    return {
      subject: lines.slice(1).filter((line) => line !== 'נושא').join(' ').trim(),
      teachers: splitTeacherNames(lines[0]),
    };
  }

  const subjectParts = [lines[0]];
  let index = 1;
  while (index < lines.length) {
    const current = lines[index];
    const previous = subjectParts[subjectParts.length - 1];
    if (
      previous.endsWith(',') ||
      SUBJECT_LINE_CONTINUATIONS.has(current) ||
      (isLikelySubject(current) && !isValidTeacherName(current))
    ) {
      subjectParts.push(current);
      index += 1;
      continue;
    }
    break;
  }

  const subject = subjectParts.join(' ').replace(/\s+,/g, ',').trim();
  const teachers = splitTeacherNames(lines.slice(index).join(' '));
  return { subject, teachers };
};

const buildLesson = (className, day, hour, subject, teacher, group = null, meta = {}) => {
  const normalized = normalizeSubjectTeacher(subject, teacher);
  const rawCellText = meta.rawCellText != null ? String(meta.rawCellText) : null;
  const duration = meta.duration != null ? Number(meta.duration) : null;
  const source = meta.source || null;

  return {
    className,
    day,
    hour: Number(hour),
    subject: normalized.subject || (rawCellText || '').trim() || '',
    teacher: normalized.teacher,
    group,
    rawCellText,
    duration: duration && duration > 1 ? duration : null,
    source,
  };
};

const expandLessons = (
  classNames,
  day,
  hour,
  subject,
  teachers,
  allowedClasses = null,
  meta = {}
) => {
  const targets = (classNames.length ? classNames : ['']).filter(Boolean);
  const validClasses = allowedClasses
    ? targets.filter((name) => allowedClasses.has(name))
    : targets;

  const classList = validClasses.length ? validClasses : targets;
  const teacherList = teachers.length ? teachers : [null];
  const lessons = [];

  classList.forEach((className) => {
    teacherList.forEach((teacher) => {
      if (!subject && !teacher) return;
      lessons.push(buildLesson(className, day, hour, subject, teacher, null, meta));
    });
  });

  return lessons;
};

export const parseCellContent = (
  rawValue,
  className,
  day,
  hour,
  allowedClasses = null,
  meta = {}
) => {
  const rawText = (rawValue ?? '').toString().trim();
  if (!rawText || rawText === 'נושא') return [];

  const cellMeta = {
    rawCellText: meta.rawCellText ?? rawText,
    source: meta.source || null,
    duration: meta.duration || null,
  };

  const lines = rawText.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
  const mergedLine = lines.join(' ').replace(/\s+/g, ' ').trim();

  let subject = '';
  let teachers = [];
  let explicitClasses = [];

  if (lines.length >= 2) {
    const leadingFromFirst = extractLeadingClasses(lines[0], allowedClasses);
    if (leadingFromFirst.classes.length >= 2) {
      explicitClasses = leadingFromFirst.classes;
      const parsed = parseMultilineCell(
        leadingFromFirst.remainder
          ? [leadingFromFirst.remainder, ...lines.slice(1)]
          : lines.slice(1)
      );
      subject = parsed.subject;
      teachers = parsed.teachers;
    } else {
      const parsed = parseMultilineCell(lines);
      subject = parsed.subject;
      teachers = parsed.teachers;
    }
  } else {
    const leading = extractLeadingClasses(mergedLine, allowedClasses);
    explicitClasses = leading.classes;
    const parsed = parseSubjectAndTeachers(leading.remainder || mergedLine);
    subject = parsed.subject;
    teachers = parsed.teachers;
  }

  if (!explicitClasses.length) {
    explicitClasses = extractClassTokens(mergedLine).filter(
      (name) => !allowedClasses || allowedClasses.has(name)
    );
    if (explicitClasses.length >= 2) {
      subject = stripClassTokensFromText(subject || mergedLine, explicitClasses);
      const reparsed = parseSubjectAndTeachers(subject);
      subject = reparsed.subject || subject;
      teachers = teachers.length ? teachers : reparsed.teachers;
    }
  }

  if (explicitClasses.length >= 2) {
    return expandLessons(explicitClasses, day, hour, subject, teachers, allowedClasses, cellMeta);
  }

  if (explicitClasses.length === 1 && explicitClasses[0] !== className) {
    return expandLessons([explicitClasses[0]], day, hour, subject, teachers, allowedClasses, cellMeta);
  }

  if (!subject && teachers.length === 1) {
    return [];
  }

  if (!subject && !teachers.length) return [];

  if (!subject && mergedLine) {
    subject = mergedLine;
    teachers = [];
  }

  return expandLessons([className], day, hour, subject, teachers, allowedClasses, cellMeta);
};
