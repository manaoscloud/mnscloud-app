import { fiberColor, occupancyLevel, portLabel, spliceDiagram } from './network-model';
import { radiusPolygon } from '../map/map';

describe('InfraGIS network model', () => {
  it('labels ports and maps ABNT colors', () => {
    expect(portLabel('FIBER', 13, 2)).toBe('F 13 (T2)');
    expect(portLabel('SPLITTER_OUT', 3, null)).toBe('OUT 3');
    expect(portLabel('PORT', 1, 'NULL')).toBe('P 1');
    expect(fiberColor('Verde')).toBe('#16A34A');
    expect(fiberColor('unknown')).toBe('#94A3B8');
  });

  it('classifies occupancy', () => {
    expect(occupancyLevel(0, 0)).toBe('none');
    expect(occupancyLevel(5, 8)).toBe('ok');
    expect(occupancyLevel(6, 8)).toBe('high');
    expect(occupancyLevel(8, 8)).toBe('full');
  });

  it('lays out the splice diagram grouped by asset', () => {
    const diagram = spliceDiagram([
      {
        FromAssetName: 'CABO B',
        FromKind: 'FIBER',
        FromNumber: 2,
        FromColor: 'amarelo',
        ToAssetName: 'SPL',
        ToKind: 'SPLITTER_IN',
        ToNumber: 1,
        IcnKind: 'FUSION',
        IcnLossDb: '0.10',
      },
      {
        FromAssetName: 'CABO A',
        FromKind: 'FIBER',
        FromNumber: 1,
        FromTube: 1,
        FromColor: 'verde',
        ToAssetName: 'CABO B',
        ToKind: 'FIBER',
        ToNumber: 1,
        IcnKind: 'FUSION',
        IcnLossDb: '0.10',
      },
      {
        FromAssetName: 'CABO A',
        FromKind: 'FIBER',
        FromNumber: 2,
        FromColor: 'amarelo',
        ToAssetName: 'CABO B',
        ToKind: 'FIBER',
        ToNumber: 2,
        IcnKind: 'FUSION',
        IcnLossDb: '0.10',
      },
    ]);
    expect(diagram.lines.map((line) => line.from.label)).toEqual(['F 1 (T1)', 'F 2', 'F 2']);
    expect(diagram.lines[0].from.color).toBe('#16A34A');
    expect(
      diagram.groups.filter((group) => group.side === 'left').map((group) => group.asset),
    ).toEqual(['CABO A', 'CABO B']);
    expect(
      diagram.groups.filter((group) => group.side === 'right').map((group) => group.asset),
    ).toEqual(['CABO B', 'SPL']);
    expect(diagram.height).toBeGreaterThan(diagram.lines[2].from.y);
  });

  it('draws the feasibility radius around a point', () => {
    const polygon = radiusPolygon(-60, -3, 300);
    const ring = polygon.coordinates[0];
    expect(ring.length).toBe(65);
    expect(ring[0]).toEqual(ring[64]);
    expect(Math.abs(ring[16][1] - -3 - 300 / 111320)).toBeLessThan(1e-9);
  });
});
