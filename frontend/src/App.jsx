import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Protected from './pages/Protected';
import PrivateRoute from './components/PrivateRoute';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/signup" element={<Signup />} />
        <Route path="/login" element={<Login />} />
        <Route
          path="/protected"
          element={
            <PrivateRoute>
              <Protected />
            </PrivateRoute>
          }
        />
        <Route path="/" element={<Navigate to="/protected" replace />} />
        <Route path="*" element={<Navigate to="/protected" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;