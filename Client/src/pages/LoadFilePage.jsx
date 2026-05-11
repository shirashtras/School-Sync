import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const inputRef = useRef(null);

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
      setError('אנא בחר קובץ PDF');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setLoading(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post('/api/schedule/upload', formData);

      setMessage('הקובץ הועלה בהצלחה!');
      setSelectedFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      console.log('Upload response:', response.data);
      navigate('/select');
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בהעלאת הקובץ');
      console.error('Upload error:', err);
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

          <Box sx={{ mb: 3 }}>
            <input
              ref={inputRef}
              type="file"
              accept=".pdf"
              style={{ display: 'none' }}
              onChange={handleFileChange}
              disabled={loading}
            />
            <Button
              variant="outlined"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              fullWidth
              sx={{ mb: 2, textTransform: 'none' }}
            >
              {selectedFile ? `✓ ${selectedFile.name}` : 'בחר קובץ PDF'}
            </Button>
          </Box>

          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleUpload}
            disabled={!selectedFile || loading}
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
