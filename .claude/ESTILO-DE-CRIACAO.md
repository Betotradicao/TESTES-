# ESTILO DE CRIACAO - RADAR 360
## Padrão de Criação de Novas Funcionalidades

> Este documento define as regras obrigatórias para criação de qualquer nova tela ou funcionalidade no sistema RADAR 360.
> Todo desenvolvedor (humano ou IA) DEVE seguir estas diretrizes.

---

## 1. HEADER DA TELA (Banner Superior)

Toda nova tela DEVE ter um header com:
- **Gradiente laranja**: `bg-gradient-to-r from-orange-600 to-orange-500`
- **Texto branco**: título em `text-2xl font-bold` com emoji relevante
- **Subtítulo**: `text-orange-100 text-sm` com descrição da funcionalidade

```jsx
<div className="bg-gradient-to-r from-orange-600 to-orange-500 text-white px-6 py-4">
  <div className="flex items-center justify-between">
    <div>
      <h1 className="text-2xl font-bold">TITULO DA TELA</h1>
      <p className="text-orange-100 text-sm">Descrição da funcionalidade</p>
    </div>
  </div>
</div>
```

---

## 2. TABELAS - Colunas

### 2.1 Header das Colunas
- **Cor de fundo**: `bg-gray-600` (cinza escuro padrão)
- **Texto**: `text-xs font-medium text-white uppercase tracking-wider`
- **Emojis**: Cada coluna DEVE ter um emoji no header
- **Whitespace**: `whitespace-nowrap` para não quebrar linha

### 2.2 Drag & Drop (Arrastar Colunas)
Toda tabela DEVE permitir reordenar colunas por drag & drop:
- Cada `<th>` deve ter `draggable`
- Salvar ordem no `localStorage` com chave única da tela (ex: `entradas_saidas_columns_order`)
- Ao entrar e sair da tela, a ordem DEVE permanecer como o usuário deixou
- Indicador visual de drag: ícone de 6 pontos (grip) cinza claro no início de cada coluna

```jsx
// Estado
const [columns, setColumns] = useState(() => {
  const saved = localStorage.getItem('NOME_TELA_columns_order');
  if (saved) {
    try {
      const savedIds = JSON.parse(saved);
      const colMap = {};
      INITIAL_COLUMNS.forEach(c => colMap[c.id] = c);
      const ordered = savedIds.filter(id => colMap[id]).map(id => colMap[id]);
      INITIAL_COLUMNS.forEach(c => { if (!savedIds.includes(c.id)) ordered.push(c); });
      return ordered;
    } catch { return INITIAL_COLUMNS; }
  }
  return INITIAL_COLUMNS;
});

// Salvar ao reordenar
localStorage.setItem('NOME_TELA_columns_order', JSON.stringify(newCols.map(c => c.id)));
```

### 2.3 Ordenação A-Z (Sort)
Toda coluna DEVE ter ordenação clicável:
- Clicar no header alterna entre ascendente/descendente
- Indicador visual: seta laranja (`text-orange-300`) ao lado do nome da coluna
- Usar `useMemo` para performance com `getSortValue` tipado por coluna
- `localeCompare('pt-BR')` para textos, subtração numérica para valores

```jsx
const sortedData = React.useMemo(() => {
  if (!sortColumn || data.length === 0) return data;
  return [...data].sort((a, b) => {
    const valA = getSortValue(a, sortColumn);
    const valB = getSortValue(b, sortColumn);
    let cmp = typeof valA === 'number' && typeof valB === 'number'
      ? valA - valB
      : String(valA).localeCompare(String(valB), 'pt-BR');
    return sortDirection === 'asc' ? cmp : -cmp;
  });
}, [data, sortColumn, sortDirection]);
```

### 2.4 Engrenagem de Visibilidade de Colunas
Toda tabela DEVE ter um botão de engrenagem discreto para ativar/desativar colunas:
- Posição: canto superior direito da tabela, ícone cinza claro `text-gray-400`
- Dropdown com checkboxes para cada coluna
- Salvar no `localStorage` com chave `NOME_TELA_hidden_cols`
- Fechar ao clicar fora (useRef + useEffect)

### 2.5 Corpo da Tabela
- **Texto**: `text-sm` (tamanho padrão)
- **Cor do texto**: `text-gray-900` para valores, `text-gray-500` para placeholders (-)
- **Hover nas linhas**: `hover:bg-gray-50`
- **Divisor**: `divide-y divide-gray-200`
- **Whitespace**: `whitespace-nowrap` nas células

---

## 3. BOTÃO DE PDF

Toda tela com tabela DEVE ter botão de exportação PDF:
- Posição: próximo ao botão Pesquisar ou no header
- Ícone de documento/download
- Estilo discreto mas visível

---

## 4. FILTROS

### 4.1 Layout
- **Máximo 2 linhas** de filtros: `grid grid-cols-3 md:grid-cols-6 gap-3`
- Se necessário reduzir filtros para caber em 2 linhas
- Labels: `text-xs font-medium text-gray-600 mb-1` com emoji

### 4.2 Inputs e Selects
- Borda: `border border-gray-300 rounded-md`
- Padding: `px-2 py-1.5`
- Fonte: `text-sm`
- Focus: `focus:ring-orange-500 focus:border-orange-500`
- Selects devem ter opção "Todos/Todas" como default

### 4.3 Botões de Ação
- **Pesquisar**: `bg-orange-600 text-white hover:bg-orange-700` com loading spinner
- **Limpar**: `bg-gray-200 text-gray-700 hover:bg-gray-300`

### 4.4 Filtros com valor '0'
IMPORTANTE: Ao verificar se um filtro deve ser enviado, usar verificação explícita:
```javascript
// CORRETO - funciona para valor '0'
if (filters.campo !== undefined && filters.campo !== '') params.append('campo', filters.campo);

// ERRADO - '0' é truthy mas pode causar confusão
if (filters.campo) params.append('campo', filters.campo);
```

---

## 5. CARDS DE RESUMO

Quando a tela tiver dados resumidos, usar cards no topo:
- Grid: `grid grid-cols-2 md:grid-cols-5 gap-4`
- Cada card com borda colorida e fundo suave:
  - Verde: entradas/positivo (`bg-green-50 border-green-200`)
  - Vermelho: saídas/negativo (`bg-red-50 border-red-200`)
  - Azul: saldo positivo (`bg-blue-50 border-blue-200`)
  - Laranja: saldo negativo (`bg-orange-50 border-orange-200`)
  - Amarelo: pendentes/abertos (`bg-yellow-50 border-yellow-200`)
  - Esmeralda: concluídos/quitados (`bg-emerald-50 border-emerald-200`)

---

## 6. LOADING

Usar o componente `RadarLoading` para estados de carregamento:
```jsx
import RadarLoading from '../components/RadarLoading';

{loading && (
  <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80">
    <RadarLoading message="Buscando dados..." />
  </div>
)}
```

---

## 7. NAVEGAÇÃO

Ao criar nova tela:
1. Adicionar rota em `App.jsx` com `ProtectedRoute`
2. Adicionar item no `Sidebar.jsx` na seção correta
3. Adicionar módulo em `menuConstants.js` (MENU_MODULES, MENU_SUBMENUS, MENU_STRUCTURE)

---

## 8. BACKEND - Padrão de API

### 8.1 Estrutura
- **Service**: `packages/backend/src/services/NOME.service.ts` - lógica de negócio e queries
- **Controller**: `packages/backend/src/controllers/NOME.controller.ts` - extrai params e chama service
- **Routes**: `packages/backend/src/routes/NOME.routes.ts` - define endpoints com `authenticateToken`
- Registrar no `index.ts`: `app.use('/api/NOME', router)`

### 8.2 Oracle (Intersolid)
- Sempre usar `MappingService.getSchema()` para resolver schema dinâmico
- Queries via `OracleService.query(sql, params)` (read-only, user POWERBI)
- Bind variables com `:nomeParam` (nunca concatenar valores na SQL)
- Paginação com `ROWNUM <= 500` (ou parametrizável)

### 8.3 Filtros no Backend
- Usar `buildFilters(filters, params)` que retorna string WHERE
- Iniciar com `WHERE 1=1` para facilitar concatenação
- Verificar `!== undefined && !== ''` para campos que podem ter valor '0'
- Converter para `Number()` quando o campo Oracle é numérico

---

## 9. RACE CONDITION EM BUSCAS

Quando a tela tem busca automática (useEffect) + busca manual (botão):
```javascript
const searchIdRef = useRef(0);

const handleSearch = async () => {
  const currentSearchId = ++searchIdRef.current;
  // ... fetch ...
  if (currentSearchId !== searchIdRef.current) return; // descarta resposta antiga
  setData(response.data);
};
```

---

## 10. PALETA DE CORES PADRÃO

| Elemento | Classe Tailwind |
|----------|----------------|
| Header da tela | `from-orange-600 to-orange-500` |
| Header tabela | `bg-gray-600 text-white` |
| Botão principal | `bg-orange-600 hover:bg-orange-700` |
| Botão secundário | `bg-gray-200 hover:bg-gray-300` |
| Focus ring | `ring-orange-500 border-orange-500` |
| Links/destaque | `text-orange-600` |
| Texto principal | `text-gray-900` |
| Texto secundário | `text-gray-600` |
| Texto placeholder | `text-gray-500` |
| Fundo da página | `bg-gray-100` |
| Card branco | `bg-white rounded-lg shadow` |
| Borda padrão | `border-gray-300` |

---

## CHECKLIST - Nova Funcionalidade

Antes de considerar uma tela pronta, verificar:

- [ ] Header laranja com emoji e descrição
- [ ] Tabela com header cinza (`bg-gray-600`)
- [ ] Colunas com drag & drop (salvo no localStorage)
- [ ] Colunas com sort A-Z clicável
- [ ] Engrenagem para ativar/desativar colunas
- [ ] Botão de exportar PDF
- [ ] Filtros em no máximo 2 linhas
- [ ] Botões Pesquisar (laranja) e Limpar (cinza)
- [ ] RadarLoading durante carregamento
- [ ] Cards de resumo (quando aplicável)
- [ ] Busca automática ao abrir a tela
- [ ] Race condition protegida
- [ ] Rota, Sidebar e menuConstants atualizados
- [ ] Texto `text-sm`, cores na paleta padrão
