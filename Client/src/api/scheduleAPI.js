import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
});

// Schedule API endpoints
export const scheduleAPI = {
  upload: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post('/schedule/upload', formData);
  },

  getClasses: () => apiClient.get('/schedule/classes'),

  getClassSchedule: (className) => apiClient.get(`/schedule/classes/${className}`),

  getTeacherSchedule: (teacherName) => apiClient.get(`/schedule/teachers/${teacherName}`),

  getGroupSchedule: (groupName) => apiClient.get(`/schedule/groups/${groupName}`),

  getAllTeachers: () => apiClient.get('/schedule/teachers'),

  getAllGroups: () => apiClient.get('/schedule/groups'),

  getFullSchedule: () => apiClient.get('/schedule/full'),
};

export default apiClient;
