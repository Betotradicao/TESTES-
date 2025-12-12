const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

console.log('===================================');
console.log('TESTE COMPLETO DE TODOS OS EMAILS');
console.log('===================================');
console.log('Email configurado:', process.env.EMAIL_USER);
console.log('===================================\n');

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testAllEmails() {
  const emailUser = process.env.EMAIL_USER;

  // ==========================================
  // 1. EMAIL DE RECUPERAÇÃO DE SENHA
  // ==========================================
  console.log('📧 1/3 - Testando EMAIL DE RECUPERAÇÃO DE SENHA...');
  try {
    const resetUrl = 'http://localhost:3004/reset-password?token=abc123def456';
    const resetEmail = {
      from: `"Prevenção no Radar" <${emailUser}>`,
      to: emailUser,
      subject: '🔐 Recuperação de Senha - Prevenção no Radar [TESTE]',
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
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Prevenção no Radar</h1>
            </div>
            <div class="content">
              <h2>Recuperação de Senha</h2>
              <p>Olá Beto,</p>
              <p>Você solicitou a recuperação de senha para sua conta no sistema Prevenção no Radar.</p>
              <p>Clique no botão abaixo para redefinir sua senha:</p>
              <p style="text-align: center;">
                <a href="${resetUrl}" class="button">Redefinir Senha</a>
              </p>
              <p>Ou copie e cole este link no seu navegador:</p>
              <p style="word-break: break-all; background-color: #eee; padding: 10px; border-radius: 3px;">
                ${resetUrl}
              </p>
              <p><strong>Este link é válido por 1 hora.</strong></p>
              <p>Se você não solicitou esta recuperação, ignore este email. Sua senha permanecerá inalterada.</p>
              <p><em>⚠️ Este é um email de TESTE do sistema</em></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Prevenção no Radar - Todos os direitos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Recuperação de Senha - Prevenção no Radar [TESTE]

Olá Beto,

Você solicitou a recuperação de senha para sua conta.

Para redefinir sua senha, acesse o link abaixo:
${resetUrl}

Este link é válido por 1 hora.

Se você não solicitou esta recuperação, ignore este email.

⚠️ Este é um email de TESTE do sistema

---
© ${new Date().getFullYear()} Prevenção no Radar
      `
    };

    await transporter.sendMail(resetEmail);
    console.log('✅ Email de Recuperação de Senha enviado com sucesso!\n');
    await sleep(2000);

  } catch (error) {
    console.error('❌ Erro ao enviar Email de Recuperação:', error.message, '\n');
  }

  // ==========================================
  // 2. EMAIL DE BOAS-VINDAS (Primeiro Acesso)
  // ==========================================
  console.log('📧 2/3 - Testando EMAIL DE BOAS-VINDAS...');
  try {
    const welcomeEmail = {
      from: `"Prevenção no Radar" <${emailUser}>`,
      to: emailUser,
      subject: '🎉 Bem-vindo ao Prevenção no Radar! [TESTE]',
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
            .info-box { background-color: #fff; border-left: 4px solid #ea580c; padding: 15px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Bem-vindo!</h1>
            </div>
            <div class="content">
              <h2>Olá Beto!</h2>
              <p>Sua conta no sistema <strong>Prevenção no Radar</strong> foi criada com sucesso!</p>

              <div class="info-box">
                <h3>📋 Suas Credenciais de Acesso:</h3>
                <p><strong>Email:</strong> ${emailUser}</p>
                <p><strong>Senha Temporária:</strong> SenhaTemp123</p>
              </div>

              <p><strong>⚠️ Importante:</strong> Por segurança, recomendamos que você altere sua senha no primeiro acesso.</p>

              <p style="text-align: center;">
                <a href="http://localhost:3004/login" class="button">Acessar o Sistema</a>
              </p>

              <h3>🚀 Próximos Passos:</h3>
              <ol>
                <li>Faça login no sistema usando suas credenciais</li>
                <li>Altere sua senha temporária</li>
                <li>Complete seu perfil</li>
                <li>Explore as funcionalidades do sistema</li>
              </ol>

              <p>Se tiver dúvidas ou precisar de ajuda, entre em contato com nossa equipe de suporte.</p>

              <p><em>⚠️ Este é um email de TESTE do sistema</em></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Prevenção no Radar - Todos os direitos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Bem-vindo ao Prevenção no Radar! [TESTE]

Olá Beto!

Sua conta no sistema Prevenção no Radar foi criada com sucesso!

📋 Suas Credenciais de Acesso:
Email: ${emailUser}
Senha Temporária: SenhaTemp123

⚠️ Importante: Por segurança, recomendamos que você altere sua senha no primeiro acesso.

Acesse: http://localhost:3004/login

🚀 Próximos Passos:
1. Faça login no sistema usando suas credenciais
2. Altere sua senha temporária
3. Complete seu perfil
4. Explore as funcionalidades do sistema

Se tiver dúvidas ou precisar de ajuda, entre em contato com nossa equipe de suporte.

⚠️ Este é um email de TESTE do sistema

---
© ${new Date().getFullYear()} Prevenção no Radar
      `
    };

    await transporter.sendMail(welcomeEmail);
    console.log('✅ Email de Boas-Vindas enviado com sucesso!\n');
    await sleep(2000);

  } catch (error) {
    console.error('❌ Erro ao enviar Email de Boas-Vindas:', error.message, '\n');
  }

  // ==========================================
  // 3. EMAIL DE CONFIRMAÇÃO DE TROCA DE SENHA
  // ==========================================
  console.log('📧 3/3 - Testando EMAIL DE CONFIRMAÇÃO DE TROCA DE SENHA...');
  try {
    const passwordChangedEmail = {
      from: `"Prevenção no Radar" <${emailUser}>`,
      to: emailUser,
      subject: '✅ Senha Alterada com Sucesso - Prevenção no Radar [TESTE]',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #16a34a; color: white; padding: 20px; text-align: center; border-radius: 5px 5px 0 0; }
            .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 5px 5px; }
            .button { display: inline-block; padding: 12px 30px; background-color: #ea580c; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
            .warning-box { background-color: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin: 15px 0; }
            .info-box { background-color: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; margin: 15px 0; }
            .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Senha Alterada</h1>
            </div>
            <div class="content">
              <h2>Olá Beto,</h2>
              <p>Sua senha foi <strong>alterada com sucesso</strong>!</p>

              <div class="info-box">
                <h3>📊 Detalhes da Alteração:</h3>
                <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}</p>
                <p><strong>IP:</strong> 192.168.1.100 (exemplo)</p>
                <p><strong>Navegador:</strong> Chrome (Windows)</p>
              </div>

              <div class="warning-box">
                <h3>⚠️ Não foi você?</h3>
                <p>Se você <strong>NÃO</strong> solicitou esta alteração, sua conta pode estar comprometida!</p>
                <p><strong>Ações recomendadas:</strong></p>
                <ul>
                  <li>Recupere sua senha imediatamente</li>
                  <li>Entre em contato com o suporte</li>
                  <li>Verifique acessos recentes à sua conta</li>
                </ul>
                <p style="text-align: center;">
                  <a href="http://localhost:3004/forgot-password" class="button">Recuperar Senha</a>
                </p>
              </div>

              <p>Se foi você quem alterou a senha, pode ignorar este email e continuar usando o sistema normalmente.</p>

              <p style="text-align: center;">
                <a href="http://localhost:3004/login" class="button">Fazer Login</a>
              </p>

              <p><strong>Dica de Segurança:</strong> Use senhas fortes, únicas e ative a autenticação em duas etapas sempre que possível.</p>

              <p><em>⚠️ Este é um email de TESTE do sistema</em></p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} Prevenção no Radar - Todos os direitos reservados</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Senha Alterada com Sucesso - Prevenção no Radar [TESTE]

Olá Beto,

Sua senha foi alterada com sucesso!

📊 Detalhes da Alteração:
Data/Hora: ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
IP: 192.168.1.100 (exemplo)
Navegador: Chrome (Windows)

⚠️ Não foi você?
Se você NÃO solicitou esta alteração, sua conta pode estar comprometida!

Ações recomendadas:
- Recupere sua senha imediatamente
- Entre em contato com o suporte
- Verifique acessos recentes à sua conta

Recuperar senha: http://localhost:3004/forgot-password

Se foi você quem alterou a senha, pode ignorar este email e continuar usando o sistema normalmente.

Fazer Login: http://localhost:3004/login

Dica de Segurança: Use senhas fortes, únicas e ative a autenticação em duas etapas sempre que possível.

⚠️ Este é um email de TESTE do sistema

---
© ${new Date().getFullYear()} Prevenção no Radar
      `
    };

    await transporter.sendMail(passwordChangedEmail);
    console.log('✅ Email de Confirmação de Troca de Senha enviado com sucesso!\n');

  } catch (error) {
    console.error('❌ Erro ao enviar Email de Confirmação:', error.message, '\n');
  }

  console.log('===================================');
  console.log('✅ TESTE COMPLETO FINALIZADO!');
  console.log('===================================');
  console.log(`\n📬 Verifique a caixa de entrada de: ${emailUser}`);
  console.log('(Não esqueça de verificar a pasta de SPAM)\n');
  console.log('Você deve ter recebido 3 emails:');
  console.log('1. 🔐 Recuperação de Senha');
  console.log('2. 🎉 Boas-Vindas');
  console.log('3. ✅ Confirmação de Troca de Senha');
  console.log('===================================\n');
}

testAllEmails();
