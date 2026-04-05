import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import RadarLoading from '../components/RadarLoading';

export default function RhIndicadores() {
  const { user } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, ativos: 0, desligados: 0, admissoes_ano: 0, desligamentos_ano: 0 });
  const [colaboradores, setColaboradores] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [statsRes, colabRes] = await Promise.all([
        api.get('/rh/colaboradores/stats'),
        api.get('/rh/colaboradores?limit=500'),
      ]);
      setStats(statsRes.data || { total: 0, ativos: 0, desligados: 0, admissoes_ano: 0, desligamentos_ano: 0 });
      setColaboradores(colabRes.data.colaboradores || colabRes.data || []);
    } catch (err) {
      toast.error('Erro ao carregar indicadores');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    return new Date(d).toLocaleDateString('pt-BR');
  };

  // Gender distribution
  const masculino = colaboradores.filter((c) => (c.sexo || '').toUpperCase() === 'M').length;
  const feminino = colaboradores.filter((c) => (c.sexo || '').toUpperCase() === 'F').length;
  const totalGenero = masculino + feminino || 1;
  const percMasc = Math.round((masculino / totalGenero) * 100);
  const percFem = Math.round((feminino / totalGenero) * 100);

  // Status distribution
  const ativos = stats.ativos || 0;
  const desligados = stats.desligados || 0;
  const totalStatus = ativos + desligados || 1;
  const percAtivos = Math.round((ativos / totalStatus) * 100);

  // Turnover rate
  const taxaRotatividade = stats.total > 0
    ? (((stats.admissoes_ano || 0) + (stats.desligamentos_ano || 0)) / 2 / stats.total * 100).toFixed(1)
    : '0.0';

  // Recent admissions & dismissals
  const anoAtual = new Date().getFullYear();
  const admissoesRecentes = colaboradores
    .filter((c) => c.status === 'ativo' && c.data_admissao)
    .sort((a, b) => new Date(b.data_admissao) - new Date(a.data_admissao))
    .slice(0, 10);

  const desligamentosRecentes = colaboradores
    .filter((c) => c.status === 'desligado' && c.data_desligamento)
    .sort((a, b) => new Date(b.data_desligamento) - new Date(a.data_desligamento))
    .slice(0, 10);

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-100">
        <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
        <div className="flex-1 flex items-center justify-center">
          <RadarLoading />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Indicadores de RH</h1>
              <p className="text-orange-100 text-sm mt-1">Metricas e indicadores do quadro de colaboradores</p>
            </div>
            <button
              className="md:hidden text-white"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-green-200">
              <p className="text-sm text-gray-600">Ativos</p>
              <p className="text-2xl font-bold text-green-600">{stats.ativos || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-red-200">
              <p className="text-sm text-gray-600">Desligados</p>
              <p className="text-2xl font-bold text-red-600">{stats.desligados || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-blue-200">
              <p className="text-sm text-gray-600">Admissoes no Ano</p>
              <p className="text-2xl font-bold text-blue-600">{stats.admissoes_ano || 0}</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm p-4 border border-orange-200">
              <p className="text-sm text-gray-600">Taxa Rotatividade</p>
              <p className="text-2xl font-bold text-orange-600">{taxaRotatividade}%</p>
            </div>
          </div>

          {/* Visual Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Gender Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuicao por Genero</h3>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm text-gray-600 w-24">Masculino</span>
                <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-blue-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${percMasc}%`, minWidth: percMasc > 0 ? '2rem' : '0' }}
                  >
                    {percMasc > 10 && <span className="text-xs text-white font-medium">{percMasc}%</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 w-12 text-right">{masculino}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24">Feminino</span>
                <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-pink-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${percFem}%`, minWidth: percFem > 0 ? '2rem' : '0' }}
                  >
                    {percFem > 10 && <span className="text-xs text-white font-medium">{percFem}%</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 w-12 text-right">{feminino}</span>
              </div>
            </div>

            {/* Status Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Distribuicao por Status</h3>
              <div className="flex items-center gap-4 mb-3">
                <span className="text-sm text-gray-600 w-24">Ativos</span>
                <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${percAtivos}%`, minWidth: percAtivos > 0 ? '2rem' : '0' }}
                  >
                    {percAtivos > 10 && <span className="text-xs text-white font-medium">{percAtivos}%</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 w-12 text-right">{ativos}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm text-gray-600 w-24">Desligados</span>
                <div className="flex-1 bg-gray-200 rounded-full h-6 overflow-hidden">
                  <div
                    className="bg-red-500 h-full rounded-full flex items-center justify-end pr-2 transition-all"
                    style={{ width: `${100 - percAtivos}%`, minWidth: (100 - percAtivos) > 0 ? '2rem' : '0' }}
                  >
                    {(100 - percAtivos) > 10 && <span className="text-xs text-white font-medium">{100 - percAtivos}%</span>}
                  </div>
                </div>
                <span className="text-sm font-semibold text-gray-700 w-12 text-right">{desligados}</span>
              </div>
            </div>
          </div>

          {/* Recent Tables */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Recent Admissions */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-green-50">
                <h3 className="text-sm font-semibold text-green-800">Admissoes Recentes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {admissoesRecentes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">Nenhuma admissao recente</td>
                      </tr>
                    ) : (
                      admissoesRecentes.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{c.nome}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{c.cargo_nome || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{formatDate(c.data_admissao)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Dismissals */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-red-50">
                <h3 className="text-sm font-semibold text-red-800">Desligamentos Recentes</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nome</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Cargo</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Data</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {desligamentosRecentes.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-4 py-4 text-center text-sm text-gray-500">Nenhum desligamento recente</td>
                      </tr>
                    ) : (
                      desligamentosRecentes.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-900">{c.nome}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{c.cargo_nome || '-'}</td>
                          <td className="px-4 py-2 text-sm text-gray-600">{formatDate(c.data_desligamento)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
