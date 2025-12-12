const nodemailer = require('nodemailer');
require('dotenv').config();

async function testEmail() {
  console.log('===================================');
  console.log('TESTE DE ENVIO DE EMAIL');
  console.log('===================================');
  console.log('EMAIL_USER:', process.env.EMAIL_USER);
  console.log('EMAIL_PASS:', process.env.EMAIL_PASS ? '***configurado***' : 'NÃO CONFIGURADO');
  console.log('===================================\n');

  try {
    // Criar transporter
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
      }
    });

    console.log('✅ Transporter criado com sucesso\n');

    // Testar conexão
    console.log('🔍 Testando conexão com Gmail...');
    await transporter.verify();
    console.log('✅ Conexão com Gmail OK!\n');

    // Enviar email de teste
    console.log('📧 Enviando email de teste...');
    const info = await transporter.sendMail({
      from: `"Prevenção no Radar - TESTE" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: 'Teste de Recuperação de Senha - Prevenção no Radar',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #ea580c; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #ea580c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Prevenção no Radar</h1>
            </div>
            <div class="content">
              <h2>✅ TESTE DE EMAIL - FUNCIONANDO!</h2>
              <p>Este é um email de teste para verificar se o sistema de recuperação de senha está funcionando corretamente.</p>
              <p>Se você recebeu este email, significa que:</p>
              <ul>
                <li>✅ As credenciais do Gmail estão corretas</li>
                <li>✅ A senha de app está funcionando</li>
                <li>✅ O nodemailer está configurado corretamente</li>
                <li>✅ O sistema está pronto para enviar emails de recuperação</li>
              </ul>
              <p><strong>Data/Hora do teste:</strong> ${new Date().toLocaleString('pt-BR')}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
TESTE DE EMAIL - Prevenção no Radar

Este é um email de teste para verificar se o sistema de recuperação de senha está funcionando.

Se você recebeu este email, o sistema está pronto para enviar emails de recuperação!

Data/Hora: ${new Date().toLocaleString('pt-BR')}
      `
    });

    console.log('✅ Email enviado com sucesso!');
    console.log('📨 Message ID:', info.messageId);
    console.log('\n===================================');
    console.log('🎉 TESTE CONCLUÍDO COM SUCESSO!');
    console.log('===================================');
    console.log(`Verifique a caixa de entrada de: ${process.env.EMAIL_USER}`);
    console.log('(Não esqueça de verificar a pasta de SPAM)');
    console.log('===================================\n');

  } catch (error) {
    console.error('\n❌ ERRO ao enviar email:');
    console.error(error);
    console.error('\n===================================');
    console.error('POSSÍVEIS CAUSAS:');
    console.error('===================================');
    console.error('1. Senha de app incorreta');
    console.error('2. Verificação em 2 etapas não ativada');
    console.error('3. Email incorreto');
    console.error('4. Bloqueio de firewall/antivírus');
    console.error('===================================\n');
  }
}

testEmail();
