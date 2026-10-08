import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Overview } from './pages/Overview';
import { KnowledgeMap } from './pages/KnowledgeMap';
import { Tutor } from './pages/Tutor';
import { Assessment } from './pages/Assessment';
import { AssessmentResults } from './pages/AssessmentResults';
import { CourseIngestion } from './pages/CourseIngestion';
import { Evaluation } from './pages/Evaluation';
import { Progress } from './pages/Progress';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Overview />} />
          <Route path="courses" element={<CourseIngestion />} />
          <Route path="knowledge-map" element={<KnowledgeMap />} />
          <Route path="tutor" element={<Tutor />} />
          <Route path="assessment" element={<Assessment />} />
          <Route path="assessment/results" element={<AssessmentResults />} />
          <Route path="evaluation" element={<Evaluation />} />
          <Route path="progress" element={<Progress />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
