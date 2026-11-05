import {
  isSerialBanner,
  termproxyInput,
  termproxyResize,
  vpsConsoleSocketUrl,
} from './instance-console';

describe('VPS console helpers', () => {
  it('builds the console WebSocket URL on the API origin', () => {
    expect(
      vpsConsoleSocketUrl('https://app.example/api/v1/', {
        type: 'serial',
        token: 'a+b/c',
        path: '/hosting/vps/console/ws',
      }),
    ).toBe('wss://app.example/api/v1/hosting/vps/console/ws?token=a%2Bb%2Fc');
  });

  it('frames termproxy input by byte length and resize', () => {
    expect(termproxyInput('ls\r')).toBe('0:3:ls\r');
    expect(termproxyInput('ç')).toBe('0:2:ç');
    expect(termproxyResize(120, 40)).toBe('1:120:40:');
  });

  it('tells the Proxmox serial banner apart from VM output', () => {
    expect(isSerialBanner('starting serial terminal on interface serial0\r\n')).toBeTrue();
    expect(isSerialBanner('vps-ixc login: ')).toBeFalse();
    expect(isSerialBanner('')).toBeFalse();
  });
});
