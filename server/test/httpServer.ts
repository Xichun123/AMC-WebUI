import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

type StartedHttpServer = {
  baseUrl: string;
  close: () => Promise<void>;
};

export async function startHttpServer(server: Server): Promise<StartedHttpServer> {
  await new Promise<void>((resolve, reject) => {
    const handleListenError = (error: Error) => {
      server.off('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off('error', handleListenError);
      resolve();
    };

    server.once('error', handleListenError);
    server.once('listening', handleListening);
    server.listen(0, '127.0.0.1');
  });

  const address = server.address() as AddressInfo;

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: async () => {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error) reject(error);
          else resolve();
        });
      });
    },
  };
}

export function createHttpServerCleanup() {
  const cleanupCallbacks: Array<() => Promise<void>> = [];

  return {
    track: <T extends StartedHttpServer>(server: T) => {
      cleanupCallbacks.push(server.close);
      return server;
    },
    cleanup: async () => {
      while (cleanupCallbacks.length) {
        const close = cleanupCallbacks.pop();
        if (close) {
          await close();
        }
      }
    },
  };
}
