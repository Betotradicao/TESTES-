const fs = require('fs');

// Ler arquivo AFD
const content = fs.readFileSync('C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\1\\afd_report.txt', 'utf8');

// Remover aspas e separar linhas
const lines = content.trim().replace(/^"|"$/g, '').split('\\r\\n');

// Estrutura para armazenar registros por funcionário e data
const registros = {};
const funcionarios = {};

console.log(`Total de linhas: ${lines.length}\n`);

lines.forEach((line, idx) => {
  if (!line || line.length < 20) return;

  const tipo = line[9];

  // Tipo 5 - Cadastro de funcionário
  if (tipo === '5') {
    const pis = line.substring(23, 35);
    const nome = line.substring(43, 95).trim();
    funcionarios[pis] = nome;
  }

  // Tipo 3 - Marcação de ponto
  if (tipo === '3') {
    const data = line.substring(10, 18); // DDMMAAAA
    const hora = line.substring(18, 22); // HHMM
    const pis = line.substring(22, 34);

    const dia = data.substring(0, 2);
    const mes = data.substring(2, 4);
    const ano = data.substring(4, 8);
    const dataFormatada = `${dia}/${mes}`;

    const horaFormatada = `${hora.substring(0, 2)}:${hora.substring(2, 4)}`;

    const chave = `${ano}-${mes}-${dia}_${pis}`;

    if (!registros[chave]) {
      registros[chave] = {
        data: dataFormatada,
        diaSemana: '',
        pis: pis,
        nome: '',
        batidas: []
      };
    }

    registros[chave].batidas.push(horaFormatada);
  }
});

// Preencher nomes dos funcionários
Object.keys(registros).forEach(chave => {
  const reg = registros[chave];
  reg.nome = funcionarios[reg.pis] || 'Funcionário não cadastrado';
});

// Ordenar por data
const chavesOrdenadas = Object.keys(registros).sort();

// Função para calcular dia da semana
function getDiaSemana(dataKey) {
  const [ano, mes, dia] = dataKey.split('_')[0].split('-');
  const data = new Date(parseInt(ano), parseInt(mes) - 1, parseInt(dia));
  const dias = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  return dias[data.getDay()];
}

// Calcular total de horas trabalhadas
function calcularTotal(batidas) {
  if (batidas.length < 2) return '00:00';

  let totalMinutos = 0;

  for (let i = 0; i < batidas.length - 1; i += 2) {
    const [h1, m1] = batidas[i].split(':').map(Number);
    const [h2, m2] = batidas[i + 1].split(':').map(Number);

    const minutos1 = h1 * 60 + m1;
    const minutos2 = h2 * 60 + m2;

    totalMinutos += (minutos2 - minutos1);
  }

  const horas = Math.floor(totalMinutos / 60);
  const minutos = totalMinutos % 60;

  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}`;
}

// Exibir formato cartão de ponto
console.log('═'.repeat(120));
console.log('CARTÃO DE PONTO - DEZEMBRO 2025 / JANEIRO 2026');
console.log('═'.repeat(120));
console.log(`Dia     | Sem | Nome do Funcionário                | Ent.1 | Sai.1 | Ent.2 | Sai.2 | Total`);
console.log('─'.repeat(120));

let funcionarioAtual = '';
let count = 0;

chavesOrdenadas.forEach(chave => {
  const reg = registros[chave];
  const diaSemana = getDiaSemana(chave);

  const ent1 = reg.batidas[0] || '     ';
  const sai1 = reg.batidas[1] || '     ';
  const ent2 = reg.batidas[2] || '     ';
  const sai2 = reg.batidas[3] || '     ';
  const total = calcularTotal(reg.batidas);

  // Quebra de página por funcionário
  if (funcionarioAtual !== reg.nome) {
    if (funcionarioAtual !== '') {
      console.log('─'.repeat(120));
    }
    funcionarioAtual = reg.nome;
    console.log(`\nFUNCIONÁRIO: ${reg.nome} (PIS: ${reg.pis})`);
    console.log('─'.repeat(120));
  }

  console.log(
    `${reg.data.padEnd(8)}| ${diaSemana} | ${reg.nome.substring(0, 34).padEnd(34)} | ${ent1} | ${sai1} | ${ent2} | ${sai2} | ${total}`
  );

  count++;
});

console.log('═'.repeat(120));
console.log(`\nTotal de registros processados: ${count}`);
console.log(`Total de funcionários: ${Object.keys(funcionarios).length}`);

// Salvar JSON para uso posterior
const output = {
  funcionarios: funcionarios,
  registros: chavesOrdenadas.map(chave => ({
    ...registros[chave],
    total: calcularTotal(registros[chave].batidas),
    diaSemana: getDiaSemana(chave)
  }))
};

fs.writeFileSync('cartao-ponto.json', JSON.stringify(output, null, 2), 'utf8');
console.log('\nArquivo JSON salvo: cartao-ponto.json');
