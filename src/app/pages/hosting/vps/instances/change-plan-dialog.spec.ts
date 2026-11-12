import type { HostingVpsInstance, HostingVpsPlan } from '../vps.types';
import { proxmoxUpgradePlans } from './change-plan-dialog';

const PROVIDER = 'PX-1';

function plan(
  uuid: string,
  region: string,
  cpu: number,
  memoryMb: number,
  diskGb: number,
  extra: Partial<HostingVpsPlan> = {},
): HostingVpsPlan {
  return {
    HvpUUID: uuid,
    HvpName: uuid,
    HvpProvider: 'proxmox',
    HvpRegion: region,
    HvpIsActive: 1,
    HostingVpsProviderHvrUUID: PROVIDER,
    HvpConfig: { cpu, memoryMb, diskGb },
    ...extra,
  } as HostingVpsPlan;
}

const ADOPTION_PLAN = plan('ADOPTED', 'adopted', 0, 0, 0, { HvpIsActive: 0, HvpConfig: {} });
const PLANS = [
  ADOPTION_PLAN,
  plan('START', 'auto', 1, 1024, 25),
  plan('BASIC', 'auto', 2, 2048, 50),
  plan('PRO', 'auto', 4, 8192, 160),
  plan('PINNED-PVE02', 'pve02', 4, 8192, 160),
  plan('PINNED-PVE01', 'pve01', 4, 8192, 160),
  plan('OFF', 'auto', 8, 16384, 320, { HvpIsActive: 0 }),
  plan('OTHER-PROVIDER', 'auto', 8, 16384, 320, { HostingVpsProviderHvrUUID: 'PX-2' }),
];

function names(instance: HostingVpsInstance, current: HostingVpsPlan | null): string[] {
  return proxmoxUpgradePlans(instance, PLANS, current).map((option) => option.plan.HvpUUID);
}

describe('Proxmox upgrade plans', () => {
  it('offers an adopted VM only plans not smaller than the VM, on auto or its node', () => {
    const adopted: HostingVpsInstance = {
      HviUUID: 'VM-1',
      HviName: 'MNS-DNS-PROD1',
      HviIsActive: 1,
      HviAdoptedAt: '2026-11-12T10:00:00Z',
      HostingVpsProviderHvrUUID: PROVIDER,
      HostingVpsPlanHvpUUID: 'ADOPTED',
      HviConfig: { proxmoxNode: 'pve02', runtime: { vcpus: 2, memoryMb: 2048, diskGb: 40 } },
    };
    expect(names(adopted, ADOPTION_PLAN)).toEqual(['BASIC', 'PINNED-PVE02', 'PRO']);
  });

  it('offers an adopted VM without a runtime size every compatible plan (the API checks the VM)', () => {
    const adopted: HostingVpsInstance = {
      HviUUID: 'VM-2',
      HviName: 'MNS-API-PROD1',
      HviIsActive: 1,
      HviAdoptedAt: '2026-11-12T10:00:00Z',
      HostingVpsProviderHvrUUID: PROVIDER,
      HostingVpsPlanHvpUUID: 'ADOPTED',
      HviConfig: { proxmoxNode: 'pve01' },
    };
    // Its plan may be missing from the list: the instance provider is used.
    expect(names(adopted, null)).toEqual(['START', 'BASIC', 'PINNED-PVE01', 'PRO']);
  });

  it('keeps the plan region and disk rule for a server the platform created', () => {
    const created: HostingVpsInstance = {
      HviUUID: 'VM-3',
      HviName: 'MNS-DNS-PROD2',
      HviIsActive: 1,
      HviAdoptedAt: null,
      HostingVpsProviderHvrUUID: PROVIDER,
      HostingVpsPlanHvpUUID: 'BASIC',
      HviConfig: { proxmoxNode: 'pve02' },
    };
    expect(names(created, PLANS[2])).toEqual(['PRO']);
  });
});
