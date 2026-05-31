import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchedule } from '../hooks/useSchedule';
import ScheduleTable from '../components/ScheduleTable';
import EditableLessonForm from '../components/EditableLessonForm';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';

export default function ClassSchedulePage() {
  const navigate = useNavigate();
  const {
    selectedClass,
    fetchClassSchedule,
    fetchTeachers,
    updateLesson,
    loading,
    error,
  } = useSchedule();
  const [schedule, setSchedule] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!selectedClass) return;
    fetchClassSchedule(selectedClass).then(setSchedule).catch(console.error);
    fetchTeachers().then(setTeachers).catch(console.error);
  }, [selectedClass, fetchClassSchedule, fetchTeachers]);

  if (!selectedClass) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">בחר כיתה תחילה.</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/select')}>חזרה לבחירה</Button>
      </Box>
    );
  }

  if (loading) return <Box sx={{ p: 3 }}><Alert severity="info">טוען...</Alert></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;

  const openEdit = (day, hour, entry) => {
    const teachers = (entry.teacher || '')
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
    setEditing({
      className: selectedClass,
      day,
      hour: Number(hour),
      subject: entry.subject || '',
      teacher: entry.teacher || '',
      originalSubject: entry.subject || '',
      originalTeacher: teachers.length === 1 ? teachers[0] : null,
    });
  };

  const handleSave = async (lesson) => {
    await updateLesson({
      className: lesson.className,
      day: lesson.day,
      hour: Number(lesson.hour),
      subject: lesson.subject,
      teacher: lesson.teacher,
      originalSubject: lesson.originalSubject,
      originalTeacher: lesson.originalTeacher,
    });
    const refreshed = await fetchClassSchedule(selectedClass);
    setSchedule(refreshed);
    setEditing(null);
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#f5f7ff', direction: 'rtl' }}>
      <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, boxShadow: 6, direction: 'rtl' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" component="h1">
            מערכת כיתה: {selectedClass}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={() => navigate('/select')}>חזרה</Button>
            <Button variant="outlined" onClick={() => navigate('/print')}>הדפסה</Button>
          </Box>
        </Box>

        <ScheduleTable
          schedule={schedule}
          viewMode="class"
          onEdit={openEdit}
        />
      </Paper>

      <EditableLessonForm
        open={Boolean(editing)}
        lesson={editing}
        teachers={teachers}
        onClose={() => setEditing(null)}
        onSave={handleSave}
      />
    </Box>
  );
}
