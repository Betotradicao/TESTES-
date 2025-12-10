const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function resetPassword() {
  const client = new Client({
    connectionString: 'postgresql://postgres:admin123@localhost:5432/market_security'
  });

  try {
    await client.connect();
    console.log('✅ Conectado!');

    // Senha nova
    const novaSenha = 'Beto3107';

    // Gerar hash
    console.log('\n🔐 Gerando hash da senha...');
    const hash = await bcrypt.hash(novaSenha, 10);
    console.log('Hash gerado:', hash);

    // Testar se o hash funciona
    console.log('\n🧪 Testando hash...');
    const testeOk = await bcrypt.compare(novaSenha, hash);
    console.log('Teste do hash:', testeOk ? '✅ OK' : '❌ FALHOU');

    if (testeOk) {
      // Atualizar no banco
      await client.query(
        'UPDATE employees SET password = $1, first_access = false WHERE username = $2',
        [hash, 'Beto']
      );

      console.log('\n✅ SENHA ATUALIZADA COM SUCESSO!');
      console.log('\n📋 DADOS DE LOGIN:');
      console.log('👤 Usuário: Beto');
      console.log('🔑 Senha: Beto3107');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

resetPassword();
