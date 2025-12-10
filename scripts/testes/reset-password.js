const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function resetPassword() {
  const client = new Client({
    connectionString: 'postgresql://postgres:admin123@localhost:5432/market_security'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco!');

    // Listar usuários
    const result = await client.query('SELECT id, username, name FROM employees ORDER BY created_at LIMIT 10');

    console.log('\n📋 Usuários encontrados:');
    result.rows.forEach((user, index) => {
      console.log(`${index + 1}. ID: ${user.id} | Username: ${user.username} | Nome: ${user.name}`);
    });

    if (result.rows.length > 0) {
      // Resetar senha do primeiro usuário
      const userId = result.rows[0].id;
      const hashedPassword = await bcrypt.hash('Beto3107', 10);

      await client.query(
        'UPDATE employees SET username = $1, password = $2, first_access = false WHERE id = $3',
        ['Beto', hashedPassword, userId]
      );

      console.log('\n✅ Senha resetada com sucesso!');
      console.log('👤 Usuário: Beto');
      console.log('🔑 Senha: Beto3107');
    } else {
      console.log('❌ Nenhum usuário encontrado!');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

resetPassword();
