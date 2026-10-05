import { Navigate, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import LandingPage from './pages/LandingPage.jsx';
import AnalyzePage from './pages/AnalyzePage.jsx';
import FilesPage from './pages/FilesPage.jsx';
import FileDetailPage from './pages/FileDetailPage.jsx';
import BacktestPage from './pages/BacktestPage.jsx';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="analyze" element={<AnalyzePage />} />
        <Route path="files" element={<FilesPage />} />
        <Route path="files/:id" element={<FileDetailPage />} />
        <Route path="backtest" element={<BacktestPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
