export type VoipSoftswitchDidItem = {
  VsdUUID: string;
  VsdID: string;
  VoipSoftswitchAccountVssUUID: string;
  CustomerCusUUID: string;
  VoipDomainVdmUUID: string;
  VoipSoftswitchSubscriberVsuUUID?: string | null;
  VsdNumber: string;
  VsdDirection: 'inbound' | 'outbound' | 'both';
  VsdRouteType: 'subscriber' | 'external' | 'trunk' | 'none';
  VsdRouteValue?: string | null;
  VsdDescription?: string | null;
  VsdEnabled: number;
  SoftswitchName?: string | null;
  CustomerName?: string | null;
  DomainName?: string | null;
  SubscriberUsername?: string | null;
};
