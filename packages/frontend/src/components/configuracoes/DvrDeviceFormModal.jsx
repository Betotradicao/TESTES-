import { useState, useEffect } from 'react';

const codecOptions = [
  { value: 'transcode', label: 'Transcodificar (libx264) - H.265/HEVC, obrigatorio pra DVRs novos' },
  { value: 'copy', label: 'Copiar (sem transcodificar) - mais rapido, se seu DVR ja grava em H.264' }
];

const statusOptions = [
  { value: 'active', label: 'Ativo' },
  { value: 'inactive', label: 'Inativo' }
];

export default function DvrDeviceFormModal({ device, companies, onClose, onSave }) {
  const [form, setForm] = useState({
    name: '',
    codigo_loja: '',
    ip: '',
    porta_http: 80,
    porta_rtsp: 554,
    usuario: 'admin',
    senha: '',
    codec_mode: 'transcode',
    antecedencia_segundos: 15,
    tempo_depois_segundos: 120,
    is_default: false,
    status: 'active'
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (device) {
      setForm({
        name: device.name || '',
        codigo_loja: device.codigo_loja ?? '',
        ip: device.ip || '',
        porta_http: device.porta_http ?? 80,
        porta_rtsp: device.porta_rtsp ?? 554,
        usuario: device.usuario || 'admin',
        senha: '', // nunca preenche senha — usuario digita pra trocar
        codec_mode: device.codec_mode || 'transcode',
        antecedencia_segundos: device.antecedencia_segundos ?? 15,
        tempo_depois_segundos: device.tempo_depois_segundos ?? 120,
        is_default: !!device.is_default,
        status: device.status || 'active'
      });
    }
  }, [device]);

  const setField = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || form.codigo_loja === '' || !form.ip) return;
    setSubmitting(true);
    try {
      const payload = { ...form, codigo_loja: parseInt(form.codigo_loja, 10) };
      // Se senha vazia em edicao, nao envia (mantem a antiga no back)
      if (device && !payload.senha) delete payload.senha;
      await onSave(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4 rounded-t-2xl flex items-center justify-between">
          <h2 className="text-white text-xl font-bold">
            {device ? 'Editar DVR' : 'Novo DVR'}
          </h2>
          <button onClick={onClose} className="text-white hover:bg-white/20 rounded-full w-8 h-8 flex items-center justify-center text-xl">
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setField('name', e.target.value)}
                placeholder="Ex: DVR Loja 2 - Acougue"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Loja *</label>
              <select
                value={form.codigo_loja}
                onChange={e => setField('codigo_loja', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              >
                <option value="">Selecione a loja...</option>
                {companies.map(c => {
                  const codLoja = c.codLoja ?? c.cod_loja;
                  const nome = c.apelido || c.nomeFantasia || c.nome_fantasia || `Loja ${codLoja}`;
                  return (
                    <option key={codLoja} value={codLoja}>{nome} (cod {codLoja})</option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={e => setField('status', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">IP do DVR *</label>
              <input
                type="text"
                value={form.ip}
                onChange={e => setField('ip', e.target.value)}
                placeholder="Ex: 187.90.96.96 ou hea08skfqwk.sn.mynetname.net"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                required
              />
              <p className="text-xs text-gray-500 mt-1">IP fixo publico ou DDNS Mikrotik. Sem tunel SSH.</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porta HTTP (API)</label>
              <input
                type="number"
                value={form.porta_http}
                onChange={e => setField('porta_http', parseInt(e.target.value, 10) || 80)}
                placeholder="80 ou 8123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Porta RTSP (Video)</label>
              <input
                type="number"
                value={form.porta_rtsp}
                onChange={e => setField('porta_rtsp', parseInt(e.target.value, 10) || 554)}
                placeholder="554 ou 5554"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usu&aacute;rio</label>
              <input
                type="text"
                value={form.usuario}
                onChange={e => setField('usuario', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Senha {device && <span className="text-xs text-gray-400">(deixe em branco pra manter)</span>}
              </label>
              <input
                type="password"
                value={form.senha}
                onChange={e => setField('senha', e.target.value)}
                placeholder={device ? '••••••••' : 'Senha do DVR'}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Codec do v&iacute;deo</label>
              <select
                value={form.codec_mode}
                onChange={e => setField('codec_mode', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                {codecOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tempo ANTES do evento (s)</label>
              <input
                type="number"
                value={form.antecedencia_segundos}
                onChange={e => setField('antecedencia_segundos', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tempo DEPOIS do evento (s)</label>
              <input
                type="number"
                value={form.tempo_depois_segundos}
                onChange={e => setField('tempo_depois_segundos', parseInt(e.target.value, 10) || 0)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
              <input
                id="is_default"
                type="checkbox"
                checked={form.is_default}
                onChange={e => setField('is_default', e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <label htmlFor="is_default" className="text-sm text-gray-700">
                <strong>DVR principal desta loja</strong>
                <span className="block text-xs text-gray-500">Quando uma bipagem chega sem indicar DVR especifico, usa este.</span>
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
            >
              {submitting ? 'Salvando...' : (device ? 'Salvar altera&ccedil;&otilde;es' : 'Criar DVR')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
