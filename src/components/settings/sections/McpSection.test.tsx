import { act, type ComponentProps } from 'react';
import { fireEvent } from '@testing-library/react';
import { DEFAULT_APP_SETTINGS } from '@/constants/settingsDefaults';
import { renderWithProviders, setupProviderTestRenderer as setupTestRenderer } from '@/test/render/providerRenderer';
import type { AppSettings } from '@/types';
import { McpSection } from './McpSection';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMcpServerCapabilitiesMock = vi.hoisted(() => vi.fn());

vi.mock('@/services/api/mcpApi', () => ({
  fetchMcpServerCapabilities: fetchMcpServerCapabilitiesMock,
}));

describe('McpSection', () => {
  const renderer = setupTestRenderer({ providers: { language: 'en' } });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderMcpSection = async (overrides: Partial<ComponentProps<typeof McpSection>> = {}) => {
    await act(async () => {
      renderer.root.render(<McpSection settings={DEFAULT_APP_SETTINGS} onUpdate={vi.fn()} {...overrides} />);
    });
  };

  it('updates only the edited server when multiple MCP servers share the same id', async () => {
    const onUpdate = vi.fn();
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      mcpServers: [
        {
          id: 'duplicate',
          name: 'First Server',
          enabled: true,
          transport: 'stdio',
          command: 'npx',
        },
        {
          id: 'duplicate',
          name: 'Second Server',
          enabled: true,
          transport: 'stdio',
          command: 'node',
        },
      ],
    };

    await renderMcpSection({ settings, onUpdate });

    const nameInputs = Array.from(renderer.container.querySelectorAll<HTMLInputElement>('input')).filter(
      (input) => input.value === 'First Server' || input.value === 'Second Server',
    );
    expect(nameInputs).toHaveLength(2);

    await act(async () => {
      fireEvent.change(nameInputs[1], { target: { value: 'Renamed Second Server' } });
    });

    expect(onUpdate).toHaveBeenCalledWith('mcpServers', [
      settings.mcpServers[0],
      {
        ...settings.mcpServers[1],
        name: 'Renamed Second Server',
      },
    ]);
  });

  it('tests a server and shows discovered MCP capabilities', async () => {
    fetchMcpServerCapabilitiesMock.mockResolvedValue({
      tools: [{ name: 'read_file' }],
      resources: [{ uri: 'file:///tmp/readme.md', name: 'README' }],
      resourceTemplates: [{ uriTemplate: 'file:///{path}', name: 'File' }],
      prompts: [{ name: 'summarize' }],
    });
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      mcpServers: [
        {
          id: 'remote',
          name: 'Remote',
          enabled: true,
          transport: 'http',
          url: 'https://mcp.example.com/mcp',
        },
      ],
    };

    await renderMcpSection({ settings });

    const testButton = Array.from(renderer.container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Test',
    );
    expect(testButton).not.toBeUndefined();

    await act(async () => {
      fireEvent.click(testButton!);
    });

    expect(fetchMcpServerCapabilitiesMock).toHaveBeenCalledWith(settings.mcpServers[0]);
    expect(renderer.container.textContent).toContain('Tools 1');
    expect(renderer.container.textContent).toContain('Resources 2');
    expect(renderer.container.textContent).toContain('Prompts 1');
  });

  it('keeps the Chinese add-server action on one line', async () => {
    const zhRenderer = renderWithProviders(<McpSection settings={DEFAULT_APP_SETTINGS} onUpdate={vi.fn()} />, {
      language: 'zh',
    });

    const addButton = Array.from(zhRenderer.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('添加服务器'),
    );

    expect(addButton).not.toBeUndefined();
    expect(addButton?.className).toContain('whitespace-nowrap');
    expect(addButton?.className).toContain('shrink-0');
  });

  it('adds a localized default server name in Chinese', async () => {
    const onUpdate = vi.fn();
    const zhRenderer = renderWithProviders(<McpSection settings={DEFAULT_APP_SETTINGS} onUpdate={onUpdate} />, {
      language: 'zh',
    });
    const addButton = Array.from(zhRenderer.container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('添加服务器'),
    );

    await act(async () => {
      fireEvent.click(addButton!);
    });

    expect(onUpdate).toHaveBeenCalledWith('mcpServers', [
      expect.objectContaining({
        name: '新 MCP 服务器',
      }),
    ]);
  });

  it('keeps duplicate server ids from creating duplicate enabled control ids', async () => {
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      mcpServers: [
        {
          id: 'duplicate',
          name: 'First Server',
          enabled: true,
          transport: 'stdio',
          command: 'npx',
        },
        {
          id: 'duplicate',
          name: 'Second Server',
          enabled: false,
          transport: 'stdio',
          command: 'node',
        },
      ],
    };

    await renderMcpSection({ settings });

    const enabledIds = Array.from(renderer.container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')).map(
      (input) => input.id,
    );

    expect(enabledIds).toHaveLength(2);
    expect(new Set(enabledIds).size).toBe(2);
    enabledIds.forEach((id) => {
      expect(renderer.container.querySelector(`label[for="${id}"]`)).not.toBeNull();
    });
  });

  it('contains long server names in the card header', async () => {
    const longName = 'A very long MCP server name that should stay contained inside the card header';
    const settings: AppSettings = {
      ...DEFAULT_APP_SETTINGS,
      mcpServers: [
        {
          id: 'long-name',
          name: longName,
          enabled: true,
          transport: 'stdio',
          command: 'npx',
        },
      ],
    };

    await renderMcpSection({ settings });

    const serverLabel = Array.from(renderer.container.querySelectorAll('label')).find(
      (label) => label.textContent === longName,
    );
    const header = serverLabel?.closest('[data-mcp-server-card-header]');
    const actions = header?.querySelector('[data-mcp-server-card-actions]');

    expect(serverLabel?.className).toContain('truncate');
    expect(serverLabel?.parentElement?.className).toContain('min-w-0');
    expect(header?.className).toContain('sm:flex-row');
    expect(actions?.className).toContain('shrink-0');
  });
});
