import { PhoneDialer } from './phone-dialer';

describe('PhoneDialer', () => {
  it('dials only when the dock is available and the value is dialable', () => {
    const dialer = new PhoneDialer();
    const dialed: string[] = [];
    expect(dialer.canDial('(92) 97777-1111')).toBe(false);
    dialer.register((number) => dialed.push(number));
    dialer.available.set(true);
    expect(dialer.canDial('(92) 97777-1111')).toBe(true);
    expect(dialer.canDial('no phone')).toBe(false);
    dialer.dial('(92) 97777-1111');
    dialer.dial('javascript:alert(1)');
    expect(dialed).toEqual(['92977771111']);
  });
});
