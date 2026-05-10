import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ScheduleProvider } from './context/ScheduleContext';
import LoadFilePage from './pages/LoadFilePage';
import SelectViewPage from './pages/SelectViewPage';
import ClassSchedulePage from './pages/ClassSchedulePage';

function App() {
  return (
    <BrowserRouter>
      <ScheduleProvider>
        <Routes>
          <Route path="/" element={<LoadFilePage />} />
          <Route path="/select" element={<SelectViewPage />} />
          <Route path="/schedule" element={<ClassSchedulePage />} />
        </Routes>
      </ScheduleProvider>
    </BrowserRouter>
  );
}

export default App;