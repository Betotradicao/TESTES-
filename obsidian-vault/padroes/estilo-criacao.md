# Estilo de Criação — Radar 360

Padrões visuais/funcionais OBRIGATÓRIOS para qualquer tela nova no sistema.

## 🎨 Header da Tela
- Gradiente laranja: `bg-gradient-to-r from-orange-600 to-orange-500`
- Texto branco, título `text-2xl font-bold` com emoji
- Subtítulo `text-orange-100 text-sm`

## 📊 Tabelas — OBRIGATÓRIO
- **Header:** `bg-gray-600 text-white`, cada coluna com emoji
- **Drag & Drop** de colunas (salvo em `localStorage`)
- **Sort A-Z** clicável (seta laranja `text-orange-300`)
- **Engrenagem** pra ativar/desativar colunas
- Texto `text-sm`, `text-gray-900`

## 🔘 Botões
| Tipo | Classe |
|---|---|
| Principal | `bg-orange-600 hover:bg-orange-700` |
| Secundário | `bg-gray-200 hover:bg-gray-300` |
| Pesquisar | laranja + loading spinner |

## 📦 Filtros
- Máximo **2 linhas**: `grid grid-cols-3 md:grid-cols-6 gap-3`
- Focus: `focus:ring-orange-500 focus:border-orange-500`
- Selects com "Todos/Todas" como default

## ⚠️ Filtros com valor '0'
```javascript
// ✅ CORRETO
if (filters.campo !== undefined && filters.campo !== '') params.append('campo', filters.campo);
// ❌ ERRADO (pode confundir com valor '0')
if (filters.campo) params.append('campo', filters.campo);
```

## 🔄 Race Condition em buscas
```javascript
const searchIdRef = useRef(0);
const handleSearch = async () => {
  const currentSearchId = ++searchIdRef.current;
  // ... fetch ...
  if (currentSearchId !== searchIdRef.current) return; // descarta resposta antiga
  setData(response.data);
};
```

## ⏳ Loading
Usar componente `RadarLoading`:
```jsx
<RadarLoading message="Buscando dados..." />
```

## 🧭 Navegação de nova tela
1. Rota em `App.jsx` com `ProtectedRoute`
2. Item no `Sidebar.jsx`
3. Módulo em `menuConstants.js`

## 🏷️ Tags
#padrao #ui #frontend
