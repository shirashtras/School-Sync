import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { parseExcelWorkbook } from './parsers/excelParser.js';
import { parsePdfFile } from './parsers/pdfGridParser.js';
import {
  buildScheduleIndexes,
  loadScheduleData,
  saveScheduleData,
  normalizeLesson,
} from './scheduleStore.js';
import { splitTeacherNames } from './parsers/cellParser.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/pdf',
    ];
    cb(null, allowed.includes(file.mimetype));
  },
});

let scheduleData = loadScheduleData();

const decode = (value) => decodeURIComponent(value);

const respondGrouped = (res, grouped) => {
  if (grouped) return res.json(grouped);
  return res.status(404).json({ message: 'Not found' });
};

// ── Spec API ──────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'Server is running' });
});

app.get('/api/schedule/status', (_req, res) => {
  res.json({ isLoaded: scheduleData.lessons.length > 0 });
});

app.post('/api/schedule/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const extension = path.extname(req.file.originalname || '').toLowerCase();
    const isPdf = req.file.mimetype === 'application/pdf' || extension === '.pdf';

    let lessons = [];
    if (isPdf) {
      lessons = await parsePdfFile(req.file.path);
    } else {
      lessons = parseExcelWorkbook(req.file.path);
    }

    scheduleData = buildScheduleIndexes(lessons.map(normalizeLesson));
    saveScheduleData(scheduleData);

    res.json({
      message: 'File uploaded and processed successfully',
      filename: req.file.filename,
      data: {
        lessonsCount: scheduleData.lessons.length,
        classesCount: scheduleData.classes.length,
        teachersCount: scheduleData.teachers.length,
        daysCount: scheduleData.days.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: 'Error processing file', error: error.message });
  }
});

app.get('/api/schedule/classes', (_req, res) => {
  res.json(scheduleData.classes);
});

app.get('/api/schedule/teachers', (_req, res) => {
  res.json(scheduleData.teachers);
});

app.get('/api/schedule/days', (_req, res) => {
  res.json(scheduleData.days);
});

app.get('/api/schedule/lessons', (_req, res) => {
  res.json(scheduleData.lessons);
});

app.get('/api/schedule/class/:className', (req, res) => {
  respondGrouped(res, scheduleData.scheduleByClass[decode(req.params.className)]);
});

app.get('/api/schedule/teacher/:teacherName', (req, res) => {
  respondGrouped(res, scheduleData.scheduleByTeacher[decode(req.params.teacherName)]);
});

app.get('/api/schedule/day/:dayName', (req, res) => {
  respondGrouped(res, scheduleData.scheduleByDay[decode(req.params.dayName)]);
});

app.put('/api/schedule/update', (req, res) => {
  try {
    const {
      className,
      day,
      hour,
      subject,
      teacher = null,
      originalTeacher = null,
      group = null,
    } = req.body || {};

    const targetHour = Number(hour);
    if (!className || !day || !Number.isFinite(targetHour) || !subject) {
      return res.status(400).json({ message: 'className, day, hour, subject are required' });
    }

    const matchAtSlot = (lesson) =>
      lesson.className === className &&
      lesson.day === day &&
      lesson.hour === targetHour &&
      (group ? lesson.group === group : true);

    const indices = scheduleData.lessons
      .map((lesson, index) => ({ lesson, index }))
      .filter(({ lesson }) => {
        if (!matchAtSlot(lesson)) return false;
        if (!originalTeacher) return true;
        return lesson.teacher === originalTeacher;
      })
      .map(({ index }) => index);

    if (indices.length === 0) {
      return res.status(404).json({ message: 'Lesson not found' });
    }

    const teacherNames = teacher ? splitTeacherNames(teacher) : [null];
    const updated = [...scheduleData.lessons];
    indices.forEach((index, position) => {
      const nextTeacher = teacherNames.length === 1
        ? teacherNames[0]
        : (teacherNames[position] ?? teacherNames[teacherNames.length - 1] ?? teacher);
      updated[index] = normalizeLesson({
        ...updated[index],
        subject,
        teacher: nextTeacher,
        group,
      });
    });

    scheduleData = buildScheduleIndexes(updated);
    saveScheduleData(scheduleData);
    res.json({ message: 'Lesson updated successfully', lesson: updated[indices[0]] });
  } catch (error) {
    res.status(500).json({ message: 'Error updating lesson', error: error.message });
  }
});

// ── Backward-compatible routes ────────────────────────────

app.get('/api/schedule/full', (_req, res) => {
  res.json(scheduleData);
});

app.get('/api/schedule/classes/:className', (req, res) => {
  respondGrouped(res, scheduleData.scheduleByClass[decode(req.params.className)]);
});

app.get('/api/schedule/teachers/:teacherName', (req, res) => {
  respondGrouped(res, scheduleData.scheduleByTeacher[decode(req.params.teacherName)]);
});

app.get('/api/schedule/days/:dayName', (req, res) => {
  respondGrouped(res, scheduleData.scheduleByDay[decode(req.params.dayName)]);
});

app.put('/api/schedule/lesson', (req, res) => {
  const hour = req.body.hour ?? req.body.time;
  req.body = { ...req.body, hour };
  const {
    className, day, subject, teacher = null, group = null,
  } = req.body;

  if (!className || !day || !hour || !subject) {
    return res.status(400).json({ message: 'className, day, hour, subject are required' });
  }

  const targetHour = Number(hour);
  const index = scheduleData.lessons.findIndex(
    (l) => l.className === className && l.day === day && l.hour === targetHour
  );
  if (index === -1) return res.status(404).json({ message: 'Lesson not found' });

  const updated = [...scheduleData.lessons];
  updated[index] = normalizeLesson({ ...updated[index], subject, teacher, group });
  scheduleData = buildScheduleIndexes(updated);
  saveScheduleData(scheduleData);
  return res.json({ message: 'Lesson updated successfully' });
});

app.use((_req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, _req, res, _next) => {
  console.error('Error:', err);
  res.status(500).json({ message: 'Server error', error: err.message });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
  console.log(`📝 API available at http://localhost:${PORT}/api`);
});
