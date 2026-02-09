import { useState } from 'react';
import api from '../../services/api';

export default function BarcodeInstallerTab() {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const res = await api.get('/barcode-installer/download', {
        responseType: 'blob'
      });

      // Download do ZIP
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'ScannerService-Instalador.zip');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Erro ao baixar instalador:', err);
      alert('Erro ao baixar instalador: ' + (err.response?.data?.message || err.message));
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
            <p className="text-sm text-gray-500">Baixe o pacote de instalacao do leitor de codigo de barras para as maquinas do cliente</p>
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

      {/* Botão de Download */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Baixar Instalador</h3>
        <p className="text-sm text-gray-600 mb-4">
          Clique no botao abaixo para baixar o pacote ZIP com o instalador completo.
          Apos baixar, extraia o ZIP na maquina do cliente e execute o <strong>NOVO-INSTALAR.bat</strong> como Administrador.
          O instalador visual abrira para voce configurar IP, token e nome da maquina.
        </p>
        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Baixando...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Baixar Instalador (.zip)
            </>
          )}
        </button>
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
              <p className="font-medium text-gray-900">Baixe o instalador clicando no botao verde acima</p>
              <p className="text-sm text-gray-500">Um arquivo .zip sera baixado com todos os arquivos necessarios.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">3</span>
            <div>
              <p className="font-medium text-gray-900">Extraia o ZIP e execute NOVO-INSTALAR.bat como Administrador</p>
              <p className="text-sm text-gray-500">Clique com botao direito no NOVO-INSTALAR.bat e escolha "Executar como administrador".</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">4</span>
            <div>
              <p className="font-medium text-gray-900">O instalador visual abrira - preencha as configuracoes</p>
              <p className="text-sm text-gray-500">Informe o IP/Dominio do servidor, token de autenticacao e nome da maquina na tela do instalador.</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="flex-shrink-0 w-7 h-7 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-sm font-bold">5</span>
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
          <li>Abre interface visual para configurar IP/Dominio, token e nome da maquina</li>
          <li>Permite testar conexao com o servidor antes de instalar</li>
          <li>Registra inicio automatico via Task Scheduler do Windows</li>
          <li>Usa Raw Input API para identificar multiplos scanners USB simultaneamente</li>
          <li>Envia codigos escaneados via webhook HTTPS para a aplicacao</li>
        </ul>
        <div className="mt-3 pt-3 border-t border-gray-200">
          <p><strong>Arquivos incluidos no ZIP:</strong></p>
          <p className="text-xs text-gray-500 mt-1">
            NOVO-INSTALAR.bat | INICIAR-SCANNER.bat | DESINSTALAR.bat | novo_instalador_visual.py | scanner_service.py | raw_input_handler.py | device_manager.py | requirements.txt
          </p>
        </div>
      </div>
    </div>
  );
}
