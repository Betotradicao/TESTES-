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
import PendenciasNotas from './pages/PendenciasNotas';
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
import DisparoWhatsapp from './pages/DisparoWhatsapp';
import RhDashboard from './pages/RhDashboard';
import RhConfiguracoes from './pages/RhConfiguracoes';
import RhCadastroGeral from './pages/RhCadastroGeral';
import RhResultados from './pages/RhResultados';
import RhControleASO from './pages/RhControleASO';
import RhAusencias from './pages/RhAusencias';
import RhAdmissoes from './pages/RhAdmissoes';
import RhDesligamentos from './pages/RhDesligamentos';
import RhVagas from './pages/RhVagas';
import RhTreinamentos from './pages/RhTreinamentos';
import RhIndicadores from './pages/RhIndicadores';
import RhPlaceholder from './pages/RhPlaceholder';
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
import MargensCategoria from './pages/MargensCategoria';

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
              path="/margens-categoria"
              element={
                <ProtectedRoute>
                  <MargensCategoria />
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
              path="/pendencias-notas"
              element={
                <ProtectedRoute>
                  <PendenciasNotas />
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
              path="/disparo-whatsapp"
              element={
                <ProtectedRoute>
                  <DisparoWhatsapp />
                </ProtectedRoute>
              }
            />
            {/* RH no Radar */}
            <Route
              path="/rh/dashboard"
              element={
                <ProtectedRoute>
                  <RhDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rh/configuracoes"
              element={
                <ProtectedRoute>
                  <RhConfiguracoes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rh/cadastro"
              element={
                <ProtectedRoute>
                  <RhCadastroGeral />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rh/resultados"
              element={
                <ProtectedRoute>
                  <RhResultados />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rh/aso"
              element={
                <ProtectedRoute>
                  <RhControleASO />
                </ProtectedRoute>
              }
            />
            <Route
              path="/rh/ausencias"
              element={
                <ProtectedRoute>
                  <RhAusencias />
                </ProtectedRoute>
              }
            />
            <Route path="/rh/admissoes" element={<ProtectedRoute><RhAdmissoes /></ProtectedRoute>} />
            <Route path="/rh/desligamentos" element={<ProtectedRoute><RhDesligamentos /></ProtectedRoute>} />
            <Route path="/rh/vagas" element={<ProtectedRoute><RhVagas /></ProtectedRoute>} />
            <Route path="/rh/treinamentos" element={<ProtectedRoute><RhTreinamentos /></ProtectedRoute>} />
            <Route path="/rh/indicadores" element={<ProtectedRoute><RhIndicadores /></ProtectedRoute>} />
            {/* RH Placeholder pages */}
            <Route path="/rh/documentacao" element={<ProtectedRoute><RhPlaceholder title="Documentacao" subtitle="Gestao de documentos dos colaboradores" features={['Contratos de trabalho', 'Termos de responsabilidade', 'Declaracoes', 'Templates personalizaveis']} /></ProtectedRoute>} />
            <Route path="/rh/exames" element={<ProtectedRoute><RhPlaceholder title="Exames Periodicos" subtitle="Controle de exames medicos" features={['Exames admissionais', 'Periodicos', 'Demissionais', 'Alertas de vencimento']} /></ProtectedRoute>} />
            <Route path="/rh/vencimentos" element={<ProtectedRoute><RhPlaceholder title="Relatorio de Vencimentos" subtitle="ASOs e documentos proximos do vencimento" features={['ASOs vencidos', 'ASOs a vencer', 'Documentos pendentes']} /></ProtectedRoute>} />
            <Route path="/rh/jornadas" element={<ProtectedRoute><RhPlaceholder title="Jornadas de Trabalho" subtitle="Controle de jornadas e escalas" features={['Jornadas CLT', 'Escalas de trabalho', 'Banco de horas']} /></ProtectedRoute>} />
            <Route path="/rh/ferias" element={<ProtectedRoute><RhPlaceholder title="Controle de Ferias" subtitle="Gestao de ferias dos colaboradores" features={['Programacao de ferias', 'Saldo de dias', 'Ferias vencidas', 'Calendario de ferias']} /></ProtectedRoute>} />
            <Route path="/rh/absenteismo" element={<ProtectedRoute><RhPlaceholder title="Analise de Absenteismo" subtitle="Indicadores de ausencias" features={['Taxa de absenteismo', 'Ranking por setor', 'Evolucao mensal', 'Motivos mais frequentes']} /></ProtectedRoute>} />
            <Route path="/rh/candidatos" element={<ProtectedRoute><RhPlaceholder title="Cadastro de Candidatos" subtitle="Gestao de candidatos por vaga" features={['Triagem de curriculos', 'Historico de candidatos', 'Banco de talentos']} /></ProtectedRoute>} />
            <Route path="/rh/processo-seletivo" element={<ProtectedRoute><RhPlaceholder title="Processo Seletivo" subtitle="Acompanhamento de processos seletivos" features={['Etapas do processo', 'Avaliacao de candidatos', 'Feedback', 'Aprovacao final']} /></ProtectedRoute>} />
            <Route path="/rh/presenca" element={<ProtectedRoute><RhPlaceholder title="Controle de Presenca" subtitle="Presenca em treinamentos" features={['Lista de presenca', 'Frequencia por colaborador', 'Certificados automaticos']} /></ProtectedRoute>} />
            <Route path="/rh/certificados" element={<ProtectedRoute><RhPlaceholder title="Certificados" subtitle="Gestao de certificados de treinamento" features={['Emissao de certificados', 'Historico', 'Validade', 'Download PDF']} /></ProtectedRoute>} />
            <Route path="/rh/lancamentos" element={<ProtectedRoute><RhPlaceholder title="Lancamentos Financeiros" subtitle="Lancamentos de folha e custos RH" features={['Folha de pagamento', 'Custos por departamento', 'Evolucao mensal']} /></ProtectedRoute>} />
            <Route path="/rh/folha" element={<ProtectedRoute><RhPlaceholder title="Folha de Pagamento" subtitle="Gestao da folha de pagamento" features={['Salarios', 'Beneficios', 'Descontos', 'Resumo mensal']} /></ProtectedRoute>} />
            <Route path="/rh/beneficios" element={<ProtectedRoute><RhPlaceholder title="Beneficios" subtitle="Gestao de beneficios dos colaboradores" features={['Vale transporte', 'Vale refeicao', 'Plano de saude', 'Outros beneficios']} /></ProtectedRoute>} />
            <Route path="/rh/rotatividade" element={<ProtectedRoute><RhPlaceholder title="Rotatividade (Turnover)" subtitle="Indicadores de rotatividade" features={['Taxa de turnover', 'Evolucao mensal', 'Por departamento', 'Motivos de saida']} /></ProtectedRoute>} />
            <Route path="/rh/perfil" element={<ProtectedRoute><RhPlaceholder title="Perfil Demografico" subtitle="Analise do perfil dos colaboradores" features={['Distribuicao por idade', 'Genero', 'Escolaridade', 'Tempo de casa']} /></ProtectedRoute>} />
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
