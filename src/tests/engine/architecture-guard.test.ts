import * as fs from 'fs';
import * as path from 'path';

/**
 * Architecture guard: the pure engine must never import UI, navigation,
 * animation, or persistence libraries. Fails the build if any engine file
 * references a forbidden module.
 */

const ENGINE_DIR = path.resolve(__dirname, '../../engine');

const FORBIDDEN_MODULES = [
  'react',
  'react-native',
  'expo',
  'expo-router',
  'zustand',
  '@react-native-async-storage/async-storage',
  'react-native-reanimated',
  'react-native-gesture-handler',
];

function collectTsFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectTsFiles(fullPath));
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath);
    }
  }
  return files;
}

/** Matches static imports, re-exports, and require() calls. */
function importedModules(source: string): string[] {
  const modules: string[] = [];
  const patterns = [
    /import\s[^'"]*['"]([^'"]+)['"]/g,
    /export\s[^'"]*from\s*['"]([^'"]+)['"]/g,
    /require\(\s*['"]([^'"]+)['"]\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      modules.push(match[1]);
    }
  }
  return modules;
}

function isForbidden(moduleName: string): boolean {
  return FORBIDDEN_MODULES.some(
    (forbidden) => moduleName === forbidden || moduleName.startsWith(`${forbidden}/`),
  );
}

describe('engine architecture guard', () => {
  const files = collectTsFiles(ENGINE_DIR);

  it('finds engine files to scan', () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it.each(files.map((file) => [path.relative(ENGINE_DIR, file), file]))(
    '%s has no forbidden imports',
    (_relative, fullPath) => {
      const source = fs.readFileSync(fullPath as string, 'utf8');
      const offending = importedModules(source).filter(isForbidden);
      expect(offending).toEqual([]);
    },
  );
});
