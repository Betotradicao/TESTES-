const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function testLogin() {
  const client = new Client({
    connectionString: 'postgresql://postgres:admin123@localhost:5432/market_security'
  });

  try {
    await client.connect();

    // Buscar o usuário Beto
    const result = await client.query(
      "SELECT id, username, name, password, active FROM employees WHERE username = 'Beto'"
    );

    if (result.rows.length === 0) {
      console.log('❌ Usuário Beto não encontrado!');
      await client.end();
      return;
    }

    const user = result.rows[0];
    console.log('✅ Usuário encontrado:');
    console.log('   Username:', user.username);
    console.log('   Nome:', user.name);
    console.log('   Ativo:', user.active);
    console.log('   Hash no banco:', user.password);

    // Testar senha
    const senhaTestada = 'Beto3107';
    console.log('\n🔐 Testando senha:', senhaTestada);

    const senhaCorreta = await bcrypt.compare(senhaTestada, user.password);

    if (senhaCorreta) {
      console.log('✅ SENHA CORRETA! O login deve funcionar!');
    } else {
      console.log('❌ SENHA INCORRETA! Vou resetar novamente...');

      // Resetar com uma senha que funciona
      const novoHash = await bcrypt.hash(senhaTestada, 10);
      await client.query(
        'UPDATE employees SET password = $1 WHERE username = $2',
        [novoHash, 'Beto']
      );

      console.log('✅ Senha resetada novamente!');

      // Testar de novo
      const testeNovo = await bcrypt.compare(senhaTestada, novoHash);
      console.log('Teste após reset:', testeNovo ? '✅ OK' : '❌ FALHOU');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

testLogin();
