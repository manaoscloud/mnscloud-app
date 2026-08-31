import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ActivatedRoute, convertToParamMap, Router } from '@angular/router';
import { of } from 'rxjs';

import { InviteAcceptPage } from './invite-accept';
import { TenantsService } from '../../tenants.service';
import { InviteSessionService } from '../../../../services/invite-session.service';
import { AppI18nService } from '../../../../services/app-i18n.service';
import { provideTransloco, TranslocoLoader } from '@jsverse/transloco';

class TestingTranslocoLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

describe('InviteAcceptPage', () => {
  let component: InviteAcceptPage;
  let fixture: ComponentFixture<InviteAcceptPage>;

  beforeEach(async () => {
    const tenantsService = jasmine.createSpyObj<TenantsService>('TenantsService', [
      'validateInviteToken',
      'acceptInvite',
      'acceptInviteWithProfile',
    ]);
    tenantsService.validateInviteToken.and.resolveTo({
      data: {
        InviteEmail: 'user@example.com',
        InviteRole: 'ADMIN',
        EnvironmentUUID: '11111111-1111-1111-1111-111111111111',
        EnvironmentName: 'Tenant A',
        UserUUID: '22222222-2222-2222-2222-222222222222',
        UserExists: 1,
        UserProfileComplete: 1,
      },
    });
    tenantsService.acceptInvite.and.resolveTo({
      message: 'Access granted successfully.',
    });

    await TestBed.configureTestingModule({
      imports: [InviteAcceptPage],
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
          useValue: jasmine.createSpyObj<InviteSessionService>('InviteSessionService', [
            'get',
            'clear',
          ]),
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

    fixture = TestBed.createComponent(InviteAcceptPage);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
