const { Client } = require('pg');

async function checkUsers() {
  const client = new Client({
    connectionString: 'postgresql://postgres:admin123@localhost:5432/market_security'
  });

  try {
    await client.connect();
    console.log('Conectado ao banco!');

    const result = await client.query('SELECT id, username, name, first_access FROM employees ORDER BY created_at');

    console.log('\n=== USUARIOS NO BANCO ===\n');
    result.rows.forEach((user, i) => {
      console.log(`${i+1}. Username: "${user.username}"`);
      console.log(`   Nome: ${user.name}`);
      console.log(`   Primeiro acesso: ${user.first_access}`);
      console.log(`   ID: ${user.id}\n`);
    });

    await client.end();
  } catch (error) {
    console.error('Erro:', error.message);
  }
}

checkUsers();
