import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { InviteValidatePage } from './invite-validate';
import { TenantsService } from '../../tenants.service';
import { InviteSessionService } from '../../../../services/invite-session.service';
import { AppI18nService } from '../../../../services/app-i18n.service';
import { provideTransloco, TranslocoLoader } from '@jsverse/transloco';

class TestingTranslocoLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

describe('InviteValidatePage', () => {
  let component: InviteValidatePage;
  let fixture: ComponentFixture<InviteValidatePage>;

  beforeEach(async () => {
    const tenantsService = jasmine.createSpyObj<TenantsService>('TenantsService', [
      'validateInviteToken',
    ]);
    tenantsService.validateInviteToken.and.resolveTo({
      status: 'success',
      data: {
        InviteEmail: 'user@example.com',
        InviteRole: 'ADMIN',
        EnvironmentUUID: '11111111-1111-1111-1111-111111111111',
        EnvironmentName: 'Tenant A',
      },
    });

    await TestBed.configureTestingModule({
      imports: [InviteValidatePage],
      providers: [
        provideZonelessChangeDetection(),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ token: 'invite-token' }),
            },
          },
        },
        { provide: Router, useValue: jasmine.createSpyObj<Router>('Router', ['navigate']) },
        { provide: TenantsService, useValue: tenantsService },
        {
          provide: InviteSessionService,
          useValue: jasmine.createSpyObj<InviteSessionService>('InviteSessionService', ['set']),
        },
        { provide: AppI18nService, useValue: { t: (key: string) => key } },
        provideTransloco({
          config: {
            availableLangs: ['en-US'],
            defaultLang: 'en-US',
            fallbackLang: 'en-US',
            reRenderOnLangChange: false,
            missingHandler: { logMissingKey: false },
          },
          loader: TestingTranslocoLoader,
        }),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(InviteValidatePage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
