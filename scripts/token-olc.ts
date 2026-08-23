/** PDF'in gerçek token maliyetini ölçer. count_tokens ücretsizdir. */
import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, existsSync } from 'node:fs';

function ortamYukle() {
  if (!existsSync('.env.local')) return;
  for (const s of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = s.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (m && m[2].trim() && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

async function main() {
  ortamYukle();
  const c = new Anthropic();
  for (const yol of process.argv.slice(2)) {
    const b64 = readFileSync(yol).toString('base64');
    const r = await c.messages.countTokens({
      model: 'claude-opus-5',
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: b64 } },
          { type: 'text', text: 'x' },
        ],
      }],
    });
    const ad = yol.split(/[\/]/).pop();
    const girdiUSD = (r.input_tokens * 5) / 1e6;
    console.log(`${ad}`);
    console.log(`  ${r.input_tokens.toLocaleString('tr')} token · tam fiyat $${girdiUSD.toFixed(4)} · cache okuma $${(girdiUSD * 0.1).toFixed(4)}`);
  }
}
main().catch((e) => { console.error(e.message); process.exit(1); });
