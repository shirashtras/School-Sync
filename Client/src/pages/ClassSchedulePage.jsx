import { useEffect, useState } from 'react';
import { useSchedule } from '../hooks/useSchedule';
import ScheduleCell from '../components/ScheduleCell';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';

const ClassSchedulePage = () => {
  const { selectedClass, selectedTeacher, selectedGroup, fetchClassSchedule, fetchTeacherSchedule, fetchGroupSchedule, loading, error } = useSchedule();
  const [schedule, setSchedule] = useState([]);

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
    }
    if (fetchFunc && name) {
      fetchFunc(name).then(setSchedule).catch(console.error);
    }
  }, [selectedClass, selectedTeacher, selectedGroup, fetchClassSchedule, fetchTeacherSchedule, fetchGroupSchedule]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;
  if (!selectedClass && !selectedTeacher && !selectedGroup) return <div>Please select a class, teacher, or group first.</div>;
  if (!schedule || schedule.length === 0) return <div>No schedule data available.</div>;

  const selectedName = selectedClass || selectedTeacher || selectedGroup;
  const selectedType = selectedClass ? 'Class' : selectedTeacher ? 'Teacher' : 'Group';

  const days = schedule.map((daySchedule) => daySchedule.day || 'Schedule');
  const timeSlots = Array.from(
    new Set(
      schedule.flatMap((daySchedule) => daySchedule.entries.map((entry) => entry.time))
    )
  );

  const getEntriesForDayAndTime = (day, time) => {
    const daySchedule = schedule.find((d) => d.day === day);
    if (!daySchedule) return [];
    return daySchedule.entries.filter((entry) => entry.time === time);
  };

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#f5f7ff' }}>
      <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, boxShadow: 6 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {selectedType} Schedule for {selectedName}
        </Typography>

        <TableContainer component={Paper} sx={{ mt: 2, boxShadow: 'none' }}>
          <Table sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ backgroundColor: '#f2f2f2', fontWeight: 700 }}>Time</TableCell>
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
                        <ScheduleCell entries={entries} />
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
};

export default ClassSchedulePage;