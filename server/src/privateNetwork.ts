import net from 'node:net';

export const isPrivateNetworkHostname = (hostname: string): boolean => {
  const normalizedHostname = hostname.replace(/^\[|\]$/g, '');
  const ipVersion = net.isIP(normalizedHostname);

  if (ipVersion === 4) {
    const [first, second] = normalizedHostname.split('.').map((part) => Number(part));
    return (
      first === 10 ||
      first === 127 ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 169 && second === 254) ||
      first === 0
    );
  }

  if (ipVersion === 6) {
    const lower = normalizedHostname.toLowerCase();
    return lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80:');
  }

  return ['localhost', 'localhost.localdomain'].includes(normalizedHostname.toLowerCase());
};
