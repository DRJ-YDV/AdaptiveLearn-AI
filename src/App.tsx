import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { KnowledgeMap } from './pages/KnowledgeMap';
import { Tutor } from './pages/Tutor';
import { Assessment } from './pages/Assessment';
import { AssessmentResults } from './pages/AssessmentResults';
import { CourseIngestion } from './pages/CourseIngestion';
import { Evaluation } from './pages/Evaluation';
import { Progress } from './pages/Progress';
import { StudyPlanPage } from './pages/StudyPlan';
import { RevisionKit } from './pages/RevisionKit';
import { Landing } from './pages/Landing';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/landing" element={<Navigate to="/" replace />} />
        <Route path="/courses" element={<Navigate to="/app/courses" replace />} />
        <Route path="/knowledge-map" element={<Navigate to="/app/knowledge-map" replace />} />
        <Route path="/tutor" element={<Navigate to="/app/tutor" replace />} />
        <Route path="/assessment" element={<Navigate to={`/app/assessment${window.location.search}`} replace />} />
        <Route path="/assessment/results" element={<Navigate to={`/app/assessment/results${window.location.search}`} replace />} />
        <Route path="/evaluation" element={<Navigate to="/app/evaluation" replace />} />
        <Route path="/progress" element={<Navigate to="/app/progress" replace />} />
        <Route path="/study-plan" element={<Navigate to="/app/study-plan" replace />} />
        <Route path="/revision-kit" element={<Navigate to="/app/revision-kit" replace />} />
        <Route path="/app" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="courses" element={<CourseIngestion />} />
          <Route path="knowledge-map" element={<KnowledgeMap />} />
          <Route path="tutor" element={<Tutor />} />
          <Route path="assessment" element={<Assessment />} />
          <Route path="assessment/results" element={<AssessmentResults />} />
          <Route path="evaluation" element={<Evaluation />} />
          <Route path="progress" element={<Progress />} />
          <Route path="study-plan" element={<StudyPlanPage />} />
          <Route path="revision-kit" element={<RevisionKit />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
