/**
 * What a VPS or container plan sells (vCPU, memory, disk, transfer), shown next to its price in
 * the instance plan picker so a plan is never chosen by price alone. Every provider uses it.
 */
export type PlanSpecConfig = {
  cpu?: number | null;
  memoryMb?: number | null;
  diskGb?: number | null;
  transferGb?: number | null;
  diskType?: string | null;
  dedicatedCpu?: boolean | null;
  publicIpv4?: boolean | null;
};

type Translate = (key: string, params?: Record<string, string | number>) => string;

/** Hardware of the plan: `4 vCPU · 8 GB RAM · 160 GB SSD`; empty when the plan has none. */
export function planHardwareSummary(
  config: PlanSpecConfig | null | undefined,
  t: Translate,
): string {
  if (!config) return '';
  const cpu = positive(config.cpu);
  const memoryMb = positive(config.memoryMb);
  const diskGb = positive(config.diskGb);
  const diskType = String(config.diskType ?? '').trim();
  return [
    cpu
      ? t(config.dedicatedCpu ? 'hostingPlanSpecs.dedicatedCpu' : 'hostingPlanSpecs.cpu', {
          count: cpu,
        })
      : null,
    memoryMb ? t('hostingPlanSpecs.memory', { amount: formatMemory(memoryMb) }) : null,
    diskGb
      ? diskType
        ? t('hostingPlanSpecs.diskTyped', {
            amount: formatStorageGb(diskGb),
            type: diskTypeLabel(diskType),
          })
        : t('hostingPlanSpecs.disk', { amount: formatStorageGb(diskGb) })
      : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Network allowances of the plan: transfer and public IPv4. */
export function planNetworkSpecs(
  config: PlanSpecConfig | null | undefined,
  t: Translate,
): string[] {
  if (!config) return [];
  const transferGb = positive(config.transferGb);
  return [
    transferGb ? t('hostingPlanSpecs.transfer', { amount: formatStorageGb(transferGb) }) : null,
    config.publicIpv4 ? t('Public IPv4') : null,
  ].filter((item): item is string => Boolean(item));
}

function positive(value: unknown): number | null {
  const number = Number(value ?? 0);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** 512 MB, 1 GB, 1.5 GB, 64 GB. */
export function formatMemory(memoryMb: number): string {
  if (memoryMb < 1024) return `${trim(memoryMb)} MB`;
  return `${trim(memoryMb / 1024)} GB`;
}

/** 25 GB, 640 GB, 4 TB (binary steps, as the providers publish them). */
export function formatStorageGb(gb: number): string {
  if (gb >= 1024) return `${trim(gb / 1024)} TB`;
  return `${trim(gb)} GB`;
}

function trim(value: number): string {
  return String(Math.round(value * 10) / 10);
}

function diskTypeLabel(type: string): string {
  const normalized = type.toLowerCase();
  if (normalized === 'nvme') return 'NVMe';
  return normalized.toUpperCase();
}
