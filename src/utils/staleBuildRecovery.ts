type ServiceWorkerRegistrationLike = {
  unregister: () => Promise<boolean>;
};

export type StaleBuildRecoveryTarget = {
  caches?: {
    keys: () => Promise<string[]>;
    delete: (cacheName: string) => Promise<boolean>;
  };
  navigator?: {
    serviceWorker?: {
      getRegistrations?: () => Promise<readonly ServiceWorkerRegistrationLike[]>;
    };
  };
  location: {
    reload: () => void;
  };
};

const STALE_BUILD_ERROR_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Loading chunk [\w-]+ failed/i,
];

const ignoreRecoveryError = () => undefined;

export const isStaleBuildError = (error: Error | null): boolean => {
  const message = error?.message ?? '';
  return STALE_BUILD_ERROR_PATTERNS.some((pattern) => pattern.test(message));
};

export const recoverFromStaleBuild = async (target: StaleBuildRecoveryTarget = window): Promise<void> => {
  const registrations = await target.navigator?.serviceWorker?.getRegistrations?.().catch(() => []);
  await Promise.all(registrations?.map((registration) => registration.unregister().catch(ignoreRecoveryError)) ?? []);

  const cacheKeys = await target.caches?.keys().catch(() => []);
  await Promise.all(cacheKeys?.map((cacheName) => target.caches?.delete(cacheName).catch(ignoreRecoveryError)) ?? []);

  target.location.reload();
};
