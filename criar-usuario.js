const { Client } = require('pg');
const bcrypt = require('bcrypt');

async function criarUsuario() {
  // Conectar ao banco PostgreSQL do Docker
  const client = new Client({
    host: 'localhost',
    port: 5434, // Porta do Docker (não 5432)
    user: 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres123',
    database: 'prevencao_db'
  });

  try {
    await client.connect();
    console.log('✅ Conectado ao banco de dados');

    // Gerar hash da senha
    const senha = 'Beto3107@';
    const hash = await bcrypt.hash(senha, 10);
    console.log('🔐 Hash gerado:', hash);

    // Inserir usuário
    const insertUser = `
      INSERT INTO users (name, email, password, role, recovery_email, is_first_login, last_password_change, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW(), NOW())
      ON CONFLICT (email) DO UPDATE SET
        password = EXCLUDED.password,
        role = EXCLUDED.role,
        updated_at = NOW()
      RETURNING id, name, email, role;
    `;

    const userResult = await client.query(insertUser, [
      'Beto',
      'Beto',
      hash,
      'admin',
      'beto@exemplo.com',
      false
    ]);

    console.log('✅ Usuário criado/atualizado:', userResult.rows[0]);

    // Marcar setup como completo
    const insertConfig = `
      INSERT INTO system_config (is_setup_completed, created_at, updated_at)
      VALUES (TRUE, NOW(), NOW())
      ON CONFLICT (id) DO UPDATE SET is_setup_completed = TRUE;
    `;

    await client.query(insertConfig);
    console.log('✅ Setup marcado como completo');

    console.log('\n========================================');
    console.log('✅ USUÁRIO CRIADO COM SUCESSO!');
    console.log('========================================');
    console.log('📋 Credenciais:');
    console.log('   Email/Usuário: Beto');
    console.log('   Senha: Beto3107@');
    console.log('   Tipo: Administrador');
    console.log('\n🔐 Você já pode fazer login!');

  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

criarUsuario();
