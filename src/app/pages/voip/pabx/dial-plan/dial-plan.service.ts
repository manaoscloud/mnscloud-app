import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../../../services/api.service';

export type VoipPabxDialPlanItem = {
  uuid: string;
  id: string;
  name: string;
  enabled: number;
  serverEngine?: string | null;
  domainName?: string | null;
  domainUUID?: string | null;
  code: string;
  description?: string | null;
  isDefault?: number | null;
};

export type VoipPabxDialPlanRuleItem = {
  uuid: string;
  id: string;
  name: string;
  enabled: number;
  domainUUID?: string | null;
  dialPlanUUID: string;
  dialPlanName?: string | null;
  direction: string;
  operator: string;
  pattern: string;
  replacement?: string | null;
  stripDigits?: number | null;
  prepend?: string | null;
  priority?: number | null;
  caseSensitive?: number | null;
  resultType: string;
  trunkUUID?: string | null;
  trunkRuntimeName?: string | null;
  trunkName?: string | null;
  callerIdMode?: string | null;
  callerIdValue?: string | null;
  fallbackTrunks?: string | null;
  engineConfig?: string | null;
  description?: string | null;
};

export type VoipPabxTrunkOption = {
  uuid: string;
  id: string;
  name: string;
  enabled: number;
  pabxUUID?: string | null;
  pabxName?: string | null;
  host?: string | null;
  direction?: string | null;
};

@Injectable({ providedIn: 'root' })
export class VoipPabxDialPlanUiService {
  private readonly api = inject(ApiService);

  listPlans(params: { search?: string; limit?: number; offset?: number } = {}) {
    return this.list('dial-plans', params);
  }

  createPlan(payload: Record<string, unknown>) {
    return this.api.post<any>('voip/pabx/dial-plans', payload);
  }

  updatePlan(uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`voip/pabx/dial-plans/${uuid}`, payload);
  }

  removePlan(uuid: string) {
    return this.api.delete<any>(`voip/pabx/dial-plans/${uuid}`);
  }

  removeManyPlans(ids: string[]) {
    return this.api.delete<any>('voip/pabx/dial-plans/bulk', { ids });
  }

  listRules(
    dialPlanUUID: string,
    params: { search?: string; limit?: number; offset?: number } = {},
  ) {
    return this.list('dial-plan-rules', { ...params, dialPlanUUID });
  }

  listAllRules(
    params: { search?: string; limit?: number; offset?: number; dialPlanUUID?: string } = {},
  ) {
    return this.list('dial-plan-rules', params);
  }

  listTrunks(params: { search?: string; limit?: number; offset?: number; status?: number } = {}) {
    return this.list('trunks', params);
  }

  createRule(payload: Record<string, unknown>) {
    return this.api.post<any>('voip/pabx/dial-plan-rules', payload);
  }

  updateRule(uuid: string, payload: Record<string, unknown>) {
    return this.api.put<any>(`voip/pabx/dial-plan-rules/${uuid}`, payload);
  }

  removeRule(uuid: string) {
    return this.api.delete<any>(`voip/pabx/dial-plan-rules/${uuid}`);
  }

  removeManyRules(ids: string[]) {
    return this.api.delete<any>('voip/pabx/dial-plan-rules/bulk', { ids });
  }

  private list(resource: string, params: Record<string, unknown>) {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && String(value).trim()) {
        query.set(key, String(value).trim());
      }
    }
    const suffix = query.toString();
    return this.api.get<any>(`voip/pabx/${resource}${suffix ? `?${suffix}` : ''}`);
  }
}
