import { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import { searchPOS, getLiveStreamUrl, getCupom, getCanaisConfig } from '../services/dvr-cftv.service';

const PERIODOS = [
  { value: 'hoje', label: 'Hoje' },
  { value: 'ontem', label: 'Ontem' },
  { value: 'semana', label: 'Última Semana' },
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
  if (periodo === 'hoje') {
    return { start: `${hojeStr} 00:00:00`, end: `${hojeStr} 23:59:59` };
  }
  if (periodo === 'ontem') {
    const ontem = new Date(hoje);
    ontem.setDate(ontem.getDate() - 1);
    const ontemStr = formatDate(ontem);
    return { start: `${ontemStr} 00:00:00`, end: `${ontemStr} 23:59:59` };
  }
  if (periodo === 'semana') {
    const semana = new Date(hoje);
    semana.setDate(semana.getDate() - 7);
    return { start: `${formatDate(semana)} 00:00:00`, end: `${hojeStr} 23:59:59` };
  }
  return null;
}

const formatCurrency = (v) => v == null ? '-' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function VisionPDV() {
  const [canais, setCanais] = useState([]);
  const [text, setText] = useState('');
  const [channel, setChannel] = useState(0);
  const [periodo, setPeriodo] = useState('personalizado');
  const [startDate, setStartDate] = useState(formatDate(new Date()));
  const [startTime, setStartTime] = useState('00:00');
  const [endDate, setEndDate] = useState(formatDate(new Date()));
  const [endTime, setEndTime] = useState('23:59');
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingClip, setLoadingClip] = useState(null);
  const [videoUrl, setVideoUrl] = useState(null);
  const [videoTime, setVideoTime] = useState('');
  const [error, setError] = useState('');
  const [cupomData, setCupomData] = useState(null);
  const [loadingCupom, setLoadingCupom] = useState(null);
  const [showCupom, setShowCupom] = useState(false);
  const videoRef = useRef(null);

  // Carregar canais configurados do backend
  useEffect(() => {
    getCanaisConfig()
      .then(data => {
        if (data.canais && data.canais.length > 0) {
          setCanais(data.canais.map(c => ({ value: c.channel, label: c.label })));
          setChannel(data.canalPadrao ?? data.canais[0].channel);
        }
      })
      .catch(err => console.error('Erro ao carregar canais:', err));
  }, []);

  const handleSearch = async () => {
    setError('');
    setLoading(true);
    setResults([]);
    setTotal(0);
    setVideoUrl(null);
    setCupomData(null);
    setShowCupom(false);

    try {
      let start, end;
      if (periodo === 'personalizado') {
        start = `${startDate} ${startTime}:00`;
        end = `${endDate} ${endTime}:59`;
      } else {
        const range = getDateRange(periodo);
        start = range.start;
        end = range.end;
      }

      const data = await searchPOS({ text: text.trim() || '', channel, start, end });
      setResults(data.items || []);
      setTotal(data.total || 0);

      if (!data.items?.length) {
        setError('Nenhuma transação encontrada');
      }
    } catch (err) {
      setError('Erro ao buscar: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePlayClip = async (item) => {
    setLoadingClip(item.ID);
    setVideoUrl(null);
    setVideoTime(item.Time);
    setError('');
    try {
      // Streaming direto do DVR (sem esperar gerar clipe)
      const url = getLiveStreamUrl(item.Channel, item.Time);
      setVideoUrl(url);
    } catch (err) {
      setError('Erro ao iniciar vídeo: ' + (err.response?.data?.error || err.message));
    } finally {
      setLoadingClip(null);
    }

    // Abrir cupom fiscal automaticamente junto com o vídeo
    setCupomData(null);
    setShowCupom(true);
    setLoadingCupom(item.ID);
    try {
      const data = await getCupom(item.Channel, item.Time, item.cupom);
      setCupomData(data);
    } catch (err) {
      setCupomData({ found: false, message: 'Erro ao buscar cupom' });
    } finally {
      setLoadingCupom(null);
    }
  };

  const handleShowCupom = async (item) => {
    if (loadingCupom) return;
    setLoadingCupom(item.ID);
    setCupomData(null);
    setShowCupom(true);
    try {
      const data = await getCupom(item.Channel, item.Time, item.cupom);
      setCupomData(data);
    } catch (err) {
      setCupomData({ found: false, message: 'Erro ao buscar cupom' });
    } finally {
      setLoadingCupom(null);
    }
  };

  const canalLabel = (ch) => {
    const c = canais.find(c => String(c.value) === String(ch));
    return c ? c.label.split(' - ')[0] : `Canal ${parseInt(ch) + 1}`;
  };

  return (
    <Layout>
      <div className="p-3 md:p-4">
        {/* Header compacto */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-800">Vision PDV</h1>
            <p className="text-xs text-gray-500">Busca de transações POS com vídeo do DVR</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Buscar Produto</label>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Ex: tang, cerveja, cigarro..."
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Canal</label>
              <select
                value={channel}
                onChange={(e) => setChannel(parseInt(e.target.value))}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {canais.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="w-[150px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Período</label>
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
                <div className="w-[220px]">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Início</label>
                  <div className="flex gap-1">
                    <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                    <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                  </div>
                </div>
                <div className="w-[220px]">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Fim</label>
                  <div className="flex gap-1">
                    <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                      className="flex-1 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                    <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)}
                      className="w-20 px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                  </div>
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
        </div>

        {/* Layout: Vídeo + Cupom (esquerda) | Tabela (direita) */}
        <div className="flex gap-3" style={{ height: 'calc(100vh - 180px)' }}>

          {/* Coluna esquerda: Vídeo + Cupom (sempre visível) */}
          <div className="flex flex-col gap-3" style={{ width: '480px', flexShrink: 0 }}>
            {/* Player de Vídeo */}
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
                    style={{ width: '480px', height: '360px', objectFit: 'contain' }}>
                  </video>
                ) : (
                  <div className="text-gray-500 text-sm flex flex-col items-center gap-2">
                    <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Clique em Reproduzir na tabela</span>
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
                  /* Notinha estilo cupom fiscal */
                  <div className="font-mono text-xs p-3" style={{ fontFamily: "'Courier New', monospace", backgroundColor: '#FFFDE7', color: '#5D4037' }}>
                    <div className="text-center border-b border-dashed pb-2 mb-2" style={{ borderColor: '#D4A017' }}>
                      <p className="font-bold">CUPOM FISCAL</p>
                      <p>PDV {channel + 1} - Cupom #{cupomData.cupom}</p>
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
                          <span className="truncate mr-2" style={{ maxWidth: '320px' }}>
                            {item.descricao}
                          </span>
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
              <h2 className="text-sm font-semibold text-purple-700">Transações Encontradas</h2>
              {total > 0 && (
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                  {total} resultado{total !== 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-purple-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-600 w-12">No.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-600">Horário</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-24">N° Cupom</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-16">Canal</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-20">Nota</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-24">Vídeo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.length === 0 && !loading && (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-gray-400 text-sm">
                        {total === 0 ? 'Faça uma busca para ver os resultados' : 'Nenhum resultado'}
                      </td>
                    </tr>
                  )}
                  {results.map((item, idx) => (
                    <tr key={item.ID} className={`hover:bg-purple-50 cursor-pointer transition-colors ${videoTime === item.Time ? 'bg-purple-50 border-l-2 border-purple-500' : ''}`}>
                      <td className="px-3 py-1.5 text-gray-500 text-xs">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-800 text-sm">{item.Time}</td>
                      <td className="px-3 py-1.5 text-center">
                        {item.cupom ? (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            #{item.cupom}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
                          {canalLabel(item.Channel)}
                        </span>
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          onClick={() => handleShowCupom(item)}
                          disabled={loadingCupom === item.ID}
                          className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                          title="Ver cupom fiscal"
                        >
                          {loadingCupom === item.ID ? (
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
                          onClick={() => handlePlayClip(item)}
                          disabled={loadingClip === item.ID}
                          className="px-2 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1"
                        >
                          {loadingClip === item.ID ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          )}
                          {loadingClip === item.ID ? '...' : 'Play'}
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
