import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { scheduleAPI } from '../api/scheduleAPI';
import { useSchedule } from '../hooks/useSchedule';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  Grid,
  Alert,
} from '@mui/material';

export default function SelectViewPage() {
  const [viewType, setViewType] = useState('class');
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setSelectedClass, setSelectedTeacher, setSelectedGroup, setSelectedDay } = useSchedule();

  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      setError('');
      setSelectedItem('');
      try {
        let response;
        switch (viewType) {
          case 'class':
            response = await scheduleAPI.getClasses();
            break;
          case 'teacher':
            response = await scheduleAPI.getAllTeachers();
            break;
          case 'group':
            response = await scheduleAPI.getAllGroups();
            break;
          case 'day':
            response = await scheduleAPI.getAllDays();
            break;
          default:
            response = { data: [] };
        }
        setItems(response.data || []);
      } catch (err) {
        setError(`שגיאה בטעינת הרשימה: ${err.message}`);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };
    fetchItems();
  }, [viewType]);

  const handleSelectItem = (itemName) => {
    setSelectedItem(itemName);
    setSelectedClass(null);
    setSelectedTeacher(null);
    setSelectedGroup(null);
    setSelectedDay(null);

    if (viewType === 'class') setSelectedClass(itemName);
    if (viewType === 'teacher') setSelectedTeacher(itemName);
    if (viewType === 'group') setSelectedGroup(itemName);
    if (viewType === 'day') setSelectedDay(itemName);

    navigate('/schedule');
  };

  const getViewTitle = () => {
    switch (viewType) {
      case 'class':
        return '📚 בחר כיתה';
      case 'teacher':
        return '👨‍🏫 בחר מורה';
      case 'group':
        return '👥 בחר הקבצה';
      case 'day':
        return '📅 בחר יום';
      default:
        return 'בחר תצוגה';
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 6,
        px: 2,
      }}
    >
      <Container maxWidth="lg">
        <Paper
          elevation={8}
          sx={{
            borderRadius: 4,
            p: { xs: 3, md: 5 },
            direction: 'rtl',
          }}
        >
          <Typography variant="h3" component="h1" align="center" gutterBottom>
            🗓️ לוח זמנים
          </Typography>

          <Box sx={{ mb: 4, p: 3, bgcolor: '#f8f9fa', borderRadius: 3, borderLeft: '4px solid #667eea' }}>
            <FormControl component="fieldset" sx={{ width: '100%' }}>
              <FormLabel component="legend" sx={{ mb: 2, color: '#667eea', fontSize: 18, fontWeight: 700 }}>
                בחר סוג תצוגה:
              </FormLabel>
              <RadioGroup row value={viewType} onChange={(e) => setViewType(e.target.value)} sx={{ flexWrap: 'wrap', gap: 2 }}>
                <FormControlLabel value="class" control={<Radio />} label="📚 לפי כיתה" />
                <FormControlLabel value="teacher" control={<Radio />} label="👨‍🏫 לפי מורה" />
                <FormControlLabel value="group" control={<Radio />} label="👥 לפי הקבצה" />
                <FormControlLabel value="day" control={<Radio />} label="📅 לפי יום" />
              </RadioGroup>
            </FormControl>
          </Box>

          <Box sx={{ mb: 4, p: 3, bgcolor: '#f8f9fa', borderRadius: 3, borderLeft: '4px solid #667eea' }}>
            <Typography variant="h5" sx={{ mb: 2, color: '#667eea', fontWeight: 700 }}>
              {getViewTitle()}
            </Typography>

            {loading && <Alert severity="info" sx={{ mb: 2 }}>⏳ טוען...</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            {!loading && items.length === 0 && !error && <Alert severity="warning">אין פריטים זמינים</Alert>}

            <Grid container spacing={2} sx={{ mt: 1 }}>
              {items.map((item) => (
                <Grid item xs={12} sm={6} md={4} key={item}>
                  <Button
                    variant={selectedItem === item ? 'contained' : 'outlined'}
                    color={selectedItem === item ? 'primary' : 'inherit'}
                    fullWidth
                    onClick={() => handleSelectItem(item)}
                    sx={{ textTransform: 'none', height: 72 }}
                  >
                    {item}
                  </Button>
                </Grid>
              ))}
            </Grid>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
}