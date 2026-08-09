import { useContext } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, AuthContext } from './context/AuthContext';
import AuthGateway from './components/auth/AuthGateway';
import Dashboard from './components/dashboard/Dashboard';
import Chat from './components/chat/Chat';
import './App.css';

function AppContent() {
  const { isAuthenticated, isLoading } = useContext(AuthContext);

  if (isLoading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <Routes>
      {isAuthenticated ? (
        <>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/chat/:roomId" element={<Chat />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </>
      ) : (
        <>
          <Route path="/login" element={<AuthGateway />} />
          <Route path="/register" element={<AuthGateway />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </>
      )}
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
