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
import MonitorarEmailDVR from './pages/MonitorarEmailDVR';
import VisualizarCameras from './pages/VisualizarCameras';
import RupturaLancadorItens from './pages/RupturaLancadorItens';
import RupturaVerificacao from './pages/RupturaVerificacao';
import RupturaResultados from './pages/RupturaResultados';
import RupturaResultadosAuditorias from './pages/RupturaResultadosAuditorias';
import EtiquetaLancadorItens from './pages/EtiquetaLancadorItens';
import EtiquetaVerificacao from './pages/EtiquetaVerificacao';
import EtiquetaResultadosAuditorias from './pages/EtiquetaResultadosAuditorias';
import PerdasLancador from './pages/PerdasLancador';
import PerdasResultados from './pages/PerdasResultados';
import GestaoTrocas from './pages/GestaoTrocas';
import ControlePDV from './pages/ControlePDV';
import ProducaoLancador from './pages/ProducaoLancador';
import ProducaoSugestao from './pages/ProducaoSugestao';
import ProducaoResultados from './pages/ProducaoResultados';
import EstoqueSaude from './pages/EstoqueSaude';
import HortFrutLancador from './pages/HortFrutLancador';
import HortFrutConferencia from './pages/HortFrutConferencia';
import HortFrutResultados from './pages/HortFrutResultados';
import Fornecedores from './pages/Fornecedores';
import CompraVendaAnalise from './pages/CompraVendaAnalise';
import FrenteCaixa from './pages/FrenteCaixa';
import PrevencaoPedidos from './pages/PrevencaoPedidos';
import RupturaIndustria from './pages/RupturaIndustria';

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
            <Route
              path="/monitorar-email-dvr"
              element={
                <ProtectedRoute>
                  <MonitorarEmailDVR />
                </ProtectedRoute>
              }
            />
            <Route
              path="/bipagens-inteligentes"
              element={
                <ProtectedRoute>
                  <VisualizarCameras />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ruptura-lancador"
              element={
                <ProtectedRoute>
                  <RupturaLancadorItens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ruptura-verificacao/:surveyId"
              element={
                <ProtectedRoute>
                  <RupturaVerificacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ruptura-resultados/:surveyId"
              element={
                <ProtectedRoute>
                  <RupturaResultados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ruptura-auditorias"
              element={
                <ProtectedRoute>
                  <RupturaResultadosAuditorias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/etiquetas/lancar"
              element={
                <ProtectedRoute>
                  <EtiquetaLancadorItens />
                </ProtectedRoute>
              }
            />
            <Route
              path="/etiquetas/verificar/:surveyId"
              element={
                <ProtectedRoute>
                  <EtiquetaVerificacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/etiquetas/resultados"
              element={
                <ProtectedRoute>
                  <EtiquetaResultadosAuditorias />
                </ProtectedRoute>
              }
            />
            <Route
              path="/perdas-lancador"
              element={
                <ProtectedRoute>
                  <PerdasLancador />
                </ProtectedRoute>
              }
            />
            <Route
              path="/perdas-resultados"
              element={
                <ProtectedRoute>
                  <PerdasResultados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-trocas"
              element={
                <ProtectedRoute>
                  <GestaoTrocas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/controle-pdv"
              element={
                <ProtectedRoute>
                  <ControlePDV />
                </ProtectedRoute>
              }
            />
            <Route
              path="/producao-lancador"
              element={
                <ProtectedRoute>
                  <ProducaoLancador />
                </ProtectedRoute>
              }
            />
            <Route
              path="/producao-sugestao"
              element={
                <ProtectedRoute>
                  <ProducaoSugestao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/producao/resultados"
              element={
                <ProtectedRoute>
                  <ProducaoResultados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/estoque-saude"
              element={
                <ProtectedRoute>
                  <EstoqueSaude />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hortfrut-lancador"
              element={
                <ProtectedRoute>
                  <HortFrutLancador />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hortfrut-conferencia/:id"
              element={
                <ProtectedRoute>
                  <HortFrutConferencia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/hortfrut-resultados"
              element={
                <ProtectedRoute>
                  <HortFrutResultados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/fornecedores"
              element={
                <ProtectedRoute>
                  <Fornecedores />
                </ProtectedRoute>
              }
            />
            <Route
              path="/compra-venda-analise"
              element={
                <ProtectedRoute>
                  <CompraVendaAnalise />
                </ProtectedRoute>
              }
            />
            <Route
              path="/frente-caixa"
              element={
                <ProtectedRoute>
                  <FrenteCaixa />
                </ProtectedRoute>
              }
            />
            <Route
              path="/prevencao-pedidos"
              element={
                <ProtectedRoute>
                  <PrevencaoPedidos />
                </ProtectedRoute>
              }
            />
            <Route
              path="/ruptura-industria"
              element={
                <ProtectedRoute>
                  <RupturaIndustria />
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
