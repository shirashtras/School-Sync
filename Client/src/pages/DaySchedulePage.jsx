import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSchedule } from '../hooks/useSchedule';
import { sortDayLessons } from '../utils/filterByDay';
import {
  Alert,
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';

export default function DaySchedulePage() {
  const navigate = useNavigate();
  const { selectedDay, fetchDaySchedule, loading, error } = useSchedule();
  const [schedule, setSchedule] = useState([]);

  useEffect(() => {
    if (!selectedDay) return;
    fetchDaySchedule(selectedDay).then(setSchedule).catch(console.error);
  }, [selectedDay, fetchDaySchedule]);

  if (!selectedDay) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">בחר יום תחילה.</Alert>
        <Button sx={{ mt: 2 }} onClick={() => navigate('/select')}>חזרה לבחירה</Button>
      </Box>
    );
  }

  if (loading) return <Box sx={{ p: 3 }}><Alert severity="info">טוען...</Alert></Box>;
  if (error) return <Box sx={{ p: 3 }}><Alert severity="error">{error}</Alert></Box>;

  const rows = sortDayLessons(
    schedule.flatMap((classBlock) =>
      (classBlock.entries || []).map((entry) => ({
        className: classBlock.className,
        hour: Number(entry.hour ?? entry.time),
        subject: entry.subject,
        teacher: entry.teacher,
        group: entry.group,
      }))
    )
  );

  return (
    <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#f5f7ff', direction: 'rtl' }}>
      <Paper sx={{ p: { xs: 2, md: 4 }, borderRadius: 4, boxShadow: 6 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
          <Typography variant="h4" component="h1">
            מערכת יום: {selectedDay}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" onClick={() => navigate('/select')}>חזרה</Button>
            <Button variant="outlined" onClick={() => navigate('/print')}>הדפסה</Button>
          </Box>
        </Box>

        <TableContainer component={Paper} sx={{ mt: 2 }}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700 }}>שעה</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>כיתה</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>מקצוע</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>מורה</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>קבוצה</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row, idx) => (
                <TableRow key={`${row.className}-${row.hour}-${idx}`}>
                  <TableCell>{row.hour}</TableCell>
                  <TableCell>{row.className}</TableCell>
                  <TableCell>{row.subject}</TableCell>
                  <TableCell>{row.teacher || '-'}</TableCell>
                  <TableCell>{row.group || '-'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
