import type { AppSettings } from '@/types';

type ThirdPartyApiActiveSettings = Pick<AppSettings, 'apiMode' | 'isThirdPartyApiEnabled'>;

export const isThirdPartyApiActive = (settings: ThirdPartyApiActiveSettings): boolean =>
  settings.isThirdPartyApiEnabled === true && settings.apiMode === 'third-party';
