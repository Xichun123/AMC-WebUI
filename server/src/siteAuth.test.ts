// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createSitePasswordHash, loadSiteAuthConfig } from './siteAuth';

describe('siteAuth', () => {
  it('stays disabled when SITE_AUTH_USERS_JSON is empty', () => {
    expect(loadSiteAuthConfig({})).toEqual({
      enabled: false,
      users: [],
      sessionDays: 7,
    });
  });

  it('loads Unicode usernames and a custom session lifetime', () => {
    const config = loadSiteAuthConfig({
      SITE_AUTH_USERS_JSON: JSON.stringify([{ username: '慧慧', passwordHash: 'scrypt:test' }]),
      SITE_AUTH_SECRET: 'secret',
      SITE_AUTH_SESSION_DAYS: '14',
    });

    expect(config).toEqual({
      enabled: true,
      users: [{ username: '慧慧', passwordHash: 'scrypt:test' }],
      secret: 'secret',
      sessionDays: 14,
    });
  });

  it('requires a secret when users are configured', () => {
    expect(() =>
      loadSiteAuthConfig({
        SITE_AUTH_USERS_JSON: JSON.stringify([{ username: 'amc', passwordHash: 'scrypt:test' }]),
      }),
    ).toThrow(/SITE_AUTH_SECRET is required/);
  });

  it('creates scrypt password hashes for the environment registry', async () => {
    const hash = await createSitePasswordHash('棒棒棒', Buffer.from('1234567890abcdef'));

    expect(hash).toMatch(/^scrypt:16384:8:1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/);
  });
});
