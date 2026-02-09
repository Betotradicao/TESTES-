import { useState, useEffect } from 'react';
import api from '../../services/api';

export default function BarcodeInstallerTab() {
  const [domain, setDomain] = useState('');
  const [token, setToken] = useState('');
  const [machineName, setMachineName] = useState('CAIXA_01');
  const [loading, setLoading] = useState(false);
  const [loadingDefaults, setLoadingDefaults] = useState(true);

  // Pré-preencher domínio da URL atual e token do backend
  useEffect(() => {
    // Domínio: pegar da URL atual (sem porta)
    const currentHost = window.location.hostname;
    if (currentHost && currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      setDomain(currentHost);
    }

    // Buscar defaults do backend
    const fetchDefaults = async () => {
      try {
        const res = await api.get('/barcode-installer/defaults');
        if (res.data?.defaults) {
          if (res.data.defaults.apiToken) {
            setToken(res.data.defaults.apiToken);
          }
        }
      } catch (err) {
        console.error('Erro ao buscar defaults:', err);
      } finally {
        setLoadingDefaults(false);
      }
    };
    fetchDefaults();
  }, []);

  const handleGenerate = async () => {
    if (!domain.trim()) {
      alert('Preencha o domínio do servidor!');
      return;
    }
    if (!token.trim()) {
      alert('Preencha o token de autenticação (API_TOKEN)!');
      return;
    }
    if (!machineName.trim()) {
      alert('Preencha o nome da máquina!');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/barcode-installer/generate', {
        domain: domain.trim(),
        token: token.trim(),
        machineName: machineName.trim()
      }, {
        responseType: 'blob'
      });

      // Download do ZIP
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `ScannerService-${machineName.replace(/[^a-zA-Z0-9_-]/g, '')}.zip`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao gerar instalador:', err);
      alert('Erro ao gerar instalador: ' + (err.response?.data?.message || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-green-100 p-2 rounded-lg">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Instalador Scanner Service</h2>
            <p className="text-sm text-gray-500">Gera o pacote de instalacao do leitor de codigo de barras para as maquinas do cliente</p>
          </div>
        </div>
      </div>

      {/* Pré-requisito: Python */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div>
            <h3 className="font-semibold text-amber-800">Pre-requisito: Python 3.8+</h3>
            <p className="text-sm text-amber-700 mt-1">
              O Scanner Service precisa do Python instalado na maquina do cliente.
              Se ainda nao tem, baixe e instale antes de rodar o instalador.
            </p>
            <a
              href="https://www.python.org/downloads/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-lg hover:bg-amber-700 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Baixar Python (python.org)
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
            <p className="text-xs text-amber-600 mt-1">
              IMPORTANTE: Marque "Add Python to PATH" durante a instalacao!
            </p>
          </div>
        </div>
      </div>

      {/* Formulário */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Configuracao do Instalador</h3>

        {loadingDefaults ? (
          <div className="text-center py-4 text-gray-500">Carregando configuracoes...</div>
        ) : (
          <div className="space-y-4">
            {/* Domínio */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Dominio do Servidor
              </label>
              <input
                type="text"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                placeholder="Ex: tradicao.prevencaonoradar.com.br"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Dominio HTTPS do cliente (sem http://). O webhook sera: https://DOMINIO/api/bipagens/webhook
              </p>
            </div>

            {/* Token */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Token de Autenticacao (API_TOKEN)
              </label>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="Token do .env do backend"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                O mesmo API_TOKEN configurado no .env do backend
              </p>
            </div>

            {/* Nome da Máquina */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nome da Maquina / Caixa
              </label>
              <input
                type="text"
                value={machineName}
                onChange={(e) => setMachineName(e.target.value)}
                placeholder="Ex: CAIXA_01, CAIXA_02, BALCAO_01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                Identificador unico desta maquina (ex: CAIXA_01, CAIXA_02, BALCAO_01)
              </p>
            </div>

            {/* Botão Gerar */}
            <div className="pt-2">
              <button
                onClick={handleGenerate}
                disabled={loading || !domain || !token || !machineName}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {loading ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Gerando instalador...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Gerar e Baixar Instalador (.zip)
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Instruções */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Como instalar no cliente</h3>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">1</span>
            <div>
              <p className="font-medium text-gray-900">Instale o Python na maquina do cliente</p>
              <p className="text-sm text-gray-500">Clique no botao amarelo acima. Marque "Add Python to PATH" durante a instalacao.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">2</span>
            <div>
              <p className="font-medium text-gray-900">Preencha os campos acima e clique "Gerar e Baixar Instalador"</p>
              <p className="text-sm text-gray-500">Um arquivo .zip sera baixado com tudo pronto.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            <div>
              <p className="font-medium text-gray-900">Extraia o ZIP e execute INSTALAR.bat como Administrador</p>
              <p className="text-sm text-gray-500">Clique com botao direito no INSTALAR.bat e escolha "Executar como administrador".</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">4</span>
            <div>
              <p className="font-medium text-gray-900">Pronto! O scanner vai funcionar automaticamente</p>
              <p className="text-sm text-gray-500">Conecte o scanner USB e bipe um codigo. O servico inicia automaticamente com o Windows.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Info técnica */}
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h4 className="font-semibold text-gray-700 mb-2">O que o instalador faz:</h4>
        <ul className="list-disc list-inside space-y-1">
          <li>Instala dependencias Python (keyboard, requests, pywin32, python-dotenv)</li>
          <li>Configura o servico com o dominio, token e nome da maquina informados</li>
          <li>Registra inicio automatico via Task Scheduler do Windows</li>
          <li>Usa Raw Input API para identificar multiplos scanners USB simultaneamente</li>
          <li>Envia codigos escaneados via webhook HTTPS para a aplicacao</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p><strong>Arquivos incluidos no ZIP:</strong></p>
          <p className="text-xs text-gray-500 mt-1">
            INSTALAR.bat | INICIAR-SCANNER.bat | DESINSTALAR.bat | scanner_service.py | raw_input_handler.py | device_manager.py | requirements.txt | .env (pre-configurado)
          </p>
        </div>
      </div>
    </div>
  );
}
