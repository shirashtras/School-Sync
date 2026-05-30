import { createContext, useState, useCallback } from 'react';
import { scheduleAPI } from '../api/scheduleAPI';

export const ScheduleContext = createContext();

export function ScheduleProvider({ children }) {
  const [lessons, setLessons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const uploadFile = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.upload(file);
      const full = await scheduleAPI.getLessons();
      setLessons(full.data || []);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בהעלאת הקובץ');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.getClasses();
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בטעינת הכיתות');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.getAllTeachers();
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בטעינת המורים');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDays = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.getAllDays();
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בטעינת הימים');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClassSchedule = useCallback(async (className) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.getClassSchedule(className);
      setSelectedClass(className);
      setSelectedTeacher(null);
      setSelectedDay(null);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בטעינת לוח הזמנים');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTeacherSchedule = useCallback(async (teacherName) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.getTeacherSchedule(teacherName);
      setSelectedTeacher(teacherName);
      setSelectedClass(null);
      setSelectedDay(null);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בטעינת לוח הזמנים');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchDaySchedule = useCallback(async (dayName) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.getDaySchedule(dayName);
      setSelectedDay(dayName);
      setSelectedClass(null);
      setSelectedTeacher(null);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בטעינת לוח הזמנים');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const updateLesson = useCallback(async (payload) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.updateLesson(payload);
      const full = await scheduleAPI.getLessons();
      setLessons(full.data || []);
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בעדכון השיעור');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const value = {
    lessons,
    loading,
    error,
    selectedClass,
    selectedTeacher,
    selectedDay,
    setSelectedClass,
    setSelectedTeacher,
    setSelectedDay,
    uploadFile,
    fetchClasses,
    fetchTeachers,
    fetchDays,
    fetchClassSchedule,
    fetchTeacherSchedule,
    fetchDaySchedule,
    updateLesson,
    clearError,
  };

  return (
    <ScheduleContext.Provider value={value}>
      {children}
    </ScheduleContext.Provider>
  );
}
