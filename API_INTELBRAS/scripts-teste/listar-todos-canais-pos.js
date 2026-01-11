/**
 * Script para listar configurações de TODOS os canais POS
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
    return null;
  }
}

async function main() {
  console.log('Obtendo configurações ATMSniffer...\n');

  const atmSniffer = await getDVRConfig('ATMSniffer');
  if (!atmSniffer) {
    console.error('Erro ao obter configurações');
    return;
  }

  const lines = atmSniffer.split('\n');

  // Buscar em todos os 16 canais
  for (let i = 0; i < 16; i++) {
    const channelLines = lines.filter(l => l.startsWith(`table.ATMSniffer[${i}]`));

    if (channelLines.length === 0) continue;

    // Extrair configurações principais
    const enable = channelLines.find(l => l.includes('.Enable='))?.split('=')[1];
    const name = channelLines.find(l => l.includes('.Name='))?.split('=')[1];
    const protocol = channelLines.find(l => l.includes('.ProtocolName='))?.split('=')[1];
    const serverPort = channelLines.find(l => l.includes('.ServerPort='))?.split('=')[1];
    const delimiter = channelLines.find(l => l.includes('.Delimiter='))?.split('=')[1];
    const encoding = channelLines.find(l => l.includes('.SnifferEncode='))?.split('=')[1];
    const displayMode = channelLines.find(l => l.includes('.DisplayMode='))?.split('=')[1];
    const displayTime = channelLines.find(l => l.includes('.DisplayTime='))?.split('=')[1];

    // Só mostrar canais que têm pelo menos algumas configurações
    if (enable || name || protocol || serverPort) {
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`CANAL ${i} (Interface: Canal ${i + 1})`);
      console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`  Nome: ${name || 'N/A'}`);
      console.log(`  Habilitado: ${enable || 'N/A'}`);
      console.log(`  Protocolo: ${protocol || 'N/A'}`);
      console.log(`  Porta Servidor: ${serverPort || 'N/A'}`);
      console.log(`  Delimiter: ${delimiter || 'N/A'} ${delimiter ? '(hex: 0x' + Buffer.from(delimiter).toString('hex') + ')' : ''}`);
      console.log(`  Encoding: ${encoding || 'N/A'}`);
      console.log(`  DisplayMode: ${displayMode || 'N/A'}`);
      console.log(`  DisplayTime: ${displayTime || 'N/A'} seg`);
      console.log(`  Total de linhas de config: ${channelLines.length}`);
      console.log();

      // Se for o PDV1, destacar
      if (name && name.includes('PDV1')) {
        console.log(`  🎯 ESTE É O CANAL PDV1 QUE ESTAMOS PROCURANDO!`);
        console.log();
      }
    }
  }
}

main().catch(console.error);
