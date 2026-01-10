const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\1\\afd_671.txt', 'utf8');
const lines = content.trim().replace(/^"|"$/g, '').split('\\r\\n');

const funcionariosAtivos = new Map(); // PIS -> { nome, batidas: [{data, hora}] }
const cadastros = {};

console.log('Analisando funcionários ATIVOS (que bateram ponto de 01 a 10/01/2026)...\n');

lines.forEach((line, idx) => {
  if (!line || line.length < 50) return;

  const tipo = line[9];

  // Tipo 5 - Cadastro
  if (tipo === '5') {
    // Formato: NSR(9) + Tipo(1) + DataHora(25) + E/D + PIS(12) + Nome(52) + checksum
    const match = line.match(/^(\d{9})(\d)([\d\-T:+]+)([ED])(\d{12})(.+)$/);
    if (match) {
      const pis = match[5];
      const nomeCompleto = match[6];
      const nome = nomeCompleto.substring(0, 52).trim();
      cadastros[pis] = nome;
      console.log(`Cadastro encontrado - PIS: ${pis} - Nome: ${nome}`);
    }
  }

  // Tipo 3 - Marcação
  if (tipo === '3') {
    // Formato: NSR(9) + Tipo(1) + DataHora(25) + PIS(12) + checksum
    const match = line.match(/^(\d{9})(\d)([\d\-T:+]+)(\d{12})/);
    if (match) {
      const nsr = match[1];
      const dataHora = match[3];
      const pis = match[4];

      // Extrair data e hora
      const dataMatch = dataHora.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
      if (dataMatch) {
        const [_, ano, mes, dia, hora, minuto] = dataMatch;
        const data = `${dia}/${mes}/${ano}`;
        const horaFmt = `${hora}:${minuto}`;

        if (!funcionariosAtivos.has(pis)) {
          funcionariosAtivos.set(pis, {
            nome: cadastros[pis] || 'SEM CADASTRO',
            batidas: []
          });
        }

        funcionariosAtivos.get(pis).batidas.push({
          data,
          hora: horaFmt,
          nsr
        });
      }
    }
  }
});

// Ordenar por quantidade de batidas (mais ativo primeiro)
const funcionariosOrdenados = Array.from(funcionariosAtivos.entries())
  .map(([pis, dados]) => ({
    pis,
    nome: dados.nome,
    totalBatidas: dados.batidas.length,
    primeiraBatida: dados.batidas[0],
    ultimaBatida: dados.batidas[dados.batidas.length - 1]
  }))
  .sort((a, b) => b.totalBatidas - a.totalBatidas);

console.log('\n' + '='.repeat(120));
console.log('FUNCIONÁRIOS ATIVOS (bateram ponto entre 01/01/2026 e 10/01/2026)');
console.log('='.repeat(120));
console.log(`Total de funcionários ativos: ${funcionariosOrdenados.length}`);
console.log(`Funcionários com nome cadastrado: ${Object.keys(cadastros).length}`);
console.log('='.repeat(120));

console.log(`\n${'#'.padStart(4)} | ${'PIS'.padEnd(13)} | ${'Batidas'.padStart(7)} | ${'Primeira'.padEnd(16)} | ${'Última'.padEnd(16)} | ${'Nome'.padEnd(50)}`);
console.log('-'.repeat(120));

funcionariosOrdenados.forEach((func, idx) => {
  if (idx < 50) { // Mostrar top 50
    console.log(
      `${String(idx + 1).padStart(4)} | ` +
      `${func.pis} | ` +
      `${String(func.totalBatidas).padStart(7)} | ` +
      `${(func.primeiraBatida.data + ' ' + func.primeiraBatida.hora).padEnd(16)} | ` +
      `${(func.ultimaBatida.data + ' ' + func.ultimaBatida.hora).padEnd(16)} | ` +
      `${func.nome.substring(0, 50).padEnd(50)}`
    );
  }
});

if (funcionariosOrdenados.length > 50) {
  console.log(`\n... e mais ${funcionariosOrdenados.length - 50} funcionários`);
}

// Estatísticas
console.log('\n' + '='.repeat(120));
console.log('ESTATÍSTICAS');
console.log('='.repeat(120));

const comMuitasBatidas = funcionariosOrdenados.filter(f => f.totalBatidas >= 20).length;
const comPoucasBatidas = funcionariosOrdenados.filter(f => f.totalBatidas < 5).length;
const mediaBatidas = funcionariosOrdenados.reduce((sum, f) => sum + f.totalBatidas, 0) / funcionariosOrdenados.length;

console.log(`Funcionários com >= 20 batidas (muito ativos): ${comMuitasBatidas}`);
console.log(`Funcionários com < 5 batidas (pouco ativos): ${comPoucasBatidas}`);
console.log(`Média de batidas por funcionário: ${mediaBatidas.toFixed(1)}`);

// Salvar lista completa em JSON
const output = {
  periodo: '01/01/2026 a 10/01/2026',
  totalFuncionarios: funcionariosOrdenados.length,
  funcionariosComNome: Object.keys(cadastros).length,
  funcionarios: funcionariosOrdenados
};

fs.writeFileSync('funcionarios-ativos-671.json', JSON.stringify(output, null, 2), 'utf8');
console.log('\nArquivo JSON salvo: funcionarios-ativos-671.json');
