import { FLOW_TEMPLATES } from './automation-templates';
import { portsOf } from './automation-graph';
import { widgetOf } from './automation.service';

const STATIC_PORTS: Record<string, string[]> = {
  'core.trigger': ['next'],
  'core.business_hours': ['open', 'closed'],
  'conversations.send_message': ['next'],
  'conversations.distribute': ['no_agent'],
  'conversations.handoff': [],
  'core.end': [],
};

describe('flow templates', () => {
  for (const template of FLOW_TEMPLATES) {
    it(`${template.key} is a consistent graph`, () => {
      const graph = template.build((key) => key);
      const ids = new Set(graph.nodes.map((n) => n.id));
      expect(ids.size).toBe(graph.nodes.length);
      expect(ids.has(graph.start)).toBe(true);
      for (const edge of graph.edges) {
        expect(ids.has(edge.from)).toBe(true);
        expect(ids.has(edge.to)).toBe(true);
        const node = graph.nodes.find((n) => n.id === edge.from)!;
        const ports = portsOf(node, {
          type: node.type,
          ports: (STATIC_PORTS[node.type] ?? []).map((id) => ({ id, label: id })),
        } as never).map((p) => p.id);
        expect(ports).toContain(edge.port);
      }
    });
  }

  it('infers the flow picker from the property name', () => {
    expect(widgetOf('flowUUID', undefined)).toBe('flow');
  });
});
