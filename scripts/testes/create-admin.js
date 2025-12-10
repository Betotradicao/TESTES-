const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function createAdmin() {
  const client = new Client({
    connectionString: 'postgresql://postgres:admin123@localhost:5432/market_security'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco!');

    // Verificar se já existe um admin
    const checkAdmin = await client.query(
      "SELECT * FROM users WHERE email = 'admin@prevencao.com'"
    );

    if (checkAdmin.rows.length > 0) {
      console.log('⚠️ Usuário admin já existe!');
      console.log('Email: admin@prevencao.com');

      // Resetar senha
      const hashedPassword = await bcrypt.hash('Admin@2024', 10);
      await client.query(
        'UPDATE users SET password = $1 WHERE email = $2',
        [hashedPassword, 'admin@prevencao.com']
      );

      console.log('✅ Senha resetada!');
      console.log('\n📋 CREDENCIAIS DE ADMIN:');
      console.log('👤 Email: admin@prevencao.com');
      console.log('🔑 Senha: Admin@2024');
    } else {
      // Criar novo usuário admin
      const hashedPassword = await bcrypt.hash('Admin@2024', 10);

      await client.query(
        `INSERT INTO users (email, password, role, "isMaster", "companyId", created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`,
        ['admin@prevencao.com', hashedPassword, 'admin', true, null]
      );

      console.log('✅ USUÁRIO ADMIN CRIADO COM SUCESSO!');
      console.log('\n📋 CREDENCIAIS DE ADMIN:');
      console.log('👤 Email: admin@prevencao.com');
      console.log('🔑 Senha: Admin@2024');
      console.log('\n🔓 Permissões: MASTER (acesso total)');
    }

    await client.end();
  } catch (error) {
    console.error('❌ Erro:', error.message);
  }
}

createAdmin();
