import { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import api, { getApiBaseUrl } from '../utils/api';

const PERIODOS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'semana', label: 'Ultima Semana' },
  { value: 'personalizado', label: 'Personalizado' },
];

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getDateRange(periodo) {
  const hoje = new Date();
  const hojeStr = formatDate(hoje);
  if (periodo === 'hoje') return { start: hojeStr, end: hojeStr };
  if (periodo === 'ontem') {
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    return { start: formatDate(ontem), end: formatDate(ontem) };
  }
  if (periodo === 'semana') {
    const semana = new Date(hoje);
    semana.setDate(semana.getDate() - 7);
    return { start: formatDate(semana), end: hojeStr };
  }
  return null;
}

const formatCurrency = (v) => v == null ? '-' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function getLiveStreamUrl(channel, time, antes, depois) {
  const baseUrl = getApiBaseUrl();
  const token = localStorage.getItem('token');
  const params = new URLSearchParams({ channel: String(channel), time, token });
  if (antes !== undefined) params.append('antes', String(antes));
  if (depois !== undefined) params.append('depois', String(depois));
  return `${baseUrl}/dvr-cftv/pos/live-stream?${params.toString()}`;
}

export default function VisionPalavraChave2() {
  const [text, setText] = useState('');
  const [pdvFilter, setPdvFilter] = useState('');
  const [periodo, setPeriodo] = useState('personalizado');
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Video
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoTime, setVideoTime] = useState('');
  const [loadingClip, setLoadingClip] = useState(null);
  const videoRef = useRef(null);

  // Cupom
  const [cupomData, setCupomData] = useState(null);
  const [loadingCupom, setLoadingCupom] = useState(null);

  // Config cameras PDV
  const [camerasPdv, setCamerasPdv] = useState([]);

  // Detail modal
  const [selectedItem, setSelectedItem] = useState(null);

  // Carregar config cameras-pdv
  useEffect(() => {
    api.get('/dvr-cftv/config/cameras-pdv')
      .then(res => setCamerasPdv(res.data.cameras || []))
      .catch(() => {});
  }, []);

  const getCameraForPdv = (pdv) => {
    return camerasPdv.find(c => c.pdv === pdv);
  };

  const handleSearch = async () => {
    if (!text.trim()) {
      setError('Digite uma palavra-chave para buscar');
      return;
    }
    setError('');
    setLoading(true);
    setResults([]);
    setTotal(0);
    setVideoUrl(null);
    setCupomData(null);

    try {
      let start, end;
      if (periodo === 'personalizado') {
        start = startDate;
        end = endDate;
      } else {
        const range = getDateRange(periodo);
        start = range.start;
        end = range.end;
      }

      const params = { text: text.trim(), start, end };
      if (pdvFilter) params.pdv = pdvFilter;

      const res = await api.get('/dvr-cftv/pos/search-oracle', { params, timeout: 120000 });
      setResults(res.data.items || []);
      setTotal(res.data.total || 0);

      if (!res.data.items?.length) {
        setError('Nenhuma transacao encontrada');
      }
    } catch (err) {
      setError('Erro ao buscar: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePlayVideo = (item) => {
    const cam = getCameraForPdv(item.pdv);
    if (!cam) {
      setError(`Nenhuma camera configurada para o PDV ${item.pdv}. Configure em Configuracoes.`);
      return;
    }
    setLoadingClip(item.cupomNum);
    setVideoTime(item.time);
    setError('');

    const url = getLiveStreamUrl(cam.channel, item.time, cam.antes, cam.depois);
    setVideoUrl(url);
    setLoadingClip(null);

    // Buscar cupom automaticamente
    setCupomData(null);
    // show cupom panel
    setLoadingCupom(item.cupomNum);
    api.get('/dvr-cftv/pos/cupom', { params: { channel: cam.channel, time: item.time, cupomNum: item.cupomNum } })
      .then(res => setCupomData(res.data))
      .catch(() => setCupomData({ found: false, message: 'Erro ao buscar cupom' }))
      .finally(() => setLoadingCupom(null));
  };

  const handleShowCupom = (item) => {
    if (loadingCupom) return;
    const cam = getCameraForPdv(item.pdv);
    const ch = cam ? cam.channel : 0;
    setLoadingCupom(item.cupomNum);
    setCupomData(null);
    // show cupom panel
    api.get('/dvr-cftv/pos/cupom', { params: { channel: ch, time: item.time, cupomNum: item.cupomNum } })
      .then(res => setCupomData(res.data))
      .catch(() => setCupomData({ found: false, message: 'Erro ao buscar cupom' }))
      .finally(() => setLoadingCupom(null));
  };

  const tipoColor = (tipo) => {
    if (tipo === 'CANCELAMENTO') return 'bg-red-100 text-red-700';
    if (tipo === 'DESCONTO') return 'bg-green-100 text-green-700';
    if (tipo === 'FINALIZADORA') return 'bg-blue-100 text-blue-700';
    if (tipo === 'BUSCA PRECO') return 'bg-yellow-100 text-yellow-700';
    return 'bg-purple-100 text-purple-700';
  };

  return (
    <Layout>
      {/* Modal Detalhe */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setSelectedItem(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 px-6 py-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-bold text-lg">Detalhe da Transacao</h3>
                  <p className="text-purple-200 text-sm">{selectedItem.time}</p>
                </div>
                <button onClick={() => setSelectedItem(null)} className="text-white/80 hover:text-white">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            <div className="bg-purple-50 px-6 py-4 border-b border-purple-100">
              <p className="text-xs text-purple-500 font-medium uppercase">Cupom Fiscal</p>
              <p className="text-3xl font-bold text-purple-700 mt-1">#{selectedItem.cupomNum}</p>
            </div>
            <div className="px-6 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500">PDV</span>
                  <p className="text-sm font-semibold">{selectedItem.pdv}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Valor</span>
                  <p className="text-sm font-semibold">{formatCurrency(selectedItem.valor)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <span className="text-xs text-gray-500">Tipo</span>
                  <p className={`text-xs font-semibold px-2 py-0.5 rounded inline-block mt-0.5 ${tipoColor(selectedItem.tipo)}`}>{selectedItem.tipo}</p>
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button
                  onClick={() => { handlePlayVideo(selectedItem); setSelectedItem(null); }}
                  disabled={!getCameraForPdv(selectedItem.pdv)}
                  className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                  Reproduzir Video
                </button>
                <button
                  onClick={() => { handleShowCupom(selectedItem); setSelectedItem(null); }}
                  className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg text-sm flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Ver Cupom
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-3 md:p-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg shadow-lg p-4 mb-3 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Vision Palavra Chave 2</h1>
              <p className="text-white/80 text-sm mt-0.5">Busca por palavra-chave no ERP com video do DVR</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 sm:p-3 flex-shrink-0">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Palavra-Chave</label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ex: dinheiro, cartao, cancelado, desconto, cerveja..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="w-[80px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">PDV</label>
              <input
                type="text"
                value={pdvFilter}
                onChange={(e) => setPdvFilter(e.target.value)}
                placeholder="Todos"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Periodo</label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {PERIODOS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            {periodo === 'personalizado' && (
              <>
                <div className="w-[150px]">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Inicio</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                </div>
                <div className="w-[150px]">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fim</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                </div>
              </>
            )}
            <button
              onClick={handleSearch}
              disabled={loading}
              className="px-6 py-1.5 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg text-sm transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              Buscar
            </button>
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 px-3 py-1.5 rounded-lg">{error}</div>
          )}
          {camerasPdv.length === 0 && (
            <div className="mt-2 text-sm text-amber-600 bg-amber-50 px-3 py-1.5 rounded-lg flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              Configure as cameras por PDV em Configuracoes de Rede → aba DVR CFTV (coluna "Pal. Chave 2") para habilitar o video.
            </div>
          )}
        </div>

        {/* Layout: Video + Cupom (esquerda) | Tabela (direita) */}
        <div className="flex gap-3" style={{ height: 'calc(100vh - 230px)' }}>
          {/* Coluna esquerda: Video + Cupom */}
          <div className="flex flex-col gap-3" style={{ width: '480px', flexShrink: 0 }}>
            {/* Player de Video */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="px-3 py-1.5 bg-purple-100 border-b flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {videoUrl && <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>}
                  <h2 className="text-sm font-semibold text-purple-700">Video</h2>
                </div>
                {videoTime && <span className="text-xs text-gray-500">{videoTime}</span>}
              </div>
              <div className="bg-black flex items-center justify-center" style={{ height: '360px' }}>
                {videoUrl ? (
                  <video ref={videoRef} src={videoUrl} controls autoPlay
                    style={{ width: '480px', height: '360px', objectFit: 'contain' }} />
                ) : (
                  <div className="text-gray-500 text-sm flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Clique em Play na tabela</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cupom Fiscal */}
            <div className="rounded-lg shadow-sm border border-yellow-300 overflow-hidden flex flex-col flex-1" style={{ backgroundColor: '#FFFDE7' }}>
              <div className="px-3 py-1.5 border-b border-yellow-300 flex items-center justify-between" style={{ backgroundColor: '#FFF9C4' }}>
                <h2 className="text-sm font-semibold text-yellow-800">Cupom Fiscal</h2>
              </div>
              <div className="overflow-auto flex-1 p-0">
                {loadingCupom ? (
                  <div className="flex items-center justify-center py-8">
                    <svg className="animate-spin h-6 w-6 text-yellow-600" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    <span className="ml-2 text-sm text-yellow-700">Buscando cupom...</span>
                  </div>
                ) : cupomData && cupomData.found ? (
                  <div className="font-mono text-xs p-3" style={{ fontFamily: "'Courier New', monospace", backgroundColor: '#FFFDE7', color: '#5D4037' }}>
                    <div className="text-center border-b border-dashed pb-2 mb-2" style={{ borderColor: '#D4A017' }}>
                      <p className="font-bold">CUPOM FISCAL</p>
                      <p>PDV {cupomData.pdv || '?'} - Cupom #{cupomData.cupom}</p>
                      <p>{cupomData.hora || videoTime}</p>
                      {cupomData.cancelado && (
                        <p className="font-bold text-red-600 mt-1">** CANCELADO **</p>
                      )}
                    </div>
                    {cupomData.operador && (
                      <div className="border-b border-dashed pb-1 mb-1 text-[10px]" style={{ borderColor: '#D4A017' }}>
                        <p>Operador: <strong>{cupomData.operador}</strong></p>
                      </div>
                    )}
                    <div className="border-b border-dashed pb-1 mb-1" style={{ borderColor: '#D4A017' }}>
                      <div className="flex justify-between font-bold">
                        <span>Produto</span>
                        <span>Total</span>
                      </div>
                    </div>
                    {cupomData.itens?.map((item, i) => (
                      <div key={i} className="py-0.5">
                        <div className="flex justify-between">
                          <span className="truncate mr-2" style={{ maxWidth: '320px' }}>{item.descricao}</span>
                          <span className="whitespace-nowrap font-semibold">{formatCurrency(item.total)}</span>
                        </div>
                        <div className="text-[10px]" style={{ color: '#8D6E63' }}>
                          {item.qtd} x {formatCurrency(item.unitario)}
                        </div>
                      </div>
                    ))}
                    <div className="border-t border-dashed mt-1 pt-1" style={{ borderColor: '#D4A017' }}>
                      {cupomData.desconto > 0 && (
                        <div className="flex justify-between text-[11px]" style={{ color: '#C62828' }}>
                          <span>DESCONTO</span>
                          <span>-{formatCurrency(cupomData.desconto)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-sm mt-1">
                        <span>TOTAL ({cupomData.qtdItens} itens)</span>
                        <span>{formatCurrency(cupomData.total)}</span>
                      </div>
                    </div>
                    {cupomData.formaPgto && (
                      <div className="border-t border-dashed mt-1 pt-1" style={{ borderColor: '#D4A017' }}>
                        <p className="text-[10px] font-bold mb-0.5">PAGAMENTO:</p>
                        <p className="text-[10px]">{cupomData.formaPgto}</p>
                        {cupomData.troco > 0 && (
                          <p className="text-[10px]">TROCO: {formatCurrency(cupomData.troco)}</p>
                        )}
                      </div>
                    )}
                  </div>
                ) : cupomData ? (
                  <div className="p-4 text-center text-sm" style={{ color: '#A0855B' }}>
                    Nenhum cupom encontrado neste horario
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 gap-2" style={{ color: '#C5A55A' }}>
                    <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <span className="text-sm">Clique em Nota na tabela</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tabela de Resultados */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex-1 flex flex-col">
            <div className="px-3 py-1.5 bg-purple-100 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold text-purple-700">Transacoes Encontradas</h2>
              {total > 0 && (
                <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  {total} resultado{total !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-purple-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-600 w-12">No.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-600">Horario</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-16">PDV</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-24">Cupom</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-24">Tipo</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-purple-600 w-24">Valor</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-20">Nota</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-20">Video</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.length === 0 && !loading && (
                    <tr>
                      <td colSpan={8} className="px-3 py-8 text-center text-gray-400 text-sm">
                        {total === 0 ? 'Faca uma busca para ver os resultados' : 'Nenhum resultado'}
                      </td>
                    </tr>
                  )}
                  {results.map((item, idx) => (
                    <tr key={`${item.cupomNum}-${item.pdv}-${idx}`}
                      onClick={() => setSelectedItem(item)}
                      className={`hover:bg-purple-50 cursor-pointer transition-colors ${videoTime === item.time ? 'bg-purple-50 border-l-2 border-purple-500' : ''}`}>
                      <td className="px-3 py-1.5 text-gray-500 text-xs">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-800 text-sm">{item.time}</td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-semibold">{item.pdv}</span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {item.cupomNum ? (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">#{item.cupomNum}</span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded font-medium ${tipoColor(item.tipo)}`}>{item.tipo}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-sm font-medium">{formatCurrency(item.valor)}</td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleShowCupom(item); }}
                          disabled={loadingCupom === item.cupomNum}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {loadingCupom === item.cupomNum ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          )}
                          Nota
                        </button>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          onClick={(e) => { e.stopPropagation(); handlePlayVideo(item); }}
                          disabled={loadingClip === item.cupomNum || !getCameraForPdv(item.pdv)}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                          title={!getCameraForPdv(item.pdv) ? `PDV ${item.pdv} sem camera configurada` : 'Reproduzir video'}
                        >
                          {loadingClip === item.cupomNum ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                          Play
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
