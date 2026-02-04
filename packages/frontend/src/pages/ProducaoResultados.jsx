import { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../services/api';
import { useLoja } from '../contexts/LojaContext';

export default function ProducaoResultados() {
  const { lojaSelecionada } = useLoja();
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadAudits();
  }, [lojaSelecionada]);

  const loadAudits = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (lojaSelecionada) params.append('codLoja', lojaSelecionada);
      const response = await api.get(`/production/audits?${params.toString()}`);
      setAudits(response.data);
    } catch (err) {
      console.error('Erro ao carregar auditorias:', err);
      setError('Erro ao carregar auditorias');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePDF = async (auditId) => {
    try {
      setError('');
      // Aqui você pode adicionar a lógica para gerar o PDF
      alert('Funcionalidade de geração de PDF será implementada');
    } catch (err) {
      console.error('Erro ao gerar PDF:', err);
      setError('Erro ao gerar PDF');
    }
  };

  const handleDelete = async (auditId) => {
    if (!window.confirm('Tem certeza que deseja excluir esta auditoria?')) {
      return;
    }

    try {
      await api.delete(`/production/audits/${auditId}`);
      await loadAudits();
    } catch (err) {
      console.error('Erro ao excluir auditoria:', err);
      setError('Erro ao excluir auditoria');
    }
  };

  const getStatusBadge = (status) => {
    if (status === 'completed') {
      return (
        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
          ✅ Concluída
        </span>
      );
    }
    return (
      <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
        🔄 Em andamento
      </span>
    );
  };

  return (
    <Layout>
      <div className="p-4 lg:p-8">
        {/* Header com Gradiente Laranja */}
        <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg shadow-lg p-6 mb-8 text-white">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl lg:text-3xl font-bold">📊 Resultados - Produção</h1>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
              </svg>
            </div>
          </div>
          <p className="text-white/90">
            Visualize histórico e relatórios de produção
          </p>
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-500">Carregando auditorias...</div>
          </div>
        ) : audits.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-8 text-center">
            <div className="text-gray-400 text-6xl mb-4">📭</div>
            <p className="text-gray-600 text-lg">Nenhuma auditoria encontrada</p>
            <p className="text-gray-500 text-sm mt-2">
              Crie sua primeira auditoria em "Sugestão Produção Padaria"
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Data
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Produtos
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Auditor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    WhatsApp
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {audits.map(audit => (
                  <tr key={audit.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {new Date(audit.audit_date).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(audit.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {audit.items?.length || 0} itens
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {audit.user?.name || audit.user?.username || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {audit.sent_whatsapp ? (
                        <span className="text-green-600">✅ Enviado</span>
                      ) : (
                        <span className="text-gray-400">Não enviado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-2">
                      {audit.pdf_url && (
                        <a
                          href={audit.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-900"
                        >
                          📄 PDF
                        </a>
                      )}
                      <button
                        onClick={() => handleGeneratePDF(audit.id)}
                        className="text-orange-600 hover:text-orange-900"
                      >
                        🔄 Gerar PDF
                      </button>
                      <button
                        onClick={() => handleDelete(audit.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        🗑️ Excluir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
