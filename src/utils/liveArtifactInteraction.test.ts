import { describe, expect, it } from 'vitest';
import { parseLiveArtifactInteractionSpec } from './liveArtifactInteraction';

describe('liveArtifactInteraction utilities', () => {
  it('accepts array enum fields for multi-select interaction state', () => {
    const interaction = {
      instruction: 'Continue with the selected channels.',
      schema: {
        type: 'object',
        properties: {
          channels: {
            type: 'array',
            title: 'Channels',
            items: {
              type: 'string',
              enum: ['email', 'social', 'blog'],
              enumNames: ['Email', 'Social', 'Blog'],
            },
            default: ['email', 'blog'],
          },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interaction))).toMatchObject({
      schema: {
        properties: {
          channels: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['email', 'social', 'blog'],
              enumNames: ['Email', 'Social', 'Blog'],
            },
            default: ['email', 'blog'],
          },
        },
      },
    });
  });

  it('rejects array defaults outside the declared item options', () => {
    const interaction = {
      instruction: 'Continue with the selected channels.',
      schema: {
        type: 'object',
        properties: {
          channels: {
            type: 'array',
            items: {
              type: 'string',
              enum: ['email', 'social'],
            },
            default: ['email', 'video'],
          },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interaction))).toBeNull();
  });

  it('accepts date and range formats on compatible interaction fields', () => {
    const interaction = {
      instruction: 'Continue with schedule and intensity.',
      schema: {
        type: 'object',
        properties: {
          dueDate: { type: 'string', format: 'date' },
          priority: { type: 'integer', format: 'range', minimum: 1, maximum: 5, default: 3 },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interaction))).toMatchObject({
      schema: {
        properties: {
          dueDate: { type: 'string', format: 'date' },
          priority: { type: 'integer', format: 'range', minimum: 1, maximum: 5, default: 3 },
        },
      },
    });
  });

  it('rejects enum defaults that are outside the declared options', () => {
    const interaction = {
      instruction: 'Continue with the selected option.',
      schema: {
        type: 'object',
        properties: {
          tone: {
            type: 'string',
            enum: ['brief', 'detailed'],
            default: 'balanced',
          },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interaction))).toBeNull();
  });

  it('rejects non-integer defaults and enum options for integer fields', () => {
    const interactionWithDecimalDefault = {
      instruction: 'Continue with the chosen count.',
      schema: {
        type: 'object',
        properties: {
          count: {
            type: 'integer',
            default: 1.5,
          },
        },
      },
    };
    const interactionWithDecimalEnum = {
      instruction: 'Continue with the chosen count.',
      schema: {
        type: 'object',
        properties: {
          count: {
            type: 'integer',
            enum: [1, 2.5],
          },
        },
      },
    };

    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interactionWithDecimalDefault))).toBeNull();
    expect(parseLiveArtifactInteractionSpec(JSON.stringify(interactionWithDecimalEnum))).toBeNull();
  });
});
