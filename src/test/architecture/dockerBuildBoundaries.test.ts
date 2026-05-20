import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const projectRoot = path.resolve(__dirname, '../../..');

const readProjectFile = (relativePath: string) => fs.readFileSync(path.join(projectRoot, relativePath), 'utf8');

describe('Docker build boundaries', () => {
  it('keeps Docker CI on source builds instead of requiring host build artifacts', () => {
    const workflow = readProjectFile('.github/workflows/ci.yml');
    const dockerBuildJob = workflow.slice(workflow.indexOf('  docker-build:'));
    const apiDockerfile = readProjectFile('Dockerfile.api');

    expect(workflow).toContain('actions/upload-artifact@v4');
    expect(workflow).toContain('name: production-build');
    expect(dockerBuildJob).toContain('actions/download-artifact@v4');
    expect(dockerBuildJob).not.toContain('npm ci --legacy-peer-deps');
    expect(dockerBuildJob).not.toContain('npm run build');
    expect(apiDockerfile).toContain('FROM node:26-alpine AS builder');
    expect(apiDockerfile).toContain('COPY server ./server');
    expect(apiDockerfile).toContain('RUN npm run build:api');
    expect(apiDockerfile).toContain('COPY --from=builder /app/server/dist /app/server/dist');
    expect(apiDockerfile).not.toContain('COPY server/dist /app/server/dist');
  });
});
