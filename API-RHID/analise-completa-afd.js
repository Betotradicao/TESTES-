const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\1\\afd_report.txt', 'utf8');
const lines = content.trim().replace(/^"|"$/g, '').split('\\r\\n');

const tiposCadastro = new Set();
const funcionarios = new Set();
const cadastros = {};
const estatisticas = {
  tipo0: 0,
  tipo1: 0,
  tipo2: 0,
  tipo3: 0,
  tipo4: 0,
  tipo5: 0,
  tipo6: 0,
  tipo9: 0,
  outros: 0
};

console.log('Analisando todas as linhas...\n');

lines.forEach((line, idx) => {
  if (!line || line.length < 10) return;

  const tipo = line[9];

  // Contar por tipo
  if (tipo === '0') estatisticas.tipo0++;
  else if (tipo === '1') estatisticas.tipo1++;
  else if (tipo === '2') estatisticas.tipo2++;
  else if (tipo === '3') estatisticas.tipo3++;
  else if (tipo === '4') estatisticas.tipo4++;
  else if (tipo === '5') estatisticas.tipo5++;
  else if (tipo === '6') estatisticas.tipo6++;
  else if (tipo === '9') estatisticas.tipo9++;
  else {
    estatisticas.outros++;
    console.log(`Linha ${idx}: Tipo desconhecido '${tipo}' - ${line.substring(0, 80)}`);
  }

  // Tipo 5 - Cadastro
  if (tipo === '5') {
    console.log(`\n>>> REGISTRO TIPO 5 (Cadastro) - Linha ${idx}:`);
    console.log(`Linha completa: ${line}`);
    console.log(`Tamanho: ${line.length} caracteres`);

    if (line.length >= 95) {
      const pis = line.substring(23, 35);
      const nome = line.substring(43, 95).trim();
      cadastros[pis] = nome;
      console.log(`PIS: ${pis}`);
      console.log(`Nome: ${nome}`);
    } else {
      console.log('AVISO: Linha muito curta para extrair dados completos');
    }
  }

  // Tipo 3 - Marcação
  if (tipo === '3' && line.length >= 34) {
    const pis = line.substring(22, 34);
    funcionarios.add(pis);
  }
});

console.log('\n' + '='.repeat(100));
console.log('ESTATÍSTICAS DO ARQUIVO AFD');
console.log('='.repeat(100));
console.log(`Total de linhas processadas: ${lines.length}`);
console.log(`\nRegistros por tipo:`);
console.log(`  Tipo 0 (Cabeçalho):           ${estatisticas.tipo0}`);
console.log(`  Tipo 1 (Empresa):             ${estatisticas.tipo1}`);
console.log(`  Tipo 2 (Ajuste):              ${estatisticas.tipo2}`);
console.log(`  Tipo 3 (Marcação de ponto):   ${estatisticas.tipo3}`);
console.log(`  Tipo 4 (Horário):             ${estatisticas.tipo4}`);
console.log(`  Tipo 5 (Cadastro):            ${estatisticas.tipo5} <<<`);
console.log(`  Tipo 6 (Ajuste manual):       ${estatisticas.tipo6}`);
console.log(`  Tipo 9 (Rodapé):              ${estatisticas.tipo9}`);
console.log(`  Outros:                       ${estatisticas.outros}`);

console.log(`\n${'='.repeat(100)}`);
console.log(`Funcionários únicos (PIS diferentes batendo ponto): ${funcionarios.size}`);
console.log(`Cadastros com nome encontrados: ${Object.keys(cadastros).length}`);
console.log(`Percentual com nome: ${((Object.keys(cadastros).length / funcionarios.size) * 100).toFixed(1)}%`);

if (Object.keys(cadastros).length > 0) {
  console.log(`\n${'='.repeat(100)}`);
  console.log('FUNCIONÁRIOS CADASTRADOS (com nome):');
  console.log('='.repeat(100));
  Object.keys(cadastros).sort().forEach((pis, idx) => {
    console.log(`${String(idx + 1).padStart(3)}. PIS: ${pis} - ${cadastros[pis]}`);
  });
}

console.log(`\n${'='.repeat(100)}`);
console.log('PRIMEIROS 10 PIS SEM CADASTRO:');
console.log('='.repeat(100));
const pisSemNome = [...funcionarios].filter(pis => !cadastros[pis]).sort();
pisSemNome.slice(0, 10).forEach((pis, idx) => {
  console.log(`${String(idx + 1).padStart(3)}. PIS: ${pis} - SEM NOME`);
});
console.log(`... e mais ${pisSemNome.length - 10} funcionários sem cadastro`);
