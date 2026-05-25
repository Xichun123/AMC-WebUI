import { describe, expect, it } from 'vitest';
import { readProjectFile } from './projectFiles';

describe('header, message actions, and documentation guardrails', () => {
  it('removes dead Header prop references', () => {
    const source = readProjectFile('src/components/header/Header.tsx');

    expect(source).not.toContain('onOpenSettingsModal');
    expect(source).not.toContain('isKeyLocked');
  });

  it('removes dead MessageActions prop references', () => {
    const source = readProjectFile('src/components/message/MessageActions.tsx');

    expect(source).not.toContain('onTextToSpeech');
    expect(source).not.toContain('ttsMessageId');
  });

  it('does not document importmap/CDN runtime ownership as current architecture in README', () => {
    const source = readProjectFile('README.md');

    expect(source).not.toContain('import map');
    expect(source).not.toContain('通过 CDN 加载');
    expect(source).not.toContain('Tailwind CSS 3.4 (CDN)');
    expect(source).not.toContain('HTML import map 零构建');
  });

  it('does not advertise a dedicated ECharts renderer that is not implemented', () => {
    const zhReadme = readProjectFile('README.md');
    const enReadme = readProjectFile('README.en.md');

    expect(zhReadme).not.toContain('ECharts');
    expect(enReadme).not.toContain('ECharts');
  });

  it('keeps local Live Artifact demo artifacts out of git status', () => {
    const gitignore = readProjectFile('.gitignore');

    expect(gitignore).toContain('.playwright-visible-demo-profile/');
    expect(gitignore).toContain('tmp-live-artifact-demo/');
  });
});
