// Phone Bridge v1 (mnscloud-phoneweb docs/phone-bridge.md): the App drives the PhoneWeb frame
// (`/phoneweb/?embed=app`, same origin) with versioned postMessage messages. No secret, token or
// SIP credential ever crosses the bridge.

export const PHONE_BRIDGE_CHANNEL = 'mnscloud-phone';
export const PHONE_BRIDGE_VERSION = 1;
export const PHONEWEB_PATH = '/phoneweb/';

export type PhoneBridgeCommand =
  | 'phone.state'
  | 'phone.focus'
  | 'phone.dial'
  | 'phone.answer'
  | 'phone.hangup'
  | 'phone.mute'
  | 'phone.dtmf'
  | 'phone.signOut';

export interface PhoneCallState {
  direction: 'incoming' | 'outgoing' | null;
  remote: string | null;
  established: boolean;
  answerable: boolean;
  muted: boolean;
}

export interface PhoneState {
  signedIn: boolean;
  registration: string;
  account: string | null;
  call: PhoneCallState | null;
}

export interface PhoneBridgeMessage {
  channel: typeof PHONE_BRIDGE_CHANNEL;
  v: number;
  type: string;
  id?: string;
  payload?: Record<string, unknown>;
}

export function phoneCommand(
  id: string,
  type: PhoneBridgeCommand,
  payload?: Record<string, unknown>,
): PhoneBridgeMessage {
  return { channel: PHONE_BRIDGE_CHANNEL, v: PHONE_BRIDGE_VERSION, id, type, payload };
}

/**
 * Accepts a `message` event only from the PhoneWeb frame of this exact origin, with the bridge
 * channel and version; anything else is ignored.
 */
export function readPhoneBridgeMessage(
  event: Pick<MessageEvent, 'origin' | 'source' | 'data'>,
  frame: Window | null | undefined,
  origin: string,
): PhoneBridgeMessage | null {
  if (!frame || event.origin !== origin || event.source !== frame) return null;
  const data = event.data as Partial<PhoneBridgeMessage> | null;
  if (!data || typeof data !== 'object') return null;
  if (data.channel !== PHONE_BRIDGE_CHANNEL || data.v !== PHONE_BRIDGE_VERSION) return null;
  if (typeof data.type !== 'string') return null;
  return data as PhoneBridgeMessage;
}

export function toPhoneState(payload: Record<string, unknown> | undefined): PhoneState | null {
  if (!payload) return null;
  const call = payload['call'] as Record<string, unknown> | null | undefined;
  return {
    signedIn: payload['signedIn'] === true,
    registration: String(payload['registration'] ?? 'offline'),
    account: typeof payload['account'] === 'string' ? payload['account'] : null,
    call: call
      ? {
          direction:
            call['direction'] === 'incoming' || call['direction'] === 'outgoing'
              ? call['direction']
              : null,
          remote: typeof call['remote'] === 'string' ? call['remote'] : null,
          established: call['established'] === true,
          answerable: call['answerable'] === true,
          muted: call['muted'] === true,
        }
      : null,
  };
}

/** Same characters PhoneWeb accepts (digits, +, *, #); separators are dropped. */
export function dialableNumber(value: string | null | undefined): string | null {
  const number = String(value ?? '').replace(/[\s().-]/g, '');
  return /^[0-9+*#]{1,32}$/.test(number) ? number : null;
}

/** Frame URL; the single-use App handoff code goes only in the fragment. */
export function phoneFrameUrl(handoffCode?: string | null): string {
  const base = `${PHONEWEB_PATH}?embed=app`;
  return handoffCode ? `${base}#handoff=${encodeURIComponent(handoffCode)}` : base;
}
