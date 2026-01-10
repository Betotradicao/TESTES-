const fs = require('fs');

const content = fs.readFileSync('C:\\Users\\ADMINI~1\\AppData\\Local\\Temp\\1\\afd_671.txt', 'utf8');
const lines = content.trim().replace(/^"|"$/g, '').split('\\r\\n');

const funcionarios = new Set();
const cadastros = {};
let tipo3 = 0;
let tipo5 = 0;

console.log('Analisando formato AFD 671...\n');

lines.forEach((line, idx) => {
  if (!line || line.length < 20) return;

  const tipo = line[9];

  // Tipo 3 - Marcação (formato 671 é diferente)
  if (tipo === '3') {
    tipo3++;
    // No formato 671, o PIS está em posição diferente
    // Formato: NSR(9) + Tipo(1) + Data/Hora ISO + PIS + checksum
    // Exemplo: 00008824932026-01-02T07:46:00-0300012975247240ed89

    const partes = line.match(/^(\d{9})(\d)([\d\-T:+]+)(\d{12})/);
    if (partes) {
      const nsr = partes[1];
      const tipo = partes[2];
      const dataHora = partes[3];
      const pis = partes[4];

      funcionarios.add(pis);

      if (idx < 50) {
        console.log(`NSR: ${nsr}, Tipo: ${tipo}, Data/Hora: ${dataHora}, PIS: ${pis}`);
      }
    }
  }

  // Tipo 5 - Cadastro
  if (tipo === '5') {
    tipo5++;
    console.log(`\n>>> TIPO 5 ENCONTRADO - Linha ${idx}:`);
    console.log(`Conteúdo: ${line}`);
    console.log(`Tamanho: ${line.length} caracteres\n`);
  }
});

console.log('\n' + '='.repeat(100));
console.log('ESTATÍSTICAS AFD 671');
console.log('='.repeat(100));
console.log(`Total de linhas: ${lines.length}`);
console.log(`Marcações tipo 3: ${tipo3}`);
console.log(`Cadastros tipo 5: ${tipo5}`);
console.log(`Funcionários únicos (PIS): ${funcionarios.size}`);

console.log('\n' + '='.repeat(100));
console.log('LISTA DE PIS (primeiros 50):');
console.log('='.repeat(100));

const pisOrdenados = [...funcionarios].sort();
pisOrdenados.slice(0, 50).forEach((pis, idx) => {
  console.log(`${String(idx + 1).padStart(3)}. PIS: ${pis}`);
});

if (pisOrdenados.length > 50) {
  console.log(`\n... e mais ${pisOrdenados.length - 50} funcionários`);
}

// Salvar lista de PIS
fs.writeFileSync('pis-lista-671.txt', pisOrdenados.join('\n'), 'utf8');
console.log('\nLista de PIS salva em: pis-lista-671.txt');
