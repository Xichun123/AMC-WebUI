import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import { projectRoot, readProjectFile } from './projectFiles';

describe('project documentation structure', () => {
  it('keeps the shared chat input selector in the focused storage constants module', () => {
    const settingsDefaults = readProjectFile('src/constants/settingsDefaults.ts');
    const storageKeys = readProjectFile('src/constants/storageKeys.ts');

    expect(settingsDefaults).not.toContain("export * from './storageKeys';");
    expect(storageKeys).toContain('export const CHAT_INPUT_TEXTAREA_SELECTOR');
    expect(fs.existsSync(path.join(projectRoot, 'src/constants/domSelectors.ts'))).toBe(false);
  });

  it('documents the current source structure in both READMEs', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    for (const source of [zhReadme, enReadme]) {
      expect(source).toContain('src/features/');
      expect(source).toContain('src/i18n/');
      expect(source).toContain('src/pwa/');
      expect(source).toContain('src/schemas/');
      expect(source).toContain('src/test/');
      expect(source).toContain('local-python');
    }

    expect(zhReadme).not.toContain('Gemini / Pyodide / API / 日志等基础设施');
    expect(enReadme).not.toContain('Gemini, Pyodide, API, logging, and infrastructure services');
    expect(zhReadme).not.toContain('utils/                  # 导出、会话、IndexedDB');
    expect(enReadme).not.toContain('utils/                  # Export, session, IndexedDB');
  });

  it('distinguishes Docker runtime defaults from the static runtime-config template', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    expect(zhReadme).toContain('Docker 默认值');
    expect(zhReadme).toContain('public/runtime-config.js 模板');
    expect(enReadme).toContain('Docker default');
    expect(enReadme).toContain('public/runtime-config.js template');
  });

  it('documents Docker Compose source builds without requiring host build output', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    expect(zhReadme).toContain('Docker build 阶段会自动执行前端生产构建和 API TypeScript 构建');
    expect(enReadme).toContain('Docker build stage runs both the frontend production build and API TypeScript build');
  });

  it('serves module workers with a JavaScript MIME type in Docker', () => {
    const nginxConfig = readProjectFile('docker/nginx.conf');

    expect(nginxConfig).toMatch(/location\s+~\s+\\\.mjs\$/);
    expect(nginxConfig).toMatch(/types\s*\{[\s\S]*application\/javascript\s+[^;}]*\bmjs\b[\s\S]*\}/);
    expect(nginxConfig).toMatch(/location\s+~\s+\\\.mjs\$[\s\S]*Cache-Control "no-cache"/);
  });

  it('does not serve the app shell for missing hashed asset files in Docker', () => {
    const nginxConfig = readProjectFile('docker/nginx.conf');

    expect(nginxConfig).toMatch(/location\s+\^~\s+\/assets\/\s*\{[\s\S]*try_files\s+\$uri\s+=404;/);
  });

  it('does not cap API request bodies at the Nginx layer in Docker', () => {
    const nginxConfig = readProjectFile('docker/nginx.conf');

    expect(nginxConfig).toMatch(/client_max_body_size\s+0;/);
  });

  it('forces the app shell to revalidate after Docker redeploys', () => {
    const nginxConfig = readProjectFile('docker/nginx.conf');

    expect(nginxConfig).toMatch(/location\s+=\s+\/index\.html\s*\{[\s\S]*Cache-Control "no-cache"/);
    expect(nginxConfig).toMatch(/location\s+\/\s*\{[\s\S]*Cache-Control "no-cache"/);
  });

  it('protects the Docker app shell and same-origin API with the site auth check', () => {
    const nginxConfig = readProjectFile('docker/nginx.conf');

    expect(nginxConfig).toMatch(/absolute_redirect\s+off;/);
    expect(nginxConfig).toMatch(/location\s+=\s+\/api\/auth\/check\s*\{[\s\S]*internal;/);
    expect(nginxConfig).toMatch(/location\s+\/api\/\s*\{[\s\S]*auth_request\s+\/api\/auth\/check;/);
    expect(nginxConfig).toMatch(/location\s+\/\s*\{[\s\S]*auth_request\s+\/api\/auth\/check;/);
    expect(nginxConfig).toMatch(/location\s+=\s+\/login\s*\{[\s\S]*try_files\s+\/index\.html\s+=404;/);
    expect(nginxConfig).toMatch(/location\s+~\s+\^\/\([^}]*sidebar-logo\\\.png[^}]*\)\$/);
    expect(nginxConfig).toContain('return 302 /login?next=$request_uri;');
    expect(nginxConfig).toContain('{"error":"AUTH_REQUIRED"}');
  });

  it('describes local Python package loading precisely', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    expect(zhReadme).toContain('预加载 numpy、pandas、matplotlib');
    expect(zhReadme).toContain('按需安装 scipy、scikit-learn');
    expect(zhReadme).not.toContain('预装 numpy、pandas、matplotlib、scipy、scikit-learn');

    expect(enReadme).toContain('Preloads numpy, pandas, and matplotlib');
    expect(enReadme).toContain('installs scipy and scikit-learn on demand');
    expect(enReadme).not.toContain(
      'Bundled scientific stack such as numpy, pandas, matplotlib, scipy, and scikit-learn',
    );
  });
});
