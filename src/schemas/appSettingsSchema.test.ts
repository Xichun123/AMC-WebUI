import { describe, expect, it } from 'vitest';
import { sanitizeImportedAppSettings } from './appSettingsSchema';

describe('appSettingsSchema', () => {
  it('preserves custom Live Artifacts prompts from imported settings', () => {
    const settings = sanitizeImportedAppSettings({
      liveArtifactsSystemPrompt: 'Custom Live Artifacts prompt',
    });

    expect((settings as { liveArtifactsSystemPrompt?: string }).liveArtifactsSystemPrompt).toBe(
      'Custom Live Artifacts prompt',
    );
  });

  it('defaults missing custom Live Artifacts prompts to blank', () => {
    const settings = sanitizeImportedAppSettings({});

    expect((settings as { liveArtifactsSystemPrompt?: string }).liveArtifactsSystemPrompt).toBe('');
  });

  it('preserves only the inline custom Live Artifacts prompt from imported settings', () => {
    const settings = sanitizeImportedAppSettings({
      liveArtifactsSystemPrompts: {
        inline: 'Inline custom prompt',
        full: 'Full custom prompt',
        fullHtml: 'Complete HTML custom prompt',
        unsupported: 'Ignore me',
      },
    });

    expect(
      (
        settings as {
          liveArtifactsSystemPrompts?: Record<string, string>;
        }
      ).liveArtifactsSystemPrompts,
    ).toEqual({
      inline: 'Inline custom prompt',
    });
  });

  it('defaults Live Artifacts built-in prompt mode to inline', () => {
    const settings = sanitizeImportedAppSettings({});

    expect(settings.liveArtifactsPromptMode).toBe('inline');
  });

  it('preserves the graphite theme from imported settings', () => {
    const settings = sanitizeImportedAppSettings({
      themeId: 'graphite',
    });

    expect(settings.themeId).toBe('graphite');
  });

  it('falls back to inline when importing retired Live Artifacts prompt modes', () => {
    const fullSettings = sanitizeImportedAppSettings({
      liveArtifactsPromptMode: 'full',
    });
    const fullHtmlSettings = sanitizeImportedAppSettings({
      liveArtifactsPromptMode: 'fullHtml',
    });

    expect(fullSettings.liveArtifactsPromptMode).toBe('inline');
    expect(fullHtmlSettings.liveArtifactsPromptMode).toBe('inline');
  });

  it('preserves enabled third-party API mode from imported settings', () => {
    const settings = sanitizeImportedAppSettings({
      apiMode: 'third-party',
      isThirdPartyApiEnabled: true,
      thirdPartyApi: {
        activeProvider: 'anthropic',
        providers: {
          anthropic: {
            apiKey: 'sk-ant-test',
            baseUrl: 'https://api.anthropic.com',
            modelId: 'claude-test',
            models: [{ id: 'claude-test', name: 'Claude Test', isPinned: true }],
            protocol: 'anthropic',
            enabled: true,
          },
        },
      },
    });

    expect(settings.apiMode).toBe('third-party');
    expect(settings.isThirdPartyApiEnabled).toBe(true);
    expect(settings.thirdPartyApi.activeProvider).toBe('anthropic');
    expect(settings.thirdPartyApi.providers.anthropic.modelId).toBe('claude-test');
    expect(settings.thirdPartyApi.providers.anthropic.enabled).toBe(true);
  });

  it('falls back to Gemini mode when imported third-party API mode is disabled', () => {
    const settings = sanitizeImportedAppSettings({
      apiMode: 'third-party',
      isThirdPartyApiEnabled: false,
    });

    expect(settings.apiMode).toBe('gemini-native');
  });

  it('preserves valid Live Artifacts custom font size settings from imported settings', () => {
    const settings = sanitizeImportedAppSettings({
      liveArtifactsCustomFontSize: 22,
    });

    expect(settings.liveArtifactsCustomFontSize).toBe(22);
  });

  it('falls back for invalid Live Artifacts custom font size settings', () => {
    const settings = sanitizeImportedAppSettings({
      liveArtifactsCustomFontSize: 99,
    });

    expect(settings.liveArtifactsCustomFontSize).toBe(16);
  });

  it('preserves valid MCP server settings from imported settings', () => {
    const settings = sanitizeImportedAppSettings({
      mcpServers: [
        {
          id: 'filesystem',
          name: 'Filesystem',
          enabled: true,
          transport: 'stdio',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          env: {
            DEBUG: 'mcp:*',
          },
        },
        {
          id: 'remote-search',
          name: 'Remote Search',
          enabled: false,
          transport: 'http',
          url: 'https://mcp.example.com/mcp',
          headers: {
            authorization: 'Bearer token',
          },
          auth: {
            type: 'bearer',
            token: 'remote-token',
          },
        },
      ],
    });

    expect(settings.mcpServers).toEqual([
      {
        id: 'filesystem',
        name: 'Filesystem',
        enabled: true,
        transport: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
        env: {
          DEBUG: 'mcp:*',
        },
      },
      {
        id: 'remote-search',
        name: 'Remote Search',
        enabled: false,
        transport: 'http',
        url: 'https://mcp.example.com/mcp',
        headers: {
          authorization: 'Bearer token',
        },
        auth: {
          type: 'bearer',
          token: 'remote-token',
        },
      },
    ]);
  });

  it('drops invalid MCP server entries from imported settings', () => {
    const settings = sanitizeImportedAppSettings({
      mcpServers: [
        {
          id: 'valid',
          name: 'Valid',
          enabled: true,
          transport: 'stdio',
          command: 'node',
          args: ['server.js', 42],
          env: {
            KEEP: 'yes',
            DROP: 1,
          },
        },
        {
          id: '',
          name: 'Missing ID',
          enabled: true,
          transport: 'stdio',
          command: 'node',
        },
        {
          id: 'unsupported',
          name: 'Unsupported',
          enabled: true,
          transport: 'websocket',
        },
        {
          id: 'file-url',
          name: 'File URL',
          enabled: true,
          transport: 'http',
          url: 'file:///tmp/mcp',
        },
      ],
    });

    expect(settings.mcpServers).toEqual([
      {
        id: 'valid',
        name: 'Valid',
        enabled: true,
        transport: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: {
          KEEP: 'yes',
        },
      },
    ]);
  });
});
