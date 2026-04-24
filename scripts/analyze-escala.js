// Analisa Planilha de escala de trabalho 7.5.xlsm aba-por-aba
const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const FILE = 'C:/Users/Administrator/Desktop/roberto-prevencao-no-radar-main/Planilha de escala de trabalho 7.5.xlsm';
const wb = XLSX.readFile(FILE, { bookVBA: true, cellFormula: true, cellStyles: true });

const ABA = process.argv[2]; // nome da aba
if (!ABA) {
  console.log('ABAS:', wb.SheetNames.join(' | '));
  process.exit(0);
}
const sh = wb.Sheets[ABA];
if (!sh) { console.error('Aba nao encontrada:', ABA); process.exit(1); }

const range = XLSX.utils.decode_range(sh['!ref']);
const maxRows = Math.min(range.e.r, parseInt(process.argv[3] || '60') - 1);
const maxCols = Math.min(range.e.c, parseInt(process.argv[4] || '30') - 1);

console.log('=== ABA:', ABA, '=== range:', sh['!ref']);
console.log('');

// Dump cell values + formulas
for (let r = range.s.r; r <= maxRows; r++) {
  const row = [];
  for (let c = range.s.c; c <= maxCols; c++) {
    const addr = XLSX.utils.encode_cell({ r, c });
    const cell = sh[addr];
    if (!cell) { row.push(''); continue; }
    let v = cell.v;
    if (cell.f) v = `=${cell.f}`; // formula
    if (typeof v === 'string' && v.length > 40) v = v.slice(0, 37) + '...';
    row.push(v == null ? '' : String(v));
  }
  // so imprime linhas com ao menos 1 valor
  if (row.some(x => x !== '')) {
    console.log(`R${r+1}:`, row.map((x, i) => x ? `${XLSX.utils.encode_col(i)}=${x}` : '').filter(Boolean).join(' | '));
  }
}
