import { Dict, FlowGraph, GraphEdge, GraphNode, TRIGGER_TYPE } from './automation-adapter';

export interface FlowTemplate {
  key: string;
  surface?: 'conversation' | 'event';
  /** Translation keys of the menu entry and of the name/description of the created flow. */
  labelKey: string;
  nameKey: string;
  descriptionKey: string;
  /** Builds the draft graph; `t` translates the texts the contact will read. */
  build: (t: (key: string) => string) => FlowGraph;
}

const WEEK = [1, 2, 3, 4, 5].map((day) => ({ day, start: '08:00', end: '18:00' }));

function node(id: string, type: string, x: number, y: number, config: Dict = {}): GraphNode {
  return { id, type, typeVersion: 1, position: { x, y }, config };
}

function edge(from: string, port: string, to: string): GraphEdge {
  return { from, port, to };
}

function trigger(): GraphNode {
  return node('trigger', TRIGGER_TYPE, 40, 200, {
    triggers: [{ type: 'conversation.inbound', connectionUUIDs: [] }],
  });
}

function hours(): GraphNode {
  return node('hours', 'core.business_hours', 340, 200, {
    timezone: 'America/Sao_Paulo',
    week: WEEK,
    holidays: [],
  });
}

/** "Menu inicial": greeting menu in business hours, a message outside them. Teams stay empty. */
export function buildMainMenu(t: (key: string) => string): FlowGraph {
  return {
    schemaVersion: 1,
    start: 'trigger',
    nodes: [
      trigger(),
      hours(),
      node('menu', 'conversations.ask', 640, 80, {
        text: t('automation.templates.mainMenu.question'),
        options: [
          { id: 'finance', label: t('automation.templates.mainMenu.finance') },
          { id: 'support', label: t('automation.templates.mainMenu.support') },
          { id: 'agent', label: t('automation.templates.mainMenu.agent') },
        ],
        timeoutMinutes: 30,
        maxRetries: 2,
        invalidMessage: t('automation.templates.mainMenu.invalid'),
      }),
      node('finance', 'conversations.handoff', 980, 0, {
        includeSummary: true,
      }),
      node('support', 'conversations.handoff', 980, 160, {
        includeSummary: true,
      }),
      node('agent', 'conversations.distribute', 980, 320, { includeSummary: true }),
      node('agentFallback', 'conversations.handoff', 1320, 360, { includeSummary: true }),
      node('closedMessage', 'conversations.send_message', 640, 460, {
        text: t('automation.templates.mainMenu.closed'),
      }),
      node('end', 'core.end', 980, 520),
    ],
    edges: [
      edge('trigger', 'next', 'hours'),
      edge('hours', 'open', 'menu'),
      edge('hours', 'closed', 'closedMessage'),
      edge('menu', 'option:finance', 'finance'),
      edge('menu', 'option:support', 'support'),
      edge('menu', 'option:agent', 'agent'),
      edge('agent', 'no_agent', 'agentFallback'),
      edge('closedMessage', 'next', 'end'),
    ],
  };
}

/** "Fora do horario": message and an invitation to leave a message, then handoff. */
export function buildAfterHours(t: (key: string) => string): FlowGraph {
  return {
    schemaVersion: 1,
    start: 'trigger',
    nodes: [
      trigger(),
      hours(),
      node('closedMessage', 'conversations.send_message', 640, 320, {
        text: t('automation.templates.afterHours.closed'),
      }),
      node('leave', 'conversations.ask', 980, 320, {
        text: t('automation.templates.afterHours.leave'),
        timeoutMinutes: 60,
        maxRetries: 0,
        saveAs: 'message',
      }),
      node('handoff', 'conversations.handoff', 1320, 320, {
        includeSummary: true,
      }),
      node('open', 'core.end', 640, 80),
    ],
    edges: [
      edge('trigger', 'next', 'hours'),
      edge('hours', 'open', 'open'),
      edge('hours', 'closed', 'closedMessage'),
      edge('closedMessage', 'next', 'leave'),
      edge('leave', 'answer', 'handoff'),
      edge('leave', 'invalid', 'handoff'),
      edge('leave', 'timeout', 'handoff'),
    ],
  };
}

export const FLOW_TEMPLATES: readonly FlowTemplate[] = [
  {
    key: 'crm-owner-followup',
    surface: 'event',
    labelKey: 'crm.prospect.ownerTemplate',
    nameKey: 'crm.prospect.ownerTemplate',
    descriptionKey: 'crm.prospect.ownerTemplateHelp',
    build: (t) => buildCrmFollowUp(t),
  },
  {
    key: 'crm-reminder',
    surface: 'event',
    labelKey: 'crm.prospect.reminderTemplate',
    nameKey: 'crm.prospect.reminderTemplate',
    descriptionKey: 'crm.prospect.reminderTemplateHelp',
    build: (t) => buildCrmFollowUp(t, false),
  },
  {
    key: 'main-menu',
    labelKey: 'automation.templates.mainMenu.label',
    nameKey: 'automation.templates.mainMenu.name',
    descriptionKey: 'automation.templates.mainMenu.description',
    build: buildMainMenu,
  },
  {
    key: 'after-hours',
    labelKey: 'automation.templates.afterHours.label',
    nameKey: 'automation.templates.afterHours.name',
    descriptionKey: 'automation.templates.afterHours.description',
    build: buildAfterHours,
  },
];

/** Draft only: the operator chooses the owner and explicitly validates/publishes in the editor. */
export function buildCrmFollowUp(t: (key: string) => string, assign = true): FlowGraph {
  return {
    schemaVersion: 1,
    start: 'trigger',
    nodes: [
      node('trigger', TRIGGER_TYPE, 40, 200, {
        triggers: [{ type: 'event', event: 'crm.lead.created' }],
      }),
      ...(assign ? [node('owner', 'crm.assign_owner', 340, 200, { target: 'lead' })] : []),
      node('followup', 'crm.log_activity', 640, 200, {
        target: 'lead',
        name: t('crm.prospect.followUpName'),
        kind: 'call',
        state: 'planned',
        dueInMinutes: assign ? 60 : 1440,
      }),
      node('end', 'core.end', 940, 200),
    ],
    edges: [
      edge('trigger', 'next', assign ? 'owner' : 'followup'),
      ...(assign
        ? [
            edge('owner', 'next', 'followup'),
            edge('owner', 'missing', 'end'),
            edge('owner', 'error', 'end'),
          ]
        : []),
      edge('followup', 'next', 'end'),
      edge('followup', 'missing', 'end'),
      edge('followup', 'error', 'end'),
    ],
  };
}
