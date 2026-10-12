// Test-only Workers binding replacement; real runtime continues using cloudflare:workers.
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'cloudflare:workers')
    return {
      url: 'data:text/javascript,export const env = globalThis.__orbitTestEnv;',
      shortCircuit: true,
    };
  if (
    specifier.startsWith('.') &&
    context.parentURL?.startsWith('file:') &&
    !/\.[a-z]+$/i.test(specifier)
  ) {
    const url = new URL(specifier + '.ts', context.parentURL);
    if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
  }
  return nextResolve(specifier, context);
}
