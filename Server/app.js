import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import fs from 'fs';
import pdfParse from 'pdf-parse';

// Load environment variables
dotenv.config();

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Express app
const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    // Allow Excel and PDF files
    if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/pdf'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel or PDF files are allowed'));
    }
  },
});

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
}

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const dataFilePath = path.join(dataDir, 'schedule.json');

// Function to save data
const saveScheduleData = (data) => {
  fs.writeFileSync(dataFilePath, JSON.stringify(data, null, 2));
};

// Function to load data
const loadScheduleData = () => {
  if (fs.existsSync(dataFilePath)) {
    return JSON.parse(fs.readFileSync(dataFilePath, 'utf8'));
  }
  return {
    classes: [],
    teachers: [],
    groups: [],
    days: [],
    scheduleByClass: {},
    scheduleByTeacher: {},
    scheduleByGroup: {},
    scheduleByDay: {},
  };
};

// Replace the global variable
let scheduleData = loadScheduleData();

const pushEntryToSchedule = (target, key, day, entry) => {
  if (!target[key]) target[key] = [];
  let dayBucket = target[key].find((item) => item.day === day);
  if (!dayBucket) {
    dayBucket = { day, entries: [] };
    target[key].push(dayBucket);
  }
  dayBucket.entries.push(entry);
};

const rebuildScheduleData = (entries) => {
  const classes = new Set();
  const teachers = new Set();
  const groups = new Set();
  const days = new Set();
  const scheduleByClass = {};
  const scheduleByTeacher = {};
  const scheduleByGroup = {};
  const scheduleByDay = {};

  entries.forEach((row) => {
    const rawClassName = (row.className || '').toString().trim();
    const day = (row.day || '').toString().trim();
    const time = ((row.time ?? row.hour ?? '') || '').toString().trim();
    const subject = (row.subject || '').toString().trim();
    const rawTeacher = (row.teacher || '').toString().trim();
    const rawGroup = (row.group || '').toString().trim();

    const classNames = splitClassNames(rawClassName);
    const normalizedClasses = classNames.length
      ? classNames
      : [normalizeClassToken(rawClassName)].filter(Boolean);
    const teacherNames = sanitizeTeacherNames(rawTeacher);
    const normalizedTeachers = teacherNames.length
      ? teacherNames
      : (rawTeacher ? [rawTeacher] : []);
    const finalGroup = isGroupEligibleSubject(subject) ? rawGroup : '';

    if (!normalizedClasses.length || !day || !time || !subject) return;

    normalizedClasses.forEach((className) => classes.add(className));
    days.add(day);
    normalizedTeachers.forEach((teacher) => teachers.add(teacher));
    if (finalGroup) groups.add(finalGroup);

    normalizedClasses.forEach((className) => {
      const teacherValue = normalizedTeachers.join(', ');
      const baseEntry = { time, subject, teacher: teacherValue, group: finalGroup };

      pushEntryToSchedule(scheduleByClass, className, day, baseEntry);
      pushEntryToSchedule(scheduleByDay, day, className, { ...baseEntry, className });

      normalizedTeachers.forEach((teacher) => {
        pushEntryToSchedule(scheduleByTeacher, teacher, day, {
          time,
          subject,
          teacher,
          group: finalGroup,
          className,
        });
      });

      if (finalGroup) {
        pushEntryToSchedule(scheduleByGroup, finalGroup, day, {
          time,
          subject,
          teacher: teacherValue,
          group: finalGroup,
          className,
        });
      }
    });
  });

  return {
    classes: Array.from(classes),
    teachers: Array.from(teachers),
    groups: Array.from(groups),
    days: Array.from(days),
    scheduleByClass,
    scheduleByTeacher,
    scheduleByGroup,
    scheduleByDay,
  };
};

const toFlatEntries = (data) => {
  return Object.entries(data.scheduleByClass || {}).flatMap(([className, daySchedules]) =>
    (daySchedules || []).flatMap((daySchedule) =>
      (daySchedule.entries || []).map((entry) => ({
        className,
        day: daySchedule.day,
        time: entry.time,
        subject: entry.subject,
        teacher: entry.teacher,
        group: entry.group,
      }))
    )
  );
};

const WEEK_DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
const SUBJECT_CONTINUATION_WORDS = new Set([
  'הנקרא',
  'ומשתנה',
  'יהדות',
  'אנגלית',
  'מדוברת',
  'פרקי',
  'אבות',
  'חשבון',
]);

const SUBJECT_KEYWORDS = [
  'תורה', 'דינים', 'יהדות', 'חשבון', 'אנגלית', 'נביא', 'ספרות', 'קריאה',
  'הבנת', 'הנקרא', 'הבעה', 'דקדוק', 'טבע', 'מולדת', 'היסטוריה', 'גאוגרפיה',
  'הנדסה', 'מלאכה', 'ציור', 'זמרה', 'התעמלות', 'כישורי חיים', 'פרשת שבוע',
  'באורי תפילה', 'פרקי אבות', 'העשרה', 'תגבור', 'שעת סיפור', 'זהב', 'חברה',
  'גדולי ישראל', 'מהנה', 'ומשתנה', 'מיומנויות',
];

const isWeekdayLine = (line) => WEEK_DAYS.includes(line);
const isHourLine = (line) => /^[1-8]$/.test(line);
const isPageMarker = (line) => /^--\s*\d+\s+of\s+\d+\s*--$/i.test(line);
const isClassToken = (line) => /^[א-ת]\d+$/i.test(line);
const isGroupToken = (line) =>
  /^[א-ת]\d+(?:\s*,\s*[א-ת]\d+)*$/.test(line) ||
  /^\d?[א-ת]\d(?:\s*,\s*[א-ת]\d+)*$/.test(line);

const normalizeClassToken = (token) => {
  const cleaned = (token || '').toString().trim();
  if (!cleaned) return '';
  const match = cleaned.match(/[א-ת]\d+/);
  return match ? match[0] : cleaned;
};

const splitCsvValues = (value) =>
  (value || '')
    .toString()
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const splitClassNames = (value) => {
  const direct = splitCsvValues(value).map(normalizeClassToken);
  const validDirect = direct.filter((token) => /^[א-ת]\d+$/.test(token));
  if (validDirect.length) return validDirect;
  const inline = (value || '').toString().match(/[א-ת]\d+/g) || [];
  return inline.map(normalizeClassToken).filter((token) => /^[א-ת]\d+$/.test(token));
};

const splitTeacherNames = (value) =>
  splitCsvValues(value)
    .map((name) => name.replace(/[,\s]+$/g, '').trim())
    .filter(Boolean);

const isGroupEligibleSubject = (subject) =>
  /חשבון|אנגלית/.test((subject || '').toString());

const isLikelySubjectLine = (line) => {
  const text = (line || '').toString().trim();
  if (!text) return false;
  if (isHourLine(text) || isWeekdayLine(text) || isLikelyClassHeaderLine(text)) return false;
  return SUBJECT_KEYWORDS.some((keyword) => text.includes(keyword));
};

const sanitizeTeacherNames = (teacherValue) =>
  splitTeacherNames(teacherValue).filter((teacher) => {
    if (!teacher) return false;
    if (splitClassNames(teacher).length > 0) return false;
    if (/^\d+$/.test(teacher)) return false;
    if (isLikelySubjectLine(teacher)) return false;
    return teacher.length >= 2;
  });

const normalizePdfLines = (text) =>
  (text || '')
    .split(/\r?\n/)
    .map((line) => line.trim().replace(/\s+/g, ' '))
    .filter((line) => line && !isPageMarker(line));

const extractClassesFromLine = (line) => {
  if (!line) return [];
  const spacedTokens = line.split(/[\t ]+/).map((token) => token.trim()).filter(Boolean);
  const inlineTokens = line.match(/[א-ת]\d+/g) || [];
  return Array.from(new Set([...spacedTokens, ...inlineTokens])).filter((token) => isClassToken(token));
};

const isLikelyClassHeaderLine = (line) => extractClassesFromLine(line).length >= 4;

const shouldSkipLessonLine = (line) =>
  !line ||
  isWeekdayLine(line) ||
  isHourLine(line) ||
  isLikelyClassHeaderLine(line) ||
  /^לוח/.test(line) ||
  /^כיתה/.test(line);

const parseLessonsFromPdfLines = (lines) => {
  const lessons = [];
  let index = 0;

  while (index < lines.length) {
    let subject = lines[index];
    if (shouldSkipLessonLine(subject)) {
      index += 1;
      continue;
    }

    if (
      index + 1 < lines.length &&
      SUBJECT_CONTINUATION_WORDS.has(lines[index + 1])
    ) {
      subject = `${subject} ${lines[index + 1]}`.trim();
      index += 1;
    }

    let teacher = '';
    let group = '';

    if (index + 1 < lines.length && !shouldSkipLessonLine(lines[index + 1])) {
      const teacherCandidate = lines[index + 1];
      if (!isLikelySubjectLine(teacherCandidate) && !isGroupToken(teacherCandidate)) {
        teacher = teacherCandidate;
        index += 1;
      }
    }

    if (teacher && isGroupToken(teacher)) {
      group = teacher;
      teacher = '';
    } else if (index + 1 < lines.length && isGroupToken(lines[index + 1])) {
      group = lines[index + 1];
      index += 1;
    }

    lessons.push({ subject, teacher, group });
    index += 1;
  }

  return lessons;
};

const parsePdfToRows = (pdfText) => {
  const lines = normalizePdfLines(pdfText);
  const sections = [];

  for (let i = 0; i < lines.length; i += 1) {
    if (!isWeekdayLine(lines[i])) continue;

    const days = [];
    let cursor = i;
    while (cursor < lines.length && days.length < 3) {
      if (isWeekdayLine(lines[cursor])) days.push(lines[cursor]);
      cursor += 1;
    }
    if (!days.length) continue;

    let classHeaderIndex = -1;
    for (let j = cursor; j < Math.min(lines.length, cursor + 60); j += 1) {
      if (isLikelyClassHeaderLine(lines[j])) {
        classHeaderIndex = j;
        break;
      }
    }
    if (classHeaderIndex === -1) continue;

    const classes = extractClassesFromLine(lines[classHeaderIndex]);
    if (!classes.length) continue;

    let endIndex = lines.length;
    for (let j = classHeaderIndex + 1; j < lines.length; j += 1) {
      if (isWeekdayLine(lines[j])) {
        endIndex = j;
        break;
      }
    }

    sections.push({
      days,
      classes,
      contentLines: lines.slice(classHeaderIndex + 1, endIndex),
    });
    i = endIndex - 1;
  }

  const rows = [];
  sections.forEach((section) => {
    const lessons = parseLessonsFromPdfLines(section.contentLines);
    let lessonIndex = 0;

    section.days.forEach((day) => {
      for (let hour = 1; hour <= 8; hour += 1) {
        let classIndex = 0;
        while (classIndex < section.classes.length && lessonIndex < lessons.length) {
          const lesson = lessons[lessonIndex];
          lessonIndex += 1;

          if (!lesson?.subject) {
            classIndex += 1;
            continue;
          }

          const explicitClasses = splitClassNames(lesson.group)
            .filter((className) => section.classes.includes(className));

          if (explicitClasses.length >= 2) {
            explicitClasses.forEach((className) => {
              rows.push({
                className,
                day,
                time: `${hour}`,
                subject: lesson.subject,
                teacher: lesson.teacher,
                group: lesson.group,
              });
            });

            const targetIndexes = explicitClasses
              .map((className) => section.classes.indexOf(className))
              .filter((idx) => idx >= 0)
              .sort((a, b) => a - b);
            const maxTarget = targetIndexes[targetIndexes.length - 1];
            classIndex = Math.max(classIndex + 1, maxTarget + 1);
            continue;
          }

          const className = section.classes[classIndex];
          rows.push({
            className,
            day,
            time: `${hour}`,
            subject: lesson.subject,
            teacher: lesson.teacher,
            group: lesson.group,
          });
          classIndex += 1;
        }
      }
    });
  });

  return rows;
};

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Upload Excel file
app.post('/api/schedule/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const extension = path.extname(req.file.originalname || '').toLowerCase();
    const isPdf = req.file.mimetype === 'application/pdf' || extension === '.pdf';

    const normalizeKey = (key) => key?.toString().trim().toLowerCase();
    const mapKey = (key) => {
      switch (normalizeKey(key)) {
        case 'class':
        case 'class name':
        case 'classname':
        case 'כיתה':
        case 'כיתת':
          return 'className';
        case 'day':
        case 'יום':
          return 'day';
        case 'time':
        case 'שעה':
        case 'זמן':
          return 'time';
        case 'subject':
        case 'מקצוע':
        case 'נושא':
          return 'subject';
        case 'teacher':
        case 'מורה':
          return 'teacher';
        case 'group':
        case 'הקבצה':
        case 'קבוצה':
          return 'group';
        default:
          return normalizeKey(key);
      }
    };

    const parseCellValue = (rawValue) => {
      const rawText = rawValue?.toString().trim();
      if (!rawText) return null;

      const lines = rawText.split(/\r?\n/).map((part) => part.trim()).filter(Boolean);
      if (lines.length >= 2) {
        return {
          subject: lines[0],
          teacher: lines[1],
          group: lines[2] || '',
        };
      }

      const slashParts = rawText.split('/').map((part) => part.trim()).filter(Boolean);
      if (slashParts.length === 2) {
        return {
          subject: slashParts[0],
          teacher: slashParts[1],
          group: '',
        };
      }
      if (slashParts.length >= 3) {
        return {
          subject: slashParts[0],
          teacher: slashParts[1],
          group: slashParts[2],
        };
      }

      return {
        subject: rawText,
        teacher: '',
        group: '',
      };
    };

    const parseMatrixSheet = (worksheet, sheetName) => {
      const rows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
      if (!rows || rows.length < 2) return [];

      const headerRow = rows[0].map((cell) => cell.toString().trim());
      const hasClassHeaders = headerRow.slice(1).some((cell) => cell.toString().trim());
      if (!hasClassHeaders) return [];

      const rawCells = rows.slice(1).flatMap((row) =>
        row.slice(1).map((cell) => cell?.toString().trim()).filter(Boolean)
      );
      const hasStructuredContent = rawCells.some((text) => /\r?\n|\//.test(text));
      const maybeTeacherOnly = !hasStructuredContent;

      const entries = [];
      for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
        const row = rows[rowIndex] || [];
        const time = (row[0] ?? '').toString().trim();
        if (!time) continue;

        for (let colIndex = 1; colIndex < headerRow.length; colIndex += 1) {
          const className = headerRow[colIndex]?.toString().trim();
          const cellValue = row[colIndex] ?? '';
          const parsed = parseCellValue(cellValue);
          if (!className || !parsed) continue;

          let { subject, teacher, group } = parsed;
          if (!teacher && maybeTeacherOnly && subject) {
            teacher = subject;
            subject = '';
          }

          if (!subject && !teacher) continue;

          entries.push({
            className,
            day: sheetName,
            time,
            subject,
            teacher,
            group: group || className,
          });
        }
      }
      return entries;
    };

    const parseFlatSheet = (worksheet) => {
      const jsonData = xlsx.utils.sheet_to_json(worksheet, { defval: '' });
      return jsonData.map((rawRow) => {
        const row = {};
        Object.entries(rawRow).forEach(([rawKey, value]) => {
          const normalized = mapKey(rawKey);
          if (normalized) row[normalized] = value;
        });
        return row;
      }).filter((row) => row.className || row.class || row.teacher || row.group);
    };

    let parsedRows = [];
    if (isPdf) {
      const pdfBuffer = fs.readFileSync(req.file.path);
      const parsedPdf = await pdfParse(pdfBuffer);
      parsedRows = parsePdfToRows(parsedPdf.text || '');
    } else {
      const workbook = xlsx.readFile(req.file.path);
      workbook.SheetNames.forEach((sheetName) => {
        const worksheet = workbook.Sheets[sheetName];
        let sheetRows = parseMatrixSheet(worksheet, sheetName);
        if (!sheetRows.length) {
          const dataRows = parseFlatSheet(worksheet);
          sheetRows = dataRows.map((row) => {
            const className = row.className || row.class || '';
            const day = row.day || '';
            const time = row.time || row.hour || '';
            const subject = row.subject || '';
            const teacher = row.teacher || '';
            const group = row.group || '';
            return { className, day, time, subject, teacher, group };
          });
        }
        parsedRows.push(...sheetRows);
      });
    }

    scheduleData = rebuildScheduleData(parsedRows);

    // Save data
    saveScheduleData(scheduleData);

    res.json({
      message: 'File uploaded and processed successfully',
      filename: req.file.filename,
      data: {
        classesCount: scheduleData.classes.length,
        teachersCount: scheduleData.teachers.length,
        groupsCount: scheduleData.groups.length,
        daysCount: scheduleData.days.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing file', error: error.message });
  }
});

// Get all classes
app.get('/api/schedule/classes', (req, res) => {
  try {
    res.json(scheduleData.classes);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching classes', error: error.message });
  }
});

// Get schedule for a specific class
app.get('/api/schedule/classes/:className', (req, res) => {
  try {
    const { className } = req.params;
    const decodedName = decodeURIComponent(className);

    if (scheduleData.scheduleByClass[decodedName]) {
      res.json(scheduleData.scheduleByClass[decodedName]);
    } else {
      res.status(404).json({ message: 'Class not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching class schedule', error: error.message });
  }
});

// Get all teachers
app.get('/api/schedule/teachers', (req, res) => {
  try {
    res.json(scheduleData.teachers);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teachers', error: error.message });
  }
});

// Get schedule for a specific teacher
app.get('/api/schedule/teachers/:teacherName', (req, res) => {
  try {
    const { teacherName } = req.params;
    const decodedName = decodeURIComponent(teacherName);

    if (scheduleData.scheduleByTeacher[decodedName]) {
      res.json(scheduleData.scheduleByTeacher[decodedName]);
    } else {
      res.status(404).json({ message: 'Teacher not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching teacher schedule', error: error.message });
  }
});

// Get all groups
app.get('/api/schedule/groups', (req, res) => {
  try {
    res.json(scheduleData.groups);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching groups', error: error.message });
  }
});

// Get all days
app.get('/api/schedule/days', (req, res) => {
  try {
    res.json(scheduleData.days || []);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching days', error: error.message });
  }
});

// Get schedule for a specific group
app.get('/api/schedule/groups/:groupName', (req, res) => {
  try {
    const { groupName } = req.params;
    const decodedName = decodeURIComponent(groupName);

    if (scheduleData.scheduleByGroup[decodedName]) {
      res.json(scheduleData.scheduleByGroup[decodedName]);
    } else {
      res.status(404).json({ message: 'Group not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching group schedule', error: error.message });
  }
});

// Get schedule for a specific day
app.get('/api/schedule/days/:dayName', (req, res) => {
  try {
    const { dayName } = req.params;
    const decodedName = decodeURIComponent(dayName);

    if (scheduleData.scheduleByDay?.[decodedName]) {
      res.json(scheduleData.scheduleByDay[decodedName]);
    } else {
      res.status(404).json({ message: 'Day not found' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Error fetching day schedule', error: error.message });
  }
});

// Edit single lesson
app.put('/api/schedule/lesson', (req, res) => {
  try {
    const {
      className,
      day,
      time,
      subject,
      teacher = '',
      group = '',
    } = req.body || {};

    if (!className || !day || !time || !subject) {
      return res.status(400).json({ message: 'className, day, time, subject are required' });
    }

    const allEntries = toFlatEntries(scheduleData);
    const targetIndex = allEntries.findIndex(
      (item) =>
        item.className === className &&
        item.day === day &&
        item.time === time
    );

    if (targetIndex === -1) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    allEntries[targetIndex] = {
      ...allEntries[targetIndex],
      subject: subject.toString().trim(),
      teacher: teacher.toString().trim(),
      group: group.toString().trim(),
    };

    scheduleData = rebuildScheduleData(allEntries);
    saveScheduleData(scheduleData);

    return res.json({ message: 'Lesson updated successfully' });
  } catch (error) {
    return res.status(500).json({ message: 'Error updating lesson', error: error.message });
  }
});

// Get full schedule
app.get('/api/schedule/full', (req, res) => {
  try {
    res.json(scheduleData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching full schedule', error: error.message });
  }
});

// Status: is a schedule loaded?
app.get('/api/schedule/status', (req, res) => {
  try {
    const isLoaded = Array.isArray(scheduleData?.classes) && scheduleData.classes.length > 0;
    res.json({ isLoaded });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching status', error: error.message });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Server error', error: err.message });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📝 API available at http://localhost:${PORT}/api`);
});