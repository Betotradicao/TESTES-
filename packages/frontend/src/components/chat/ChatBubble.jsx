import { useState, useRef, useEffect, useCallback } from 'react';
import api from '../../utils/api';

// Ícone do Radar IA (SVG inline)
const RadarIcon = () => (
  <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="12" cy="12" r="10" className="stroke-white" />
    <circle cx="12" cy="12" r="6" className="stroke-white opacity-60" />
    <circle cx="12" cy="12" r="2" className="fill-white stroke-white" />
    <line x1="12" y1="2" x2="12" y2="12" className="stroke-white opacity-40" />
    <line x1="12" y1="12" x2="20" y2="8" className="stroke-white" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

// Formatar data
const formatDate = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

// Formatar markdown simples (negrito, bullet, headers, etc.)
const formatMarkdown = (text) => {
  if (!text) return '';
  return text
    .replace(/^### (.*$)/gm, '<h4 class="font-bold text-base mt-3 mb-1">$1</h4>')
    .replace(/^## (.*$)/gm, '<h3 class="font-bold text-lg mt-4 mb-2">$1</h3>')
    .replace(/^# (.*$)/gm, '<h2 class="font-bold text-xl mt-4 mb-2">$1</h2>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^- /gm, '• ')
    .replace(/\n/g, '<br/>');
};

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // tela grande
  const [view, setView] = useState('chat'); // 'chat' | 'history'
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [conversationTitle, setConversationTitle] = useState('Nova conversa');
  const [loading, setLoading] = useState(false);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll quando novas mensagens chegam
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Focus no input quando abrir
  useEffect(() => {
    if (isOpen && view === 'chat' && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, view]);

  // Carregar conversas
  const loadConversations = useCallback(async () => {
    setLoadingConversations(true);
    try {
      const res = await api.get('/api/ai-consultant/conversations');
      setConversations(res.data);
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    } finally {
      setLoadingConversations(false);
    }
  }, []);

  // Carregar histórico de uma conversa
  const loadConversation = useCallback(async (id) => {
    try {
      const res = await api.get(`/api/ai-consultant/conversations/${id}`);
      setConversationId(id);
      setConversationTitle(res.data.conversation.title);
      setMessages(
        res.data.messages.map((m) => ({
          role: m.role,
          content: m.content,
          time: m.created_at
        }))
      );
      setView('chat');
    } catch (err) {
      console.error('Erro ao carregar conversa:', err);
    }
  }, []);

  // Nova conversa
  const startNewConversation = useCallback(() => {
    setConversationId(null);
    setConversationTitle('Nova conversa');
    setMessages([]);
    setView('chat');
  }, []);

  // Enviar mensagem
  const sendMessage = useCallback(async () => {
    if (!message.trim() || loading) return;

    const userMessage = message.trim();
    setMessage('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage, time: new Date().toISOString() }]);
    setLoading(true);

    try {
      const res = await api.post('/api/ai-consultant/chat', {
        message: userMessage,
        conversationId
      });

      setConversationId(res.data.conversationId);
      setConversationTitle(res.data.title);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.reply, time: new Date().toISOString() }
      ]);
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Erro ao se comunicar com a IA. Verifique se a chave OpenAI está configurada.';
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ ${errorMsg}`, time: new Date().toISOString() }
      ]);
    } finally {
      setLoading(false);
    }
  }, [message, loading, conversationId]);

  // Deletar conversa
  const deleteConversation = useCallback(async (id, e) => {
    e.stopPropagation();
    if (!window.confirm('Deletar esta conversa?')) return;
    try {
      await api.delete(`/api/ai-consultant/conversations/${id}`);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (conversationId === id) {
        startNewConversation();
      }
    } catch (err) {
      console.error('Erro ao deletar conversa:', err);
    }
  }, [conversationId, startNewConversation]);

  // KeyDown no input
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Botão flutuante */}
      <button
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen && view === 'history') loadConversations();
        }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-orange-500 to-orange-600 text-white shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center"
        title="Radar IA - Consultor Inteligente"
      >
        {isOpen ? (
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <RadarIcon />
        )}
      </button>

      {/* Painel do Chat */}
      {isOpen && (
        <div className={`fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden animate-in transition-all duration-300 ${
          isExpanded
            ? 'inset-4 sm:inset-6 md:inset-10 lg:left-[10%] lg:right-[10%] lg:top-[5%] lg:bottom-[5%]'
            : 'bottom-24 right-6 w-96 h-[600px]'
        }`}>
          {/* Header */}
          <div className={`bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 ${isExpanded ? 'py-4' : 'py-3'} flex items-center justify-between shrink-0`}>
            <div className="flex items-center gap-2">
              <div className={`${isExpanded ? 'w-10 h-10' : 'w-8 h-8'} bg-white bg-opacity-20 rounded-full flex items-center justify-center`}>
                <RadarIcon />
              </div>
              <div>
                <h3 className={`font-semibold ${isExpanded ? 'text-lg' : 'text-sm'}`}>Radar IA</h3>
                <p className={`${isExpanded ? 'text-sm' : 'text-xs'} text-orange-100 truncate ${isExpanded ? 'max-w-96' : 'max-w-48'}`}>
                  {view === 'history' ? 'Histórico' : conversationTitle}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {/* Botão histórico */}
              <button
                onClick={() => {
                  if (view === 'chat') {
                    setView('history');
                    loadConversations();
                  } else {
                    setView('chat');
                  }
                }}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title={view === 'chat' ? 'Ver histórico' : 'Voltar ao chat'}
              >
                {view === 'chat' ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                )}
              </button>
              {/* Botão expandir/recolher */}
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title={isExpanded ? 'Recolher' : 'Expandir tela'}
              >
                {isExpanded ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9L4 4m0 0v4m0-4h4m6 6l5 5m0 0v-4m0 4h-4" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                )}
              </button>
              {/* Botão nova conversa */}
              <button
                onClick={startNewConversation}
                className="p-1.5 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors"
                title="Nova conversa"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
            </div>
          </div>

          {/* View: Histórico de Conversas */}
          {view === 'history' && (
            <div className="flex-1 overflow-y-auto p-3">
              {loadingConversations ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center text-gray-400 mt-10">
                  <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                  <p className="text-sm">Nenhuma conversa ainda</p>
                  <p className="text-xs mt-1">Comece uma nova conversa!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {conversations.map((conv) => (
                    <div
                      key={conv.id}
                      onClick={() => loadConversation(conv.id)}
                      className="p-3 rounded-xl border border-gray-100 hover:bg-orange-50 hover:border-orange-200 cursor-pointer transition-colors group"
                    >
                      <div className="flex justify-between items-start">
                        <p className="text-sm font-medium text-gray-700 truncate flex-1 mr-2">{conv.title}</p>
                        <button
                          onClick={(e) => deleteConversation(conv.id, e)}
                          className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity p-1"
                          title="Deletar"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">{formatDate(conv.updated_at)}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* View: Chat */}
          {view === 'chat' && (
            <>
              {/* Mensagens */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center mt-8">
                    <div className="w-16 h-16 bg-gradient-to-br from-orange-100 to-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                      <svg className="w-8 h-8 text-orange-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="6" opacity="0.5" />
                        <circle cx="12" cy="12" r="2" fill="currentColor" />
                        <line x1="12" y1="12" x2="20" y2="8" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <h4 className={`font-semibold text-gray-700 ${isExpanded ? 'text-lg' : 'text-sm'}`}>Olá! Sou o Radar IA</h4>
                    <p className={`${isExpanded ? 'text-sm' : 'text-xs'} text-gray-400 mt-1 px-6`}>
                      Seu consultor de gestão de supermercado. Pergunte sobre vendas, margens, setores, ruptura, perdas e muito mais!
                    </p>
                    <div className={`mt-4 space-y-2 px-4 ${isExpanded ? 'grid grid-cols-2 gap-3 space-y-0' : ''}`}>
                      {[
                        'Como estão as vendas este mês?',
                        'Qual setor tem melhor margem?',
                        'Quais produtos estão em ruptura?',
                        'Analise as perdas e quebras do mês',
                        ...(isExpanded ? [
                          'Faça um raio-X completo da operação',
                          'Quais operadores precisam de atenção?'
                        ] : [])
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          onClick={() => {
                            setMessage(suggestion);
                            setTimeout(() => sendMessage(), 100);
                          }}
                          className={`w-full text-left ${isExpanded ? 'text-sm px-4 py-3' : 'text-xs px-3 py-2'} rounded-lg border border-gray-200 text-gray-600 hover:bg-orange-50 hover:border-orange-300 hover:text-orange-700 transition-colors`}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`rounded-2xl px-3.5 py-2.5 ${isExpanded ? 'text-base' : 'text-sm'} ${
                        msg.role === 'user'
                          ? `${isExpanded ? 'max-w-[60%]' : 'max-w-[85%]'} bg-orange-500 text-white rounded-br-md`
                          : `${isExpanded ? 'max-w-[90%]' : 'max-w-[85%]'} bg-gray-100 text-gray-700 rounded-bl-md`
                      }`}
                    >
                      <div
                        dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }}
                        className="leading-relaxed [&>br]:mb-1"
                      />
                    </div>
                  </div>
                ))}

                {/* Indicador "digitando..." */}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-gray-100 rounded-2xl rounded-bl-md px-4 py-3">
                      <div className="flex gap-1.5">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className={`border-t border-gray-100 ${isExpanded ? 'p-4' : 'p-3'} shrink-0`}>
                <div className="flex items-end gap-2">
                  <textarea
                    ref={inputRef}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Pergunte sobre seus dados..."
                    rows={isExpanded ? 2 : 1}
                    className={`flex-1 resize-none border border-gray-200 rounded-xl px-3 py-2 ${isExpanded ? 'text-base' : 'text-sm'} focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent ${isExpanded ? 'max-h-32' : 'max-h-24'} overflow-y-auto`}
                    style={{ minHeight: isExpanded ? '52px' : '38px' }}
                    disabled={loading}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!message.trim() || loading}
                    className={`shrink-0 ${isExpanded ? 'w-11 h-11' : 'w-9 h-9'} rounded-xl bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19V5m0 0l-7 7m7-7l7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* CSS para animação */}
      <style>{`
        .animate-in {
          animation: slideUp 0.3s ease-out;
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
