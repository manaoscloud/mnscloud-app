import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { resolveApiUrl } from '../../../shared/runtime/app-runtime-config';

interface SignerCeremonyData {
  CtsUUID: string;
  CtsID: string;
  CtsRole: string;
  CtsRoutingOrder: number;
  CtsName: string;
  CtsEmail: string;
  CtsPhone?: string;
  CtsTaxID?: string;
  CtsRequiredLevel: string;
  CtsMfaMethods: string;
  CtsStatus: string;
  CtsSignedAt?: string;
  Envelope: {
    CteUUID: string;
    CteTitle: string;
    CteStatus: string;
    CteOriginalSha256: string;
    CteVerificationCode: string;
    CteRequireTimestamp: number;
    CteRoutingType: string;
    CteExpiresAt?: string;
    CteOriginalStoragePath?: string;
    DocumentTitle: string;
    DocumentNumber?: string;
  };
  AllSigners: Array<{
    CtsName: string;
    CtsRole: string;
    CtsRoutingOrder: number;
    CtsStatus: string;
    CtsSignedAt?: string;
  }>;
}

@Component({
  selector: 'app-contract-signing',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatCheckboxModule,
    MatIconModule,
    MatProgressSpinnerModule,
    RouterLink,
  ],
  template: `
    <div class="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div class="sm:mx-auto sm:w-full sm:max-w-3xl">
        <div class="text-center mb-8">
          <h1 class="text-3xl font-extrabold text-slate-900 tracking-tight">
            Cerimônia de Assinatura Eletrônica
          </h1>
          <p class="mt-2 text-sm text-slate-600">
            Validade Jurídica conforme MP 2.200-2/2001, Lei 14.063/2020 e Lei 14.620/2023 (Art. 784, §4º CPC)
          </p>
        </div>

        <div class="bg-white py-8 px-6 shadow sm:rounded-lg sm:px-10 border border-slate-200">
          @if (loading()) {
            <div class="flex flex-col items-center justify-center py-12">
              <mat-spinner diameter="48"></mat-spinner>
              <p class="mt-4 text-slate-600 font-medium">Carregando dados da cerimônia de assinatura...</p>
            </div>
          } @else if (errorMessage()) {
            <div class="rounded-md bg-red-50 p-6 text-center">
              <mat-icon class="text-red-500 text-4xl mb-2">error_outline</mat-icon>
              <h3 class="text-lg font-semibold text-red-800">Assinatura Indisponível</h3>
              <p class="mt-2 text-sm text-red-700">{{ errorMessage() }}</p>
            </div>
          } @else if (completed()) {
            <div class="rounded-md bg-emerald-50 p-6 text-center">
              <mat-icon class="text-emerald-500 text-5xl mb-2">check_circle</mat-icon>
              <h3 class="text-xl font-bold text-emerald-900">Documento Assinado com Sucesso!</h3>
              <p class="mt-2 text-sm text-emerald-800">
                Sua manifestação de vontade e evidências digitais foram autenticadas e encadeadas com hash criptográfico SHA-256 no diário de assinaturas.
              </p>
              @if (actionResult()?.envelopeStatus === 'completed') {
                <div class="mt-4 p-3 bg-emerald-100 rounded text-emerald-900 font-medium text-sm">
                  Todos os signatários completaram a assinatura. O documento tornou-se um título executivo com integridade preservada.
                </div>
              }
            </div>
          } @else if (ceremony()) {
            <div class="space-y-6">
              <!-- Document Details -->
              <div class="border-b border-slate-200 pb-4">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 uppercase tracking-wide">
                  {{ ceremony()?.Envelope?.CteStatus }}
                </span>
                <h2 class="text-2xl font-bold text-slate-800 mt-2">
                  {{ ceremony()?.Envelope?.CteTitle }}
                </h2>
                <div class="mt-2 text-sm text-slate-600 grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div><strong>Documento:</strong> {{ ceremony()?.Envelope?.DocumentTitle }}</div>
                  <div><strong>Código Verificador:</strong> <span class="font-mono text-xs">{{ ceremony()?.Envelope?.CteVerificationCode }}</span></div>
                  <div class="sm:col-span-2">
                    <strong>Hash SHA-256 Original:</strong>
                    <span class="font-mono text-xs block break-all text-slate-500">{{ ceremony()?.Envelope?.CteOriginalSha256 }}</span>
                  </div>
                </div>
              </div>

              <!-- Signer Identification -->
              <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Seus Dados de Signatário</h3>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-slate-800">
                  <div><strong>Nome:</strong> {{ ceremony()?.CtsName }}</div>
                  <div><strong>E-mail:</strong> {{ ceremony()?.CtsEmail }}</div>
                  @if (ceremony()?.CtsTaxID) {
                    <div><strong>CPF/CNPJ:</strong> {{ ceremony()?.CtsTaxID }}</div>
                  }
                  <div><strong>Papel:</strong> {{ ceremony()?.CtsRole }}</div>
                  <div><strong>Nível Exigido:</strong> {{ ceremony()?.CtsRequiredLevel }}</div>
                </div>
              </div>

              <!-- Parties Table -->
              <div>
                <h3 class="text-sm font-semibold text-slate-700 uppercase tracking-wider mb-2">Quadro de Signatários</h3>
                <ul class="divide-y divide-slate-200 border border-slate-200 rounded-md">
                  @for (s of ceremony()?.AllSigners; track s.CtsName) {
                    <li class="py-2.5 px-4 flex items-center justify-between text-sm">
                      <div class="flex items-center gap-2">
                        <mat-icon [class.text-emerald-500]="s.CtsStatus === 'signed'" [class.text-slate-400]="s.CtsStatus !== 'signed'" class="text-base">
                          {{ s.CtsStatus === 'signed' ? 'check_circle' : 'schedule' }}
                        </mat-icon>
                        <span class="font-medium text-slate-900">{{ s.CtsName }}</span>
                        <span class="text-xs text-slate-500">({{ s.CtsRole }})</span>
                      </div>
                      <span class="text-xs font-semibold px-2 py-0.5 rounded" [class.bg-emerald-100]="s.CtsStatus === 'signed'" [class.text-emerald-800]="s.CtsStatus === 'signed'" [class.bg-slate-100]="s.CtsStatus !== 'signed'">
                        {{ s.CtsStatus === 'signed' ? 'Assinado' : 'Pendente' }}
                      </span>
                    </li>
                  }
                </ul>
              </div>

              @if (ceremony()?.CtsStatus === 'signed') {
                <div class="p-4 bg-emerald-50 rounded text-center text-emerald-800 font-medium">
                  Você já assinou este documento em {{ ceremony()?.CtsSignedAt | date:'dd/MM/yyyy HH:mm:ss' }}.
                </div>
              } @else {
                <!-- Agreement and Sign Action -->
                <div class="pt-4 border-t border-slate-200 space-y-4">
                  <div class="flex items-start">
                    <mat-checkbox [(ngModel)]="agreed" color="primary">
                      <span class="text-xs text-slate-700 leading-normal">
                        Li e concordo com os termos do documento acima especificado, manifestando expressamente minha concordância e assinatura eletrônica avançada com plena validade jurídica e eficácia executiva.
                      </span>
                    </mat-checkbox>
                  </div>

                  <div class="flex flex-col sm:flex-row gap-3 justify-end pt-2">
                    <button mat-button color="warn" (click)="decline()" [disabled]="submitting()">
                      Recusar Assinatura
                    </button>
                    <button mat-flat-button color="primary" [disabled]="!agreed() || submitting()" (click)="sign()">
                      @if (submitting()) {
                        <span>Registrando...</span>
                      } @else {
                        <span>Assinar Documento Eletronicamente</span>
                      }
                    </button>
                  </div>
                </div>
              }
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class ContractSigningPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);

  readonly token = signal<string>('');
  readonly ceremony = signal<SignerCeremonyData | null>(null);
  readonly loading = signal<boolean>(true);
  readonly submitting = signal<boolean>(false);
  readonly agreed = signal<boolean>(false);
  readonly completed = signal<boolean>(false);
  readonly errorMessage = signal<string | null>(null);
  readonly actionResult = signal<any>(null);

  ngOnInit() {
    const tokenParam = this.route.snapshot.paramMap.get('token') ?? '';
    this.token.set(tokenParam);
    if (!tokenParam) {
      this.errorMessage.set('Token de cerimônia não informado.');
      this.loading.set(false);
      return;
    }
    this.loadCeremony(tokenParam);
  }

  private loadCeremony(token: string) {
    this.loading.set(true);
    const url = resolveApiUrl(`public/contracts/sign/${token}`);
    this.http.get<{ status: string; data: SignerCeremonyData }>(url).subscribe({
      next: (res) => {
        this.ceremony.set(res.data);
        this.loading.set(false);
        // Record viewed action automatically
        if (res.data?.CtsStatus === 'pending') {
          this.recordAction('signer.viewed');
        }
      },
      error: (err) => {
        this.errorMessage.set(err.error?.error || 'Cerimônia de assinatura não encontrada ou expirada.');
        this.loading.set(false);
      },
    });
  }

  sign() {
    if (!this.agreed() || this.submitting()) return;
    this.submitting.set(true);
    this.recordAction('signer.signed', {
      agreed: true,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
    });
  }

  decline() {
    if (this.submitting()) return;
    this.submitting.set(true);
    this.recordAction('signer.declined', {
      reason: 'Recusado pelo signatário',
      timestamp: new Date().toISOString(),
    });
  }

  private recordAction(eventType: string, evidence?: Record<string, unknown>) {
    const token = this.token();
    const url = resolveApiUrl(`public/contracts/sign/${token}/action`);
    this.http.post<{ status: string; data: any }>(url, { eventType, evidence: evidence ?? {} }).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.actionResult.set(res.data);
        if (eventType === 'signer.signed') {
          this.completed.set(true);
        } else if (eventType === 'signer.declined') {
          this.errorMessage.set('A assinatura foi recusada pelo signatário.');
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(err.error?.error || 'Erro ao registrar ação de assinatura.');
      },
    });
  }
}
