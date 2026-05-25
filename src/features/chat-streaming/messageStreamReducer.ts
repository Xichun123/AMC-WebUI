import type { Part, UsageMetadata } from '@google/genai';
import type { UploadedFile } from '@/types';
import { mergeGroundingMetadata, type MetadataWithCitations } from '@/utils/groundingMetadata';
import {
  appendApiPart,
  getContentDeltaFromPart,
  getGeneratedFileFromPart,
  mergeUniqueFiles,
} from './messageStreamParts';
import { mergeUsageMetadata, mergeUrlContextMetadata } from './messageStreamMetadata';

type MessageStreamEvent =
  | { type: 'part'; part: Part; receivedAt?: Date }
  | { type: 'thought'; text: string; receivedAt?: Date }
  | { type: 'files'; files: UploadedFile[]; receivedAt?: Date }
  | {
      type: 'complete';
      usage?: UsageMetadata;
      grounding?: unknown;
      urlContext?: unknown;
      generatedFiles?: UploadedFile[];
      aborted?: boolean;
      receivedAt?: Date;
    };

export interface MessageStreamState {
  generationId: string;
  generationStartTime: Date;
  content: string;
  thoughts: string;
  apiParts: Part[];
  files: UploadedFile[];
  firstTokenTimeMs?: number;
  firstContentPartTime: Date | null;
  usage?: UsageMetadata;
  grounding?: MetadataWithCitations;
  urlContext?: unknown;
  aborted: boolean;
}

export const createMessageStreamState = ({
  generationId,
  generationStartTime,
}: {
  generationId: string;
  generationStartTime: Date;
}): MessageStreamState => ({
  generationId,
  generationStartTime,
  content: '',
  thoughts: '',
  apiParts: [],
  files: [],
  firstContentPartTime: null,
  aborted: false,
});

const isMeaningfulPart = (part: Part) => {
  const anyPart = part as Part & {
    text?: string;
    executableCode?: unknown;
    codeExecutionResult?: unknown;
    inlineData?: unknown;
  };

  return Boolean(
    (anyPart.text && anyPart.text.trim().length > 0) ||
    anyPart.executableCode ||
    anyPart.codeExecutionResult ||
    anyPart.inlineData,
  );
};

const recordFirstToken = (state: MessageStreamState, receivedAt?: Date): MessageStreamState => {
  if (state.firstTokenTimeMs !== undefined) {
    return state;
  }

  const now = receivedAt ?? new Date();
  return {
    ...state,
    firstTokenTimeMs: now.getTime() - state.generationStartTime.getTime(),
  };
};

const recordFirstContentPart = (state: MessageStreamState, receivedAt?: Date): MessageStreamState => {
  if (state.firstContentPartTime) {
    return state;
  }

  return {
    ...state,
    firstContentPartTime: receivedAt ?? new Date(),
  };
};

export const reduceMessageStreamEvent = (state: MessageStreamState, event: MessageStreamEvent): MessageStreamState => {
  switch (event.type) {
    case 'thought':
      return {
        ...recordFirstToken(state, event.receivedAt),
        thoughts: state.thoughts + event.text,
      };
    case 'part': {
      let nextState = recordFirstToken(state, event.receivedAt);
      if (isMeaningfulPart(event.part)) {
        nextState = recordFirstContentPart(nextState, event.receivedAt);
      }

      const generatedFile = getGeneratedFileFromPart(event.part);

      return {
        ...nextState,
        content: nextState.content + getContentDeltaFromPart(event.part),
        apiParts: appendApiPart(nextState.apiParts, event.part),
        files: generatedFile ? mergeUniqueFiles(nextState.files, [generatedFile]) : nextState.files,
      };
    }
    case 'files':
      return {
        ...state,
        files: mergeUniqueFiles(state.files, event.files),
      };
    case 'complete':
      return {
        ...state,
        usage: mergeUsageMetadata(state.usage, event.usage),
        grounding: mergeGroundingMetadata(state.grounding, event.grounding),
        urlContext: mergeUrlContextMetadata(state.urlContext, event.urlContext),
        files: event.generatedFiles ? mergeUniqueFiles(state.files, event.generatedFiles) : state.files,
        aborted: state.aborted || !!event.aborted,
      };
  }
};
