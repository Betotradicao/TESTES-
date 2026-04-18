const fs = require('fs');
const m = JSON.parse(fs.readFileSync('/app/trad_map.json','utf8'));
// Adicionar codigo_loja em TAB_NF
m.tabelas.TAB_NF.colunas.codigo_loja = 'COD_LOJA';
m.tabelas.TAB_NF.tabelas_campo.codigo_loja = 'TAB_NF';
fs.writeFileSync('/app/trad_map_fixed.json', JSON.stringify(m));
console.log('OK - tamanho:', JSON.stringify(m).length);
console.log('TAB_NF.colunas:', Object.keys(m.tabelas.TAB_NF.colunas).join(','));
