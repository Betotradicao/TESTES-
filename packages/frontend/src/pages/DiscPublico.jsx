import { useState } from 'react';
import { api } from '../utils/api';
import toast from 'react-hot-toast';
import { DISC_GROUPS } from './RhMetodoDisc';

const PERFIL_COR = {
  D: { bg: 'bg-red-500', text: 'text-red-700', light: 'bg-red-50' },
  I: { bg: 'bg-yellow-400', text: 'text-yellow-800', light: 'bg-yellow-50' },
  S: { bg: 'bg-emerald-500', text: 'text-emerald-700', light: 'bg-emerald-50' },
  C: { bg: 'bg-blue-500', text: 'text-blue-700', light: 'bg-blue-50' },
};
const PERFIL_NOME = { D: 'Dominância', I: 'Influência', S: 'Estabilidade', C: 'Conformidade' };

export default function DiscPublico() {
  const [step, setStep] = useState('info'); // info | quiz | results | thanks
  const [nome, setNome] = useState('');
  const [currentGroup, setCurrentGroup] = useState(0);
  const [answers, setAnswers] = useState({});
  const [scores, setScores] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleStart = () => {
    if (!nome.trim()) { toast.error('Informe seu nome pra começar'); return; }
    setStep('quiz');
    setCurrentGroup(0);
    setAnswers({});
  };

  const handleSelect = (type, optionIndex) => {
    const groupId = DISC_GROUPS[currentGroup].id;
    const current = answers[groupId] || {};
    if (type === 'mais' && current.menos === optionIndex) return;
    if (type === 'menos' && current.mais === optionIndex) return;
    setAnswers(prev => ({ ...prev, [groupId]: { ...prev[groupId], [type]: optionIndex } }));
  };

  const currentAnswer = answers[DISC_GROUPS[currentGroup]?.id] || {};
  const canProceed = currentAnswer.mais !== undefined && currentAnswer.menos !== undefined;

  const handleNext = () => {
    if (!canProceed) { toast.error('Escolha uma palavra para MAIS e outra para MENOS'); return; }
    if (currentGroup < DISC_GROUPS.length - 1) setCurrentGroup(p => p + 1);
    else calculateAndSave();
  };

  const handlePrev = () => { if (currentGroup > 0) setCurrentGroup(p => p - 1); };

  const calculateAndSave = async () => {
    const totals = { D: 0, I: 0, S: 0, C: 0 };
    DISC_GROUPS.forEach(group => {
      const a = answers[group.id];
      if (!a) return;
      totals[group.options[a.mais].profile] += 1;
      totals[group.options[a.menos].profile] -= 1;
    });
    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const perfil_primario = sorted[0][0];
    const perfil_secundario = sorted[1][0];
    setScores({ raw: totals, perfil_primario, perfil_secundario });

    setSaving(true);
    try {
      await api.post('/rh/disc-publico/submit', {
        nome: nome.trim(),
        scores: totals,
        perfil_primario,
        perfil_secundario,
        respostas: answers,
      });
      setStep('results');
    } catch (err) {
      toast.error('Erro ao enviar. Tente novamente.');
      console.error(err);
    } finally { setSaving(false); }
  };

  const progresso = Math.round(((currentGroup + 1) / DISC_GROUPS.length) * 100);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-6 shadow">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold">Método DISC — Perfil Comportamental</h1>
          <p className="text-orange-100 mt-1">Avaliação baseada na metodologia de William Marston</p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 md:p-6">
        {/* INFO */}
        {step === 'info' && (
          <div className="bg-white rounded-xl shadow-md p-6 md:p-8">
            <div className="flex justify-center mb-4">
              <div className="bg-orange-100 rounded-full p-4">
                <svg className="w-12 h-12 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"/>
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-center text-gray-800 mb-2">Bem-vindo à Avaliação DISC</h2>
            <p className="text-center text-gray-500 mb-6">Leva em média <strong>10 a 15 minutos</strong>.</p>

            <div className="bg-gray-50 rounded-lg p-5 mb-6 text-base text-gray-700 space-y-3">
              <p><strong>O que é o DISC?</strong></p>
              <p>
                É uma ferramenta que identifica 4 dimensões principais do seu comportamento:
                <span className="text-red-600 font-bold"> Dominância (D)</span>,
                <span className="text-yellow-700 font-bold"> Influência (I)</span>,
                <span className="text-emerald-600 font-bold"> Estabilidade (S)</span> e
                <span className="text-blue-600 font-bold"> Conformidade (C)</span>.
              </p>
              <p><strong>Como funciona?</strong></p>
              <ul className="list-disc pl-5 space-y-1">
                <li>24 grupos de 4 palavras/adjetivos</li>
                <li>Em cada grupo, escolhe a palavra que <strong>MAIS</strong> te descreve</li>
                <li>E a palavra que <strong>MENOS</strong> te descreve</li>
                <li>Responda de forma espontânea, sem pensar demais</li>
                <li>Não há resposta certa ou errada — cada perfil tem pontos fortes diferentes</li>
              </ul>
            </div>

            <label className="block text-sm font-semibold text-gray-700 mb-2">Seu nome completo</label>
            <input type="text" value={nome} onChange={e => setNome(e.target.value.toUpperCase())}
              style={{ textTransform: 'uppercase' }}
              placeholder="DIGITE SEU NOME"
              className="w-full border-2 border-gray-200 rounded-lg px-4 py-3 text-base focus:border-orange-500 focus:outline-none" />

            <button onClick={handleStart}
              className="w-full mt-5 bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-lg text-lg transition">
              Iniciar Avaliação
            </button>
          </div>
        )}

        {/* QUIZ */}
        {step === 'quiz' && (
          <div className="bg-white rounded-xl shadow-md p-5 md:p-6">
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-semibold text-gray-600">Grupo {currentGroup + 1} de {DISC_GROUPS.length}</span>
                <span className="text-sm text-gray-500">{progresso}%</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 transition-all" style={{ width: `${progresso}%` }}></div>
              </div>
            </div>

            <p className="text-center text-gray-700 text-lg mb-5">
              Escolha a palavra que <span className="text-emerald-600 font-bold">MAIS</span> e a que <span className="text-red-600 font-bold">MENOS</span> te descreve:
            </p>

            <div className="space-y-3 mb-6">
              {DISC_GROUPS[currentGroup].options.map((opt, idx) => {
                const isMais = currentAnswer.mais === idx;
                const isMenos = currentAnswer.menos === idx;
                return (
                  <div key={idx} className={`flex items-center gap-3 p-3 rounded-lg border-2 ${isMais ? 'border-emerald-500 bg-emerald-50' : isMenos ? 'border-red-500 bg-red-50' : 'border-gray-200'}`}>
                    <div className="flex-1 text-base font-medium text-gray-800">{opt.text}</div>
                    <button onClick={() => handleSelect('mais', idx)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition ${isMais ? 'bg-emerald-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-emerald-100'}`}>
                      MAIS
                    </button>
                    <button onClick={() => handleSelect('menos', idx)}
                      className={`px-4 py-2 rounded-lg font-bold text-sm transition ${isMenos ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-red-100'}`}>
                      MENOS
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between gap-3">
              <button onClick={handlePrev} disabled={currentGroup === 0}
                className="px-5 py-3 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold disabled:opacity-40">
                ← Anterior
              </button>
              <button onClick={handleNext} disabled={!canProceed || saving}
                className="flex-1 px-5 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-bold disabled:opacity-40">
                {saving ? 'Enviando...' : currentGroup === DISC_GROUPS.length - 1 ? '✓ Finalizar' : 'Próximo →'}
              </button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {step === 'results' && scores && (
          <div className="bg-white rounded-xl shadow-md p-6 md:p-8 text-center">
            <div className="flex justify-center mb-4">
              <div className={`rounded-full p-5 ${PERFIL_COR[scores.perfil_primario].light}`}>
                <svg className={`w-14 h-14 ${PERFIL_COR[scores.perfil_primario].text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/>
                </svg>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-gray-800 mb-2">Obrigado, {nome}!</h2>
            <p className="text-gray-600 mb-6">Sua avaliação foi enviada com sucesso.</p>

            <div className="bg-gray-50 rounded-lg p-5 mb-5 text-left">
              <div className="text-sm text-gray-500 mb-1 uppercase font-semibold">Seu Perfil Primário</div>
              <div className={`text-3xl font-bold ${PERFIL_COR[scores.perfil_primario].text} mb-3`}>
                {scores.perfil_primario} — {PERFIL_NOME[scores.perfil_primario]}
              </div>
              <div className="text-sm text-gray-500 mb-1 uppercase font-semibold">Secundário</div>
              <div className={`text-xl font-semibold ${PERFIL_COR[scores.perfil_secundario].text}`}>
                {scores.perfil_secundario} — {PERFIL_NOME[scores.perfil_secundario]}
              </div>
            </div>

            <div className="space-y-2 mb-6">
              {['D', 'I', 'S', 'C'].map(p => {
                const val = scores.raw[p] || 0;
                const max = Math.max(...Object.values(scores.raw).map(v => Math.abs(v)), 1);
                const pct = Math.round((Math.abs(val) / max) * 100);
                return (
                  <div key={p}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-semibold">{p} · {PERFIL_NOME[p]}</span>
                      <span className="text-gray-600">{val}</span>
                    </div>
                    <div className="h-3 bg-gray-200 rounded overflow-hidden">
                      <div className={`h-full ${PERFIL_COR[p].bg}`} style={{ width: `${pct}%` }}></div>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="text-sm text-gray-500">
              O RH já recebeu seu resultado. Obrigado pelo seu tempo! 🎉
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
