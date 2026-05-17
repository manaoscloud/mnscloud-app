export type MnscloudAppRuntimeConfig = {
  apiBaseUrl?: string | null;
};

declare global {
  interface Window {
    MNSCLOUD_APP_CONFIG?: MnscloudAppRuntimeConfig;
  }
}

const API_V1_SUFFIX = '/api/v1';
const API_SUFFIX = '/api';

function browserOrigin(): string {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function toAbsoluteUrl(value: string): string {
  if (typeof window === 'undefined') return value;

  try {
    return new URL(value, window.location.origin).toString();
  } catch {
    return value;
  }
}

export function resolveApiBaseUrl(): string {
  const configured =
    typeof window !== 'undefined' ? window.MNSCLOUD_APP_CONFIG?.apiBaseUrl?.trim() : null;
  const rawBase = configured ? toAbsoluteUrl(configured) : `${browserOrigin()}${API_V1_SUFFIX}`;
  const normalized = trimTrailingSlashes(rawBase);

  if (normalized.endsWith(API_V1_SUFFIX)) return normalized;
  if (normalized.endsWith(API_SUFFIX)) return `${normalized}/v1`;

  return `${normalized}${API_V1_SUFFIX}`;
}

export function resolveApiUrl(endpoint: string): string {
  const normalizedEndpoint = endpoint.replace(/^\/+/, '');
  return `${resolveApiBaseUrl()}/${normalizedEndpoint}`;
}
