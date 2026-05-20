import React, { useEffect, useMemo, useState } from 'react';
import { AVAILABLE_THEMES } from '@/constants/themeConstants';
import { applyThemeToDocument } from '@/utils/themeDom';
import { DEFAULT_APP_SETTINGS } from '@/constants/appConstants';

type LoginState = 'idle' | 'loading';

function getSafeNextUrl(): string {
  const params = new URLSearchParams(window.location.search);
  const next = params.get('next');
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/login')) {
    return '/';
  }
  return next;
}

export const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [state, setState] = useState<LoginState>('idle');
  const [error, setError] = useState<string | null>(null);
  const nextUrl = useMemo(getSafeNextUrl, []);
  const isSubmitting = state === 'loading';

  useEffect(() => {
    const pearlTheme = AVAILABLE_THEMES.find((theme) => theme.id === 'pearl') ?? AVAILABLE_THEMES[0];
    applyThemeToDocument(document, pearlTheme, DEFAULT_APP_SETTINGS);
  }, []);

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
        if (isMounted && session?.authenticated) {
          window.location.assign(nextUrl);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, [nextUrl]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!username.trim() || !password || isSubmitting) {
      return;
    }

    setState('loading');
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      if (!response.ok) {
        setError('用户名或密码不正确');
        return;
      }

      window.location.assign(nextUrl);
    } catch {
      setError('登录失败，请稍后再试');
    } finally {
      setState('idle');
    }
  };

  return (
    <div className="flex min-h-full w-full items-center justify-center bg-[var(--theme-bg-secondary)] px-5 py-8 text-[var(--theme-text-primary)]">
      <main className="w-full max-w-[320px]" aria-label="AMC 登录">
        <form
          className="flex flex-col items-stretch gap-4 bg-[var(--theme-bg-primary)] px-7 py-8"
          onSubmit={handleSubmit}
          noValidate
        >
          <img
            src="/sidebar-logo.png"
            alt="AMC WebUI"
            className="mx-auto mb-8 h-12 w-auto max-w-[180px] select-none object-contain"
            draggable={false}
            width={164}
            height={48}
          />
          <label className="sr-only" htmlFor="site-username">
            用户名
          </label>
          <input
            id="site-username"
            className="h-11 w-full rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-input)] px-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-tertiary)] focus:border-[var(--theme-border-focus)] focus:ring-2 focus:ring-[var(--theme-border-focus)]/15 disabled:cursor-not-allowed disabled:opacity-60"
            type="text"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="用户名"
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            disabled={isSubmitting}
            required
          />
          <label className="sr-only" htmlFor="site-password">
            密码
          </label>
          <input
            id="site-password"
            className="h-11 w-full rounded-md border border-[var(--theme-border-secondary)] bg-[var(--theme-bg-input)] px-3 text-sm text-[var(--theme-text-primary)] outline-none transition placeholder:text-[var(--theme-text-tertiary)] focus:border-[var(--theme-border-focus)] focus:ring-2 focus:ring-[var(--theme-border-focus)]/15 disabled:cursor-not-allowed disabled:opacity-60"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="密码"
            autoComplete="current-password"
            disabled={isSubmitting}
            required
          />
          {error ? (
            <p className="-mb-1 text-center text-xs leading-5 text-[var(--theme-text-danger)]" role="alert">
              {error}
            </p>
          ) : null}
          <button
            className="mt-1 h-11 w-full rounded-md bg-[var(--theme-bg-accent)] px-3 text-sm font-medium text-[var(--theme-text-accent)] transition hover:bg-[var(--theme-bg-accent-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--theme-border-focus)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--theme-bg-primary)] disabled:cursor-not-allowed disabled:opacity-50"
            type="submit"
            disabled={isSubmitting || !username.trim() || !password}
          >
            {isSubmitting ? '登录中...' : '登录'}
          </button>
        </form>
      </main>
    </div>
  );
};
