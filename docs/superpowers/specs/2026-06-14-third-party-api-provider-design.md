# 第三方 API Provider 功能完善设计

**日期**: 2026-06-14
**项目**: AMC-WebUI
**状态**: 草案（待 review）

## 概述

将已存在但未接线的"第三方 API provider"功能真正跑通：用户在设置里选择一个第三方 provider（OpenAI / DeepSeek / Anthropic / OpenRouter / Qwen / Kimi / Custom），填入 API key，即可在模型选择器里选用该 provider 的模型并发送消息。该模式**完全替代**现有的 "OpenAI-compatible API" 模式，成为非 Gemini 模型的唯一入口。

## 背景与现状

`thirdPartyApiProviders.ts` 已经定义了 7 个 provider 预设（含 baseUrl、默认模型、protocol）、配置 sanitize、provider 切换等完整逻辑，并且 `AppSettings.thirdPartyApi` 字段、`buildProviderAwareModelList()`、`getThirdPartyProviderConfig()` 等都已有。但以下三个环节未接通，导致功能不可用：

1. **UI 入口缺失**：设置面板里没有任何 provider 选择/配置界面。
2. **模型列表不接入**：`useApp.ts` 用本地 `buildProviderAwareModels()`（把所有模型标成 `gemini-native`），不调用支持第三方的 `buildProviderAwareModelList()`。
3. **消息发送不认识第三方**：`standardChatApiCall.ts` 只按 `isOpenAICompatibleApiActive()`（读扁平的 `openaiCompatible*` 字段）分流，不读 `thirdPartyApi`。

## 功能需求

1. **Provider 选择**：用户可在 API 配置区启用第三方模式，并从 7 个预设中选择 active provider。
2. **Provider 配置**：每个 provider 可独立编辑 API key、baseUrl、模型列表、默认模型。
3. **模型可见**：启用后，active provider 的模型出现在模型选择器，带 `apiMode: 'third-party'` 标记。
4. **消息发送**：发送时按 provider.protocol 分流——`openai-compatible` 复用现有发送函数，`anthropic` 走新写的适配器。
5. **连接测试**：配置面板提供"测试连接"按钮，按 provider.protocol 调对应的 `/models`（或 Anthropic 的 `/v1/models`）端点验证 key/baseUrl。
6. **旧配置不迁移**：现有用户的 `openaiCompatible*` 字段保留在 IndexedDB（不破坏数据），但代码不再读取；用户需在第三方 provider 界面重新填写。

## 技术设计

### 1. 数据模型：`thirdPartyApi` 成为唯一真相

`AppSettings.thirdPartyApi`（已存在）是 active provider 配置的唯一来源。旧的 `openaiCompatibleBaseUrl/ApiKey/ModelId/Models` 和 `isOpenAICompatibleApiEnabled` 字段**保留在类型与 schema 中**（避免破坏持久化数据），但发送层、模型列表、UI **全部改为读 active provider**。

**启用语义重定义**：

- `isThirdPartyApiEnabled === true` 且 `apiMode === 'third-party'` → 第三方模式激活。
- 新增工具函数 `isThirdPartyApiActive(settings)`（参照现有 `isOpenAICompatibleApiActive` 的风格），封装此判断。所有原来调 `isOpenAICompatibleApiActive()` 的地方改为调 `isThirdPartyApiActive()`。

**`apiMode` 取值收敛**：运行时只产生两种值——`'gemini-native'` 和 `'third-party'`。`'openai-compatible'` 不再被代码主动设置（类型里保留，因旧数据可能含此值；sanitize 时若读到 `'openai-compatible'` 归一为 `'gemini-native'`）。

### 2. 消息发送分流

**修改 `src/features/message-sender/standardChatApiCall.ts`**：

当前逻辑（第 116 行）：

```typescript
const isOpenAICompatibleMode = isOpenAICompatibleApiActive(appSettings);
const apiModelId = isOpenAICompatibleMode ? appSettings.openaiCompatibleModelId : activeModelId;
```

改为：

```typescript
const isThirdPartyMode = isThirdPartyApiActive(appSettings);
const activeProvider = isThirdPartyMode ? getThirdPartyProviderConfig(appSettings) : null;
const apiModelId = activeProvider ? activeProvider.modelId : activeModelId;
```

发送分支（当前第 158 行 `if (isOpenAICompatibleMode)`）改为按 protocol 分流（**openai-compatible 协议复用现有发送函数，anthropic 协议用新写的发送函数**）：

```typescript
if (activeProvider) {
  const providerConfig = {
    baseUrl: activeProvider.baseUrl,
    apiKey: activeProvider.apiKey,  // 见下：key 解析
    systemInstruction: sessionToUpdate.systemInstruction,
    temperature: sessionToUpdate.temperature,
    topP: sessionToUpdate.topP,
  };

  if (activeProvider.protocol === 'anthropic') {
    // 走新写的 sendAnthropicMessageStream / NonStream
    ...
  } else {
    // openai-compatible：复用现有 sendOpenAICompatibleMessageStream / NonStream
    // （这些函数已经接收 config.baseUrl，只需把 key/baseUrl/modelId 换成 provider 的）
    ...
  }
  return;
}
```

**API key 解析**：复用 `thirdPartyApiProviders.ts` 已有的 `resolveActiveThirdPartyProviderApiKey(settings, envOpenAIApiKey)`。该函数已处理"provider 自带 key 优先，OpenAI provider 可回退到环境变量"。

### 3. Anthropic API 适配器（新建）

**新建 `src/services/api/anthropicApi.ts`**，实现 `StreamMessageSender` 与 `NonStreamMessageSender` 接口（与 `openaiCompatibleApi.ts` 同构）。

Anthropic Messages API 与 OpenAI 的关键差异：

| 维度     | OpenAI                            | Anthropic                                            |
| -------- | --------------------------------- | ---------------------------------------------------- |
| 认证头   | `Authorization: Bearer <key>`     | `x-api-key: <key>` + `anthropic-version: 2023-06-01` |
| 端点     | `<base>/chat/completions`         | `<base>/v1/messages`                                 |
| 模型列表 | `<base>/models` (GET)             | `<base>/v1/models` (GET)                             |
| system   | messages 数组里的 role            | 顶层 `system` 字段                                   |
| 流式     | `data: {json}` SSE，`[DONE]` 结束 | `event: content_block_delta` 等 SSE 事件             |
| usage    | `usage` in body                   | `message_start` / `message_delta` 事件里             |

**模块分解**（参照 `openaiCompatibleApi.ts` 的拆法，每个文件单一职责）：

- `anthropicMessages.ts` — `buildAnthropicRequestBody()`：把 `ChatHistoryItem[]` + `Part[]` 转成 Anthropic 格式（history role 映射、system 提取到顶层、文本/图片 part 转换）。
- `anthropicResponses.ts` — `extractAnthropicMessageText()` / `extractAnthropicReasoningText()` / `readAnthropicErrorMessage()`。
- `anthropicStream.ts` — `readAnthropicStreamEvents()`：解析 Anthropic SSE 事件流为 `Part`。
- `anthropicTypes.ts` — 类型定义 + `mapAnthropicUsage()`。
- `anthropicUrls.ts` — `buildAnthropicMessagesUrl()` / `buildAnthropicModelsUrl()`。
- `anthropicApi.ts` — `sendAnthropicMessageStream` / `sendAnthropicMessageNonStream`，实现两个 sender 接口。

**范围限定**：Anthropic 适配器只支持文本 + 图片输入、文本输出（含 streaming）。不支持 Anthropic 的 tool use / computer use / thinking 等高级特性（YAGNI，本轮不做）。

### 4. 模型列表接入

**修改 `src/hooks/app/useApp.ts`**：

当前本地函数（第 31 行）：

```typescript
const buildProviderAwareModels = (apiModels: ModelOption[]): ModelOption[] => {
  return apiModels.map((model) => ({ ...model, apiMode: 'gemini-native' as const }));
};
```

改为调用 `thirdPartyApiProviders.ts` 的 `buildProviderAwareModelList()`：

```typescript
const providerAwareModels = useMemo(
  () => buildProviderAwareModelList(appSettings, apiModels),
  [appSettings, apiModels],
);
```

`buildProviderAwareModelList()` 在 `isThirdPartyApiEnabled === true` 时会把 active provider 的模型（标 `apiMode: 'third-party'`）合并进列表。

### 5. 设置 UI（替换 OpenAI-compatible 面板）

**改造 `src/components/settings/SettingsContent.tsx`**：把所有 `isOpenAICompatibleApiActive` / `openaiCompatible*` 读取改为 `isThirdPartyApiActive` / active provider 读取；`apiMode === 'openai-compatible'` 改为 `'third-party'`。

**新建 `src/components/settings/sections/api-config/ThirdPartyApiSettingsPanel.tsx`**，替换 `OpenAICompatibleApiSettingsPanel`。结构：

```
┌─ Provider 选择器（下拉：OpenAI/DeepSeek/Anthropic/.../Custom） ─┐
│                                                                 │
│  API Key 输入（复用 ApiKeyInput 组件）                          │
│  Base URL 输入（复用现有 input 样式，预填 provider 默认值）     │
│  请求预览（按 protocol 显示 /v1/messages 或 /chat/completions） │
│                                                                 │
│  模型列表编辑器（复用 OpenAICompatibleModelListEditor 组件，    │
│    props 通用，直接传 active provider 的 models/modelId）       │
│                                                                 │
│  测试连接按钮（复用 ApiConnectionTester 组件）                  │
└─────────────────────────────────────────────────────────────────┘
```

切换 provider 时：`updateActiveThirdPartyProviderConfig()` 更新 active provider 的字段；切换 active provider 本身用 `updateThirdPartyApiSettings()` 改 `activeProvider`。

**`ApiConfigSection.tsx`**：启用开关（`ApiConfigToggle`）改为读写 `isThirdPartyApiEnabled` 字段（不再读写 `isOpenAICompatibleApiEnabled`）。开关打开时同时把 `apiMode` 设为 `'third-party'`，关闭时设为 `'gemini-native'`。

**i18n**：新增 provider 名称（`thirdPartyProviderOpenai` 等，共 7 条）+ 面板标题文案。复用现有 `settingsOpenAICompatible*` 文案里通用的部分（如 API key 帮助文字）。

### 6. 连接测试

**修改连接测试逻辑**（当前在 `useSettingsLogic` / `apiProxyUrl.ts` 附近）：按 active provider 的 protocol 调对应端点：

- `openai-compatible`：`GET <base>/models`，header `Authorization: Bearer <key>`（现有逻辑）。
- `anthropic`：`GET <base>/v1/models`，header `x-api-key: <key>` + `anthropic-version: 2023-06-01`。

**模型导入**（"从 API 获取模型列表"按钮，`OpenAICompatibleModelListEditor` 的 `onFetchModelsForImportPreview`）：同样按 protocol 调对应 `/models` 端点，解析返回的模型 id 列表。

### 7. Settings sanitize 与 schema

**`src/stores/settingsStore.ts` 的 `sanitizeAppSettings()`**：

- `apiMode`：若为 `'openai-compatible'`（旧数据），归一为 `'gemini-native'`（旧模式已废弃，用户需手动重新启用第三方）。
- `thirdPartyApi`：调 `sanitizeThirdPartyApiSettings()`（已存在）兜底。
- `isThirdPartyApiEnabled`：默认 false。

**`src/schemas/appSettingsSchema.ts`**：`thirdPartyApi` schema 已接入（上个 commit 做的）。`apiMode` 已含 `'third-party'`。无需额外改动。

## 新增/修改文件清单

| 文件                                                                         | 操作      | 责任                                                |
| ---------------------------------------------------------------------------- | --------- | --------------------------------------------------- |
| `src/utils/thirdPartyApiActive.ts`                                           | 新建      | `isThirdPartyApiActive()` 工具函数                  |
| `src/services/api/anthropicApi.ts`                                           | 新建      | Anthropic stream/non-stream sender                  |
| `src/services/api/anthropicMessages.ts`                                      | 新建      | 请求体构建                                          |
| `src/services/api/anthropicResponses.ts`                                     | 新建      | 响应解析                                            |
| `src/services/api/anthropicStream.ts`                                        | 新建      | SSE 流解析                                          |
| `src/services/api/anthropicTypes.ts`                                         | 新建      | 类型 + usage 映射                                   |
| `src/services/api/anthropicUrls.ts`                                          | 新建      | URL 构建                                            |
| `src/features/message-sender/standardChatApiCall.ts`                         | 修改      | 按 provider.protocol 分流                           |
| `src/hooks/app/useApp.ts`                                                    | 修改      | 用 buildProviderAwareModelList                      |
| `src/components/settings/SettingsContent.tsx`                                | 修改      | apiMode/openaiCompatible→thirdParty                 |
| `src/components/settings/sections/api-config/ThirdPartyApiSettingsPanel.tsx` | 新建      | 替换 OpenAICompatibleApiSettingsPanel               |
| `src/components/settings/sections/api-config/ApiConnectionTester.tsx`        | 可能微调  | 接受 protocol 参数                                  |
| `src/components/settings/sections/ApiConfigSection.tsx`                      | 修改      | 启用开关语义改 thirdParty                           |
| `src/hooks/settings/useSettingsLogic.ts`                                     | 修改      | 测试连接按 protocol 分流                            |
| `src/utils/openaiCompatibleMode.ts`                                          | 修改/保留 | 加 deprecation 注释，或改导出 isThirdPartyApiActive |
| `src/i18n/translations/settings/api.ts`                                      | 修改      | provider 名称 + 面板文案                            |

## 不涉及的范围

- **不迁移旧配置**：`openaiCompatible*` 字段保留但不读，用户需重填。
- **不支持 Anthropic 高级特性**：tool use / computer use / extended thinking 不做。
- **不删旧字段**：`openaiCompatible*` 留在类型里避免破坏 IndexedDB 数据。
- **不改后端代理**：浏览器直连各 provider API（与现有 OpenAI-compatible 模式一致）。
- **不新增第三方依赖**：Anthropic 适配器用 fetch + SSE 手动解析（与 openaiCompatibleApi.ts 一致）。

## 测试策略

- **Anthropic 适配器单元测试**：mock fetch，验证请求体格式（system 提取、role 映射）、响应解析、SSE 流解析、错误处理。参照 `openaiCompatibleApi` 的测试风格。
- **`isThirdPartyApiActive` 单元测试**：各 apiMode/isThirdPartyApiEnabled 组合。
- **发送分流集成测试**：mock provider，验证 openai-compatible 与 anthropic 分别走对路径。参照 `standardChatStrategy.test.tsx`。
- **UI 测试**：`ThirdPartyApiSettingsPanel` 渲染、provider 切换、配置写入。参照 `ApiConfigSection.test.tsx`。
- **回归**：现有 `useAppEvents` / `useGlobalShortcuts` 的 tab 切换测试（已含 third-party 分支）应继续通过。
