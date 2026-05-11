import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';
import fs from 'fs';

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
    // Only allow Excel files
    if (
      file.mimetype ===
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'));
    }
  },
});

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir);
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
    scheduleByClass: {},
    scheduleByTeacher: {},
    scheduleByGroup: {},
  };
};

// Replace the global variable
let scheduleData = loadScheduleData();

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Server is running' });
});

// Upload Excel file
app.post('/api/schedule/upload', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Parse Excel file
    const workbook = xlsx.readFile(req.file.path);

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

    const classes = new Set();
    const teachers = new Set();
    const groups = new Set();
    const scheduleByClass = {};
    const scheduleByTeacher = {};
    const scheduleByGroup = {};

    workbook.SheetNames.forEach((sheetName) => {
      const worksheet = workbook.Sheets[sheetName];
      let parsedRows = parseMatrixSheet(worksheet, sheetName);
      if (!parsedRows.length) {
        const dataRows = parseFlatSheet(worksheet);
        parsedRows = dataRows.map((row) => {
          const className = row.className || row.class || '';
          const day = row.day || '';
          const time = row.time || '';
          const subject = row.subject || '';
          const teacher = row.teacher || '';
          const group = row.group || '';
          return { className, day, time, subject, teacher, group };
        });
      }

      parsedRows.forEach((row) => {
        const { className, day, time, subject, teacher, group } = row;
        if (!className || !time || !subject) return;

        classes.add(className);
        if (teacher) teachers.add(teacher);
        if (group) groups.add(group);

        const entry = { time, subject, teacher, group };

        if (!scheduleByClass[className]) scheduleByClass[className] = [];
        let classDay = scheduleByClass[className].find((d) => d.day === day);
        if (!classDay) {
          classDay = { day, entries: [] };
          scheduleByClass[className].push(classDay);
        }
        classDay.entries.push(entry);

        if (teacher) {
          if (!scheduleByTeacher[teacher]) scheduleByTeacher[teacher] = [];
          let teacherDay = scheduleByTeacher[teacher].find((d) => d.day === day);
          if (!teacherDay) {
            teacherDay = { day, entries: [] };
            scheduleByTeacher[teacher].push(teacherDay);
          }
          teacherDay.entries.push({ ...entry, className });
        }

        if (group) {
          if (!scheduleByGroup[group]) scheduleByGroup[group] = [];
          let groupDay = scheduleByGroup[group].find((d) => d.day === day);
          if (!groupDay) {
            groupDay = { day, entries: [] };
            scheduleByGroup[group].push(groupDay);
          }
          groupDay.entries.push({ ...entry, className });
        }
      });
    });

    // Update scheduleData
    scheduleData = {
      classes: Array.from(classes),
      teachers: Array.from(teachers),
      groups: Array.from(groups),
      scheduleByClass,
      scheduleByTeacher,
      scheduleByGroup,
    };

    // Save data
    saveScheduleData(scheduleData);

    res.json({
      message: 'File uploaded and processed successfully',
      filename: req.file.filename,
      data: {
        classesCount: classes.size,
        teachersCount: teachers.size,
        groupsCount: groups.size,
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

// Get full schedule
app.get('/api/schedule/full', (req, res) => {
  try {
    res.json(scheduleData);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching full schedule', error: error.message });
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