import { isImageCompatibleWithPlan } from './instances';

const templateId = '9103';
const template = {
  id: templateId,
  label: templateId,
  regions: ['pve02'],
  cpu: 1,
  memoryMb: 512,
  minDiskGb: 20,
};

describe('VPS image compatibility', () => {
  it('offers every node template to a plan with automatic placement', () => {
    expect(
      isImageCompatibleWithPlan(template, { region: 'auto', diskGb: 25, cpu: 1, memoryMb: 1024 }),
    ).toBeTrue();
  });

  it('keeps hiding templates of another node for a pinned plan', () => {
    expect(isImageCompatibleWithPlan(template, { region: 'pve01', diskGb: 25 })).toBeFalse();
    expect(isImageCompatibleWithPlan(template, { region: 'pve02', diskGb: 25 })).toBeTrue();
  });

  it('still applies the minimum hardware with automatic placement', () => {
    expect(isImageCompatibleWithPlan(template, { region: 'auto', diskGb: 10 })).toBeFalse();
  });
});
