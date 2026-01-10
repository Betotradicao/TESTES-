const fs = require('fs');

// Ler dados do banco de dados
const dbData = JSON.parse(fs.readFileSync('funcionarios-db.json', 'utf8'));

// Ler dados do relógio de ponto (AFD 671)
const afdData = JSON.parse(fs.readFileSync('funcionarios-ativos-671.json', 'utf8'));

console.log('='.repeat(120));
console.log('CRUZAMENTO: FUNCIONÁRIOS DO BANCO vs RELÓGIO DE PONTO');
console.log('='.repeat(120));

console.log(`\nFuncionários no banco de dados: ${dbData.total}`);
console.log(`Funcionários que bateram ponto (01 a 10/01): ${afdData.totalFuncionarios}`);

console.log('\n' + '='.repeat(120));
console.log('VERIFICANDO SE OS 6 DO BANCO BATERAM PONTO:');
console.log('='.repeat(120));

dbData.funcionarios.forEach((func, idx) => {
  console.log(`\n${idx + 1}. ${func.name} (${func.sector})`);
  console.log(`   Barcode DB: ${func.barcode}`);
  console.log(`   Username: ${func.username}`);

  // Procurar nos registros de ponto
  // Barcode pode ser PIS ou código diferente
  const encontrado = afdData.funcionarios.find(f =>
    f.pis === func.barcode ||
    f.pis.includes(func.barcode) ||
    func.barcode.includes(f.pis)
  );

  if (encontrado) {
    console.log(`   ✓ ENCONTRADO no relógio! PIS: ${encontrado.pis}`);
    console.log(`   Total de batidas: ${encontrado.totalBatidas}`);
    console.log(`   Primeira: ${encontrado.primeiraBatida.data} ${encontrado.primeiraBatida.hora}`);
    console.log(`   Última: ${encontrado.ultimaBatida.data} ${encontrado.ultimaBatida.hora}`);
  } else {
    console.log(`   ✗ NÃO encontrado no relógio de ponto`);
    console.log(`   Possíveis razões:`);
    console.log(`     - PIS/Barcode diferente do cadastrado no relógio`);
    console.log(`     - Não bateu ponto no período 01-10/01/2026`);
    console.log(`     - É funcionário de outra empresa/relógio`);
  }
});

console.log('\n' + '='.repeat(120));
console.log('CONCLUSÃO:');
console.log('='.repeat(120));

console.log(`
O sistema atual tem 6 funcionários cadastrados (PADARIA e AÇOUGUE).
O relógio de ponto do SUPERMERCADO TRADIÇÃO tem 468 PIS diferentes.

Esses são sistemas/empresas DIFERENTES:
- Seu sistema: PADARIA/AÇOUGUE (6 funcionários)
- Relógio RHID: SUPERMERCADO TRADIÇÃO LTDA (468 PIS)

Para integrar os dados de ponto do supermercado, você precisa:
1. Importar a lista de funcionários do RHID (via portal web ou API)
2. Criar registros de Employee no banco para cada funcionário ativo
3. Mapear PIS do relógio → Barcode do sistema
`);

console.log('\n' + '='.repeat(120));
console.log('TOP 20 FUNCIONÁRIOS MAIS ATIVOS NO RELÓGIO (SUPERMERCADO):');
console.log('='.repeat(120));

afdData.funcionarios.slice(0, 20).forEach((func, idx) => {
  console.log(
    `${String(idx + 1).padStart(3)}. PIS: ${func.pis} | ` +
    `${String(func.totalBatidas).padStart(2)} batidas | ` +
    `${func.primeiraBatida.data} a ${func.ultimaBatida.data} | ` +
    `${func.nome}`
  );
});
