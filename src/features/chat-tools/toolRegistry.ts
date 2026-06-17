import type { ModelCapabilities } from '@/utils/modelCapabilities';
import type { ChatToolId, ChatToolSettingKey } from '@/types/chatTools';

type ChatToolSurface = 'tools-menu' | 'slash-command';

export type ChatToolIconKey = 'telescope' | 'globe' | 'map' | 'terminal' | 'python' | 'link' | 'calculator';

export interface ChatToolDefinition {
  id: ChatToolId;
  labelKey: string;
  shortLabelKey?: string;
  icon: ChatToolIconKey;
  settingKey?: ChatToolSettingKey;
  slashCommand?: {
    name: string;
    descriptionKey: string;
    icon: string;
  };
  isAvailable: (context: ChatToolAvailabilityContext) => boolean;
}

export interface ChatToolAvailabilityContext {
  surface: ChatToolSurface;
  capabilities: ModelCapabilities;
  hasLocalPythonHandler?: boolean;
}

const isToolsMenu = (context: ChatToolAvailabilityContext) => context.surface === 'tools-menu';

const CHAT_TOOL_REGISTRY: ChatToolDefinition[] = [
  {
    id: 'deepSearch',
    labelKey: 'deepSearchLabel',
    shortLabelKey: 'deepSearchShort',
    icon: 'telescope',
    settingKey: 'isDeepSearchEnabled',
    slashCommand: { name: 'deep', descriptionKey: 'helpCmdDeep', icon: 'deep' },
    isAvailable: ({ capabilities }) => capabilities.permissions.canUseDeepSearch,
  },
  {
    id: 'googleSearch',
    labelKey: 'webSearchLabel',
    shortLabelKey: 'webSearchShort',
    icon: 'globe',
    settingKey: 'isGoogleSearchEnabled',
    slashCommand: { name: 'online', descriptionKey: 'helpCmdSearch', icon: 'search' },
    isAvailable: (context) =>
      context.capabilities.permissions.canUseGoogleSearch &&
      (!isToolsMenu(context) || !context.capabilities.permissions.canUseLiveControls),
  },
  {
    id: 'googleMaps',
    labelKey: 'mapsGroundingLabel',
    shortLabelKey: 'mapsGroundingShort',
    icon: 'map',
    settingKey: 'isGoogleMapsEnabled',
    slashCommand: { name: 'maps', descriptionKey: 'helpCmdMaps', icon: 'maps' },
    isAvailable: (context) =>
      context.capabilities.permissions.canUseGoogleMaps &&
      (!isToolsMenu(context) || !context.capabilities.permissions.canUseLiveControls),
  },
  {
    id: 'codeExecution',
    labelKey: 'codeExecutionLabel',
    shortLabelKey: 'codeExecutionShort',
    icon: 'terminal',
    settingKey: 'isCodeExecutionEnabled',
    slashCommand: { name: 'code', descriptionKey: 'helpCmdCode', icon: 'code' },
    isAvailable: ({ capabilities }) => capabilities.permissions.canUseCodeExecution,
  },
  {
    id: 'localPython',
    labelKey: 'localPythonLabel',
    shortLabelKey: 'localPythonShort',
    icon: 'python',
    settingKey: 'isLocalPythonEnabled',
    isAvailable: (context) => context.capabilities.permissions.canUseLocalPython && !!context.hasLocalPythonHandler,
  },
  {
    id: 'urlContext',
    labelKey: 'urlContextLabel',
    shortLabelKey: 'urlContextShort',
    icon: 'link',
    settingKey: 'isUrlContextEnabled',
    slashCommand: { name: 'url', descriptionKey: 'helpCmdUrl', icon: 'url' },
    isAvailable: ({ capabilities }) => capabilities.permissions.canUseUrlContext,
  },
  {
    id: 'tokenCount',
    labelKey: 'toolsTokenCountLabel',
    icon: 'calculator',
    isAvailable: ({ capabilities }) => capabilities.permissions.canUseTokenCount,
  },
];

export const getChatToolsForSurface = (context: ChatToolAvailabilityContext): ChatToolDefinition[] =>
  CHAT_TOOL_REGISTRY.filter((tool) => {
    if (context.surface === 'slash-command' && !tool.slashCommand) {
      return false;
    }

    return tool.isAvailable(context);
  });

export const getSlashCommandToolDefinitions = (): ChatToolDefinition[] =>
  CHAT_TOOL_REGISTRY.filter((tool) => !!tool.slashCommand);
