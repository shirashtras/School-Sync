import {
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Button,
  MenuItem,
} from '@mui/material';
import { useEffect, useState } from 'react';

export default function EditableLessonForm({
  open,
  lesson,
  teachers = [],
  onClose,
  onSave,
}) {
  const [form, setForm] = useState({
    subject: '',
    teacher: '',
  });

  useEffect(() => {
    if (lesson) {
      setForm({
        subject: lesson.subject || '',
        teacher: lesson.teacher || '',
      });
    }
  }, [lesson]);

  const handleSave = () => {
    if (!form.subject.trim() || !lesson) return;
    onSave({
      className: lesson.className,
      day: lesson.day,
      hour: Number(lesson.hour),
      subject: form.subject.trim(),
      teacher: form.teacher.trim() || null,
      originalTeacher: lesson.originalTeacher ?? lesson.teacher,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>עריכת שיעור</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1, direction: 'rtl' }}>
        <TextField
          label="מקצוע"
          value={form.subject}
          onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
          required
          fullWidth
        />
        <TextField
          label="מורה"
          value={form.teacher}
          onChange={(e) => setForm((p) => ({ ...p, teacher: e.target.value }))}
          fullWidth
          select={teachers.length > 0}
        >
          {teachers.map((t) => (
            <MenuItem key={t} value={t}>{t}</MenuItem>
          ))}
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>ביטול</Button>
        <Button variant="contained" onClick={handleSave} disabled={!form.subject.trim()}>
          שמור
        </Button>
      </DialogActions>
    </Dialog>
  );
}
