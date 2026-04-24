// Extrai macros VBA de um xlsm
const fs = require('fs');
const XLSX = require('xlsx');

const FILE = 'C:/Users/Administrator/Desktop/roberto-prevencao-no-radar-main/Planilha de escala de trabalho 7.5.xlsm';
const wb = XLSX.readFile(FILE, { bookVBA: true });

if (!wb.vbaraw) { console.error('sem VBA'); process.exit(0); }

// vbaraw é o binário do vbaProject.bin — tentamos extrair strings legíveis
const raw = wb.vbaraw;
// Encontrar assinaturas de Sub/Function/End Sub
const text = raw.toString('latin1');
// Procurar padroes tipo "Sub Name(" e "Function Name("
const subs = [...text.matchAll(/\b(Sub|Function)\s+(\w+)\s*\(/gi)]
  .map(m => `${m[1]} ${m[2]}`);
// Unicos
const unique = Array.from(new Set(subs)).sort();
console.log('=== Subs e Functions VBA ===');
console.log(unique.join('\n'));
console.log('\n=== total:', unique.length);

// Salvar o binario pra o user abrir se quiser depois
fs.writeFileSync('/tmp/vbaProject.bin', raw);
console.log('\nVBA bin salvo em /tmp/vbaProject.bin');
