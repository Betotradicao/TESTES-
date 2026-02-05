export default function SectorsList({ sectors, onEdit, onToggle, lojas = [] }) {
  if (!sectors || sectors.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhum setor cadastrado. Clique em "Novo Setor" para começar.
      </div>
    );
  }

  // Função para obter o badge da loja
  const getLojaLabel = (codLoja) => {
    if (!codLoja) return <span className="text-gray-400">-</span>;
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
        Loja {codLoja}
      </span>
    );
  };

  // Função para obter o apelido da loja
  const getApelidoLoja = (codLoja) => {
    if (!codLoja) return <span className="text-gray-400">-</span>;
    const loja = lojas.find(l => l.COD_LOJA === codLoja);
    return loja?.APELIDO || <span className="text-gray-400">-</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg">
        <thead>
          <tr className="bg-gray-100">
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Identificador
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Nome
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Loja
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Apelido
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Ações
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {sectors.map(sector => (
            <tr key={sector.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {sector.id}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span
                  className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full text-white"
                  style={{ backgroundColor: sector.color_hash }}
                >
                  {sector.name}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm">
                {getLojaLabel(sector.cod_loja)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                {getApelidoLoja(sector.cod_loja)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                  sector.active
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}>
                  {sector.active ? 'Ativo' : 'Inativo'}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <button
                  onClick={() => onEdit(sector)}
                  className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-orange-100 text-orange-800 hover:bg-orange-200 transition mr-2"
                >
                  Editar
                </button>
                <button
                  onClick={() => onToggle(sector.id)}
                  className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full transition ${
                    sector.active
                      ? 'bg-red-100 text-red-800 hover:bg-red-200'
                      : 'bg-green-100 text-green-800 hover:bg-green-200'
                  }`}
                >
                  {sector.active ? 'Desativar' : 'Ativar'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
