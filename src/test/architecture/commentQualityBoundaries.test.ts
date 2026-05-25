import { describe, expect, it } from 'vitest';
import { listProjectSourceFiles, readProjectFile } from './projectFiles';

const changeHistoryCommentFragments = [
  'New\\s+(?:method|UI|ASR|SRT)\\b',
  'Added\\s+(?:setter|for|to|allow-downloads)\\b',
  'Renamed\\b',
  'Removed\\b',
  'Changed\\b',
  '.*\\bLegacy\\/Shared\\b',
  '.*\\bduring refactor transition\\b',
  '.*\\bnew specific container class\\b',
  '.*\\bPreviously this logic\\b',
  '.*\\bAbuse Check\\b',
  'Update state:',
];
const lowInformationLineCommentFragments = [
  'Refs',
  'Hooks',
  'Components',
  'Header',
  'Content Area',
  'Scrollable Content',
  'Model Selection',
  'Floating Toolbars & Navigation',
  'Modals',
  'Actions',
  'Build Config',
  'Fix:',
  'Filename Logic',
  'Logic',
  '(?:\\d+\\.\\s*)?(?:Audio|Position|Drag|Scroll|UI|Auto Fullscreen HTML|Sticky Key|Token|Thinking Budget|Core Logging|Comparison|Resizing) Logic',
  'Find the index',
  'Update ref',
  'Update index',
  'Update existing message content',
  'Clear files for new chat',
  'Determine default resolution',
  'Start polling for new files',
  'Normal Logic',
  'Enhanced Navigation Logic',
  'Minimum scale floor',
  'Add local preview URL',
  'Preserve local file reference',
  'Clear speed on complete',
  'Important for cross-origin images',
  'Must be false to allow export',
  'Helper to extract stack traces',
  'Helper to register page refs',
  'Helper to match types',
  'Helper to write WAV header and data to an ArrayBuffer',
  'Pass data to callback',
  'Only fire callback if we have data',
  'Filter and read files that have raw data',
  'Filter duplicates if any',
  'Reconnection Refs',
  'Cleanup on unmount',
  'Determine state priorities',
  'Determine disabled state',
  'Determine background class',
  'Request minimal video size as we only need audio',
  'Find the code element',
  'Check if audio track exists',
  'Synchronously resolve content string',
  'Scroll handler',
  'Check if title is generic or a placeholder',
  'Skip if already generating',
  'Need at least user prompt and model response',
  'Basic structure check',
  'Wait for the first model message to be complete',
  'Initialize Stream Handler Factory',
  'Pyodide Execution Logic',
  'Simple CSV detection',
  'Simple JSON detection',
  'Output Context',
  'Input Context',
  'Apply initial mute state',
  'AudioWorklet Setup',
  'Auto-scroll logic state',
  'Handle Worklet Messages',
  'Calculate Volume',
  'Floating Action Buttons',
  'Stop Microphone',
  'Disconnect Input Nodes',
  'Close Contexts',
  'Send a copy of the buffer',
  'Pass progress callback',
  'Mark active immediately',
  'Sanitize the session before export',
  'We create a structure compatible with the history import feature',
  'Exporting only the active chat session',
  'No groups are exported with a single chat',
  'Use blobToBase64 which is efficient and handles Blobs\\/Files',
  'Use configured media resolution',
  'Save if any changes were made',
  'Fallback to mic only',
  '\\d+\\.\\s*(?:Calculate total length|Merge chunks|Create WAV Buffer using shared helper|Create Blob and URL)',
];
const lowInformationBlockCommentFragments = [
  '\\{\\/\\*\\s*Content Area\\s*\\*\\/\\}',
  '\\{\\/\\*\\s*Main Content\\s*\\*\\/\\}',
  '\\{\\/\\*\\s*Scrollable Content\\s*\\*\\/\\}',
  '\\{\\/\\*\\s*Segmented Control \\(Tabs\\)\\s*\\*\\/\\}',
  '\\{\\/\\*\\s*\\d+\\.\\s*(?:Custom Budget Slider & Input|Gemini 3\\.0 Preset Level Selector|Off State Message)\\s*\\*\\/\\}',
  '\\{\\/\\*\\s*Text Content\\s*\\*\\/\\}',
  '\\{\\/\\*\\s*Floating Action Buttons\\s*\\*\\/\\}',
  '\\{\\/\\*\\s*(?:Sources List \\(Search Grounding\\)|URL Context Metadata)\\s*\\*\\/\\}',
];

const buildSourceLinePattern = (
  lineCommentFragments: string[],
  options: { blockCommentFragments?: string[]; flags?: string; trailingWordBoundary?: boolean } = {},
) => {
  const trailingBoundary = options.trailingWordBoundary ? '\\b' : '';
  const lineCommentPattern = `\\/\\/\\s*(?:${lineCommentFragments.join('|')})${trailingBoundary}`;
  const sourceLinePatterns = [lineCommentPattern, ...(options.blockCommentFragments ?? [])];

  return new RegExp(`(?:${sourceLinePatterns.join('|')})`, options.flags);
};

describe('comment quality boundaries', () => {
  it('keeps core type comments focused on domain meaning instead of change history', () => {
    const chatTypes = readProjectFile('src/types/chat.ts');

    expect(chatTypes).not.toMatch(/\/\/\s*Added (?:for|to)\b/);
  });

  it('keeps production comments focused on current behavior instead of change history', () => {
    const changeHistoryCommentPattern = buildSourceLinePattern(changeHistoryCommentFragments, { flags: 'i' });
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => relativePath !== 'src/test/architecture/commentQualityBoundaries.test.ts')
      .filter((relativePath) =>
        readProjectFile(relativePath)
          .split('\n')
          .some((line) => changeHistoryCommentPattern.test(line)),
      );

    expect(offenders).toEqual([]);
  });

  it('keeps comment boundary patterns readable through named fragments', () => {
    const source = readProjectFile('src/test/architecture/commentQualityBoundaries.test.ts');

    expect(source).toContain('const changeHistoryCommentFragments =');
    expect(source).toContain('const lowInformationLineCommentFragments =');
    expect(source).toContain('const lowInformationBlockCommentFragments =');
    expect(source).toContain('const buildSourceLinePattern =');
    expect(source).not.toContain('const changeHistoryCommentPattern =\n      /');
    expect(source).not.toContain('const lowInformationCommentPattern =\n      /');
  });

  it('keeps production comments from echoing nearby code structure', () => {
    const lowInformationCommentPattern = buildSourceLinePattern(lowInformationLineCommentFragments, {
      blockCommentFragments: lowInformationBlockCommentFragments,
      trailingWordBoundary: true,
    });
    const offenders = listProjectSourceFiles('src')
      .filter((relativePath) => !relativePath.includes('.test.'))
      .filter((relativePath) => relativePath !== 'src/test/architecture/commentQualityBoundaries.test.ts')
      .filter((relativePath) =>
        readProjectFile(relativePath)
          .split('\n')
          .some((line) => lowInformationCommentPattern.test(line)),
      );

    expect(offenders).toEqual([]);
  });
});
