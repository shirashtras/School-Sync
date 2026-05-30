import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ScheduleProvider } from './context/ScheduleContext';
import LoadFilePage from './pages/LoadFilePage';
import SelectViewPage from './pages/SelectViewPage';
import ClassSchedulePage from './pages/ClassSchedulePage';
import TeacherSchedulePage from './pages/TeacherSchedulePage';
import PrintSettingsPage from './pages/PrintSettingsPage';

function App() {
  return (
    <BrowserRouter>
      <ScheduleProvider>
        <Routes>
          <Route path="/" element={<LoadFilePage />} />
          <Route path="/select" element={<SelectViewPage />} />
          <Route path="/schedule/class" element={<ClassSchedulePage />} />
          <Route path="/schedule/teacher" element={<TeacherSchedulePage />} />
          <Route path="/schedule" element={<ClassSchedulePage />} />
          <Route path="/print" element={<PrintSettingsPage />} />
        </Routes>
      </ScheduleProvider>
    </BrowserRouter>
  );
}

export default App;
