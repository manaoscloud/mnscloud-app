import { usedWidgets } from './automation.service';

describe('automation pickers', () => {
  it('lists only the pickers of nodes the tenant can use', () => {
    const defs = [
      {
        locked: false,
        configSchema: {
          properties: {
            channelUUID: { 'x-widget': 'supportChannel' },
            teamUUID: { 'x-widget': 'team' },
            text: { 'x-widget': 'template' },
          },
        },
      },
      { locked: true, configSchema: { properties: { stageUUID: { 'x-widget': 'crmStage' } } } },
      {
        locked: false,
        configSchema: {
          properties: {
            items: { type: 'array', items: { properties: { s: { 'x-widget': 'crmSource' } } } },
          },
        },
      },
    ];
    expect(usedWidgets(defs).sort()).toEqual(['crmSource', 'supportChannel', 'team']);
  });
});
