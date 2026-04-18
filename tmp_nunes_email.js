/**
 * Configurar senha de app do Gmail no DVR do Nunes via API Intelbras/Dahua
 * Roda do container nunes-backend usando 172.20.0.1:38100 (tunel SSH)
 */
const http = require('http');
const crypto = require('crypto');

const DVR = { host: '172.20.0.1', port: 38100, user: 'admin', pass: 'a3seg123' };
const GMAIL_APP_PASS = 'kqjmqitwwxxwojsc';

function req(path, authHeader = null) {
  return new Promise((resolve, reject) => {
    const opts = { hostname: DVR.host, port: DVR.port, path, method: 'GET', headers: {} };
    if (authHeader) opts.headers['Authorization'] = authHeader;
    const r = http.request(opts, (res) => {
      let body = '';
      res.on('data', (c) => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    r.on('error', reject);
    r.setTimeout(15000, () => { r.destroy(); reject(new Error('timeout')); });
    r.end();
  });
}

function digestAuth(wwwAuth, uri) {
  const realm = /realm="([^"]+)"/.exec(wwwAuth)?.[1];
  const nonce = /nonce="([^"]+)"/.exec(wwwAuth)?.[1];
  const qop = /qop="([^"]+)"/.exec(wwwAuth)?.[1];
  if (!realm || !nonce) return null;
  const nc = '00000001';
  const cnonce = crypto.randomBytes(8).toString('hex');
  const ha1 = crypto.createHash('md5').update(`${DVR.user}:${realm}:${DVR.pass}`).digest('hex');
  const ha2 = crypto.createHash('md5').update(`GET:${uri}`).digest('hex');
  const response = qop
    ? crypto.createHash('md5').update(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`).digest('hex')
    : crypto.createHash('md5').update(`${ha1}:${nonce}:${ha2}`).digest('hex');
  let h = `Digest username="${DVR.user}", realm="${realm}", nonce="${nonce}", uri="${uri}", response="${response}"`;
  if (qop) h += `, qop=${qop}, nc=${nc}, cnonce="${cnonce}"`;
  return h;
}

async function apiSet(key, value) {
  const path = `/cgi-bin/configManager.cgi?action=setConfig&MailServer.${key}=${encodeURIComponent(value)}`;
  let r = await req(path);
  if (r.status === 401 && r.headers['www-authenticate']) {
    const auth = digestAuth(r.headers['www-authenticate'], path);
    if (auth) r = await req(path, auth);
  }
  const ok = /^OK/i.test(r.body.trim()) || r.body.includes('ok');
  console.log(`  ${ok ? '✅' : '⚠️'}  ${key} = ${value.length > 20 ? value.substring(0, 20) + '...' : value} | HTTP ${r.status} | ${r.body.substring(0, 80).trim()}`);
  return ok;
}

async function apiGet(key) {
  const path = `/cgi-bin/configManager.cgi?action=getConfig&name=MailServer`;
  let r = await req(path);
  if (r.status === 401 && r.headers['www-authenticate']) {
    const auth = digestAuth(r.headers['www-authenticate'], path);
    if (auth) r = await req(path, auth);
  }
  return r.body;
}

(async () => {
  console.log(`\n=== CONFIGURAR EMAIL DO DVR NUNES ===`);
  console.log(`DVR: ${DVR.host}:${DVR.port} (via tunel SSH)`);
  console.log(`Gmail App Password: ${GMAIL_APP_PASS.length} caracteres\n`);

  console.log(`📋 Config ANTES:\n`);
  const before = await apiGet();
  const pwdBefore = /MailServer\.Password=([^\r\n]*)/.exec(before)?.[1] || '';
  console.log(`   Password atual: ${pwdBefore.length} caracteres ${pwdBefore.length > 16 ? '(BUG: deveria ser 16)' : ''}`);

  console.log(`\n⚙️  Aplicando nova senha de app...\n`);
  await apiSet('Password', GMAIL_APP_PASS);

  console.log(`\n📋 Config DEPOIS:\n`);
  const after = await apiGet();
  const pwdAfter = /MailServer\.Password=([^\r\n]*)/.exec(after)?.[1] || '';
  console.log(`   Password agora: ${pwdAfter.length} caracteres ${pwdAfter.length === 16 ? '✅' : '❌ (ainda com bug)'}`);

  console.log(`\n✅ Feito. Teste o envio pelo botão "Teste" no painel do DVR.\n`);
})().catch(e => { console.error('ERR:', e.message); process.exit(1); });
