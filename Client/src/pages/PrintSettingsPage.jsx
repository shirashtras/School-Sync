import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { scheduleAPI } from '../api/scheduleAPI';
import ScheduleTable from '../components/ScheduleTable';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Container,
  FormControl,
  FormControlLabel,
  FormLabel,
  Paper,
  Radio,
  RadioGroup,
  Typography,
} from '@mui/material';

const LAYOUTS = [
  { value: 1, label: '1 בעמוד' },
  { value: 2, label: '2 בעמוד' },
  { value: 4, label: '4 בעמוד' },
  { value: 6, label: '6 בעמוד' },
];

export default function PrintSettingsPage() {
  const navigate = useNavigate();
  const printRef = useRef(null);
  const [printType, setPrintType] = useState('class');
  const [layout, setLayout] = useState(1);
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState([]);
  const [selectedTeachers, setSelectedTeachers] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([scheduleAPI.getClasses(), scheduleAPI.getAllTeachers()])
      .then(([c, t]) => {
        setClasses(c.data || []);
        setTeachers(t.data || []);
      })
      .catch((err) => setError(err.message));
  }, []);

  const toggleItem = (list, setList, item) => {
    setList((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const loadSchedules = async () => {
    setLoading(true);
    setError('');
    try {
      const items = printType === 'class' ? selectedClasses : selectedTeachers;
      if (!items.length) {
        setError('בחר לפחות פריט אחד להדפסה');
        setLoading(false);
        return;
      }

      const results = await Promise.all(
        items.map(async (name) => {
          const res =
            printType === 'class'
              ? await scheduleAPI.getClassSchedule(name)
              : await scheduleAPI.getTeacherSchedule(name);
          return { name, data: res.data, type: printType };
        })
      );
      setSchedules(results);
    } catch (err) {
      setError(err.response?.data?.message || err.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const cols = layout <= 2 ? layout : layout === 4 ? 2 : 3;

  return (
    <>
      <Box sx={{ p: 3, minHeight: '100vh', backgroundColor: '#f5f7ff' }} className="no-print">
        <Container maxWidth="md">
          <Paper sx={{ p: 4, borderRadius: 4, direction: 'rtl' }}>
            <Typography variant="h4" gutterBottom>
              הגדרות הדפסה
            </Typography>

            <FormControl sx={{ mb: 3 }}>
              <FormLabel>סוג הדפסה</FormLabel>
              <RadioGroup
                row
                value={printType}
                onChange={(e) => {
                  setPrintType(e.target.value);
                  setSchedules([]);
                }}
              >
                <FormControlLabel value="class" control={<Radio />} label="לפי כיתה" />
                <FormControlLabel value="teacher" control={<Radio />} label="לפי מורה" />
              </RadioGroup>
            </FormControl>

            <FormControl sx={{ mb: 3 }}>
              <FormLabel>פריסה בעמוד</FormLabel>
              <RadioGroup
                row
                value={String(layout)}
                onChange={(e) => setLayout(Number(e.target.value))}
              >
                {LAYOUTS.map((l) => (
                  <FormControlLabel
                    key={l.value}
                    value={String(l.value)}
                    control={<Radio />}
                    label={l.label}
                  />
                ))}
              </RadioGroup>
            </FormControl>

            <Typography variant="h6" sx={{ mb: 1 }}>
              {printType === 'class' ? 'בחר כיתות' : 'בחר מורות'}
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 3 }}>
              {(printType === 'class' ? classes : teachers).map((item) => (
                <FormControlLabel
                  key={item}
                  control={
                    <Checkbox
                      checked={
                        printType === 'class'
                          ? selectedClasses.includes(item)
                          : selectedTeachers.includes(item)
                      }
                      onChange={() =>
                        printType === 'class'
                          ? toggleItem(selectedClasses, setSelectedClasses, item)
                          : toggleItem(selectedTeachers, setSelectedTeachers, item)
                      }
                    />
                  }
                  label={item}
                />
              ))}
            </Box>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button variant="contained" onClick={loadSchedules} disabled={loading}>
                {loading ? 'טוען...' : 'טען לתצוגה'}
              </Button>
              <Button variant="outlined" onClick={handlePrint} disabled={!schedules.length}>
                הדפס
              </Button>
              <Button variant="text" onClick={() => navigate('/select')}>חזרה</Button>
            </Box>
          </Paper>
        </Container>
      </Box>

      <Box ref={printRef} className="print-area" sx={{ p: 2, direction: 'rtl' }}>
        <style>{`
          @media print {
            .no-print { display: none !important; }
            .print-area { padding: 0; }
            .print-grid {
              display: grid;
              grid-template-columns: repeat(${cols}, 1fr);
              gap: 12px;
            }
            .print-item {
              page-break-inside: avoid;
              break-inside: avoid;
            }
          }
          @media screen {
            .print-grid {
              display: grid;
              grid-template-columns: repeat(${Math.min(cols, 2)}, 1fr);
              gap: 16px;
              padding: 16px;
            }
          }
        `}</style>

        <div className="print-grid">
          {schedules.map(({ name, data, type }) => (
            <Paper key={name} className="print-item" sx={{ p: 1 }}>
              <ScheduleTable
                schedule={data}
                viewMode={type === 'teacher' ? 'teacher' : 'class'}
                title={type === 'class' ? `כיתה ${name}` : `מורה ${name}`}
              />
            </Paper>
          ))}
        </div>
      </Box>
    </>
  );
}
