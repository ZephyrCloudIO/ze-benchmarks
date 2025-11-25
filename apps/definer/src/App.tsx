import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import RoleSelection from './pages/RoleSelection';
import EvaluationCriteria from './pages/EvaluationCriteria';
import RoleDefDetail from './pages/RoleDefDetail';

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/create" element={<RoleSelection />} />
        <Route path="/create/criteria" element={<EvaluationCriteria />} />
        <Route path="/roledef/:id" element={<RoleDefDetail />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;
