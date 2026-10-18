import {
  dialableNumber,
  phoneCommand,
  phoneFrameUrl,
  readPhoneBridgeMessage,
  toPhoneState,
} from './phone-bridge';

describe('Phone Bridge (App side)', () => {
  const origin = 'https://app.example.com';
  const frame = {} as Window;
  const message = (data: unknown, overrides: Partial<MessageEvent> = {}) =>
    ({ origin, source: frame, data, ...overrides }) as Pick<
      MessageEvent,
      'origin' | 'source' | 'data'
    >;
  const ready = { channel: 'mnscloud-phone', v: 1, type: 'ready', payload: {} };

  it('accepts only the PhoneWeb frame of the same origin, channel and version', () => {
    expect(readPhoneBridgeMessage(message(ready), frame, origin)?.type).toBe('ready');
    expect(
      readPhoneBridgeMessage(message(ready, { origin: 'https://evil.example' }), frame, origin),
    ).toBeNull();
    expect(
      readPhoneBridgeMessage(message(ready, { source: {} as Window }), frame, origin),
    ).toBeNull();
    expect(readPhoneBridgeMessage(message({ ...ready, v: 2 }), frame, origin)).toBeNull();
    expect(readPhoneBridgeMessage(message({ ...ready, channel: 'x' }), frame, origin)).toBeNull();
    expect(readPhoneBridgeMessage(message('ready'), frame, origin)).toBeNull();
    expect(readPhoneBridgeMessage(message(ready), null, origin)).toBeNull();
  });

  it('builds versioned commands and maps the phone state', () => {
    expect(phoneCommand('a1', 'phone.dial', { number: '1001' })).toEqual({
      channel: 'mnscloud-phone',
      v: 1,
      id: 'a1',
      type: 'phone.dial',
      payload: { number: '1001' },
    });
    expect(
      toPhoneState({
        signedIn: true,
        registration: 'registered',
        account: 'MNSCloud · 1001',
        call: { direction: 'incoming', remote: '5592', answerable: true },
      }),
    ).toEqual({
      signedIn: true,
      registration: 'registered',
      account: 'MNSCloud · 1001',
      call: {
        direction: 'incoming',
        remote: '5592',
        established: false,
        answerable: true,
        muted: false,
      },
    });
    expect(toPhoneState({ registration: 'offline', call: null })?.call).toBeNull();
  });

  it('dials only digits, + * #, and keeps the handoff code in the fragment', () => {
    expect(dialableNumber('(92) 99999-0000')).toBe('92999990000');
    expect(dialableNumber('+55 92 3333.4444')).toBe('+559233334444');
    expect(dialableNumber('javascript:alert(1)')).toBeNull();
    expect(dialableNumber('')).toBeNull();
    expect(phoneFrameUrl()).toBe('/phoneweb/?embed=app');
    expect(phoneFrameUrl('a b')).toBe('/phoneweb/?embed=app#handoff=a%20b');
  });
});
