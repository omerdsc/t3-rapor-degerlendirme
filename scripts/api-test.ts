/** Minimal bağlantı testi — birkaç yüz token, maliyeti ihmal edilebilir. */
import { readFileSync, existsSync } from 'node:fs';
import { ClaudeIstemcisi, MODEL } from '../src/lib/ai/istemci';

function ortamYukle() {
  if (!existsSync('.env.local')) return;
  for (const satir of readFileSync('.env.local', 'utf-8').split('\n')) {
    const m = satir.match(/^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/);
    if (!m) continue;
    const d = m[2].trim().replace(/^["']|["']$/g, '');
    if (d && !process.env[m[1]]) process.env[m[1]] = d;
  }
}

async function main() {
  ortamYukle();
  const anahtar = process.env.ANTHROPIC_API_KEY;
  if (!anahtar || anahtar.startsWith('buraya-')) {
    console.log('✕ ANTHROPIC_API_KEY yok'); return;
  }
  console.log(`anahtar: ${anahtar.slice(0, 11)}…${anahtar.slice(-4)}  (${anahtar.length} karakter)`);
  console.log(`model  : ${MODEL}\n`);

  const istemci = new ClaudeIstemcisi();
  const { yanit, kullanim } = await istemci.cagir({
    model: MODEL,
    max_tokens: 100,
    messages: [{ role: 'user', content: 'Tek cümleyle yanıtla: bağlantı çalışıyor mu?' }],
  });

  const metin = yanit.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  console.log('✓ yanıt:', metin.trim());
  console.log(`  ${kullanim.girdiToken} girdi / ${kullanim.ciktiToken} çıktı token · $${kullanim.maliyet.toFixed(6)}`);
}
main().catch((e) => { console.error('✕', e.message); process.exit(1); });
