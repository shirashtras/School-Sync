import { useEffect, useState } from 'react';
import { useSchedule } from '../hooks/useSchedule';
import ScheduleCell from '../components/ScheduleCell';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

const ClassSchedulePage = () => {
  const DAY_ORDER = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי'];
  const {
    selectedClass,
    selectedTeacher,
    selectedGroup,
    selectedDay,
    fetchClassSchedule,
    fetchTeacherSchedule,
    fetchGroupSchedule,
    fetchDaySchedule,
    updateLesson,
    loading,
    error,
  } = useSchedule();
  const [schedule, setSchedule] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState(null);
  const [formState, setFormState] = useState({ subject: '', teacher: '', group: '' });

  useEffect(() => {
    let fetchFunc;
    let name;
    if (selectedClass) {
      fetchFunc = fetchClassSchedule;
      name = selectedClass;
    } else if (selectedTeacher) {
      fetchFunc = fetchTeacherSchedule;
      name = selectedTeacher;
    } else if (selectedGroup) {
      fetchFunc = fetchGroupSchedule;
      name = selectedGroup;
    } else if (selectedDay) {
      fetchFunc = fetchDaySchedule;
      name = selectedDay;
    }
    if (fetchFunc && name) {
      fetchFunc(name).then(setSchedule).catch(console.error);
    }
  }, [selectedClass, selectedTeacher, selectedGroup, selectedDay, fetchClassSchedule, fetchTeacherSchedule, fetchGroupSchedule, fetchDaySchedule]);

  if (loading) return <Box sx={{ p: 3 }}><Alert severity="info">טוען...</Alert></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;
  if (!selectedClass && !selectedTeacher && !selectedGroup && !selectedDay) {
    return <Box sx={{ p: 3 }}><Alert severity="warning">בחר כיתה, מורה, הקבצה או יום תחילה.</Alert></Box>;
  }
  if (!schedule || schedule.length === 0) return <Box sx={{ p: 3 }}><Alert severity="info">אין נתוני מערכת להצגה.</Alert></Box>;

  const selectedName = selectedClass || selectedTeacher || selectedGroup || selectedDay;
  const selectedType = selectedClass
    ? 'כיתה'
    : selectedTeacher
      ? 'מורה'
      : selectedGroup
        ? 'הקבצה'
        : 'יום';

  const days = [...new Set(schedule.map((daySchedule) => daySchedule.day || 'Schedule'))]
    .sort((a, b) => {
      const ai = DAY_ORDER.indexOf(a);
      const bi = DAY_ORDER.indexOf(b);
      if (ai === -1 && bi === -1) return a.localeCompare(b, 'he');
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  const timeSlots = Array.from(
    new Set(
      schedule.flatMap((daySchedule) => daySchedule.entries.map((entry) => entry.time))
    )
  ).sort((a, b) => Number(a) - Number(b));

  const getEntriesForDayAndTime = (day, time) => {
    const daySchedule = schedule.find((d) => d.day === day);
    if (!daySchedule) return [];
    return daySchedule.entries.filter((entry) => entry.time === time);
  };

  const openEditDialog = (day, time, entry) => {
    const sourceClass = selectedClass || entry.className;
    if (!sourceClass) return;
    setEditingLesson({ className: sourceClass, day, time, ...entry });
    setFormState({
      subject: entry.subject || '',
      teacher: entry.teacher || '',
      group: entry.group || '',
    });
    setEditDialogOpen(true);
  };

  const handleSaveLesson = async () => {
    if (!editingLesson) return;
    await updateLesson({
      className: editingLesson.className,
      day: editingLesson.day,
      time: editingLesson.time,
      subject: formState.subject,
      teacher: formState.teacher,
      group: formState.group,
    });
    const refresh = selectedClass
      ? fetchClassSchedule(selectedClass)
      : selectedTeacher
        ? fetchTeacherSchedule(selectedTeacher)
        : selectedGroup
          ? fetchGroupSchedule(selectedGroup)
          : fetchDaySchedule(selectedDay);
    const refreshedSchedule = await refresh;
    setSchedule(refreshedSchedule);
    setEditDialogOpen(false);
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#f5f7ff' }}>
      <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, boxShadow: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          מערכת {selectedType}: {selectedName}
        </Typography>
        <Button variant="outlined" onClick={() => window.print()}>
          הדפס מערכת
        </Button>

        <TableContainer component={Paper} sx={{ mt: 2, boxShadow: 'none' }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#f2f2f2', fontWeight: 700 }}>שעה</TableCell>
                {days.map((day) => (
                  <TableCell
                    key={day}
                    sx={{ backgroundColor: '#f2f2f2', fontWeight: 700 }}
                    align="center"
                  >
                    {day}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {timeSlots.map((time) => (
                <TableRow key={time}>
                  <TableCell sx={{ fontWeight: 700 }}>{time}</TableCell>
                  {days.map((day) => {
                    const entries = getEntriesForDayAndTime(day, time);
                    return (
                      <TableCell key={day} align="center" sx={{ verticalAlign: 'top' }}>
                        <ScheduleCell
                          entries={entries}
                          selectedType={selectedType}
                          onEdit={(entry) => openEditDialog(day, time, entry)}
                        />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>עריכת שיעור</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            label="מקצוע"
            value={formState.subject}
            onChange={(event) => setFormState((prev) => ({ ...prev, subject: event.target.value }))}
            required
          />
          <TextField
            label="מורה"
            value={formState.teacher}
            onChange={(event) => setFormState((prev) => ({ ...prev, teacher: event.target.value }))}
          />
          <TextField
            label="קבוצה / הקבצה"
            value={formState.group}
            onChange={(event) => setFormState((prev) => ({ ...prev, group: event.target.value }))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>ביטול</Button>
          <Button variant="contained" onClick={handleSaveLesson} disabled={!formState.subject.trim()}>
            שמור
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ClassSchedulePage;