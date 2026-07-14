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
/**
 * Texto que aparece em cima da seta no canvas.
 *
 * A condicao e o que amarra a opcao do menu ao bloco de destino — e o dado mais
 * importante da conexao. Mostrar so o label ("Ofertas e Promocoes") esconde
 * justamente isso, entao o numero vem primeiro e sempre.
 */
function rotuloConexao(c) {
  if (!c?.condicao) return c?.label || '⤵ automático';
  const cond = c.condicao === '*' ? 'qualquer outra' : `digitou ${c.condicao}`;
  return c.label && c.label !== c.condicao ? `${cond} · ${c.label}` : cond;
}

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
  const [fluxoMenu, setFluxoMenu] = useState(null);
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
        label: rotuloConexao(c),
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
        label: rotuloConexao(c),
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
          {fluxoMenu && <button onClick={() => setAba('menu')} className={`px-4 py-2.5 font-semibold border-b-2 transition ${aba === 'menu' ? 'border-emerald-600 text-emerald-700' : 'border-transparent text-gray-500'}`}>✏️ Menu</button>}
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
                    <button onClick={() => { setFluxoMenu(f); setAba('menu'); }} className="flex-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded">✏️ Editar Menu</button>
                    <button onClick={() => abrirEditor(f.id)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs rounded" title="Editor visual (fluxo complexo)">🎨</button>
                    <button onClick={() => setEditandoFluxo(f)} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-xs rounded" title="Configurações do fluxo">⚙️</button>
                    <button onClick={async () => { if (window.confirm(`Excluir fluxo "${f.nome}"?`)) { await api.delete(`/mkt-chatbot/fluxos/${f.id}`); carregarFluxos(); } }} className="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 text-xs rounded">🗑️</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {aba === 'menu' && fluxoMenu && (
          <EditorMenu fluxo={fluxoMenu} onVoltar={() => { setAba('fluxos'); setFluxoMenu(null); }} onFluxoSalvo={carregarFluxos} />
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
          <ModalFluxo fluxo={editandoFluxo} onClose={() => setEditandoFluxo(null)} onSave={async (data, menu) => {
            try {
              // Fluxo primeiro: um fluxo novo so ganha id aqui, e o menu precisa dele.
              let fluxoId = editandoFluxo.id;
              if (fluxoId) await api.put(`/mkt-chatbot/fluxos/${fluxoId}`, data);
              else fluxoId = (await api.post('/mkt-chatbot/fluxos', data))?.data?.fluxo?.id;

              if (fluxoId && menu) await api.put(`/mkt-chatbot/fluxos/${fluxoId}/menu`, menu);

              setEditandoFluxo(null); toast.success('Salvo!'); carregarFluxos();
            } catch (e) {
              toast.error(e?.response?.data?.error || 'Erro ao salvar');
            }
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
const TIPOS_OPCAO = [
  { v: 'mensagem',  label: '💬 Responder com um texto' },
  { v: 'pergunta',  label: '❓ Responder e esperar uma palavra' },
  { v: 'atendente', label: '🤝 Transferir pra atendente' },
  { v: 'encerrar',  label: '👋 Despedir e encerrar' },
];

const RODAPE_TIPO = {
  mensagem:  '↩️ Depois de responder, o bot volta pro menu sozinho.',
  pergunta:  '⏳ O bot espera o cliente digitar a palavra antes de continuar.',
  atendente: '🏁 Encerra a automação e passa pra um humano.',
  encerrar:  '🏁 Encerra a conversa.',
};

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
  const [salvando, setSalvando] = useState(false);

  const salvar = async () => {
    if (!form.nome.trim()) return toast.error('Dê um nome ao fluxo');
    setSalvando(true);
    await onSave(form);
    setSalvando(false);
  };

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
            <textarea value={form.mensagem_primeira_vez} onChange={e => setForm({ ...form, mensagem_primeira_vez: e.target.value })} rows={3} className="w-full px-3 py-2 border rounded-lg" />
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
          <button onClick={salvar} disabled={salvando} className="flex-1 px-4 py-2 bg-emerald-600 disabled:bg-gray-400 text-white rounded-lg font-bold">
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Editor de Menu — tela cheia.
// O canvas continua existindo pra fluxo complexo, mas o caso real do
// supermercado e um menu unico. Aqui cada opcao e uma SEQUENCIA de passos:
// responde algo, espera uma palavra, responde de novo... quantos quiser.
// Grava no MESMO grafo (blocos + conexoes), sem arrastar caixinha.
// ============================================================
const PASSO_NOVO = () => ({ tipo: 'mensagem', texto: '', palavra_chave: '' });

function EditorMenu({ fluxo, onVoltar, onFluxoSalvo }) {
  const [textoMenu, setTextoMenu] = useState('');
  const [opcoes, setOpcoes] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [carregando, setCarregando] = useState(true);
  // Saudacoes moram no fluxo, nao no grafo — mas sao a 1a coisa que o cliente le,
  // entao editar junto do menu (e nao num modal a parte) e o que faz sentido.
  const [msgPrimeira, setMsgPrimeira] = useState('');
  const [msgRecorrente, setMsgRecorrente] = useState('');
  const [intervaloMenu, setIntervaloMenu] = useState(0);

  useEffect(() => {
    if (!fluxo?.id) return;
    setMsgPrimeira(fluxo.mensagem_primeira_vez || '');
    setMsgRecorrente(fluxo.mensagem_recorrente || '');
    setIntervaloMenu(fluxo.intervalo_menu_horas ?? 0);
    setCarregando(true);
    api.get(`/mkt-chatbot/fluxos/${fluxo.id}/menu`)
      .then(r => {
        setTextoMenu(r.data?.texto_menu || '');
        setOpcoes((r.data?.opcoes || []).map(o => ({
          ...o,
          passos: o.passos?.length ? o.passos : [PASSO_NOVO()],
        })));
      })
      .catch(e => toast.error(e?.response?.data?.error || 'Não consegui carregar o menu'))
      .finally(() => setCarregando(false));
  }, [fluxo?.id]);

  const setOpcao = (i, campo, valor) =>
    setOpcoes(prev => prev.map((o, idx) => idx === i ? { ...o, [campo]: valor } : o));

  const setPasso = (i, j, campo, valor) =>
    setOpcoes(prev => prev.map((o, idx) => idx !== i ? o : {
      ...o,
      passos: o.passos.map((p, pj) => pj === j ? { ...p, [campo]: valor } : p),
    }));

  const addPasso = (i) =>
    setOpcoes(prev => prev.map((o, idx) => idx !== i ? o : { ...o, passos: [...o.passos, PASSO_NOVO()] }));

  const delPasso = (i, j) =>
    setOpcoes(prev => prev.map((o, idx) => idx !== i ? o : { ...o, passos: o.passos.filter((_, pj) => pj !== j) }));

  const addOpcao = () => setOpcoes(prev => [...prev, {
    numero: String(prev.length + 1), label: '', passos: [PASSO_NOVO()],
  }]);

  const salvar = async () => {
    if (opcoes.some(o => String(o.numero).trim() && !String(o.label).trim()))
      return toast.error('Toda opção precisa de um texto no menu');
    const nums = opcoes.map(o => String(o.numero).trim()).filter(Boolean);
    if (nums.length !== new Set(nums).size) return toast.error('Tem número de opção repetido');
    for (const o of opcoes) {
      const p = o.passos?.find(p => p.tipo === 'pergunta' && !String(p.palavra_chave || '').trim());
      if (p) return toast.error(`Em "${o.label}" tem um passo esperando o cliente digitar — diga qual palavra`);
    }

    setSalvando(true);
    try {
      // Saudacoes vao no fluxo; menu vai no grafo. Dois destinos, um botao.
      await api.put(`/mkt-chatbot/fluxos/${fluxo.id}`, {
        mensagem_primeira_vez: msgPrimeira,
        mensagem_recorrente: msgRecorrente,
        intervalo_menu_horas: Number(intervaloMenu) || 0,
      });
      await api.put(`/mkt-chatbot/fluxos/${fluxo.id}/menu`, { texto_menu: textoMenu, opcoes });
      toast.success('Salvo!');
      onFluxoSalvo?.();
    } catch (e) {
      toast.error(e?.response?.data?.error || 'Erro ao salvar');
    } finally {
      setSalvando(false);
    }
  };

  const visiveis = opcoes.filter(o => String(o.numero).trim() && String(o.label).trim());
  const exemplo = visiveis[0];

  if (carregando) return <div className="flex-1 flex items-center justify-center text-gray-400">Carregando menu...</div>;

  return (
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <h2 className="text-xl font-bold text-gray-800">📋 Menu de atendimento</h2>
            <p className="text-sm text-gray-500">{fluxo?.nome}</p>
          </div>
          <div className="flex gap-2">
            <button onClick={onVoltar} className="px-4 py-2 border rounded-lg bg-white">Voltar</button>
            <button onClick={salvar} disabled={salvando}
              className="px-6 py-2 bg-emerald-600 disabled:bg-gray-400 hover:bg-emerald-700 text-white font-bold rounded-lg">
              {salvando ? 'Salvando...' : '💾 Salvar menu'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">👋 Abertura da conversa</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600">Primeira vez que o cliente fala</label>
                  <textarea value={msgPrimeira} onChange={e => setMsgPrimeira(e.target.value)} rows={7}
                    className="w-full px-3 py-2 border rounded-lg mt-1" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600">Quando ele já conhece o bot</label>
                  <textarea value={msgRecorrente} onChange={e => setMsgRecorrente(e.target.value)} rows={7}
                    className="w-full px-3 py-2 border rounded-lg mt-1" />
                </div>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
              <label className="text-sm font-bold text-gray-700">⏱️ Só reenviar o menu depois de</label>
              <div className="flex items-center gap-2 mt-2">
                <input type="number" min="0" value={intervaloMenu}
                  onChange={e => setIntervaloMenu(e.target.value)}
                  className="w-24 px-3 py-2 border rounded-lg text-center font-bold text-lg" />
                <span className="text-sm font-bold text-gray-700">horas</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">
                {Number(intervaloMenu) > 0
                  ? <>Se o cliente escrever de novo antes de {intervaloMenu}h e não digitar uma opção válida, o bot <strong>fica calado</strong> em vez de repetir o menu. Digitar uma opção (1, 2...) funciona sempre.</>
                  : <><strong>0 = sem limite.</strong> O bot repete o menu toda vez que a mensagem não casar com uma opção — cliente mandando "oi", "bom dia", "tem pão?" leva três menus seguidos.</>}
              </p>
            </div>

            <div className="bg-white rounded-xl border p-4">
              <label className="text-sm font-bold text-gray-700">Texto do menu</label>
              <p className="text-xs text-gray-500 mb-2">As opções entram sozinhas no fim — não digite "1 - ..." na mão.</p>
              <textarea value={textoMenu} onChange={e => setTextoMenu(e.target.value)} rows={4}
                placeholder={'📋 *MENU DE ATENDIMENTO*\n\nDigite o número da opção desejada:'}
                className="w-full px-3 py-2 border rounded-lg" />
            </div>

            {opcoes.map((o, i) => (
              <div key={i} className="bg-white rounded-xl border-2 border-emerald-100 p-4">
                {/* Cabecalho da opcao */}
                <div className="flex gap-3 items-start pb-3 border-b">
                  <div className="w-20">
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">Cliente digita</label>
                    <input value={o.numero} onChange={e => setOpcao(i, 'numero', e.target.value)}
                      className="w-full px-2 py-2 border rounded-lg text-center font-bold text-lg" placeholder="1" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[11px] font-bold text-gray-500 block mb-1">Aparece no menu</label>
                    <input value={o.label} onChange={e => setOpcao(i, 'label', e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg" placeholder="Ofertas e Promoções" />
                  </div>
                  <button onClick={() => setOpcoes(opcoes.filter((_, idx) => idx !== i))}
                    className="mt-6 px-2 py-2 text-red-500 hover:bg-red-50 rounded" title="Remover opção inteira">🗑️</button>
                </div>

                {/* Sequencia de passos */}
                <div className="mt-3 space-y-3">
                  {o.passos.map((p, j) => (
                    <div key={j} className="border-l-4 border-emerald-300 bg-gray-50 rounded-r-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                          Passo {j + 1}
                        </span>
                        <select value={p.tipo} onChange={e => setPasso(i, j, 'tipo', e.target.value)}
                          className="flex-1 px-2 py-1.5 border rounded bg-white text-sm">
                          {TIPOS_OPCAO.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                        </select>
                        {o.passos.length > 1 && (
                          <button onClick={() => delPasso(i, j)}
                            className="px-2 py-1 text-red-400 hover:bg-red-50 rounded text-sm" title="Remover passo">✕</button>
                        )}
                      </div>

                      <label className="text-[11px] font-bold text-gray-500 block mb-1">
                        {p.tipo === 'atendente' ? 'Mensagem antes de passar pro atendente'
                          : p.tipo === 'encerrar' ? 'Mensagem de despedida'
                          : 'O que o bot envia'}
                      </label>
                      <textarea value={p.texto} onChange={e => setPasso(i, j, 'texto', e.target.value)} rows={3}
                        className="w-full px-3 py-2 border rounded-lg" />

                      {p.tipo === 'pergunta' && (
                        <div className="mt-2">
                          <label className="text-[11px] font-bold text-purple-800 block mb-1">
                            ⏳ ...e espera o cliente digitar
                          </label>
                          <input value={p.palavra_chave || ''} onChange={e => setPasso(i, j, 'palavra_chave', e.target.value)}
                            className="w-56 px-3 py-2 border-2 border-purple-300 rounded-lg font-bold" placeholder="salvei" />
                          <span className="text-[10px] text-gray-400 ml-2">Não diferencia maiúscula nem acento.</span>
                        </div>
                      )}

                      <p className="text-[11px] text-gray-400 mt-2">{RODAPE_TIPO[p.tipo] || ''}</p>
                    </div>
                  ))}
                </div>

                <button onClick={() => addPasso(i)}
                  className="mt-3 w-full py-2 border-2 border-dashed border-gray-300 text-gray-600 rounded-lg text-sm font-bold hover:bg-gray-50 hover:border-emerald-400 hover:text-emerald-700">
                  + Adicionar passo nesta opção
                </button>
              </div>
            ))}

            <button onClick={addOpcao}
              className="w-full py-3 border-2 border-dashed border-emerald-400 text-emerald-700 rounded-xl font-bold hover:bg-emerald-50">
              + Adicionar opção no menu
            </button>
          </div>

          {/* Previa */}
          <div>
            <div className="bg-white rounded-xl border p-4 sticky top-4">
              <h3 className="text-sm font-bold text-gray-700 mb-3">📱 Prévia no WhatsApp</h3>
              <div className="bg-[#e5ddd5] rounded-lg p-3 space-y-2 max-h-[70vh] overflow-y-auto">
                {msgPrimeira && (
                  <div className="bg-white rounded-lg p-2 text-xs whitespace-pre-wrap shadow-sm">
                    {msgPrimeira}
                  </div>
                )}
                <div className="bg-white rounded-lg p-2 text-xs whitespace-pre-wrap shadow-sm">
                  {textoMenu || <span className="text-gray-400">(texto do menu)</span>}
                  {visiveis.length > 0 && '\n\n' + visiveis.map(o => `${o.numero}️⃣ ${o.label}`).join('\n')}
                </div>

                {/* Simula a conversa da primeira opcao, passo a passo */}
                {exemplo && (
                  <div className="bg-[#dcf8c6] rounded-lg p-2 text-xs ml-8 shadow-sm">{exemplo.numero}</div>
                )}
                {exemplo?.passos?.map((p, j) => (
                  <div key={j}>
                    {p.texto && (
                      <div className="bg-white rounded-lg p-2 text-xs whitespace-pre-wrap shadow-sm mb-2">{p.texto}</div>
                    )}
                    {p.tipo === 'pergunta' && p.palavra_chave && (
                      <div className="bg-[#dcf8c6] rounded-lg p-2 text-xs ml-8 shadow-sm">{p.palavra_chave}</div>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-gray-400 mt-3">
                Conversa da opção {exemplo?.numero || '1'}, passo a passo. Verde = o cliente.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
