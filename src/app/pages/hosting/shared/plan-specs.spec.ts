import { formatMemory, formatStorageGb, planHardwareSummary, planNetworkSpecs } from './plan-specs';

const t = (key: string, params?: Record<string, string | number>) =>
  `${key}(${Object.entries(params ?? {})
    .map(([name, value]) => `${name}=${value}`)
    .join(',')})`;

describe('VPS plan specs', () => {
  it('summarizes vCPU, memory and typed disk', () => {
    expect(planHardwareSummary({ cpu: 4, memoryMb: 8192, diskGb: 160, diskType: 'ssd' }, t)).toBe(
      'hostingPlanSpecs.cpu(count=4) · hostingPlanSpecs.memory(amount=8 GB) · ' +
        'hostingPlanSpecs.diskTyped(amount=160 GB,type=SSD)',
    );
  });

  it('marks dedicated vCPU and untyped disk, and skips missing values', () => {
    expect(planHardwareSummary({ cpu: 8, dedicatedCpu: true, diskGb: 120 }, t)).toBe(
      'hostingPlanSpecs.dedicatedCpu(count=8) · hostingPlanSpecs.disk(amount=120 GB)',
    );
    expect(planHardwareSummary(null, t)).toBe('');
    expect(planHardwareSummary({ cpu: 0 }, t)).toBe('');
  });

  it('lists transfer and public IPv4', () => {
    expect(planNetworkSpecs({ transferGb: 4096, publicIpv4: true }, t)).toEqual([
      'hostingPlanSpecs.transfer(amount=4 TB)',
      'Public IPv4()',
    ]);
    expect(planNetworkSpecs({ publicIpv4: false }, t)).toEqual([]);
  });

  it('formats memory and storage units', () => {
    expect(formatMemory(512)).toBe('512 MB');
    expect(formatMemory(1536)).toBe('1.5 GB');
    expect(formatStorageGb(25)).toBe('25 GB');
    expect(formatStorageGb(1536)).toBe('1.5 TB');
  });
});
