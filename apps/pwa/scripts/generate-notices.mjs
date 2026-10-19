import { readFile, readdir, writeFile } from 'node:fs/promises';

const root = new URL('../../../', import.meta.url);
const lock = JSON.parse(await readFile(new URL('package-lock.json', root), 'utf8'));
const sections = ['Third-party notices — golf practice PWA\nGenerated from the locked production dependencies.\n'];
for (const [path, entry] of Object.entries(lock.packages)) {
  if (!path.startsWith('node_modules/') || entry.dev || entry.link) continue;
  const directory = new URL(`${path}/`, root);
  try {
    const metadata = JSON.parse(await readFile(new URL('package.json', directory), 'utf8'));
    const names = (await readdir(directory)).filter(name => /^(license|licence|notice|copying)(\.|$)/i.test(name));
    sections.push(`\n===== ${metadata.name}@${metadata.version} — ${metadata.license || 'See upstream terms'} =====\n`);
    if (metadata.name === '@mediapipe/tasks-vision') {
      sections.push('Google / MediaPipe contributors. Apache-2.0.\nhttps://github.com/google-ai-edge/mediapipe\n');
      sections.push(await readFile(new URL('docs/licenses/Apache-2.0.txt', root), 'utf8'));
    }
    for (const name of names) sections.push(`\n--- ${name} ---\n${await readFile(new URL(name, directory), 'utf8')}`);
    if (!names.length && metadata.name !== '@mediapipe/tasks-vision') sections.push('License identifier above; see upstream package source for complete notices.\n');
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
sections.push('\nPose Landmarker Full float16 v1 (unmodified), Google / MediaPipe contributors.\nModel downloaded at runtime from Google Storage. Apache-2.0 per upstream maintainer clarification:\nhttps://github.com/google-ai-edge/mediapipe/issues/6306\n');
await writeFile(new URL('../dist/third-party-notices.txt', import.meta.url), sections.join('\n'));
