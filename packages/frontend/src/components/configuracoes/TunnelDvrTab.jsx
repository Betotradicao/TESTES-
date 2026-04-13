import { useState, useEffect } from 'react';
import api from '../../utils/api';

const DEFAULT_VPS_IP = '46.202.150.64';
const DVR_PORTS = [
  { name: 'DVR HTTP', localPort: 80, description: 'Porta HTTP do DVR (API/Web)' },
  { name: 'DVR RTSP', localPort: 554, description: 'Porta RTSP do DVR (Video)' },
  { name: 'DVR TCP', localPort: 37777, description: 'Porta TCP do DVR (Protocolo binario)' },
];

export default function TunnelDvrTab() {
  const [lojas, setLojas] = useState([]);
  const [vpsIp, setVpsIp] = useState(DEFAULT_VPS_IP);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [tunnelStatus, setTunnelStatus] = useState({});

  useEffect(() => {
    loadStatus();
  }, []);

  const loadStatus = async () => {
    try {
      const r = await api.get('/tunnel-installer/status');
      if (r.data?.tunnels) {
        const status = {};
        r.data.tunnels.forEach(t => {
          if (t.name?.includes('-DVR-')) status[t.name] = t;
        });
        setTunnelStatus(status);
      }
    } catch {}
  };

  const addLoja = () => {
    const nextNum = lojas.length + 1;
    const basePort = 28000 + (nextNum * 100); // 28100, 28200, 28300, 28400
    setLojas([...lojas, {
      id: Date.now(),
      nome: `Loja ${nextNum}`,
      dvrIp: '',
      portas: DVR_PORTS.map((p, i) => ({
        ...p,
        remotePort: basePort + i, // 28100, 28101, 28102
        enabled: i < 2 // HTTP e RTSP habilitados por padrao
      }))
    }]);
  };

  const removeLoja = (id) => {
    setLojas(lojas.filter(l => l.id !== id));
  };

  const updateLoja = (id, field, value) => {
    setLojas(lojas.map(l => l.id === id ? { ...l, [field]: value } : l));
  };

  const togglePorta = (lojaId, portIdx) => {
    setLojas(lojas.map(l => {
      if (l.id !== lojaId) return l;
      const portas = [...l.portas];
      portas[portIdx] = { ...portas[portIdx], enabled: !portas[portIdx].enabled };
      return { ...l, portas };
    }));
  };

  const updatePorta = (lojaId, portIdx, field, value) => {
    setLojas(lojas.map(l => {
      if (l.id !== lojaId) return l;
      const portas = [...l.portas];
      portas[portIdx] = { ...portas[portIdx], [field]: Number(value) || 0 };
      return { ...l, portas };
    }));
  };

  const gerarInstalador = async (loja) => {
    if (!loja.dvrIp) {
      setMessage('Preencha o IP do DVR da ' + loja.nome);
      return;
    }

    const enabledPorts = loja.portas.filter(p => p.enabled);
    if (enabledPorts.length === 0) {
      setMessage('Habilite pelo menos uma porta');
      return;
    }

    setLoading(true);
    setMessage('');

    try {
      const tunnels = enabledPorts.map(p => ({
        name: p.name,
        localIp: loja.dvrIp,
        localPort: p.localPort,
        remotePort: p.remotePort
      }));

      const clientName = loja.nome.replace(/\s+/g, '-') + '-DVR';

      const response = await api.post('/tunnel-installer/download/bat', {
        clientName,
        vpsIp,
        tunnels
      }, { responseType: 'blob' });

      // Download do arquivo
      const blob = new Blob([response.data], { type: 'application/x-bat' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `install-dvr-tunnel-${clientName.toLowerCase()}.bat`;
      a.click();
      window.URL.revokeObjectURL(url);

      setMessage(`Instalador DVR gerado para ${loja.nome}! Baixe e execute na maquina da loja.`);
    } catch (err) {
      setMessage('Erro: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-2">📹 Instalador de Túnel DVR</h2>
        <p className="text-gray-600 text-sm">Configure túneis SSH para acessar os DVRs de cada loja remotamente pela VPS</p>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 mb-2">Como funciona</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>1. Adicione cada loja com o IP do DVR na rede local</li>
            <li>2. Gere o instalador (.BAT) para cada loja</li>
            <li>3. Execute o .BAT na maquina da loja (Windows)</li>
            <li>4. O tunel conecta automaticamente o DVR a VPS</li>
          </ul>
          <p className="text-xs text-blue-600 mt-2">Cada loja gera um servico Windows separado que nao interfere nos tuneis existentes (banco de dados, etc)</p>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div>
            <label className="text-xs font-medium text-gray-600">IP da VPS</label>
            <input type="text" value={vpsIp} onChange={e => setVpsIp(e.target.value)}
              className="block mt-1 px-3 py-2 border border-gray-300 rounded-md text-sm w-48" />
          </div>
        </div>
      </div>

      {/* Lojas */}
      {lojas.map((loja, idx) => (
        <div key={loja.id} className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-400">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <span className="text-2xl">🏪</span>
              <input type="text" value={loja.nome} onChange={e => updateLoja(loja.id, 'nome', e.target.value)}
                className="text-lg font-bold text-gray-900 border-b border-gray-300 focus:border-orange-500 outline-none px-1 py-0.5"
                placeholder="Nome da loja" />
            </div>
            <button onClick={() => removeLoja(loja.id)} className="text-red-500 hover:text-red-700 text-sm">
              🗑️ Remover
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-xs font-medium text-gray-600">IP do DVR na rede local</label>
              <input type="text" value={loja.dvrIp} onChange={e => updateLoja(loja.id, 'dvrIp', e.target.value)}
                placeholder="Ex: 192.168.102.169"
                className="block mt-1 w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-orange-500 focus:border-orange-500" />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-gray-600">Portas a tunelar</label>
            {loja.portas.map((porta, pIdx) => (
              <div key={pIdx} className={`flex items-center gap-3 p-2 rounded ${porta.enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
                <input type="checkbox" checked={porta.enabled} onChange={() => togglePorta(loja.id, pIdx)}
                  className="w-4 h-4 text-orange-600 rounded" />
                <span className="text-sm font-medium w-24">{porta.name}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Local:</span>
                  <input type="number" value={porta.localPort} onChange={e => updatePorta(loja.id, pIdx, 'localPort', e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-xs" />
                </div>
                <span className="text-gray-400">→</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">VPS:</span>
                  <input type="number" value={porta.remotePort} onChange={e => updatePorta(loja.id, pIdx, 'remotePort', e.target.value)}
                    className="w-20 px-2 py-1 border border-gray-300 rounded text-xs" />
                </div>
                <span className="text-xs text-gray-400">{porta.description}</span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <button onClick={() => gerarInstalador(loja)} disabled={loading}
              className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50 text-sm font-medium">
              {loading ? '⏳ Gerando...' : '📥 Gerar Instalador .BAT'}
            </button>
          </div>
        </div>
      ))}

      {/* Botao adicionar loja */}
      <button onClick={addLoja}
        className="w-full py-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-orange-400 hover:text-orange-600 transition-colors font-medium">
        + Adicionar Loja
      </button>

      {/* Mensagem */}
      {message && (
        <div className={`p-4 rounded-lg text-sm ${message.includes('Erro') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
        </div>
      )}
    </div>
  );
}
