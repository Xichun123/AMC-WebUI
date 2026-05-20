# Chat Input Structure

`ChatInput.tsx` owns the provider boundary and renders the composer area. Keep it small.

`ChatInputArea.tsx` is the layout shell for the composer. It combines the toolbar, status banner, text area, file previews, queued submission card, and action row.

`area/` contains the editable text surface and adjacent preview elements.

`actions/` contains action-row controls that send, record, toggle live controls, or expose overflow utilities.

`toolbar/` contains model-specific configuration controls shown above the text area.

Keep new leaf controls inside the matching subdirectory. Keep orchestration in `ChatInputProvider.tsx` or the `hooks/chat-input` boundary, then pass it through `ChatInputContext.tsx`.
