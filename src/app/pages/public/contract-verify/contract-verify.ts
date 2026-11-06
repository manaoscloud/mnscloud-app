import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, inject, resource, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { resolveApiUrl } from '../../../shared/runtime/app-runtime-config';

interface ContractVerificationData {
  CteTitle: string;
  CteStatus: string;
  CteVerificationCode: string;
  CteOriginalSha256: string;
  CteSignedSha256?: string;
  CteCompletedAt?: string;
  CteDateCreated: string;
  DocumentNumber?: string;
  DocumentTitle: string;
  signers: Array<{
    CtsName: string;
    CtsEmail: string;
    CtsRole: string;
    CtsRequiredLevel: string;
    CtsStatus: string;
    CtsSignedAt?: string;
  }>;
}

@Component({
  selector: 'app-contract-verify',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-3xl">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
            Validação de Autenticidade de Documento
          </h1>
          <p class="mt-2 text-sm text-slate-600">
            Conformidade com MP 2.200-2/2001, Lei 14.063/2020 e Art. 784, §4º do CPC
          </p>
        </div>

        <div class="bg-white py-8 px-6 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          @if (verifyResource.isLoading()) {
            <div class="flex flex-col items-center justify-center py-12">
              <mat-spinner diameter="48"></mat-spinner>
              <p class="mt-4 text-slate-600 font-medium">Verificando integridade e assinaturas do documento...</p>
            </div>
          } @else if (verifyResource.error()) {
            <div class="rounded-md bg-amber-50 p-6 text-center border border-amber-200">
              <mat-icon class="text-amber-500 text-5xl mb-2">warning</mat-icon>
              <h3 class="text-lg font-bold text-amber-900">Documento Não Encontrado</h3>
              <p class="mt-2 text-sm text-amber-800">Documento não localizado com o código informado ou hash inválido.</p>
            </div>
          } @else if (verifyResource.value(); as data) {
            <div class="space-y-6">
              <div class="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                <mat-icon class="text-emerald-600 text-4xl">verified</mat-icon>
                <div>
                  <h2 class="text-lg font-bold text-emerald-900">Documento Autêntico e Verificado</h2>
                  <p class="text-xs text-emerald-700">
                    A integridade criptográfica deste envelope e as assinaturas registradas foram validadas no diário imutável da plataforma.
                  </p>
                </div>
              </div>

              <!-- General Info -->
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div><strong>Título:</strong> {{ data.CteTitle }}</div>
                <div><strong>Documento Original:</strong> {{ data.DocumentTitle }}</div>
                <div><strong>Código de Verificação:</strong> <span class="font-mono text-xs font-bold">{{ data.CteVerificationCode }}</span></div>
                <div><strong>Situação:</strong> <span class="uppercase font-semibold text-blue-800">{{ data.CteStatus }}</span></div>
                <div><strong>Data de Criação:</strong> {{ data.CteDateCreated | date:'dd/MM/yyyy HH:mm:ss' }}</div>
                @if (data.CteCompletedAt) {
                  <div><strong>Concluído em:</strong> {{ data.CteCompletedAt | date:'dd/MM/yyyy HH:mm:ss' }}</div>
                }
                <div class="sm:col-span-2">
                  <strong>Hash SHA-256 Original:</strong>
                  <span class="font-mono text-xs block break-all text-slate-500">{{ data.CteOriginalSha256 }}</span>
                </div>
                @if (data.CteSignedSha256) {
                  <div class="sm:col-span-2">
                    <strong>Hash SHA-256 Final Assinado:</strong>
                    <span class="font-mono text-xs block break-all text-slate-500">{{ data.CteSignedSha256 }}</span>
                  </div>
                }
              </div>

              <!-- Signers Manifest -->
              <div>
                <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Signatários Certificados</h3>
                <ul class="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  @for (s of data.signers; track s.CtsEmail) {
                    <li class="p-3 flex items-center justify-between text-sm">
                      <div class="flex items-center gap-2">
                        <mat-icon [class.text-emerald-500]="s.CtsStatus === 'signed'" [class.text-slate-400]="s.CtsStatus !== 'signed'" class="text-base">
                          {{ s.CtsStatus === 'signed' ? 'check_circle' : 'schedule' }}
                        </mat-icon>
                        <div>
                          <div class="font-medium text-slate-900">{{ s.CtsName }} ({{ s.CtsEmail }})</div>
                          <div class="text-xs text-slate-500">
                            Papel: {{ s.CtsRole }} • Nível: {{ s.CtsRequiredLevel }}
                            @if (s.CtsSignedAt) {
                              • Assinado em {{ s.CtsSignedAt | date:'dd/MM/yyyy HH:mm:ss' }}
                            }
                          </div>
                        </div>
                      </div>
                      <span class="text-xs font-semibold px-2 py-0.5 rounded" [class.bg-emerald-100]="s.CtsStatus === 'signed'" [class.text-emerald-800]="s.CtsStatus === 'signed'" [class.bg-slate-100]="s.CtsStatus !== 'signed'">
                        {{ s.CtsStatus === 'signed' ? 'Assinado' : 'Pendente' }}
                      </span>
                    </li>
                  }
                </ul>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ContractVerifyPage {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  readonly code = signal<string>(this.route.snapshot.paramMap.get('code') ?? '');

  readonly verifyResource = resource({
    params: () => ({ code: this.code() }),
    loader: async ({ params }) => {
      if (!params.code) throw new Error('Código verificador não informado.');
      const url = resolveApiUrl(`public/contracts/verify/${params.code}`);
      const res = await firstValueFrom(this.http.get<{ status: string; data: ContractVerificationData }>(url));
      return res.data;
    },
  });
}
