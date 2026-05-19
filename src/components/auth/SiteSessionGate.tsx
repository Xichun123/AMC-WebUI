import React, { useEffect, useState } from 'react';

type GateState = 'checking' | 'allowed';

function buildLoginUrl(): string {
  const next = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  return `/login?next=${encodeURIComponent(next || '/')}`;
}

export const SiteSessionGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<GateState>('checking');

  useEffect(() => {
    let isMounted = true;

    void fetch('/api/auth/session', { cache: 'no-store' })
      .then(async (response) => {
        if (!response.ok) {
          return null;
        }
        return (await response.json()) as { authenticated?: boolean };
      })
      .then((session) => {
        if (!isMounted) {
          return;
        }

        if (session?.authenticated === true) {
          setState('allowed');
        } else {
          window.location.assign(buildLoginUrl());
        }
      })
      .catch(() => {
        if (isMounted) {
          window.location.assign(buildLoginUrl());
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  if (state !== 'allowed') {
    return null;
  }

  return <>{children}</>;
};
