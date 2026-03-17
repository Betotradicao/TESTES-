import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { LojaProvider } from './contexts/LojaContext';
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
import ConfiguracoesTabelas from './pages/ConfiguracoesTabelas';
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
import PrevencaoTrocas from './pages/PrevencaoTrocas';
import ControlePDV from './pages/ControlePDV';
import ProducaoLancador from './pages/ProducaoLancador';
import ProducaoSugestao from './pages/ProducaoSugestao';
import ProducaoResultados from './pages/ProducaoResultados';
import EstoqueSaude from './pages/EstoqueSaude';
import SaudeMargens from './pages/SaudeMargens';
import HortFrutLancador from './pages/HortFrutLancador';
import HortFrutConferencia from './pages/HortFrutConferencia';
import HortFrutResultados from './pages/HortFrutResultados';
import Fornecedores from './pages/Fornecedores';
import CompraVendaAnalise from './pages/CompraVendaAnalise';
import AnalisePonderacao from './pages/AnalisePonderacao';
import AnaliseRelevancia from './pages/AnaliseRelevancia';
import CompetitividadeConcorrencia from './pages/CompetitividadeConcorrencia';
import AncoragemPreco from './pages/AncoragemPreco';
import FrenteCaixa from './pages/FrenteCaixa';
import PrevencaoCaixa from './pages/PrevencaoCaixa';
import PrevcaoTributaria from './pages/PrevcaoTributaria';
import PrevencaoPedidos from './pages/PrevencaoPedidos';
import RupturaIndustria from './pages/RupturaIndustria';
import PrazoFornecedores from './pages/PrazoFornecedores';
import GestaoInteligente from './pages/GestaoInteligente';
import GarimpaFornecedores from './pages/GarimpaFornecedores';
import GarimpadorRanking from './pages/GarimpadorRanking';
import GarimpadorRankingConcorrentes from './pages/GarimpadorRankingConcorrentes';
import GarimpadorProjecao from './pages/GarimpadorProjecao';
import GarimpadorForaMix from './pages/GarimpadorForaMix';
import GarimpadorProdutosPesquisar from './pages/GarimpadorProdutosPesquisar';
import GarimpadorEcommerce from './pages/GarimpadorEcommerce';
import RotaCrescimento from './pages/RotaCrescimento';
import MarketingWhatsapp from './pages/MarketingWhatsapp';
import CalendarioAtendimento from './pages/CalendarioAtendimento';
import CotacaoPublica from './pages/CotacaoPublica';
import AnaliseCotacao from './pages/AnaliseCotacao';
import NotaFiscalRecebimento from './pages/NotaFiscalRecebimento';
import NotasAChegar from './pages/NotasAChegar';
import ExtratoSantander from './pages/ExtratoSantander';
import ExtratoBanco24h from './pages/ExtratoBanco24h';
import EntradasSaidas from './pages/EntradasSaidas';
import DemonstrativoCaixa from './pages/DemonstrativoCaixa';
import PrioridadeReposicao from './pages/PrioridadeReposicao';
import ProgramacaoAtual from './pages/ProgramacaoAtual';
import AnaliseOferta from './pages/AnaliseOferta';
import SimuladorVenda from './pages/SimuladorVenda';
import BoletoDDA from './pages/BoletoDDA';
import ConciliacaoBancaria from './pages/ConciliacaoBancaria';
import MetasRanking from './pages/MetasRanking';
import MetasParametrizar from './pages/MetasParametrizar';
import VisionOperacoesRisco from './pages/VisionOperacoesRisco';
import VisionPalavraChave2 from './pages/VisionPalavraChave2';
import VisionFacial from './pages/VisionFacial';

function App() {
  return (
    <Router>
      <AuthProvider>
        <LojaProvider>
          <SetupCheck>
            <Routes>
            {/* Public Routes - First Setup MUST be accessible without auth */}
            <Route path="/first-setup" element={<FirstSetup />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/cotacao/:token" element={<CotacaoPublica />} />

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
              path="/configuracoes-tabelas"
              element={
                <ProtectedRoute>
                  <ConfiguracoesTabelas />
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
              path="/prevencao-trocas"
              element={
                <ProtectedRoute>
                  <PrevencaoTrocas />
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
              path="/saude-margens"
              element={
                <ProtectedRoute>
                  <SaudeMargens />
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
              path="/pricing-ponderacao"
              element={
                <ProtectedRoute>
                  <AnalisePonderacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analise-relevancia"
              element={
                <ProtectedRoute>
                  <AnaliseRelevancia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pricing-competitividade"
              element={
                <ProtectedRoute>
                  <CompetitividadeConcorrencia />
                </ProtectedRoute>
              }
            />
            <Route
              path="/pricing-ancoragem"
              element={
                <ProtectedRoute>
                  <AncoragemPreco />
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
              path="/prevencao-caixa"
              element={
                <ProtectedRoute>
                  <PrevencaoCaixa />
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
              path="/prevencao-tributaria"
              element={
                <ProtectedRoute>
                  <PrevcaoTributaria />
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
            <Route
              path="/prazo-fornecedores"
              element={
                <ProtectedRoute>
                  <PrazoFornecedores />
                </ProtectedRoute>
              }
            />
            <Route
              path="/analise-cotacao"
              element={
                <ProtectedRoute>
                  <AnaliseCotacao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-inteligente"
              element={
                <ProtectedRoute>
                  <GestaoInteligente />
                </ProtectedRoute>
              }
            />
            <Route
              path="/garimpa-fornecedores"
              element={
                <ProtectedRoute>
                  <GarimpaFornecedores />
                </ProtectedRoute>
              }
            />
            <Route
              path="/garimpador-ranking"
              element={
                <ProtectedRoute>
                  <GarimpadorRanking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/garimpador-ranking-concorrentes"
              element={
                <ProtectedRoute>
                  <GarimpadorRankingConcorrentes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/garimpador-projecao"
              element={
                <ProtectedRoute>
                  <GarimpadorProjecao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/garimpador-fora-mix"
              element={
                <ProtectedRoute>
                  <GarimpadorForaMix />
                </ProtectedRoute>
              }
            />
            <Route
              path="/garimpador-produtos-pesquisar"
              element={
                <ProtectedRoute>
                  <GarimpadorProdutosPesquisar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/garimpador-ecommerce"
              element={
                <ProtectedRoute>
                  <GarimpadorEcommerce />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rota-crescimento"
              element={
                <ProtectedRoute>
                  <RotaCrescimento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/marketing-whatsapp"
              element={
                <ProtectedRoute>
                  <MarketingWhatsapp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/calendario-atendimento"
              element={
                <ProtectedRoute>
                  <CalendarioAtendimento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/nota-fiscal-recebimento"
              element={
                <ProtectedRoute>
                  <NotaFiscalRecebimento />
                </ProtectedRoute>
              }
            />
            <Route
              path="/notas-a-chegar"
              element={
                <ProtectedRoute>
                  <NotasAChegar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/prioridade-reposicao"
              element={
                <ProtectedRoute>
                  <PrioridadeReposicao />
                </ProtectedRoute>
              }
            />
            <Route
              path="/extrato-santander"
              element={
                <ProtectedRoute>
                  <ExtratoSantander />
                </ProtectedRoute>
              }
            />
            <Route
              path="/extrato-banco24h"
              element={
                <ProtectedRoute>
                  <ExtratoBanco24h />
                </ProtectedRoute>
              }
            />
            <Route
              path="/boletos-dda"
              element={
                <ProtectedRoute>
                  <BoletoDDA />
                </ProtectedRoute>
              }
            />
            <Route
              path="/conciliacao-bancaria"
              element={
                <ProtectedRoute>
                  <ConciliacaoBancaria />
                </ProtectedRoute>
              }
            />
            <Route
              path="/metas-ranking"
              element={
                <ProtectedRoute>
                  <MetasRanking />
                </ProtectedRoute>
              }
            />
            <Route
              path="/metas-parametrizar"
              element={
                <ProtectedRoute>
                  <MetasParametrizar />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vision-operacoes-risco"
              element={
                <ProtectedRoute>
                  <VisionOperacoesRisco />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vision-palavra-chave-2"
              element={
                <ProtectedRoute>
                  <VisionPalavraChave2 />
                </ProtectedRoute>
              }
            />
            <Route
              path="/vision-facial"
              element={
                <ProtectedRoute>
                  <VisionFacial />
                </ProtectedRoute>
              }
            />
            <Route
              path="/demonstrativo-caixa"
              element={
                <ProtectedRoute>
                  <DemonstrativoCaixa />
                </ProtectedRoute>
              }
            />
            <Route
              path="/entradas-saidas"
              element={
                <ProtectedRoute>
                  <EntradasSaidas />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-ofertas/programacao-atual"
              element={
                <ProtectedRoute>
                  <ProgramacaoAtual />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-ofertas/analise-sugestao"
              element={
                <ProtectedRoute>
                  <AnaliseOferta />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-ofertas/ofertas-salvas"
              element={
                <ProtectedRoute>
                  <AnaliseOferta defaultTab="salvas" />
                </ProtectedRoute>
              }
            />
            <Route
              path="/gestao-ofertas/simulador-venda"
              element={
                <ProtectedRoute>
                  <SimuladorVenda />
                </ProtectedRoute>
              }
            />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </SetupCheck>
      </LojaProvider>
    </AuthProvider>
  </Router>
  );
}

export default App
