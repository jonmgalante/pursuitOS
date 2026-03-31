import { build, context } from 'esbuild';
import { cp, mkdir, rm } from 'node:fs/promises';
import path from 'node:path';

const watch = process.argv.includes('--watch');
const root = process.cwd();
const outdir = path.join(root, 'dist');

async function copyStaticFiles() {
  await cp(path.join(root, 'manifest.json'), path.join(outdir, 'manifest.json'));
  await cp(path.join(root, 'sidepanel.html'), path.join(outdir, 'sidepanel.html'));
}

async function createBuild() {
  await rm(outdir, { recursive: true, force: true });
  await mkdir(outdir, { recursive: true });

  const shared = {
    entryPoints: {
      background: path.join(root, 'src/background.ts'),
      content: path.join(root, 'src/content.ts'),
      sidepanel: path.join(root, 'src/sidepanel.ts')
    },
    outdir,
    bundle: true,
    format: 'esm',
    platform: 'browser',
    target: 'chrome120',
    sourcemap: true,
    logLevel: 'info'
  };

  if (watch) {
    const ctx = await context(shared);
    await ctx.watch();
    await copyStaticFiles();
    console.log('Watching extension files...');
    return;
  }

  await build(shared);
  await copyStaticFiles();
  console.log('Extension built to dist/.');
}

await createBuild();
