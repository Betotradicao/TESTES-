import { useState, useRef, useEffect } from 'react';
import Layout from '../components/Layout';
import api, { getApiBaseUrl } from '../utils/api';
import { useLoja } from '../contexts/LojaContext';

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
  const { lojaSelecionada } = useLoja();
  const [text, setText] = useState('');
  const [barcode, setBarcode] = useState('');
  const [barcodeProduct, setBarcodeProduct] = useState('');
  const [pdvFilter, setPdvFilter] = useState('');
  const [operadorFilter, setOperadorFilter] = useState('');
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
  const [videoExpandido, setVideoExpandido] = useState(false);
  const [loadingClip, setLoadingClip] = useState(null);
  const videoRef = useRef(null);

  // Cupom
  const [cupomData, setCupomData] = useState(null);
  const [loadingCupom, setLoadingCupom] = useState(null);

  // Config cameras PDV
  const [camerasPdv, setCamerasPdv] = useState([]);



  // Carregar config cameras-pdv (filtrado por loja selecionada quando houver)
  useEffect(() => {
    const params = lojaSelecionada != null ? { codigo_loja: lojaSelecionada } : {};
    api.get('/dvr-cftv/config/cameras-pdv', { params })
      .then(res => setCamerasPdv(res.data.cameras || []))
      .catch(() => {});
  }, [lojaSelecionada]);

  // Esc fecha o modal de video expandido
  useEffect(() => {
    if (!videoExpandido) return;
    const onKey = (e) => { if (e.key === 'Escape') setVideoExpandido(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [videoExpandido]);

  const getCameraForPdv = (pdv) => {
    return camerasPdv.find(c => String(c.pdv) === String(pdv));
  };

  const handleBarcodeLookup = async (code) => {
    if (!code.trim()) { setBarcodeProduct(''); return; }
    try {
      const res = await api.get('/dvr-cftv/pos/produto-by-barcode', { params: { barcode: code.trim() } });
      if (res.data.found) {
        setBarcodeProduct(res.data.produto);
        setText(res.data.produto);
      } else {
        setBarcodeProduct('Produto nao encontrado');
      }
    } catch { setBarcodeProduct(''); }
  };

  const handleSearch = async () => {
    if (!text.trim() && !barcode.trim()) {
      setError('Digite uma palavra-chave ou codigo de barras');
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

      const params = { start, end };
      if (text.trim()) params.text = text.trim();
      if (barcode.trim()) params.barcode = barcode.trim();
      if (pdvFilter) params.pdv = pdvFilter;
      if (lojaSelecionada) params.codLoja = lojaSelecionada;

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

  const handlePlayVideo = async (item) => {
    const cam = getCameraForPdv(item.pdv);
    if (!cam) {
      setError(`Nenhuma camera configurada para o PDV ${item.pdv}. Configure em Configuracoes.`);
      return;
    }
    setVideoTime(item.time);
    setError('');
    setVideoUrl(null);

    // Atalho: clipe pre-gerado pelo cron (a cada 2h). Toca direto sem chamar ffmpeg.
    if (item.clip_status === 'ready' && item.clip_filename) {
      const baseUrl = getApiBaseUrl().replace(/\/$/, '');
      const token = localStorage.getItem('token');
      setVideoUrl(`${baseUrl}/dvr-cftv/pos/stream/${item.clip_filename}?token=${token}`);
    } else {
      setLoadingClip(item.cupomNum);
      // Usa antes/depois configurados por canal (coluna "Pal. Chave 2" em Configurações de Rede)
      const antes = cam.antes ?? 15;
      const depois = cam.depois ?? 120;
      const duracao = antes + depois;
      try {
        const res = await api.get('/dvr-cftv/pos/generate-clip', {
          params: { channel: cam.channel, time: item.time, duration: duracao },
          timeout: 180000
        });
        if (res.data?.success && res.data.filename) {
          const baseUrl = getApiBaseUrl().replace(/\/$/, '');
          const token = localStorage.getItem('token');
          setVideoUrl(`${baseUrl}/dvr-cftv/pos/stream/${res.data.filename}?token=${token}`);
        } else {
          setError('Falha ao gerar video');
        }
      } catch (e) {
        setError('Erro ao gerar clip: ' + (e?.response?.data?.error || e?.message || 'desconhecido'));
      } finally {
        setLoadingClip(null);
      }
    }

    // Buscar cupom automaticamente
    setCupomData(null);
    // show cupom panel
    setLoadingCupom(item.cupomNum);
    api.get('/dvr-cftv/pos/cupom', { params: { channel: cam.channel, time: item.time, cupomNum: item.cupomNum, pdv: item.pdv } })
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
    api.get('/dvr-cftv/pos/cupom', { params: { channel: ch, time: item.time, cupomNum: item.cupomNum, pdv: item.pdv } })
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
      <div className="p-3 md:p-4">
        {/* Header */}
        <div className="bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg shadow-lg p-4 mb-3 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Vision Palavra Chave</h1>
              <p className="text-white/80 text-sm mt-0.5">Busca por palavra-chave no ERP com video do DVR</p>
            </div>
            <div className="bg-white/20 backdrop-blur-sm rounded-full p-2 sm:p-3 flex-shrink-0">
              <svg className="w-6 h-6 sm:w-8 sm:h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
        </div>

        {lojaSelecionada == null && (
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-2xl p-6 mb-3 text-center">
            <div className="text-4xl mb-2">🏪</div>
            <h2 className="text-lg font-bold text-yellow-800 mb-1">Selecione uma loja</h2>
            <p className="text-yellow-700 text-sm">
              Esta tela depende da configuracao de cameras do DVR de cada loja.
              Escolha uma loja especifica no seletor (canto superior esquerdo) pra continuar.
            </p>
          </div>
        )}

        {lojaSelecionada != null && <>
        {/* Filtros */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 mb-3">
          {/* Linha 1: Campos de busca */}
          <div className="flex flex-wrap items-end gap-3 mb-2">
            <div className="w-[180px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Codigo de Barras</label>
              <input
                type="text"
                value={barcode}
                onChange={(e) => { setBarcode(e.target.value); if (!e.target.value.trim()) { setBarcodeProduct(''); } }}
                onKeyDown={(e) => {
                  if (e.key === 'Tab' && barcode.trim()) { e.preventDefault(); handleBarcodeLookup(barcode); }
                  if (e.key === 'Enter') handleSearch();
                }}
                placeholder="EAN do produto"
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              {barcodeProduct && (
                <p className={`text-xs mt-0.5 truncate ${barcodeProduct === 'Produto nao encontrado' ? 'text-red-500' : 'text-green-600 font-medium'}`}>
                  {barcodeProduct}
                </p>
              )}
            </div>
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
            <div className="w-[180px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Operador(a)</label>
              <select
                value={operadorFilter}
                onChange={(e) => setOperadorFilter(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                <option value="">Todos</option>
                {Array.from(new Set((results || []).map(r => r.OPERADOR || r.operador).filter(Boolean))).sort().map(op => (
                  <option key={op} value={op}>{op}</option>
                ))}
              </select>
            </div>
            <div className="w-[130px]">
              <label className="block text-xs font-semibold text-gray-600 mb-1">Periodo</label>
              <select
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              >
                {PERIODOS.map(p => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>
            {periodo === 'personalizado' && (
              <>
                <div className="w-[130px]">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Inicio</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-2 py-1.5 border border-gray-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500" />
                </div>
                <div className="w-[130px]">
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
          {/* Linha 2: Atalhos */}
          <div className="flex flex-wrap gap-1.5 items-center">
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('dinheiro'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'dinheiro' ? 'bg-green-100 border-green-400 text-green-800 ring-1 ring-green-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-green-50 hover:border-green-300 hover:text-green-700'}`}>
              💵 Dinheiro
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('cartao credito'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'cartao credito' ? 'bg-blue-100 border-blue-400 text-blue-800 ring-1 ring-blue-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700'}`}>
              💳 Credito
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('cartao debito'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'cartao debito' ? 'bg-indigo-100 border-indigo-400 text-indigo-800 ring-1 ring-indigo-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-indigo-50 hover:border-indigo-300 hover:text-indigo-700'}`}>
              💳 Debito
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('cartao pos'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'cartao pos' ? 'bg-sky-100 border-sky-400 text-sky-800 ring-1 ring-sky-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-sky-50 hover:border-sky-300 hover:text-sky-700'}`}>
              💳 Cartao POS
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('ifood'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'ifood' ? 'bg-rose-100 border-rose-400 text-rose-800 ring-1 ring-rose-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-rose-50 hover:border-rose-300 hover:text-rose-700'}`}>
              🛵 iFood
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('cartao parcelado'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'cartao parcelado' ? 'bg-violet-100 border-violet-400 text-violet-800 ring-1 ring-violet-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-violet-50 hover:border-violet-300 hover:text-violet-700'}`}>
              💳 Cred. Parcelado
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('pix'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'pix' ? 'bg-teal-100 border-teal-400 text-teal-800 ring-1 ring-teal-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-700'}`}>
              📱 PIX
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('funcionario'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'funcionario' ? 'bg-cyan-100 border-cyan-400 text-cyan-800 ring-1 ring-cyan-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-cyan-50 hover:border-cyan-300 hover:text-cyan-700'}`}>
              🤝 Funcionario
            </button>
            <span className="border-l border-gray-300 h-6 mx-1" />
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('canc. item'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'canc. item' ? 'bg-purple-100 border-purple-400 text-purple-800 ring-1 ring-purple-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-purple-50 hover:border-purple-300 hover:text-purple-700'}`}>
              🏷️ Canc. Item
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('canc. cupom'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'canc. cupom' ? 'bg-red-100 border-red-400 text-red-800 ring-1 ring-red-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-red-50 hover:border-red-300 hover:text-red-700'}`}>
              🧾 Canc. Cupom
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('canc. venda'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'canc. venda' ? 'bg-orange-100 border-orange-400 text-orange-800 ring-1 ring-orange-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700'}`}>
              🛒 Canc. Venda
            </button>
            <button onClick={() => { setBarcode(''); setBarcodeProduct(''); setText('desconto'); }}
              className={`px-2.5 py-1 rounded text-xs font-semibold border transition-all ${text === 'desconto' ? 'bg-emerald-100 border-emerald-400 text-emerald-800 ring-1 ring-emerald-300' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700'}`}>
              💰 Descontos
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
                <div className="flex items-center gap-2">
                  {videoTime && <span className="text-xs text-gray-500">{videoTime}</span>}
                  <button onClick={() => videoUrl && setVideoExpandido(true)}
                    disabled={!videoUrl}
                    className={`ml-1 px-2 py-1 rounded text-xs font-semibold flex items-center gap-1 transition ${
                      videoUrl
                        ? 'bg-purple-600 text-white hover:bg-purple-700 cursor-pointer'
                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                    }`}
                    title={videoUrl ? 'Expandir vídeo (tela grande)' : 'Carregue um vídeo para expandir'}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                    </svg>
                    Expandir
                  </button>
                </div>
              </div>
              <div className="bg-black flex items-center justify-center" style={{ height: '360px' }}>
                {loadingClip ? (
                  <div className="text-white text-sm flex flex-col items-center gap-3">
                    <svg className="animate-spin h-12 w-12 text-purple-400" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span className="font-semibold">Gerando clipe do DVR...</span>
                    <span className="text-xs text-gray-400">Aguarde, pode levar alguns segundos</span>
                  </div>
                ) : videoUrl ? (
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
                  <div className="font-mono text-sm p-3" style={{ fontFamily: "'Courier New', monospace", backgroundColor: '#FFFDE7', color: '#5D4037' }}>
                    <div className="text-center border-b border-dashed pb-2 mb-2" style={{ borderColor: '#D4A017' }}>
                      <p className="font-bold">CUPOM FISCAL</p>
                      <p>PDV {cupomData.pdv || '?'} - Cupom #{cupomData.cupom}</p>
                      <p>{cupomData.hora || videoTime}</p>
                      {cupomData.cancelado && (
                        <p className="font-bold text-red-600 mt-1">** CANCELADO **</p>
                      )}
                    </div>
                    {cupomData.operador && (
                      <div className="border-b border-dashed pb-1 mb-1 text-[12px]" style={{ borderColor: '#D4A017' }}>
                        <p>Operador: <strong>{cupomData.operador}</strong></p>
                      </div>
                    )}
                    <div className="border-b border-dashed pb-1 mb-1" style={{ borderColor: '#D4A017' }}>
                      <div className="flex justify-between font-bold">
                        <span>Produto</span>
                        <span>Total</span>
                      </div>
                    </div>
                    {cupomData.itens?.map((item, i) => {
                      const isCanc = (Number(item.total) || 0) < 0 || (Number(item.qtd) || 0) < 0;
                      const hasDesc = (Number(item.desconto) || 0) > 0;
                      const highlight = isCanc || hasDesc;
                      return (
                      <div key={i} className="py-0.5" style={highlight ? { color: '#C62828' } : {}}>
                        <div className="flex justify-between">
                          <span className="truncate mr-2" style={{ maxWidth: '320px' }}>{item.descricao}</span>
                          <span className={`whitespace-nowrap ${highlight ? 'font-bold' : 'font-semibold'}`}>{formatCurrency(item.total)}</span>
                        </div>
                        <div className="text-[12px]" style={{ color: highlight ? '#C62828' : '#8D6E63' }}>
                          {item.qtd} x {formatCurrency(item.unitario)}{hasDesc ? ` (desconto: -${formatCurrency(item.desconto)})` : ''}
                        </div>
                      </div>
                      );
                    })}
                    <div className="border-t border-dashed mt-1 pt-1" style={{ borderColor: '#D4A017' }}>
                      {cupomData.desconto > 0 && (
                        <div className="flex justify-between text-[13px]" style={{ color: '#C62828' }}>
                          <span>DESCONTO</span>
                          <span>-{formatCurrency(cupomData.desconto)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-base mt-1">
                        <span>TOTAL ({cupomData.qtdItens} itens)</span>
                        <span>{formatCurrency(cupomData.total)}</span>
                      </div>
                    </div>
                    {cupomData.itensComDesconto?.length > 0 && (
                      <div className="border-t border-dashed mt-1 pt-1" style={{ borderColor: '#D4A017' }}>
                        <p className="text-[12px] font-bold mb-0.5" style={{ color: '#C62828' }}>ITENS COM DESCONTO:</p>
                        {cupomData.itensComDesconto.map((d, i) => (
                          <div key={`desc-${i}`} className="text-[13px]" style={{ color: '#C62828' }}>
                            <div className="flex justify-between">
                              <span className="truncate mr-2" style={{ maxWidth: '260px' }}>{d.descricao}</span>
                              <span className="whitespace-nowrap font-semibold">{formatCurrency(d.totalFinal)}</span>
                            </div>
                            <div className="text-[12px]" style={{ color: '#8D6E63' }}>
                              de {formatCurrency(d.totalAntes)} por {formatCurrency(d.totalFinal)} (-{formatCurrency(d.desconto)})
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {cupomData.itensCancelados?.length > 0 && (
                      <div className="border-t border-dashed mt-1 pt-1" style={{ borderColor: '#D4A017' }}>
                        <p className="text-[12px] font-bold mb-0.5" style={{ color: '#C62828' }}>ITENS CANCELADOS:</p>
                        {cupomData.itensCancelados.map((c, i) => (
                          <div key={`canc-${i}`} className="text-[13px]" style={{ color: '#C62828' }}>
                            <div className="flex justify-between">
                              <span className="truncate mr-2" style={{ maxWidth: '260px' }}>{c.descricao}</span>
                              <span className="whitespace-nowrap font-semibold">-{formatCurrency(c.total)}</span>
                            </div>
                            <div className="text-[12px]" style={{ color: '#8D6E63' }}>
                              {c.qtd || 1} x {formatCurrency((c.total || 0) / (c.qtd || 1))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {cupomData.formaPgto && (
                      <div className="border-t border-dashed mt-1 pt-1" style={{ borderColor: '#D4A017' }}>
                        <p className="text-[12px] font-bold mb-0.5">PAGAMENTO:</p>
                        <p className="text-[12px]">{cupomData.formaPgto}</p>
                        {cupomData.troco > 0 && (
                          <p className="text-[12px]">TROCO: {formatCurrency(cupomData.troco)}</p>
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
              {total > 0 && (() => {
                const filtered = operadorFilter
                  ? results.filter(item => (item.OPERADOR || item.operador) === operadorFilter).length
                  : total;
                return (
                  <span className="text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                    {operadorFilter ? `${filtered} de ${total}` : `${total} resultado${total !== 1 ? 's' : ''}`}
                  </span>
                );
              })()}
            </div>
            <div className="overflow-auto flex-1">
              <table className="w-full text-sm">
                <thead className="bg-purple-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-600 w-12">No.</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-600">Horario</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-purple-600">Operador(a)</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-16">PDV</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-24">Cupom</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-24">Tipo</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-purple-600 w-24">Valor</th>
                    <th className="px-3 py-2 text-right text-xs font-semibold text-purple-600 w-24">Cedula</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-20">Nota</th>
                    <th className="px-3 py-2 text-center text-xs font-semibold text-purple-600 w-20">Video</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {results.length === 0 && !loading && (
                    <tr>
                      <td colSpan={10} className="px-3 py-8 text-center text-gray-400 text-sm">
                        {total === 0 ? 'Faca uma busca para ver os resultados' : 'Nenhum resultado'}
                      </td>
                    </tr>
                  )}
                  {results
                    .filter(item => !operadorFilter || (item.OPERADOR || item.operador) === operadorFilter)
                    .map((item, idx) => (
                    <tr key={`${item.cupomNum}-${item.pdv}-${idx}`}
                      onClick={() => handlePlayVideo(item)}
                      className={`hover:bg-purple-50 cursor-pointer transition-colors ${videoTime === item.time ? 'bg-purple-50 border-l-2 border-purple-500' : ''}`}>
                      <td className="px-3 py-1.5 text-gray-500 text-xs">{idx + 1}</td>
                      <td className="px-3 py-1.5 font-medium text-gray-800 text-sm">{item.time}</td>
                      <td className="px-3 py-1.5 text-sm text-gray-700 truncate max-w-[150px]" title={item.operador || '-'}>{item.operador || '-'}</td>
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
                        <span className={`text-xs px-2 py-0.5 rounded font-medium whitespace-nowrap ${tipoColor(item.tipo)}`}>{item.tipo}</span>
                      </td>
                      <td className="px-3 py-1.5 text-right text-sm font-medium">{formatCurrency(item.valor)}</td>
                      <td className="px-3 py-1.5 text-right text-sm font-semibold text-green-700">
                        {item.cedula != null ? formatCurrency(item.cedula) : <span className="text-gray-300">-</span>}
                      </td>
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
                        {(() => {
                          const isReady = item.clip_status === 'ready' && !!item.clip_filename;
                          const noCam = !getCameraForPdv(item.pdv);
                          const colorCls = isReady
                            ? 'bg-green-600 hover:bg-green-700'
                            : 'bg-purple-600 hover:bg-purple-700';
                          const titleTxt = noCam
                            ? `PDV ${item.pdv} sem camera configurada`
                            : isReady ? 'Clipe pre-carregado — toca instantaneo' : 'Reproduzir video (gera na hora)';
                          return (
                            <button
                              onClick={(e) => { e.stopPropagation(); handlePlayVideo(item); }}
                              disabled={loadingClip === item.cupomNum || noCam}
                              className={`px-2 py-1 ${colorCls} text-white text-xs rounded-lg transition-colors disabled:opacity-50 inline-flex items-center gap-1`}
                              title={titleTxt}
                            >
                              {isReady && (
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                              Play
                            </button>
                          );
                        })()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        </>}
      </div>

      {/* Modal de video expandido (tela grande) */}
      {videoExpandido && videoUrl && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
             onClick={() => setVideoExpandido(false)}>
          <div className="relative bg-white rounded-xl shadow-2xl max-w-[95vw] max-h-[95vh] flex flex-col overflow-hidden"
               onClick={(e) => e.stopPropagation()}
               style={{ width: '1280px' }}>
            {/* Header do modal */}
            <div className="bg-gradient-to-r from-purple-600 to-purple-500 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <h3 className="font-bold">Video do DVR</h3>
                {videoTime && <span className="text-sm text-white/90">— {videoTime}</span>}
              </div>
              <button onClick={() => setVideoExpandido(false)}
                className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/40 flex items-center justify-center transition"
                title="Fechar (Esc)">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Player */}
            <div className="bg-black flex items-center justify-center" style={{ height: 'calc(95vh - 56px)' }}>
              <video src={videoUrl} controls autoPlay
                className="w-full h-full"
                style={{ objectFit: 'contain' }} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
