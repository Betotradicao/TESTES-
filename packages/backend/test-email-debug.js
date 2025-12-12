const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('===================================');
  console.log('DEBUG - INFORMAÇÕES DO EMAIL');
  console.log('===================================');
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_PASS length:', process.env.EMAIL_PASS?.length);
  console.log('EMAIL_PASS (primeiros 4):', process.env.EMAIL_PASS?.substring(0, 4));
  console.log('EMAIL_PASS (últimos 4):', process.env.EMAIL_PASS?.substring(process.env.EMAIL_PASS.length - 4));
  console.log('===================================\n');

  // Vamos testar com diferentes configurações
  const configs = [
    {
      name: 'Gmail com "service"',
      config: {
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      }
    },
    {
      name: 'Gmail com host/port explícito',
      config: {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      }
    },
    {
      name: 'Gmail com SSL (porta 465)',
      config: {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        }
      }
    }
  ];

  for (const { name, config } of configs) {
    console.log(`\n🔍 Testando: ${name}`);
    console.log('-----------------------------------');

    try {
      const transporter = nodemailer.createTransport(config);
      console.log('✅ Transporter criado');

      await transporter.verify();
      console.log('✅ Conexão verificada com sucesso!');

      console.log('📧 Enviando email de teste...');
      const info = await transporter.sendMail({
        from: `"Prevenção no Radar" <${process.env.EMAIL_USER}>`,
        to: process.env.EMAIL_USER,
        subject: 'Teste - Prevenção no Radar',
        text: `Email de teste enviado às ${new Date().toLocaleString('pt-BR')}`
      });

      console.log('✅✅✅ EMAIL ENVIADO COM SUCESSO! ✅✅✅');
      console.log('Message ID:', info.messageId);
      console.log('\n🎉 Configuração que funciona:', name);
      return; // Sair do loop se funcionou

    } catch (error) {
      console.error(`❌ Falhou com erro:`, error.message);
      if (error.code) {
        console.error(`   Código do erro: ${error.code}`);
      }
    }
  }

  console.log('\n===================================');
  console.log('❌ NENHUMA CONFIGURAÇÃO FUNCIONOU');
  console.log('===================================');
  console.log('\nPossíveis causas:');
  console.log('1. A senha de app está incorreta ou expirada');
  console.log('2. A verificação em 2 etapas foi desativada');
  console.log('3. O Google bloqueou o acesso (verificar https://myaccount.google.com/security)');
  console.log('4. A senha de app foi revogada');
  console.log('\nSugestões:');
  console.log('- Crie uma NOVA senha de app');
  console.log('- Verifique se a verificação em 2 etapas está ATIVA');
  console.log('- Acesse: https://myaccount.google.com/apppasswords');
  console.log('===================================\n');
}

testEmail();
