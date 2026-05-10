import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { scheduleAPI } from '../api/scheduleApi';
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
  CircularProgress,
} from '@mui/material';

export default function SelectViewPage() {
  const [viewType, setViewType] = useState('class'); // 'class', 'teacher', or 'group'
  const [items, setItems] = useState([]);
  const [selectedItem, setSelectedItem] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [schedule, setSchedule] = useState(null);
  const navigate = useNavigate();
  const { setSelectedClass, setSelectedTeacher, setSelectedGroup } = useSchedule();

  // Fetch items based on view type
  useEffect(() => {
    const fetchItems = async () => {
      setLoading(true);
      setError('');
      setSelectedItem('');
      setSchedule(null);

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
          default:
            response = { data: [] };
        }
        setItems(response.data || []);
      } catch (err) {
        setError(`שגיאה בטעינת ${viewType === 'class' ? 'כיתות' : viewType === 'teacher' ? 'מורים' : 'הקבצות'}: ${err.message}`);
        setItems([]);
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, [viewType]);

  // Fetch schedule when item is selected
  const handleSelectItem = async (itemName) => {
    setSelectedItem(itemName);
    setLoading(true);
    setError('');
    setSchedule(null);

    try {
      let response;
      switch (viewType) {
        case 'class':
          response = await scheduleAPI.getClassSchedule(itemName);
          break;
        case 'teacher':
          response = await scheduleAPI.getTeacherSchedule(itemName);
          break;
        case 'group':
          response = await scheduleAPI.getGroupSchedule(itemName);
          break;
        default:
          response = { data: null };
      }
      setSchedule(response.data);
      // Set selected in context
      if (viewType === 'class') setSelectedClass(itemName);
      else if (viewType === 'teacher') setSelectedTeacher(itemName);
      else if (viewType === 'group') setSelectedGroup(itemName);
      // Navigate to schedule page
      navigate('/schedule');
    } catch (err) {
      setError(`שגיאה בטעינת לוח הזמנים: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const getViewTitle = () => {
    switch (viewType) {
      case 'class':
        return '📚 בחר כיתה';
      case 'teacher':
        return '👨‍🏫 בחר מורה';
      case 'group':
        return '👥 בחר הקבצה';
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
              <RadioGroup
                row
                value={viewType}
                onChange={(e) => setViewType(e.target.value)}
                sx={{ flexWrap: 'wrap', gap: 2 }}
              >
                <FormControlLabel
                  value="class"
                  control={<Radio />}
                  label="📚 לפי כיתה"
                />
                <FormControlLabel
                  value="teacher"
                  control={<Radio />}
                  label="👨‍🏫 לפי מורה"
                />
                <FormControlLabel
                  value="group"
                  control={<Radio />}
                  label="👥 לפי הקבצה"
                />
              </RadioGroup>
            </FormControl>
          </Box>

          <Box sx={{ mb: 4, p: 3, bgcolor: '#f8f9fa', borderRadius: 3, borderLeft: '4px solid #667eea' }}>
            <Typography variant="h5" sx={{ mb: 2, color: '#667eea', fontWeight: 700 }}>
              {getViewTitle()}
            </Typography>

            {loading && (
              <Alert severity="info" sx={{ mb: 2 }}>
                ⏳ טוען...
              </Alert>
            )}
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}
            {!loading && items.length === 0 && !error && (
              <Alert severity="warning">אין פריטים זמינים</Alert>
            )}

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

          {schedule && (
            <Box sx={{ mb: 4, p: 3, bgcolor: '#f8f9fa', borderRadius: 3, borderLeft: '4px solid #667eea' }}>
              <Typography variant="h5" sx={{ mb: 2, color: '#333', fontWeight: 700 }}>
                לוח זמנים של {selectedItem}
              </Typography>
              <Paper sx={{ p: 2, bgcolor: 'white', border: '1px solid #ddd' }}>
                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit' }}>
                  {JSON.stringify(schedule, null, 2)}
                </pre>
              </Paper>
              <Button
                variant="contained"
                color="primary"
                sx={{ mt: 3, textTransform: 'none' }}
                onClick={() => window.print()}
              >
                🖨️ הדפס
              </Button>
            </Box>
          )}

          {selectedItem && !schedule && !loading && !error && (
            <Alert severity="info">אין לוח זמנים זמין</Alert>
          )}
        </Paper>
      </Container>
    </Box>
  );
}