import { createContext, useState, useCallback } from 'react';
import { scheduleAPI } from '../api/scheduleAPI';

export const ScheduleContext = createContext();

export function ScheduleProvider({ children }) {
  const [scheduleData, setScheduleData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedClass, setSelectedClass] = useState(null);
  const [selectedTeacher, setSelectedTeacher] = useState(null);
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [selectedDay, setSelectedDay] = useState(null);

  const uploadFile = useCallback(async (file) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.upload(file);
      setScheduleData(response.data);
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

  const fetchClassSchedule = useCallback(async (className) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.getClassSchedule(className);
      setSelectedClass(className);
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
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בטעינת לוח הזמנים');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchGroupSchedule = useCallback(async (groupName) => {
    setLoading(true);
    setError(null);
    try {
      const response = await scheduleAPI.getGroupSchedule(groupName);
      setSelectedGroup(groupName);
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
      return response.data;
    } catch (err) {
      setError(err.response?.data?.message || 'שגיאה בעדכון השיעור');
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value = {
    // State
    scheduleData,
    loading,
    error,
    selectedClass,
    selectedTeacher,
    selectedGroup,
    selectedDay,

    // State setters
    setSelectedClass,
    setSelectedTeacher,
    setSelectedGroup,
    setSelectedDay,

    // Actions
    uploadFile,
    fetchClasses,
    fetchClassSchedule,
    fetchTeacherSchedule,
    fetchGroupSchedule,
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
