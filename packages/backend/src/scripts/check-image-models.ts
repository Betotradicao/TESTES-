import { ConfigurationService } from '../services/configuration.service';
import { AppDataSource } from '../config/database';

(async () => {
  await AppDataSource.initialize();
  const key = await ConfigurationService.get('openai_api_key', '');
  if (!key) { console.log('NO KEY'); process.exit(1); }
  const r = await fetch('https://api.openai.com/v1/models', {
    headers: { 'Authorization': `Bearer ${key}` }
  });
  const j: any = await r.json();
  if (j.error) { console.log('ERROR:', JSON.stringify(j.error)); process.exit(1); }
  const imageModels = (j.data || []).filter((m: any) => /image|dalle|dall-e/i.test(m.id));
  console.log('IMAGE MODELS:', JSON.stringify(imageModels.map((m: any) => m.id).sort(), null, 2));
  console.log('\nTotal models:', (j.data || []).length);
  console.log('Has gpt-image-1:', (j.data || []).some((m: any) => m.id === 'gpt-image-1'));
  console.log('Has gpt-image-2:', (j.data || []).some((m: any) => m.id === 'gpt-image-2'));

  console.log('\n--- Tentando uma chamada de teste pra gpt-image-2 ---');
  try {
    const t = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-image-2', prompt: 'test', n: 1, size: '1024x1024' })
    });
    const tj: any = await t.json();
    console.log('Status:', t.status);
    console.log('Body:', JSON.stringify(tj).slice(0, 500));
  } catch (e: any) {
    console.log('FETCH ERROR:', e.message);
  }
  process.exit(0);
})();
