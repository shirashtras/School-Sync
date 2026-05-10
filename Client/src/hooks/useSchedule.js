import { useContext } from 'react';
import { ScheduleContext } from '../context/ScheduleContext';

/**
 * Hook to access schedule context
 * @returns {Object} Schedule context value
 * @throws {Error} If used outside ScheduleProvider
 */
export function useSchedule() {
  const context = useContext(ScheduleContext);
  
  if (!context) {
    throw new Error('useSchedule must be used within ScheduleProvider');
  }
  
  return context;
}
