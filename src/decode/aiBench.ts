// Head-to-head accuracy test on labelled photos named like garter_1.jpg or rib_2.jpg.
//   npm run bench:ai -- path/to/photos [--only claude,gemini] [--limit 3]
// Keys come from ANTHROPIC_API_KEY and GEMINI_API_KEY, or are asked for without showing on screen.
// This spends real money on the keys it uses.
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import jpeg from 'jpeg-js';
import { fitLongSide, Raster } from '../vision/raster';
import { readFabric } from '../vision/pipeline';
import { loadImage } from '../vision/testing/loadImage';
import { ProviderId, TokenUsage } from './analysis';
import { buildAiImages, measurementSummary, runProvider } from './decodePhotos';
import { reconcile } from './reconcile';
import { StitchType } from '../types/knit';

const ACCEPT: Record<string, StitchType[]> = {
  stockinette: ['stockinette'],
  garter: ['garter'],
  rib: ['rib_1x1', 'rib_2x2', 'fishermans_rib', 'brioche'],
  seed: ['seed_stitch', 'moss_stitch'],
  reverse: ['reverse_stockinette'],
  moss: ['moss_stitch', 'seed_stitch'],
  cable: ['cable'],
  lace: ['lace'],
  // Fair Isle is a colour technique, so its stitch underneath is plain stockinette.
  fairisle: ['stockinette'],
};

/** List prices per million tokens, for the cost column only. Check them before relying on it. */
const PRICES: Record<ProviderId, { input: number; cached: number; output: number }> = {
  claude: { input: 4, cached: 0.2, output: 20 },
  gemini: { input: 0.75, cached: 0.075, output: 3.75 },
};
const ENV_KEY: Record<ProviderId, string> = { claude: 'ANTHROPIC_API_KEY', gemini: 'GEMINI_API_KEY' };

function askHidden(question: string): Promise<string> {
  let muted = false;
  const silent = new Writable({
    write(chunk, _encoding, done) {
      if (!muted) process.stdout.write(chunk);
      done();
    },
  });
  const rl = readline.createInterface({ input: process.stdin, output: silent, terminal: true });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer.trim());
    });
    muted = true;
  });
}

const encodeJpeg = async (raster: Raster) =>
  Buffer.from(jpeg.encode({ width: raster.width, height: raster.height, data: raster.data as unknown as Buffer }, 88).data).toString('base64');

const costOf = (provider: ProviderId, usage: TokenUsage) => {
  const price = PRICES[provider];
  return (usage.inputTokens * price.input + usage.cachedInputTokens * price.cached + usage.outputTokens * price.output) / 1e6;
};

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i >= 0 ? args.splice(i, 2)[1] : undefined;
  };
  const only = (flag('--only')?.split(',') as ProviderId[] | undefined) ?? (['claude', 'gemini'] as ProviderId[]);
  const limit = parseInt(flag('--limit') ?? '0', 10);
  const dir = args[0];
  if (!dir) throw new Error('Usage: npm run bench:ai -- path/to/photos');
  let files = fs.readdirSync(dir).filter((f) => /\.(jpe?g|png)$/i.test(f) && ACCEPT[f.split('_')[0]]).sort();
  if (limit) files = files.slice(0, limit);

  const keys = new Map<ProviderId, string>();
  for (const provider of only) {
    const key = process.env[ENV_KEY[provider]] || (await askHidden(`Paste your ${provider} key and press Enter (nothing will show; Enter alone skips): `));
    if (key) keys.set(provider, key);
  }
  if (keys.size === 0) throw new Error('No keys given.');

  type Row = { provider: ProviderId; file: string; said: string; confidence: number; right: boolean; finalConfidence: number; seconds: number; cost: number; error?: string };
  const rows: Row[] = [];
  for (const file of files) {
    const raster = fitLongSide(loadImage(path.join(dir, file)), 1600);
    const reading = readFabric(raster);
    const readings = [{ slot: 'closeup' as const, reading }];
    const images = await buildAiImages(readings, encodeJpeg);
    const accept = ACCEPT[file.split('_')[0]];
    for (const [provider, apiKey] of keys) {
      const started = Date.now();
      try {
        const result = await runProvider(provider, images, measurementSummary(readings), undefined, { apiKey, language: 'en' });
        const final = reconcile(readings, result.deduction, 'en');
        rows.push({
          provider,
          file,
          said: result.deduction.main_stitch,
          confidence: result.deduction.main_stitch_confidence,
          // A hat with a rib cuff and a plain body is right when either stitch is the labelled one.
          right: accept.includes(result.deduction.main_stitch) || accept.includes(result.deduction.edge_stitch as StitchType),
          finalConfidence: final.stitch.confidence,
          seconds: (Date.now() - started) / 1000,
          cost: costOf(provider, result.usage),
        });
      } catch (err) {
        rows.push({ provider, file, said: '-', confidence: 0, right: false, finalConfidence: 0, seconds: (Date.now() - started) / 1000, cost: 0, error: (err as Error).message });
      }
      const row = rows[rows.length - 1];
      console.log(
        `${provider.padEnd(7)} ${file.padEnd(24)} ${row.said.padEnd(20)} ${row.error ? `FAILED: ${row.error.slice(0, 70)}` : `${row.right ? 'right' : 'WRONG'}  said ${row.confidence.toFixed(2)}  app ${row.finalConfidence.toFixed(2)}  ${row.seconds.toFixed(0)}s  $${row.cost.toFixed(3)}`}`
      );
    }
  }

  console.log('\nprovider  right   wrong and sure  failed  avg time  avg cost');
  for (const provider of keys.keys()) {
    const mine = rows.filter((r) => r.provider === provider);
    const done = mine.filter((r) => !r.error);
    const right = done.filter((r) => r.right).length;
    const sureWrong = done.filter((r) => !r.right && r.finalConfidence >= 0.6).length;
    const avg = (fn: (r: Row) => number) => done.reduce((acc, r) => acc + fn(r), 0) / Math.max(1, done.length);
    console.log(
      `${provider.padEnd(9)} ${`${right}/${done.length}`.padEnd(7)} ${String(sureWrong).padEnd(15)} ${String(mine.length - done.length).padEnd(7)} ${`${avg((r) => r.seconds).toFixed(0)}s`.padEnd(9)} $${avg((r) => r.cost).toFixed(3)}`
    );
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
