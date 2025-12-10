╔════════════════════════════════════════════════════════════════════════╗
║                                                                        ║
║              INSTALADOR AUTOMÁTICO - Roberto Prevenção                ║
║                    Pasta de Arquivos Necessários                      ║
║                                                                        ║
╚════════════════════════════════════════════════════════════════════════╝

📋 INSTRUÇÕES PARA PREPARAR ESTA PASTA:

Esta pasta deve conter os instaladores necessários para instalação
offline do sistema.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📥 ARQUIVO 1: Docker Desktop Installer

  Nome do arquivo: Docker Desktop Installer.exe

  📍 Como Baixar:

  Opção 1 (Recomendada):
    1. Acesse: https://www.docker.com/products/docker-desktop/
    2. Clique em "Download for Windows"
    3. Salve o arquivo nesta pasta

  Opção 2 (Link Direto):
    1. Acesse: https://docs.docker.com/desktop/install/windows-install/
    2. Na seção "Install Docker Desktop on Windows"
    3. Clique em "Docker Desktop for Windows"
    4. Salve o arquivo nesta pasta

  Opção 3 (Via Winget - Se tiver Windows 11):
    1. Abra PowerShell como Administrador
    2. Execute: winget download Docker.DockerDesktop
    3. Copie o arquivo baixado para esta pasta

  ⚠️  Tamanho aproximado: 500-700 MB

  ✅  Após baixar, renomeie para: "Docker Desktop Installer.exe"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📥 ARQUIVO 2 (OPCIONAL): Node.js Installer

  Nome do arquivo: node-v20-x64.msi

  📍 Como Baixar:

    1. Acesse: https://nodejs.org/
    2. Baixe a versão LTS (Long Term Support)
    3. Escolha "Windows Installer (.msi)" 64-bit
    4. Salve o arquivo nesta pasta

  ⚠️  Tamanho aproximado: 30-40 MB

  ℹ️  Este arquivo é OPCIONAL. Só é necessário se o cliente não
      puder usar Docker e precisar rodar o sistema sem containers.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ ESTRUTURA FINAL DA PASTA:

  INSTALADORAUTOMATICO\
  ├── Docker Desktop Installer.exe  ⭐ OBRIGATÓRIO
  ├── node-v20-x64.msi              ⚪ OPCIONAL
  └── README.txt                    (este arquivo)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 VERIFICAÇÃO:

  Antes de ir ao cliente, verifique:

  □ Arquivo "Docker Desktop Installer.exe" está nesta pasta
  □ Tamanho do arquivo é maior que 400 MB
  □ Consegue executar o instalador (teste em uma VM)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📞 PROBLEMAS AO BAIXAR?

  Se não conseguir baixar pelo site:

  1. Tente usar outro navegador
  2. Desabilite antivírus temporariamente
  3. Use conexão diferente (celular em modo tethering)
  4. Peça para alguém baixar e enviar via pen drive
  5. Use o winget (Windows 11): winget download Docker.DockerDesktop

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Última atualização: 2025-12-07
