import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import SetupCheck from './components/SetupCheck';
import Login from './pages/Login';
import FirstSetup from './pages/FirstSetup';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Bipagens from './pages/Bipagens';
import Rankings from './pages/Rankings';
import AtivarProdutos from './pages/AtivarProdutos';
import ResultadosDoDia from './pages/ResultadosDoDia';
import Configuracoes from './pages/Configuracoes';
import ConfiguracoesRede from './pages/ConfiguracoesRede';
import Perfil from './pages/Perfil';
import ReconhecimentoFacial from './pages/ReconhecimentoFacial';

function App() {
  return (
    <Router>
      <AuthProvider>
        <SetupCheck>
          <Routes>
            {/* Public Routes - First Setup MUST be accessible without auth */}
            <Route path="/first-setup" element={<FirstSetup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected Routes */}
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bipagens"
              element={
                <ProtectedRoute>
                  <Bipagens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rankings"
              element={
                <ProtectedRoute>
                  <Rankings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ativar-produtos"
              element={
                <ProtectedRoute>
                  <AtivarProdutos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/resultados-do-dia"
              element={
                <ProtectedRoute>
                  <ResultadosDoDia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes"
              element={
                <ProtectedRoute>
                  <Configuracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/configuracoes-rede"
              element={
                <ProtectedRoute>
                  <ConfiguracoesRede />
                </ProtectedRoute>
              }
            />
            <Route
              path="/perfil"
              element={
                <ProtectedRoute>
                  <Perfil />
                </ProtectedRoute>
              }
            />
            <Route
              path="/reconhecimento-facial"
              element={
                <ProtectedRoute>
                  <ReconhecimentoFacial />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SetupCheck>
      </AuthProvider>
    </Router>
  );
}

export default App
