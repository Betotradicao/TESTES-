/**
 * Script para verificar configurações do Canal POS 5 (PDV1) via API Intelbras
 *
 * Uso:
 * node verificar-config-pos-canal5.js
 */

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const DVR_IP = '10.6.1.123';
const DVR_USER = 'admin';
const DVR_PASS = 'beto3107@';

async function getDVRConfig(configName) {
  const cmd = `curl -s -u "${DVR_USER}:${DVR_PASS}" --digest "http://${DVR_IP}/cgi-bin/configManager.cgi?action=getConfig&name=${configName}"`;

  try {
    const { stdout } = await execPromise(cmd);
    return stdout;
  } catch (error) {
    console.error(`Erro ao obter ${configName}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('='.repeat(80));
  console.log(' VERIFICAÇÃO DE CONFIGURAÇÕES DO DVR INTELBRAS - CANAL POS 5 (PDV1)');
  console.log('='.repeat(80));
  console.log();

  // 1. Informações do Sistema
  console.log('📋 1. INFORMAÇÕES DO SISTEMA');
  console.log('-'.repeat(80));
  const systemInfo = await getDVRConfig('SystemInfo');
  if (systemInfo) {
    const processor = systemInfo.match(/processor=(.+)/)?.[1];
    const serial = systemInfo.match(/serialNumber=(.+)/)?.[1];
    const updateSerial = systemInfo.match(/updateSerial=(.+)/)?.[1];
    console.log(`Processador: ${processor}`);
    console.log(`Serial: ${serial}`);
    console.log(`Update Serial: ${updateSerial}`);
  }
  console.log();

  // 2. Configurações ATM/POS Gerais
  console.log('🔧 2. CONFIGURAÇÕES ATM/POS GERAIS');
  console.log('-'.repeat(80));
  const atmConfig = await getDVRConfig('ATM');
  if (atmConfig) {
    const dataSource = atmConfig.match(/table\.ATM\.DataSource=(.+)/)?.[1];
    const displayTime = atmConfig.match(/table\.ATM\.DisplayTime=(.+)/)?.[1];
    const protocol = atmConfig.match(/table\.ATM\.ProtocolName=(.+)/)?.[1];
    const displayPos = atmConfig.match(/table\.ATM\.DisplayPostion=(.+)/)?.[1];

    console.log(`DataSource: ${dataSource}`);
    console.log(`DisplayTime: ${displayTime} segundos`);
    console.log(`ProtocolName: ${protocol}`);
    console.log(`DisplayPosition: ${displayPos}`);

    // Canais habilitados para gravação POS
    const recordChannels = [];
    const matches = atmConfig.matchAll(/table\.ATM\.RecordChannels\[(\d+)\]=(\d+)/g);
    for (const match of matches) {
      recordChannels.push(parseInt(match[2]));
    }
    console.log(`Canais com gravação POS: ${recordChannels.length} canais`);
  }
  console.log();

  // 3. ATMSniffer - Configurações específicas do Canal 5
  console.log('📡 3. CONFIGURAÇÕES DO CANAL 5 (ATMSniffer[4])');
  console.log('-'.repeat(80));
  const atmSniffer = await getDVRConfig('ATMSniffer');
  if (atmSniffer) {
    // Buscar configurações do canal 4 (índice 0-based = Canal 5)
    const lines = atmSniffer.split('\n');
    const channel4Config = lines.filter(line => line.includes('ATMSniffer[4]'));

    // Extrair configurações importantes
    const enable = channel4Config.find(l => l.includes('.Enable='))?. split('=')[1];
    const protocol = channel4Config.find(l => l.includes('.ProtocolName='))?.split('=')[1];
    const encoding = channel4Config.find(l => l.includes('.SnifferEncode='))?.split('=')[1];
    const serverPort = channel4Config.find(l => l.includes('.ServerPort='))?.split('=')[1];
    const delimiter = channel4Config.find(l => l.includes('.Delimiter='))?.split('=')[1];
    const displayMode = channel4Config.find(l => l.includes('.DisplayMode='))?.split('=')[1];
    const displayTime = channel4Config.find(l => l.includes('.DisplayTime='))?.split('=')[1];
    const fontSize = channel4Config.find(l => l.includes('.FontSize='))?.split('=')[1];
    const textColor = channel4Config.find(l => l.includes('.TextColor='))?.split('=')[1];

    console.log(`Enable: ${enable || 'N/A'}`);
    console.log(`Protocol: ${protocol || 'N/A'}`);
    console.log(`Encoding: ${encoding || 'N/A'}`);
    console.log(`ServerPort: ${serverPort || 'N/A'}`);
    console.log(`Delimiter: ${delimiter || 'N/A'} ${delimiter ? '(hex: ' + Buffer.from(delimiter).toString('hex') + ')' : ''}`);
    console.log(`DisplayMode: ${displayMode || 'N/A'}`);
    console.log(`DisplayTime: ${displayTime || 'N/A'} segundos`);
    console.log(`FontSize: ${fontSize || 'N/A'}`);
    console.log(`TextColor: ${textColor || 'N/A'}`);

    console.log();
    console.log('Linhas de configuração encontradas: ' + channel4Config.length);

    if (channel4Config.length < 10) {
      console.log();
      console.log('⚠️  AVISO: Poucas configurações encontradas para o canal 5!');
      console.log('Isso pode indicar que o canal não está totalmente configurado.');
    }
  }
  console.log();

  // 4. VideoWidget - Overlay de texto
  console.log('🎨 4. VIDEO WIDGET (Overlay de texto)');
  console.log('-'.repeat(80));
  const videoWidget = await getDVRConfig('VideoWidget');
  if (videoWidget) {
    // Buscar CustomTitle do canal 0 (exemplo que vimos)
    const customTitle = videoWidget.match(/table\.VideoWidget\[0\]\.CustomTitle\[0\]\.Text=(.+)/)?.[1];
    if (customTitle) {
      console.log(`Texto no overlay do Canal 0: "${customTitle}"`);
    }

    // Verificar se tem overlay para canal 4 também
    const lines = videoWidget.split('\n');
    const channel4Widgets = lines.filter(l => l.includes('VideoWidget[4]') && l.includes('CustomTitle'));
    if (channel4Widgets.length > 0) {
      console.log();
      console.log('Overlays encontrados no Canal 4 (Canal 5):');
      channel4Widgets.slice(0, 10).forEach(line => {
        const match = line.match(/CustomTitle\[(\d+)\]\.Text=(.+)/);
        if (match) {
          console.log(`  - CustomTitle[${match[1]}]: "${match[2]}"`);
        }
      });
    }
  }
  console.log();

  // 5. Resumo e Diagnóstico
  console.log('💡 5. DIAGNÓSTICO E RECOMENDAÇÕES');
  console.log('-'.repeat(80));

  if (atmConfig && atmConfig.includes('DisplayTime=180')) {
    console.log('✅ DisplayTime global: 180 segundos (3 minutos) - BOM');
  } else {
    console.log('⚠️  DisplayTime pode estar muito curto (<180s) - risco de múltiplas gravações');
  }

  if (atmConfig && atmConfig.includes('DataSource=Net')) {
    console.log('✅ DataSource=Net - DVR configurado para receber via rede TCP');
  }

  if (atmConfig && atmConfig.includes('ProtocolName=ATM/POS')) {
    console.log('✅ Protocolo ATM/POS ativo');
  }

  console.log();
  console.log('📝 PRÓXIMOS PASSOS:');
  console.log('   1. Verificar se ServerPort do canal 5 está em 38800');
  console.log('   2. Confirmar Delimiter está como 7C (pipe |)');
  console.log('   3. Verificar DisplayMode (Página ou Lista)');
  console.log('   4. Confirmar Encoding está como UTF-8');
  console.log();
  console.log('='.repeat(80));
}

main().catch(console.error);
