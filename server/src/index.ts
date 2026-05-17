import { loadConfig } from './config.js';
import { createServer } from './createServer.js';
import { createVertexAuth } from './vertexAuth.js';

const config = loadConfig();
const vertexAuth = config.backendFlavor === 'vertex' ? createVertexAuth() : undefined;
const server = createServer(config, { vertexAuth });

server.listen(config.port, '0.0.0.0', () => {
  console.log(`API server listening on port ${config.port} (backend: ${config.backendFlavor})`);
});
