const appearanceSettings = {
  settingsAppearance: { en: 'Appearance', zh: '外观' },
  settingsTheme: { en: 'Theme', zh: '主题' },
  settingsThemeSystem: { en: 'System', zh: '系统' },
  settingsThemeDark: { en: 'Dark', zh: '暗色' },
  settingsThemeGray: { en: 'Gray', zh: '灰色' },
  settingsThemeLight: { en: 'Light', zh: '浅色' },
  settingsFontSize: { en: 'Reading Size', zh: '阅读字号' },
  settingsLiveArtifactsFontSize: { en: 'Live Artifacts Base Size', zh: 'Live Artifacts 基础字号' },
  settingsLiveArtifactsFontSizeTooltip: {
    en: 'Sets the default font size for inline Live Artifacts in chat. Artifact content with its own font-size may still override it.',
    zh: '设置聊天内嵌 Live Artifacts 的默认字号。产物内容自带的 font-size 仍可能覆盖它。',
  },
  settingsLanguage: { en: 'Language', zh: '语言' },
  settingsLanguageSystem: { en: 'System Default', zh: '跟随系统' },
  settingsLanguageEn: { en: 'English', zh: 'English' },
  settingsLanguageZh: { en: 'Chinese', zh: '中文' },
  settingsInputToolbar: { en: 'Input Toolbar', zh: '输入框工具栏' },
  settingsBehaviorDisplay: { en: 'Interaction & Display', zh: '交互与显示' },
  // Interface Toggles
  settingsExpandCodeBlocksByDefaultLabel: { en: 'Expand Code Blocks Automatically', zh: '自动展开代码块' },
  settingsEnableMermaidRenderingLabel: { en: 'Render Mermaid Diagrams', zh: '渲染 Mermaid 图表' },
  settingsEnableMermaidRenderingTooltip: {
    en: "Render code blocks marked as 'mermaid' into diagrams.",
    zh: "将标记为 'mermaid' 的代码块渲染成图表。",
  },
  settingsEnableGraphvizRenderingLabel: { en: 'Render Graphviz Diagrams', zh: '渲染 Graphviz 图表' },
  settingsEnableGraphvizRenderingTooltip: {
    en: "Render code blocks marked as 'graphviz' or 'dot' into diagrams.",
    zh: "将标记为 'graphviz' 或 'dot' 的代码块渲染成图表。",
  },
  settingsAutoFullscreenHtmlLabel: { en: 'Auto-open Preview', zh: '自动打开预览' },
  settingsAutoFullscreenHtmlTooltip: {
    en: 'Automatically open a fullscreen preview after an HTML or SVG block is generated.',
    zh: '在 HTML 或 SVG 代码块生成后自动打开全屏预览。',
  },
  isAutoTitleEnabled: { en: 'Auto-name New Chats', zh: '自动命名新对话' },
  isAutoTitleEnabledTooltip: {
    en: 'Automatically generate a title for a new chat after the first exchange using a fast model.',
    zh: '在新对话首次往返后，使用快速模型自动生成标题。',
  },
  settingsEnableCompletionNotificationLabel: { en: 'Background Completion Notifications', zh: '后台完成通知' },
  settingsEnableCompletionNotificationTooltip: {
    en: 'Show a browser notification when a response is finished generating while the tab is in the background.',
    zh: '当标签页在后台时，在响应生成完毕后显示浏览器通知。',
  },
  settingsNotificationsUnsupported: {
    en: 'Desktop notifications are not supported by your browser.',
    zh: '当前浏览器不支持桌面通知。',
  },
  settingsNotificationsBlocked: {
    en: 'Notifications are blocked by your browser. Please enable them in your browser settings to use this feature.',
    zh: '浏览器已阻止通知。请在浏览器设置中启用通知后再使用此功能。',
  },
  settingsEnableCompletionSoundLabel: { en: 'Completion Sound', zh: '完成提示音' },
  settingsEnableCompletionSoundTooltip: {
    en: 'Play a notification sound when a response is finished generating.',
    zh: '当响应生成完毕时播放提示音。',
  },
  settingsEnableSuggestionsLabel: { en: 'Reply Suggestions', zh: '回复建议' },
  settingsEnableSuggestionsTooltip: {
    en: 'Automatically generate smart replies after the model responds. Uses a fast, separate model call.',
    zh: '在模型回应后自动生成回复建议。此功能会使用一个快速、独立的模型调用。',
  },
  settingsShowWelcomeSuggestionsLabel: { en: 'Show Welcome Suggestions', zh: '显示欢迎页建议' },
  settingsShowWelcomeSuggestionsTooltip: {
    en: 'Show suggestion cards on the new chat screen.',
    zh: '在新对话屏幕上显示建议卡片。',
  },
  settingsAutoSendOnSuggestionClickLabel: { en: 'Tap to Send Reply', zh: '点按回复即发' },
  settingsAutoSendOnSuggestionClickTooltip: {
    en: 'When enabled, clicking a follow-up reply suggestion will send it immediately. Other suggestion types will only populate the input field.',
    zh: '启用后，点击跟进型回复建议将立即发送。其他类型的建议只会填充输入框。',
  },
  settingsAutoScrollOnSendLabel: { en: 'Scroll to Latest on Send', zh: '发送后滚到最新' },
  settingsAudioCompressionLabel: { en: 'Compress Audio Before Upload', zh: '上传前压缩音频' },
  settingsAudioCompressionTooltip: {
    en: 'Automatically compress audio files (including voice recordings) to MP3 64kbps to save tokens and bandwidth.',
    zh: '自动将音频文件（包括语音录音）压缩为 MP3 64kbps，以节省 Token 和带宽。',
  },
  settingsPasteRichTextAsMarkdownLabel: { en: 'Convert Rich Text Paste to Markdown', zh: '富文本粘贴转为 Markdown' },
  settingsPasteRichTextAsMarkdownTooltip: {
    en: 'Automatically convert formatted text (HTML) from clipboard to Markdown when pasting.',
    zh: '粘贴时自动将剪贴板中的富文本（HTML）转换为 Markdown。',
  },
  settingsPasteAsTextFileLabel: { en: 'Attach Long Pasted Text as File', zh: '长文本粘贴为文件附件' },
  settingsPasteAsTextFileTooltip: {
    en: 'Automatically convert large pasted text (>5000 characters) into an attached .txt file.',
    zh: '粘贴大量文本（>5000 字符）时，自动将其转换为 .txt 附件。',
  },
  settingsShowInputTranslationButtonLabel: { en: 'Show Translate Button', zh: '显示翻译按钮' },
  settingsShowInputTranslationButtonTooltip: {
    en: 'Controls whether the translate button appears in the message input toolbar.',
    zh: '控制消息输入框工具栏中是否显示翻译按钮。',
  },
  settingsShowInputPasteButtonLabel: { en: 'Show Paste Button', zh: '显示粘贴按钮' },
  settingsShowInputPasteButtonTooltip: {
    en: 'Controls whether the paste button appears beside the message send button.',
    zh: '控制消息发送按钮旁是否显示粘贴按钮。',
  },
  settingsShowInputClearButtonLabel: { en: 'Show Clear Input Button', zh: '显示清空输入框按钮' },
  settingsShowInputClearButtonTooltip: {
    en: 'Controls whether the clear input button appears beside the message send button.',
    zh: '控制消息发送按钮旁是否显示清空输入框按钮。',
  },
  settingsCopySelectionFormattingLabel: {
    en: 'Preserve Formatting When Copying Selection',
    zh: '复制选区时保留格式',
  },
  settingsCopySelectionFormattingTooltip: {
    en: 'When enabled, copied message selections keep Markdown formatting. Turn it off to copy plain selected text only.',
    zh: '启用后，复制消息选区会保留 Markdown 格式。关闭后只复制纯文本。',
  },
  settingsSystemAudioRecordingLabel: { en: 'Include System Audio in Recordings', zh: '录音时包含系统音频' },
  settingsSystemAudioRecordingTooltip: {
    en: 'When enabled, you will be prompted to share system audio (via screen share) along with microphone input during recording.',
    zh: '启用后，录音时将提示您共享系统音频（通过屏幕共享）以混合麦克风输入。',
  },
  settingsRawModeLabel: { en: 'Raw Reasoning', zh: '原始推理' },
  settingsRawModeTooltip: {
    en: 'For supported models, pre-fill the response with <thinking> so replies start in raw reasoning mode. Unsupported models ignore this setting.',
    zh: '对支持的模型，会在回复前预填 <thinking>，让输出从原始推理模式开始。不支持的模型会忽略该设置。',
  },
  settingsHideThinkingInContextLabel: { en: 'Collapse and Omit Raw Reasoning', zh: '折叠并省略原始推理' },
  settingsHideThinkingInContextTooltip: {
    en: 'Collapse raw reasoning in the UI and remove it from future API context to save tokens.',
    zh: '在界面中折叠原始推理内容，并在后续 API 上下文中省略它以节省 Token。',
  },
};
export default appearanceSettings;
