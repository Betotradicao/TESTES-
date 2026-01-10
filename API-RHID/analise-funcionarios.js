const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\1\\afd_report.txt', 'utf8');
const lines = content.trim().replace(/^"|"$/g, '').split('\\r\\n');

const funcionarios = new Set();
const cadastros = {};
let tipo5 = 0;
let tipo3 = 0;

lines.forEach(line => {
  if (!line || line.length < 20) return;

  const tipo = line[9];

  if (tipo === '5') {
    tipo5++;
    const pis = line.substring(23, 35);
    const nome = line.substring(43, 95).trim();
    cadastros[pis] = nome;
    console.log(`Cadastro - PIS: ${pis} - Nome: ${nome}`);
  }

  if (tipo === '3') {
    tipo3++;
    const pis = line.substring(22, 34);
    funcionarios.add(pis);
  }
});

console.log('\n' + '='.repeat(80));
console.log('RESUMO');
console.log('='.repeat(80));
console.log(`Registros tipo 5 (cadastros com nome): ${tipo5}`);
console.log(`Registros tipo 3 (marcações de ponto): ${tipo3}`);
console.log(`Funcionários únicos (PISpráticos diferentes): ${funcionarios.size}`);

console.log('\n' + '='.repeat(80));
console.log('LISTA DE TODOS OS PIS:');
console.log('='.repeat(80));

const pisOrdenados = [...funcionarios].sort();
pisOrdenados.forEach((pis, idx) => {
  const nome = cadastros[pis] || 'SEM NOME CADASTRADO';
  console.log(`${String(idx + 1).padStart(3)}. PIS: ${pis} - ${nome}`);
});
