import React, { useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import type { AppSettings, McpServerAuthType, McpServerConfig, McpServerTransport } from '@/types';
import { useI18n } from '@/contexts/I18nContext';
import { SETTINGS_INPUT_CLASS } from '@/constants/formClasses';
import { fetchMcpServerCapabilities, type McpServerCapabilities } from '@/services/api/mcpApi';

interface McpSectionProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const inputBaseClasses =
  'w-full rounded-lg border p-2.5 text-sm transition-all duration-200 focus:ring-2 focus:ring-offset-0';
const labelClasses = 'text-xs font-semibold uppercase tracking-wider text-[var(--theme-text-tertiary)]';
const secondaryButtonClass =
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border border-[var(--theme-border-secondary)] px-3 py-1.5 text-xs font-medium text-[var(--theme-text-secondary)] transition-colors hover:bg-[var(--theme-bg-tertiary)] hover:text-[var(--theme-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]';

type CapabilityTestState =
  | { status: 'loading' }
  | { status: 'success'; capabilities: McpServerCapabilities }
  | { status: 'error'; error: string };

const createMcpServer = (name: string): McpServerConfig => ({
  id: `mcp-${Date.now()}`,
  name,
  enabled: false,
  transport: 'stdio',
  command: '',
  args: [],
  env: {},
});

const getCapabilityStateKey = (server: McpServerConfig, index: number): string =>
  `${server.id || 'mcp-server'}-${index}`;

const formatLines = (items: string[] | undefined): string => (items ?? []).join('\n');

const parseLines = (value: string): string[] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const formatRecord = (record: Record<string, string> | undefined): string =>
  Object.entries(record ?? {})
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');

const parseRecord = (value: string): Record<string, string> => {
  const entries = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line): Array<[string, string]> => {
      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        return [];
      }

      const key = line.slice(0, separatorIndex).trim();
      const recordValue = line.slice(separatorIndex + 1).trim();
      return key ? [[key, recordValue]] : [];
    });

  return Object.fromEntries(entries);
};

export const McpSection: React.FC<McpSectionProps> = ({ settings, onUpdate }) => {
  const { t } = useI18n();
  const servers = settings.mcpServers ?? [];
  const [capabilityStates, setCapabilityStates] = useState<Record<string, CapabilityTestState>>({});

  const updateServers = (nextServers: McpServerConfig[]) => {
    onUpdate('mcpServers', nextServers);
  };

  const updateServer = (serverIndex: number, updates: Partial<McpServerConfig>) => {
    updateServers(servers.map((server, index) => (index === serverIndex ? { ...server, ...updates } : server)));
  };

  const removeServer = (serverIndex: number) => {
    updateServers(servers.filter((_, index) => index !== serverIndex));
  };

  const addServer = () => {
    updateServers([...servers, createMcpServer(t('settingsMcpNewServer'))]);
  };

  const handleTransportChange = (serverIndex: number, server: McpServerConfig, transport: McpServerTransport) => {
    if (transport === 'stdio') {
      updateServer(serverIndex, {
        transport,
        command: server.command ?? '',
        args: server.args ?? [],
        env: server.env ?? {},
      });
      return;
    }

    updateServer(serverIndex, {
      transport,
      url: server.url ?? '',
      headers: server.headers ?? {},
      auth: server.auth ?? { type: 'none' },
    });
  };

  const handleAuthTypeChange = (serverIndex: number, authType: McpServerAuthType) => {
    updateServer(serverIndex, {
      auth: authType === 'bearer' ? { type: 'bearer' } : { type: authType },
    });
  };

  const testServerCapabilities = async (server: McpServerConfig, serverIndex: number) => {
    const key = getCapabilityStateKey(server, serverIndex);
    setCapabilityStates((prev) => ({ ...prev, [key]: { status: 'loading' } }));

    try {
      const capabilities = await fetchMcpServerCapabilities({ ...server, enabled: true });
      setCapabilityStates((prev) => ({ ...prev, [key]: { status: 'success', capabilities } }));
    } catch (error) {
      setCapabilityStates((prev) => ({
        ...prev,
        [key]: {
          status: 'error',
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="min-w-0 space-y-1">
          <h3 className="text-base font-semibold text-[var(--theme-text-primary)]">{t('settingsMcpTitle')}</h3>
          <p className="text-sm leading-relaxed text-[var(--theme-text-tertiary)]">{t('settingsMcpDescription')}</p>
        </div>
        <button type="button" onClick={addServer} className={secondaryButtonClass}>
          <Plus size={14} strokeWidth={1.7} />
          {t('settingsMcpAddServer')}
        </button>
      </div>

      {servers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--theme-border-secondary)] p-5 text-sm text-[var(--theme-text-tertiary)]">
          {t('settingsMcpEmpty')}
        </div>
      ) : (
        <div className="space-y-5">
          {servers.map((server, index) => {
            const stateKey = getCapabilityStateKey(server, index);
            const capabilityState = capabilityStates[stateKey];
            const capabilities = capabilityState?.status === 'success' ? capabilityState.capabilities : undefined;
            const capabilityErrors = capabilities?.errors ?? [];
            const resourceCount = (capabilities?.resources.length ?? 0) + (capabilities?.resourceTemplates.length ?? 0);
            const enabledInputId = `mcp-enabled-${stateKey}`;

            return (
              <section
                key={stateKey}
                className="rounded-lg border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-secondary)] p-4 shadow-sm"
              >
                <div
                  data-mcp-server-card-header
                  className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <input
                      id={enabledInputId}
                      type="checkbox"
                      checked={server.enabled}
                      onChange={(event) => updateServer(index, { enabled: event.target.checked })}
                      className="h-4 w-4 shrink-0 rounded border-[var(--theme-border-secondary)] text-[var(--theme-text-link)] focus:ring-[var(--theme-border-focus)]"
                    />
                    <label
                      htmlFor={enabledInputId}
                      className="min-w-0 truncate text-sm font-medium text-[var(--theme-text-primary)]"
                    >
                      {server.name || t('settingsMcpUnnamedServer').replace('{index}', String(index + 1))}
                    </label>
                  </div>
                  <div
                    data-mcp-server-card-actions
                    className="flex shrink-0 items-center gap-2 self-start sm:self-auto"
                  >
                    <button
                      type="button"
                      onClick={() => testServerCapabilities(server, index)}
                      disabled={capabilityState?.status === 'loading'}
                      className={secondaryButtonClass}
                    >
                      <RefreshCw
                        size={13}
                        strokeWidth={1.7}
                        className={capabilityState?.status === 'loading' ? 'animate-spin' : undefined}
                      />
                      {capabilityState?.status === 'loading' ? t('settingsMcpTesting') : t('settingsMcpTestServer')}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeServer(index)}
                      className="rounded-md p-1.5 text-[var(--theme-text-tertiary)] transition-colors hover:bg-[var(--theme-bg-danger)]/10 hover:text-[var(--theme-text-danger)] focus:outline-none focus:ring-2 focus:ring-[var(--theme-border-focus)]"
                      aria-label={t('settingsMcpRemoveServer')}
                    >
                      <Trash2 size={15} strokeWidth={1.7} />
                    </button>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-2">
                    <span className={labelClasses}>{t('settingsMcpServerName')}</span>
                    <input
                      value={server.name}
                      onChange={(event) => updateServer(index, { name: event.target.value })}
                      className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS}`}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={labelClasses}>{t('settingsMcpServerId')}</span>
                    <input
                      value={server.id}
                      onChange={(event) => updateServer(index, { id: event.target.value.trim() })}
                      className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} font-mono`}
                    />
                  </label>

                  <label className="space-y-2">
                    <span className={labelClasses}>{t('settingsMcpTransport')}</span>
                    <select
                      value={server.transport}
                      onChange={(event) =>
                        handleTransportChange(index, server, event.target.value as McpServerTransport)
                      }
                      className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS}`}
                    >
                      <option value="stdio">{t('settingsMcpTransportStdio')}</option>
                      <option value="http">{t('settingsMcpTransportHttp')}</option>
                    </select>
                  </label>

                  {server.transport === 'stdio' ? (
                    <label className="space-y-2">
                      <span className={labelClasses}>{t('settingsMcpCommand')}</span>
                      <input
                        value={server.command ?? ''}
                        onChange={(event) => updateServer(index, { command: event.target.value })}
                        className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} font-mono`}
                        placeholder="npx"
                      />
                    </label>
                  ) : (
                    <label className="space-y-2">
                      <span className={labelClasses}>{t('settingsMcpUrl')}</span>
                      <input
                        value={server.url ?? ''}
                        onChange={(event) => updateServer(index, { url: event.target.value })}
                        className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} font-mono`}
                        placeholder="https://example.com/mcp"
                      />
                    </label>
                  )}
                </div>

                {server.transport === 'stdio' ? (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="space-y-2">
                      <span className={labelClasses}>{t('settingsMcpArgs')}</span>
                      <textarea
                        value={formatLines(server.args)}
                        onChange={(event) => updateServer(index, { args: parseLines(event.target.value) })}
                        className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} min-h-[96px] resize-y font-mono`}
                        placeholder="-y&#10;@modelcontextprotocol/server-filesystem&#10;/Users/me"
                        spellCheck={false}
                      />
                    </label>
                    <label className="space-y-2">
                      <span className={labelClasses}>{t('settingsMcpEnv')}</span>
                      <textarea
                        value={formatRecord(server.env)}
                        onChange={(event) => updateServer(index, { env: parseRecord(event.target.value) })}
                        className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} min-h-[96px] resize-y font-mono`}
                        placeholder="TOKEN=value"
                        spellCheck={false}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="space-y-2">
                        <span className={labelClasses}>{t('settingsMcpAuth')}</span>
                        <select
                          value={server.auth?.type ?? 'none'}
                          onChange={(event) => handleAuthTypeChange(index, event.target.value as McpServerAuthType)}
                          className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS}`}
                        >
                          <option value="none">{t('settingsMcpAuthNone')}</option>
                          <option value="bearer">{t('settingsMcpAuthBearer')}</option>
                          <option value="customHeaders">{t('settingsMcpAuthCustomHeaders')}</option>
                        </select>
                      </label>
                      {server.auth?.type === 'bearer' && (
                        <label className="space-y-2">
                          <span className={labelClasses}>{t('settingsMcpBearerToken')}</span>
                          <input
                            type="password"
                            value={server.auth.token ?? ''}
                            onChange={(event) =>
                              updateServer(index, { auth: { type: 'bearer', token: event.target.value } })
                            }
                            className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} font-mono`}
                            placeholder="mcp_token"
                          />
                        </label>
                      )}
                    </div>
                    <label className="block space-y-2">
                      <span className={labelClasses}>{t('settingsMcpHeaders')}</span>
                      <textarea
                        value={formatRecord(server.headers)}
                        onChange={(event) => updateServer(index, { headers: parseRecord(event.target.value) })}
                        className={`${inputBaseClasses} ${SETTINGS_INPUT_CLASS} min-h-[96px] resize-y font-mono`}
                        placeholder="X-Workspace=docs"
                        spellCheck={false}
                      />
                    </label>
                  </div>
                )}

                {capabilities && (
                  <div className="mt-4 rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-primary)] p-3 text-xs text-[var(--theme-text-secondary)]">
                    <div className="flex flex-wrap gap-3 font-medium">
                      <span>
                        {t('settingsMcpCapabilityTools')} {capabilities.tools.length}
                      </span>
                      <span>
                        {t('settingsMcpCapabilityResources')} {resourceCount}
                      </span>
                      <span>
                        {t('settingsMcpCapabilityPrompts')} {capabilities.prompts.length}
                      </span>
                    </div>
                    {capabilityErrors.length > 0 && (
                      <div className="mt-2 space-y-1 text-[var(--theme-text-danger)]">
                        {capabilityErrors.map((error) => (
                          <div key={`${error.serverId}-${error.error}`}>{error.error}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {capabilityState?.status === 'error' && (
                  <div className="mt-4 rounded-md border border-[var(--theme-border-danger)] bg-[var(--theme-bg-danger)]/10 p-3 text-xs text-[var(--theme-text-danger)]">
                    {capabilityState.error}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
};
