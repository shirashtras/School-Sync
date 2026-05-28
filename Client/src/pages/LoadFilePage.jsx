import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { scheduleAPI } from '../api/scheduleAPI';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  Alert,
  CircularProgress,
} from '@mui/material';

export default function LoadFilePage() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [hasExistingSchedule, setHasExistingSchedule] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef(null);

  useEffect(() => {
    const checkExistingSchedule = async () => {
      try {
        const response = await scheduleAPI.getStatus();
        setHasExistingSchedule(Boolean(response.data?.isLoaded));
      } catch (statusError) {
        console.warn('Schedule status check failed', statusError);
      } finally {
        setCheckingStatus(false);
      }
    };

    checkExistingSchedule();
  }, []);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setSelectedFile(file);
      setMessage('');
      setError('');
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('אנא בחר קובץ Excel/PDF');
      return;
    }

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await scheduleAPI.upload(selectedFile);

      setMessage('הקובץ הועלה בהצלחה!');
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      navigate('/select');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בהעלאת הקובץ');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        py: 6,
        px: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Container maxWidth="sm">
        <Paper elevation={8} sx={{ borderRadius: 4, p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            העלאת קובץ לוח זמנים
          </Typography>

          {checkingStatus ? (
            <Alert severity="info" sx={{ mb: 3 }}>
              בודק אם קיימת מערכת שמורה...
            </Alert>
          ) : null}

          {!checkingStatus && hasExistingSchedule ? (
            <Box sx={{ mb: 3, display: 'grid', gap: 1.5 }}>
              <Alert severity="success">נמצאה מערכת קיימת</Alert>
              <Button variant="outlined" onClick={() => navigate('/select')}>
                השתמש במערכת הקיימת
              </Button>
              <Button variant="text" onClick={() => setHasExistingSchedule(false)}>
                טען קובץ חדש במקום הקיים
              </Button>
            </Box>
          ) : null}

          <Box sx={{ mb: 3, opacity: checkingStatus ? 0.5 : 1 }}>
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls,.pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={loading || checkingStatus}
            />
            <Button
              variant="outlined"
              onClick={() => inputRef.current?.click()}
              disabled={loading || checkingStatus}
              fullWidth
              sx={{ mb: 2, textTransform: 'none' }}
            >
              {selectedFile ? `✓ ${selectedFile.name}` : 'בחר קובץ Excel / PDF'}
            </Button>
          </Box>

          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleUpload}
            disabled={!selectedFile || loading || checkingStatus}
            sx={{ py: 1.5, textTransform: 'none' }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'העלה קובץ'}
          </Button>

          {message && (
            <Alert severity="success" sx={{ mt: 3 }}>
              {message}
            </Alert>
          )}
          {error && (
            <Alert severity="error" sx={{ mt: 3 }}>
              {error}
            </Alert>
          )}
        </Paper>
      </Container>
    </Box>
  );
}
