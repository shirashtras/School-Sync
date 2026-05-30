import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({ baseURL: API_BASE_URL });

export const scheduleAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/schedule/upload', formData);
  },

  getStatus: () => apiClient.get('/schedule/status'),

  getClasses: () => apiClient.get('/schedule/classes'),

  getAllTeachers: () => apiClient.get('/schedule/teachers'),

  getAllDays: () => apiClient.get('/schedule/days'),

  getLessons: () => apiClient.get('/schedule/lessons'),

  getClassSchedule: (className) =>
    apiClient.get(`/schedule/class/${encodeURIComponent(className)}`),

  getTeacherSchedule: (teacherName) =>
    apiClient.get(`/schedule/teacher/${encodeURIComponent(teacherName)}`),

  getDaySchedule: (dayName) =>
    apiClient.get(`/schedule/day/${encodeURIComponent(dayName)}`),

  updateLesson: (payload) => apiClient.put('/schedule/update', payload),

  getFullSchedule: () => apiClient.get('/schedule/full'),
};

export default apiClient;
