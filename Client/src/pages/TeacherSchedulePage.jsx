import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchedule } from '../hooks/useSchedule';
import ScheduleTable from '../components/ScheduleTable';
import EditableLessonForm from '../components/EditableLessonForm';
import { Alert, Box, Button, Paper, Typography } from '@mui/material';

export default function TeacherSchedulePage() {
  const navigate = useNavigate();
  const {
    selectedTeacher,
    fetchTeacherSchedule,
    fetchTeachers,
    updateLesson,
    loading,
    error,
  } = useSchedule();
  const [schedule, setSchedule] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (!selectedTeacher) return;
    fetchTeacherSchedule(selectedTeacher).then(setSchedule).catch(console.error);
    fetchTeachers().then(setTeachers).catch(console.error);
  }, [selectedTeacher, fetchTeacherSchedule, fetchTeachers]);

  if (!selectedTeacher) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">בחר מורה תחילה.</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/select')}>חזרה לבחירה</Button>
      </Box>
    );
  }

  if (loading) return <Box sx={{ p: 3 }}><Alert severity="info">טוען...</Alert></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;

  const openEdit = (day, hour, entry) => {
    setEditing({
      className: entry.className,
      day,
      hour: Number(hour),
      subject: entry.subject || '',
      teacher: entry.teacher || '',
      originalTeacher: selectedTeacher,
      originalSubject: entry.subject || '',
    });
  };

  const handleSave = async (lesson) => {
    await updateLesson({
      className: lesson.className,
      day: lesson.day,
      hour: Number(lesson.hour),
      subject: lesson.subject,
      teacher: lesson.teacher,
      originalTeacher: lesson.originalTeacher,
      originalSubject: lesson.originalSubject,
      duration: lesson.duration,
    });
    const refreshed = await fetchTeacherSchedule(selectedTeacher);
    setSchedule(refreshed);
    setEditing(null);
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#f5f7ff', direction: 'rtl' }}>
      <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, boxShadow: 6, direction: 'rtl' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" component="h1">
            מערכת מורה: {selectedTeacher}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={() => navigate('/select')}>חזרה</Button>
            <Button variant="outlined" onClick={() => navigate('/print')}>הדפסה</Button>
          </Box>
        </Box>

        <ScheduleTable
          schedule={schedule}
          viewMode="teacher"
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
