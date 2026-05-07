import { useEffect, useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap,
  applyNodeChanges, applyEdgeChanges, addEdge,
  Handle, Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from '../components/Sidebar';
import { api } from '../utils/api';
import toast, { Toaster } from 'react-hot-toast';

// ============================================================
// Tipos de bloco e suas paletas
// ============================================================
const TIPOS = [
  { tipo: 'mensagem', nome: 'Mensagem', emoji: '💬', cor: 'bg-blue-500', desc: 'Envia texto pro cliente' },
  { tipo: 'pergunta', nome: 'Pergunta', emoji: '❓', cor: 'bg-purple-500', desc: 'Envia + aguarda resposta' },
  { tipo: 'ia', nome: 'Agente IA', emoji: '🤖', cor: 'bg-pink-500', desc: 'IA responde com base em contexto' },
  { tipo: 'atendente', nome: 'Atendente', emoji: '🤝', cor: 'bg-amber-500', desc: 'Transfere pra humano' },
  { tipo: 'encerrar', nome: 'Encerrar', emoji: '🏁', cor: 'bg-rose-500', desc: 'Finaliza a conversa' },
];

const tipoInfo = (tipo) => TIPOS.find(t => t.tipo === tipo) || TIPOS[0];

// ============================================================
// Bloco custom no React Flow
// ============================================================
function BlocoNode({ data, selected }) {
  const info = tipoInfo(data.tipo);
  const dados = data.dados || {};
  const preview = dados.texto || dados.mensagem_transferencia || dados.mensagem_despedida || dados.prompt_sistema || '';
  const opcoes = Array.isArray(dados.opcoes) ? dados.opcoes : [];

  return (
    <div className={`min-w-[220px] max-w-[280px] bg-white border-2 ${selected ? 'border-emerald-500' : 'border-gray-300'} rounded-xl shadow-md overflow-hidden`}>
      {/* Handle de entrada (top) */}
      <Handle type="target" position={Position.Top} className="!bg-gray-400 !w-3 !h-3" />

      {/* Header */}
      <div className={`${info.cor} text-white px-3 py-2 flex items-center gap-2`}>
        <span className="text-lg">{info.emoji}</span>
        <span className="font-bold text-sm">{data.nome || info.nome}</span>
        {data.is_inicial && <span className="ml-auto text-[10px] bg-white/30 rounded px-1.5 py-0.5">▶ INÍCIO</span>}
      </div>

      {/* Body */}
      <div className="p-3">
        <div className="text-xs text-gray-700 line-clamp-3 whitespace-pre-wrap">
          {preview || <em className="text-gray-400">— sem conteúdo —</em>}
        </div>
        {opcoes.length > 0 && (
          <div className="mt-2 space-y-1">
            {opcoes.map((o, i) => (
              <div key={i} className="text-[11px] text-gray-600 bg-gray-50 rounded px-2 py-0.5">
                {o.numero}️⃣ {o.label}
              </div>
            ))}
          </div>
        )}
        {data.tipo === 'mensagem' && dados.delay_segundos != null && (
          <div className="text-[10px] text-gray-400 mt-2">⏱️ {dados.delay_segundos}s {dados.mostrar_typing && ' · ⌨️ digitando'}</div>
        )}
      </div>

      {/* Handle de saída (bottom) — exceto pra encerrar/atendente */}
      {data.tipo !== 'encerrar' && data.tipo !== 'atendente' && (
        <Handle type="source" position={Position.Bottom} className="!bg-emerald-500 !w-3 !h-3" />
      )}
    </div>
  );
}

const nodeTypes = { bloco: BlocoNode };

// ============================================================
// Componente principal
// ============================================================
export default function MarketingChatbot() {
  const { user, logout } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [aba, setAba] = useState('fluxos'); // 'fluxos' | 'editor' | 'conversas'

  const [fluxos, setFluxos] = useState([]);
  const [fluxoAtual, setFluxoAtual] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [editandoFluxo, setEditandoFluxo] = useState(null);
  const [blocoSelecionado, setBlocoSelecionado] = useState(null);

  const [conversas, setConversas] = useState([]);
  const [sessaoSelecionada, setSessaoSelecionada] = useState(null);
  const [mensagens, setMensagens] = useState([]);

  const carregarFluxos = useCallback(async () => {
    try {
      const r = await api.get('/mkt-chatbot/fluxos');
      setFluxos(r.data?.fluxos || []);
    } catch { toast.error('Erro ao carregar fluxos'); }
  }, []);

  const abrirEditor = useCallback(async (fluxoId) => {
    try {
      const r = await api.get(`/mkt-chatbot/fluxos/${fluxoId}`);
      const blocos = r.data?.blocos || [];
      const conexoes = r.data?.conexoes || [];
      setFluxoAtual(r.data?.fluxo);
      setNodes(blocos.map(b => ({
        id: String(b.id),
        type: 'bloco',
        position: { x: b.posicao_x || 0, y: b.posicao_y || 0 },
        data: { ...b },
      })));
      setEdges(conexoes.map(c => ({
        id: String(c.id),
        source: String(c.origem_id),
        target: String(c.destino_id),
        label: c.label || c.condicao || '',
        type: 'default',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2 },
        labelStyle: { fontSize: 11, fontWeight: 600 },
        data: { condicao: c.condicao, conexao_id: c.id },
      })));
      setAba('editor');
    } catch { toast.error('Erro ao abrir fluxo'); }
  }, []);

  const carregarConversas = useCallback(async () => {
    try {
      const r = await api.get('/mkt-chatbot/conversas');
      setConversas(r.data?.sessoes || []);
    } catch { /* silencioso */ }
  }, []);

  useEffect(() => { carregarFluxos(); }, [carregarFluxos]);
  useEffect(() => {
    if (aba === 'conversas') {
      carregarConversas();
      const t = setInterval(carregarConversas, 10000);
      return () => clearInterval(t);
    }
  }, [aba, carregarConversas]);

  const onNodesChange = useCallback((changes) => setNodes(nds => applyNodeChanges(changes, nds)), []);
  const onEdgesChange = useCallback((changes) => setEdges(eds => applyEdgeChanges(changes, eds)), []);

  const onConnect = useCallback(async (params) => {
    const condicao = window.prompt('Condição da conexão (ex: "1", "2", "0", "*" = qualquer):', '');
    if (condicao === null) return;
    try {
      const r = await api.post('/mkt-chatbot/conexoes', {
        fluxo_id: fluxoAtual.id,
        origem_id: parseInt(params.source),
        destino_id: parseInt(params.target),
        condicao: condicao || null,
        label: condicao || null,
      });
      const c = r.data.conexao;
      setEdges(eds => addEdge({
        ...params,
        id: String(c.id),
        label: c.label || '',
        type: 'default',
        animated: true,
        style: { stroke: '#10b981', strokeWidth: 2 },
        labelStyle: { fontSize: 11, fontWeight: 600 },
        data: { condicao: c.condicao, conexao_id: c.id },
      }, eds));
    } catch { toast.error('Erro ao conectar'); }
  }, [fluxoAtual]);

  const onNodeDragStop = useCallback(async (_e, node) => {
    try {
      await api.put(`/mkt-chatbot/blocos/${node.id}`, {
        posicao_x: Math.round(node.position.x),
        posicao_y: Math.round(node.position.y),
      });
    } catch { /* silencioso */ }
  }, []);

  const onNodeClick = useCallback((_e, node) => {
    setBlocoSelecionado(node);
  }, []);

  const onEdgeClick = useCallback(async (e, edge) => {
    e.stopPropagation();
    if (!window.confirm(`Excluir conexão "${edge.label || 'sem label'}"?`)) return;
    try {
      await api.delete(`/mkt-chatbot/conexoes/${edge.data?.conexao_id || edge.id}`);
      setEdges(eds => eds.filter(x => x.id !== edge.id));
    } catch { toast.error('Erro ao excluir'); }
  }, []);

  const adicionarBloco = async (tipo) => {
    if (!fluxoAtual) return;
    const dados = tipo === 'mensagem' ? { texto: 'Nova mensagem', delay_segundos: 1, mostrar_typing: true }
      : tipo === 'pergunta' ? { texto: 'Nova pergunta?', delay_segundos: 1, mostrar_typing: true, opcoes: [{ numero: '1', label: 'Opção 1' }] }
      : tipo === 'ia' ? { prompt_sistema: 'Você é um atendente cordial do supermercado.', persona: '', modelo: 'gpt-4o-mini', temperatura: 0.7 }
      : tipo === 'atendente' ? { mensagem_transferencia: 'Aguarde, vou transferir pra um atendente.' }
      : { mensagem_despedida: 'Obrigado pelo contato! 👋' };
    try {
      const r = await api.post('/mkt-chatbot/blocos', {
        fluxo_id: fluxoAtual.id, tipo, dados,
        posicao_x: 200, posicao_y: 200,
        is_inicial: nodes.length === 0,
      });
      const b = r.data.bloco;
      setNodes(nds => [...nds, {
        id: String(b.id), type: 'bloco',
        position: { x: b.posicao_x, y: b.posicao_y },
        data: { ...b },
      }]);
    } catch { toast.error('Erro ao criar bloco'); }
  };

  const salvarBloco = async (data) => {
    try {
      await api.put(`/mkt-chatbot/blocos/${blocoSelecionado.id}`, {
        nome: data.nome, dados: data.dados, is_inicial: data.is_inicial,
      });
      setNodes(nds => nds.map(n => n.id === blocoSelecionado.id ? { ...n, data: { ...n.data, ...data } } : n));
      setBlocoSelecionado(null);
      toast.success('Salvo!');
    } catch { toast.error('Erro ao salvar'); }
  };

  const excluirBloco = async () => {
    if (!blocoSelecionado) return;
    if (!window.confirm('Excluir esse bloco? Conexões serão removidas.')) return;
    try {
      await api.delete(`/mkt-chatbot/blocos/${blocoSelecionado.id}`);
      setNodes(nds => nds.filter(n => n.id !== blocoSelecionado.id));
      setEdges(eds => eds.filter(e => e.source !== blocoSelecionado.id && e.target !== blocoSelecionado.id));
      setBlocoSelecionado(null);
    } catch { toast.error('Erro'); }
  };

  const carregarExemplos = async () => {
    if (!window.confirm('Isso vai criar o fluxo de exemplo "Atendimento Geral - Supermercado Tradição" com Ofertas, Horário, Currículos, Endereço e Atendente.\n\nFluxos ativos atuais serão desativados.')) return;
    try {
      await api.post('/mkt-chatbot/fluxos/seed-exemplos');
      toast.success('Fluxos de exemplo criados!');
      carregarFluxos();
    } catch { toast.error('Erro ao carregar exemplos'); }
  };

  return (
    <div className="flex h-screen bg-gray-100">
      <Toaster position="top-right" />
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} user={user} logout={logout} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="bg-gradient-to-r from-green-600 to-emerald-500 text-white px-6 py-3 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">💬 Chatbot WhatsApp</h1>
            <p className="text-xs text-white/80">Construtor visual de fluxos automatizados</p>
          </div>
          {aba === 'editor' && fluxoAtual && (
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold">{fluxoAtual.nome}</span>
              <button onClick={() => { setAba('fluxos'); setFluxoAtual(null); }} className="text-xs bg-white/20 hover:bg-white/30 px-3 py-1 rounded">← Voltar</button>
            </div>
          )}
        </div>

        <div className="border-b bg-white px-6 flex">
          <button onClick={() => { setAba('fluxos'); setFluxoAtual(null); }} className={`px-4 py-2.5 font-semibold border-b-2 transition ${aba === 'fluxos' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500'}`}>📋 Fluxos</button>
          {fluxoAtual && <button onClick={() => setAba('editor')} className={`px-4 py-2.5 font-semibold border-b-2 transition ${aba === 'editor' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500'}`}>🎨 Editor Visual</button>}
          <button onClick={() => setAba('conversas')} className={`px-4 py-2.5 font-semibold border-b-2 transition ${aba === 'conversas' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500'}`}>💬 Conversas</button>
        </div>

        {aba === 'fluxos' && (
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-2">
              <h2 className="text-xl font-bold text-gray-800">Fluxos cadastrados</h2>
              <div className="flex gap-2">
                <button onClick={carregarExemplos} className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg">🌟 Carregar Exemplo Pronto</button>
                <button onClick={() => setEditandoFluxo({})} className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg">+ Novo Fluxo</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {fluxos.length === 0 && (
                <div className="col-span-full text-center text-gray-400 py-12 bg-white rounded-lg border-2 border-dashed">
                  Nenhum fluxo. Clique em "🌟 Carregar Exemplo Pronto" pra começar.
                </div>
              )}
              {fluxos.map(f => (
                <div key={f.id} className={`bg-white rounded-lg border-2 p-4 ${f.ativo ? 'border-emerald-200' : 'border-gray-200 opacity-60'}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold text-gray-800">{f.nome}</h3>
                    {f.ativo
                      ? <span className="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full font-bold">ATIVO</span>
                      : <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-bold">INATIVO</span>}
                  </div>
                  {f.descricao && <p className="text-xs text-gray-500 mb-2">{f.descricao}</p>}
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => abrirEditor(f.id)} className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded">🎨 Editar Visual</button>
                    <button onClick={() => setEditandoFluxo(f)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs rounded">⚙️</button>
                    <button onClick={async () => { if (window.confirm(`Excluir fluxo "${f.nome}"?`)) { await api.delete(`/mkt-chatbot/fluxos/${f.id}`); carregarFluxos(); } }} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs rounded">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === 'editor' && fluxoAtual && (
          <div className="flex-1 flex overflow-hidden">
            {/* Paleta lateral */}
            <div className="w-56 bg-white border-r p-3 overflow-y-auto">
              <h3 className="text-xs font-bold text-gray-600 uppercase mb-2">Adicionar bloco</h3>
              {TIPOS.map(t => (
                <button key={t.tipo} onClick={() => adicionarBloco(t.tipo)}
                  className="w-full mb-2 p-2 bg-white border-2 border-gray-200 hover:border-emerald-400 rounded-lg text-left">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{t.emoji}</span>
                    <span className="font-bold text-sm">{t.nome}</span>
                  </div>
                  <p className="text-[10px] text-gray-500">{t.desc}</p>
                </button>
              ))}
              <div className="mt-4 pt-4 border-t text-[10px] text-gray-400">
                💡 Arraste blocos pelo canvas. Conecte arrastando do círculo verde (saída) pro cinza (entrada).
              </div>
            </div>

            {/* Canvas React Flow */}
            <div className="flex-1 relative">
              <ReactFlow
                nodes={nodes} edges={edges}
                onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onNodeDragStop={onNodeDragStop}
                onNodeClick={onNodeClick}
                onEdgeClick={onEdgeClick}
                nodeTypes={nodeTypes}
                fitView
              >
                <Background color="#e5e7eb" gap={16} />
                <Controls />
                <MiniMap nodeColor={n => tipoInfo(n.data?.tipo).cor.replace('bg-', '#').replace('-500', '')} />
              </ReactFlow>
            </div>

            {/* Painel de edição */}
            {blocoSelecionado && (
              <PainelBloco bloco={blocoSelecionado} onClose={() => setBlocoSelecionado(null)} onSave={salvarBloco} onExcluir={excluirBloco} />
            )}
          </div>
        )}

        {aba === 'conversas' && (
          <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 gap-4 p-6">
            <div className="md:col-span-1 bg-white rounded-lg border max-h-[80vh] overflow-y-auto">
              <div className="p-3 border-b font-bold text-gray-700">Conversas</div>
              {conversas.length === 0 && <div className="p-6 text-center text-gray-400 text-sm">Nenhuma conversa ainda</div>}
              {conversas.map(s => (
                <button key={s.id} onClick={() => { setSessaoSelecionada(s); api.get(`/mkt-chatbot/sessoes/${s.id}/mensagens`).then(r => setMensagens(r.data?.mensagens || [])); }}
                  className={`w-full text-left p-3 border-b hover:bg-gray-50 ${sessaoSelecionada?.id === s.id ? 'bg-emerald-50' : ''}`}>
                  <div className="font-semibold text-gray-800">{s.contato?.nome_whatsapp || s.contato?.telefone}</div>
                  <div className="text-xs text-gray-500">{s.contato?.telefone}</div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {new Date(s.ultima_atividade_at).toLocaleString('pt-BR')} · <span className={`px-1.5 py-0.5 rounded ${s.status === 'ativa' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>{s.status}</span>
                  </div>
                </button>
              ))}
            </div>
            <div className="md:col-span-2 bg-white rounded-lg border max-h-[80vh] overflow-y-auto p-4">
              {!sessaoSelecionada
                ? <div className="text-center text-gray-400 py-12">Selecione uma conversa</div>
                : <div className="space-y-2">
                    {mensagens.map(m => (
                      <div key={m.id} className={`flex ${m.direcao === 'enviada' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${m.direcao === 'enviada' ? 'bg-emerald-100' : 'bg-gray-100'}`}>
                          <div className="whitespace-pre-wrap">{m.conteudo}</div>
                          <div className="text-[10px] text-gray-500 mt-1">{new Date(m.created_at).toLocaleTimeString('pt-BR')}</div>
                        </div>
                      </div>
                    ))}
                  </div>}
            </div>
          </div>
        )}

        {editandoFluxo && (
          <ModalFluxo fluxo={editandoFluxo} onClose={() => setEditandoFluxo(null)} onSave={async (data) => {
            try {
              if (editandoFluxo.id) await api.put(`/mkt-chatbot/fluxos/${editandoFluxo.id}`, data);
              else await api.post('/mkt-chatbot/fluxos', data);
              setEditandoFluxo(null); toast.success('Salvo!'); carregarFluxos();
            } catch { toast.error('Erro'); }
          }} />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Painel lateral de edição do bloco
// ============================================================
function PainelBloco({ bloco, onClose, onSave, onExcluir }) {
  const [dados, setDados] = useState(bloco.data?.dados || {});
  const [nome, setNome] = useState(bloco.data?.nome || '');
  const [isInicial, setIsInicial] = useState(bloco.data?.is_inicial || false);
  const tipo = bloco.data?.tipo;
  const info = tipoInfo(tipo);

  const salvar = () => onSave({ nome, dados, is_inicial: isInicial });

  return (
    <div className="w-80 bg-white border-l shadow-2xl overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{info.emoji}</span>
          <h3 className="font-bold text-gray-800">{info.nome}</h3>
        </div>
        <button onClick={onClose} className="text-gray-500 hover:text-gray-700">✕</button>
      </div>
      <p className="text-xs text-gray-500 mb-3">{info.desc}</p>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-bold text-gray-600">Nome (interno)</label>
          <input value={nome} onChange={e => setNome(e.target.value)} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="Ex: Menu Principal" />
        </div>

        {(tipo === 'mensagem' || tipo === 'pergunta') && (
          <>
            <div>
              <label className="text-xs font-bold text-gray-600">Texto da mensagem</label>
              <textarea value={dados.texto || ''} onChange={e => setDados({ ...dados, texto: e.target.value })}
                rows={5} className="w-full px-2 py-1.5 text-sm border rounded font-mono" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-600">Delay (s)</label>
                <input type="number" value={dados.delay_segundos ?? 1} onChange={e => setDados({ ...dados, delay_segundos: parseInt(e.target.value) || 0 })} className="w-full px-2 py-1.5 text-sm border rounded" />
              </div>
              <label className="flex items-end gap-2 text-xs">
                <input type="checkbox" checked={dados.mostrar_typing !== false} onChange={e => setDados({ ...dados, mostrar_typing: e.target.checked })} />
                ⌨️ Digitando
              </label>
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">Link (opcional)</label>
              <input value={dados.link_url || ''} onChange={e => setDados({ ...dados, link_url: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="https://..." />
            </div>
          </>
        )}

        {tipo === 'pergunta' && (
          <div>
            <label className="text-xs font-bold text-gray-600">Opções (números do menu)</label>
            <div className="space-y-1 mt-1">
              {(dados.opcoes || []).map((o, i) => (
                <div key={i} className="flex gap-1">
                  <input value={o.numero} onChange={e => { const ops = [...(dados.opcoes || [])]; ops[i] = { ...o, numero: e.target.value }; setDados({ ...dados, opcoes: ops }); }} className="w-12 px-2 py-1 text-sm border rounded" />
                  <input value={o.label} onChange={e => { const ops = [...(dados.opcoes || [])]; ops[i] = { ...o, label: e.target.value }; setDados({ ...dados, opcoes: ops }); }} className="flex-1 px-2 py-1 text-sm border rounded" />
                  <button onClick={() => { const ops = (dados.opcoes || []).filter((_, j) => j !== i); setDados({ ...dados, opcoes: ops }); }} className="text-red-500 px-1">×</button>
                </div>
              ))}
              <button onClick={() => setDados({ ...dados, opcoes: [...(dados.opcoes || []), { numero: String((dados.opcoes || []).length + 1), label: '' }] })} className="text-xs text-emerald-600 font-bold">+ Adicionar opção</button>
            </div>
          </div>
        )}

        {tipo === 'ia' && (
          <>
            <div>
              <label className="text-xs font-bold text-gray-600">Prompt do sistema (instruções)</label>
              <textarea value={dados.prompt_sistema || ''} onChange={e => setDados({ ...dados, prompt_sistema: e.target.value })}
                rows={4} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="Você é um atendente cordial do supermercado..." />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600">Persona (opcional)</label>
              <input value={dados.persona || ''} onChange={e => setDados({ ...dados, persona: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded" placeholder="Ex: Helen, atendente da Tradição" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-bold text-gray-600">Modelo</label>
                <select value={dados.modelo || 'gpt-4o-mini'} onChange={e => setDados({ ...dados, modelo: e.target.value })} className="w-full px-2 py-1.5 text-sm border rounded">
                  <option value="gpt-4o-mini">GPT-4o-mini (rápido/barato)</option>
                  <option value="gpt-4o">GPT-4o (premium)</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-bold text-gray-600">Temperatura</label>
                <input type="number" step="0.1" min="0" max="2" value={dados.temperatura ?? 0.7} onChange={e => setDados({ ...dados, temperatura: parseFloat(e.target.value) })} className="w-full px-2 py-1.5 text-sm border rounded" />
              </div>
            </div>
          </>
        )}

        {tipo === 'atendente' && (
          <div>
            <label className="text-xs font-bold text-gray-600">Mensagem ao transferir</label>
            <textarea value={dados.mensagem_transferencia || ''} onChange={e => setDados({ ...dados, mensagem_transferencia: e.target.value })} rows={3} className="w-full px-2 py-1.5 text-sm border rounded" />
          </div>
        )}

        {tipo === 'encerrar' && (
          <div>
            <label className="text-xs font-bold text-gray-600">Mensagem de despedida</label>
            <textarea value={dados.mensagem_despedida || ''} onChange={e => setDados({ ...dados, mensagem_despedida: e.target.value })} rows={3} className="w-full px-2 py-1.5 text-sm border rounded" />
          </div>
        )}

        <label className="flex items-center gap-2 text-sm pt-2 border-t">
          <input type="checkbox" checked={isInicial} onChange={e => setIsInicial(e.target.checked)} />
          ▶ Bloco inicial (1ª mensagem do fluxo)
        </label>
      </div>

      <div className="flex gap-2 mt-4 pt-4 border-t">
        <button onClick={onExcluir} className="px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded">🗑️ Excluir</button>
        <div className="flex-1"></div>
        <button onClick={onClose} className="px-3 py-2 text-xs border rounded">Cancelar</button>
        <button onClick={salvar} className="px-4 py-2 text-xs bg-emerald-600 text-white font-bold rounded">Salvar</button>
      </div>
    </div>
  );
}

// ============================================================
// Modal de Fluxo (config geral)
// ============================================================
function ModalFluxo({ fluxo, onClose, onSave }) {
  const [form, setForm] = useState({
    nome: fluxo?.nome || '',
    descricao: fluxo?.descricao || '',
    ativo: fluxo?.ativo !== false,
    instance_name: fluxo?.instance_name || '',
    mensagem_primeira_vez: fluxo?.mensagem_primeira_vez || '',
    mensagem_recorrente: fluxo?.mensagem_recorrente || '',
    timeout_inatividade_min: fluxo?.timeout_inatividade_min || 1440,
  });
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-bold text-gray-800 mb-4">{fluxo?.id ? 'Editar Fluxo' : 'Novo Fluxo'}</h3>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-bold text-gray-600">Nome do fluxo *</label>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600">Descrição</label>
            <textarea value={form.descricao} onChange={e => setForm({ ...form, descricao: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600">Instância Evolution (vazio = usa Disparo)</label>
            <input value={form.instance_name} onChange={e => setForm({ ...form, instance_name: e.target.value })} className="w-full px-3 py-2 border rounded-lg" placeholder="MARKETING" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600">Mensagem de boas-vindas (1ª vez)</label>
            <textarea value={form.mensagem_primeira_vez} onChange={e => setForm({ ...form, mensagem_primeira_vez: e.target.value })} rows={4} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600">Mensagem recorrente</label>
            <textarea value={form.mensagem_recorrente} onChange={e => setForm({ ...form, mensagem_recorrente: e.target.value })} rows={2} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <div>
            <label className="text-xs font-bold text-gray-600">Timeout (min de inatividade)</label>
            <input type="number" value={form.timeout_inatividade_min} onChange={e => setForm({ ...form, timeout_inatividade_min: parseInt(e.target.value) || 1440 })} className="w-full px-3 py-2 border rounded-lg" />
          </div>
          <label className="flex items-center gap-2"><input type="checkbox" checked={form.ativo} onChange={e => setForm({ ...form, ativo: e.target.checked })} /><span className="text-sm">Ativo</span></label>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg">Cancelar</button>
          <button onClick={() => onSave(form)} className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold">Salvar</button>
        </div>
      </div>
    </div>
  );
}
