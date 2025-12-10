const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createBetoMaster() {
  const client = new Client({
    connectionString: 'postgresql://postgres:admin123@localhost:5432/market_security'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco!');

    // Verificar se já existe
    const checkUser = await client.query(
      "SELECT * FROM users WHERE email = 'Beto'"
    );

    const hashedPassword = await bcrypt.hash('Beto3107@', 10);

    if (checkUser.rows.length > 0) {
      console.log('⚠️ Usuário Beto (master) já existe na tabela users!');

      // Atualizar senha e garantir que é master
      await client.query(
        'UPDATE users SET password = $1, role = $2, is_master = $3 WHERE email = $4',
        [hashedPassword, 'master', true, 'Beto']
      );

      console.log('✅ Usuário atualizado para MASTER!');
    } else {
      // Criar novo usuário master
      await client.query(
        `INSERT INTO users (email, password, role, is_master, company_id, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        ['Beto', hashedPassword, 'master', true, null]
      );

      console.log('✅ USUÁRIO MASTER CRIADO COM SUCESSO!');
    }

    console.log('\n📋 CREDENCIAIS MASTER:');
    console.log('👤 Email/Usuário: Beto');
    console.log('🔑 Senha: Beto3107@');
    console.log('🔓 Permissões: MASTER (acesso total + configurações)');
    console.log('\n✅ Agora você pode fazer login e acessar as Configurações!');

    await client.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
  }
}

createBetoMaster();
