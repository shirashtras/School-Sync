import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { groupLessonsToGrid } from '../utils/groupLessons';
import LessonCell from './LessonCell';

export default function ScheduleTable({
  schedule,
  viewMode = 'class',
  onEdit,
  title,
}) {
  const { days, hours, grid } = groupLessonsToGrid(schedule, viewMode);

  if (!days.length) {
    return null;
  }

  return (
    <TableContainer
      component={Paper}
      sx={{ mt: 2, boxShadow: 'none', direction: 'rtl' }}
    >
      {title && (
        <div
          style={{
            padding: '12px 16px',
            fontWeight: 700,
            fontSize: '1.1rem',
            direction: 'rtl',
            textAlign: 'right',
          }}
        >
          {title}
        </div>
      )}
      <Table sx={{ minWidth: 650, direction: 'rtl' }} size="small">
        <TableHead>
          <TableRow>
            <TableCell
              align="center"
              sx={{ backgroundColor: '#f2f2f2', fontWeight: 700, width: 60 }}
            >
              שעה
            </TableCell>
            {days.map((day) => (
              <TableCell
                key={day}
                align="center"
                sx={{ backgroundColor: '#f2f2f2', fontWeight: 700 }}
              >
                {day}
              </TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {hours.map((hour) => (
            <TableRow key={hour}>
              <TableCell align="center" sx={{ fontWeight: 700 }}>
                {hour}
              </TableCell>
              {days.map((day) => (
                <TableCell key={day} align="center" sx={{ verticalAlign: 'top' }}>
                  <LessonCell
                    entries={grid[day]?.[String(hour)] || []}
                    viewMode={viewMode}
                    onEdit={onEdit ? (entry) => onEdit(day, hour, entry) : undefined}
                  />
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
