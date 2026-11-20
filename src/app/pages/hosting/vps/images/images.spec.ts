import { BreakpointObserver } from '@angular/cdk/layout';
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { ApiService } from '../../../../services/api.service';
import { AsyncOperationsService } from '../../../../shared/operations/async-operations.service';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudConfig,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { configurableCrudTestingModule } from '../../../../shared/crud/configurable-crud/configurable-crud-testing';
import { defineCrud } from '../../../../shared/crud/configurable-crud/define-crud';
import { HostingVpsProviderPage } from '../provider/provider';
import {
  HostingVpsImagesPage,
  IMAGES_ENDPOINT,
  buildImageAccessPayload,
  canManageImageRow,
  canPublishImageRow,
  minimumSpecsSummary,
  replicaAvailabilitySummary,
  vpsImageErrorKey,
} from './images';

const dynamicUpdateConfig: ConfigurableCrudConfig = defineCrud({
  endpoint: 'test/resources',
  updateEndpoint: (row) => `test/resources/${String(row['uuid'] ?? '')}/access`,
  uuidField: 'uuid',
  pageTitle: 'VPS images',
  pageDescription:
    'Manage platform VPS logical images, audience authorization, published versions and node availability.',
  statusFilter: false,
  initialValues: { name: '' },
  columns: [{ id: 'name', label: 'Name', field: 'name', kind: 'identity' }],
  fields: [{ key: 'name', source: 'name', payloadKey: 'name', label: 'Name', required: true }],
});

@Component({
  selector: 'app-dynamic-update-test-page',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
class DynamicUpdateEndpointTestPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(dynamicUpdateConfig);
  }
}

describe('VPS image access page and dynamic update endpoint', () => {
  it('resolves dynamic updateEndpoint functions without appending the record UUID twice', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'put']);
    api.get.and.resolveTo({
      data: { items: [{ uuid: '00000005-1111-4222-8333-444444444444', name: 'Ubuntu' }], total: 1 },
    });
    api.put.and.resolveTo({
      status: 'success',
      data: { item: { uuid: '00000005-1111-4222-8333-444444444444', name: 'Ubuntu 2' } },
    });
    const snackbar = jasmine.createSpyObj('SnackbarService', ['success', 'warning', 'error']);

    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: DynamicUpdateEndpointTestPage,
        api,
        snackbar,
        providers: [
          { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
        ],
      }),
    ).compileComponents();

    const fixture = TestBed.createComponent(DynamicUpdateEndpointTestPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;

    page.startEdit({ uuid: '00000005-1111-4222-8333-444444444444', name: 'Ubuntu' });
    await page.saveItem(false);

    expect(api.put).toHaveBeenCalledWith(
      'test/resources/00000005-1111-4222-8333-444444444444/access',
      jasmine.objectContaining({ name: 'Ubuntu' }),
      undefined,
    );
  });

  it('builds bounded access payloads with delta environment arrays and revision string', () => {
    const current: ConfigurableCrudRecord = {
      HimUUID: '00000005-1111-4222-8333-444444444444',
      HimRevision: '42',
      HimVisibility: 'selected',
      HimPublication: 'published',
      canPublish: 1,
    };

    const selectedPayload = buildImageAccessPayload(
      {
        revision: '42',
        visibility: 'selected',
        addEnvironmentUUIDs: [
          '00000001-1111-4222-8333-444444444444',
          '00000002-1111-4222-8333-444444444444',
          '00000001-1111-4222-8333-444444444444',
        ],
        removeEnvironmentUUIDs: [
          '00000002-1111-4222-8333-444444444444',
          '00000003-1111-4222-8333-444444444444',
        ],
        publication: 'published',
        versionUUID: '0000000a-1111-4222-8333-444444444444',
        reason: 'Grant tenant A and B, revoke C',
      },
      current,
    );
    expect(selectedPayload).toEqual({
      revision: '42',
      visibility: 'selected',
      addEnvironmentUUIDs: [
        '00000001-1111-4222-8333-444444444444',
        '00000002-1111-4222-8333-444444444444',
      ],
      removeEnvironmentUUIDs: ['00000003-1111-4222-8333-444444444444'],
      reason: 'Grant tenant A and B, revoke C',
      publication: 'published',
      versionUUID: '0000000a-1111-4222-8333-444444444444',
    });

    const publicPayload = buildImageAccessPayload(
      {
        revision: '42',
        visibility: 'public',
        addEnvironmentUUIDs: ['00000001-1111-4222-8333-444444444444'],
        removeEnvironmentUUIDs: ['00000003-1111-4222-8333-444444444444'],
        reason: 'Publish image for all eligible customers',
      },
      current,
    );
    expect(publicPayload.addEnvironmentUUIDs).toEqual([]);
    expect(publicPayload.removeEnvironmentUUIDs).toEqual([]);
    expect(publicPayload.visibility).toBe('public');
  });

  it('formats minimum specs, replica summary, capabilities and known server error codes', () => {
    expect(minimumSpecsSummary({ cpu: 2, memoryMb: 4096, diskGb: 40 })).toBe(
      '2 vCPU · 4 GB · 40 GB',
    );
    expect(replicaAvailabilitySummary({ readyReplicas: 3, totalReplicas: 4 })).toBe('3/4');
    expect(canManageImageRow({ canManageAccess: false })).toBeFalse();
    expect(canManageImageRow({ canManageAccess: 1 })).toBeTrue();
    expect(canPublishImageRow({ canPublish: 0 })).toBeFalse();
    expect(vpsImageErrorKey({ error: { code: 'VPS_IMAGE_PROJECTION_READ_ONLY' } })).toBe(
      'Physical visibility tag changes are read-only outside production.',
    );
  });

  it('previews impact, confirms public publication, sends PUT with idempotency key and tracks operation in Activity Center', async () => {
    const imageRow: ConfigurableCrudRecord = {
      HimUUID: '00000007-1111-4222-8333-444444444444',
      HostingVpsProviderHvrUUID: '00000009-1111-4222-8333-444444444444',
      providerName: 'Proxmox Primary',
      HimImageKey: 'mns-00000006-1111-4222-8333-444444444444',
      HimName: 'Ubuntu 24.04 LTS',
      HimVisibility: 'platform',
      HimRevision: '7',
      HimPublication: 'published',
      HimInternalOnly: 0,
      currentVersionUUID: '0000000b-1111-4222-8333-444444444444',
      buildRevision: '20261119',
      cpu: 2,
      memoryMb: 2048,
      diskGb: 20,
      readyReplicas: 4,
      totalReplicas: 4,
      syncState: 'ready',
      canManageAccess: 1,
      canPublish: 1,
      activeGrantCount: 1,
    };

    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get', 'post', 'put']);
    api.get.and.callFake(async (url: string) => {
      if (url.startsWith(`${IMAGES_ENDPOINT}/00000007-1111-4222-8333-444444444444/access`)) {
        return { data: { item: imageRow, activeGrantCount: 1 } } as never;
      }
      if (url.startsWith(`${IMAGES_ENDPOINT}/00000007-1111-4222-8333-444444444444/versions`)) {
        return {
          data: {
            items: [
              {
                versionUUID: '0000000b-1111-4222-8333-444444444444',
                buildRevision: '20261119',
                publication: 'published',
                cpu: 2,
                memoryMb: 2048,
                diskGb: 20,
              },
            ],
            total: 1,
          },
        } as never;
      }
      if (url.startsWith(`${IMAGES_ENDPOINT}/00000007-1111-4222-8333-444444444444/grants`)) {
        return {
          data: {
            items: [
              {
                EnvironmentUUID: '00000004-1111-4222-8333-444444444444',
                EnvironmentName: 'Tenant Existing',
                status: 'active',
              },
            ],
            total: 1,
          },
        } as never;
      }
      if (url.startsWith('system/hosting/vps/providers')) {
        return {
          data: {
            items: [
              {
                HvrUUID: '00000009-1111-4222-8333-444444444444',
                HvrName: 'Proxmox Primary',
                HvrProvider: 'proxmox',
              },
            ],
            total: 1,
          },
        } as never;
      }
      return { data: { items: [imageRow], total: 1 } } as never;
    });

    api.post.and.resolveTo({
      data: {
        revision: '7',
        previousVisibility: 'platform',
        visibility: 'public',
        addedCount: 0,
        removedCount: 0,
        targetCount: 4,
        unavailableCount: 0,
        willPublishPublicly: true,
        publication: 'published',
        versionUUID: '0000000b-1111-4222-8333-444444444444',
      },
    } as never);

    const acceptedResponse = {
      status: 'success',
      data: {
        item: { ...imageRow, HimVisibility: 'public', HimRevision: '8' },
        operation: {
          operationUUID: 'cdc7c59d-1f8e-4b2a-9c3d-5e6f7a8b9c0d',
          state: 'queued',
          scope: 'platform',
          kind: 'vpsImage',
          action: 'access.reconcile',
          resourceLabel: 'Ubuntu 24.04 LTS',
        },
      },
    };
    api.put.and.resolveTo(acceptedResponse as never);

    const snackbar = jasmine.createSpyObj('SnackbarService', [
      'success',
      'warning',
      'error',
      'info',
    ]);
    const operations = jasmine.createSpyObj<AsyncOperationsService>('AsyncOperationsService', [
      'observe',
    ]);
    operations.observe.and.returnValue(true);

    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: HostingVpsImagesPage,
        api,
        snackbar,
        providers: [
          { provide: AsyncOperationsService, useValue: operations },
          { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                data: { scope: 'master', context: 'system' },
                queryParamMap: convertToParamMap({
                  providerUUID: '00000009-1111-4222-8333-444444444444',
                }),
              },
            },
          },
        ],
      }),
    ).compileComponents();

    const fixture = TestBed.createComponent(HostingVpsImagesPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;

    expect(page.backLink()).toBe('/system/vps/provider');

    await (
      page as unknown as { openManageAccess: (row: ConfigurableCrudRecord) => Promise<void> }
    ).openManageAccess(imageRow);

    page.stageGrantForRevocation({
      EnvironmentUUID: '00000004-1111-4222-8333-444444444444',
      EnvironmentName: 'Tenant Existing',
    });
    expect(
      page.isEnvironmentMarkedForRevocation('00000004-1111-4222-8333-444444444444'),
    ).toBeTrue();

    const confirmSpy = spyOn(
      page as unknown as {
        confirmAction: (title: string, message: string, confirmLabel?: string) => Promise<boolean>;
      },
      'confirmAction',
    ).and.resolveTo(true);

    // Changing to public clears environment delta arrays and prompts explicit public confirmation
    (
      page as unknown as { patchFormValues: (values: ConfigurableCrudRecord) => void }
    ).patchFormValues({
      visibility: 'public',
      reason: 'Approve public image availability for customers',
    });
    (
      page as unknown as { onFieldValueChanged: (key: string, value: unknown) => void }
    ).onFieldValueChanged('visibility', 'public');

    const keyBeforeSave = (
      page as unknown as { saveRequestOptions: () => { idempotencyKey?: string } }
    ).saveRequestOptions().idempotencyKey;
    expect(keyBeforeSave).toBeTruthy();

    await page.saveItem(false);

    expect(api.post).toHaveBeenCalledWith(
      `${IMAGES_ENDPOINT}/00000007-1111-4222-8333-444444444444/access/preview`,
      jasmine.objectContaining({
        revision: '7',
        visibility: 'public',
        addEnvironmentUUIDs: [],
        removeEnvironmentUUIDs: [],
        reason: 'Approve public image availability for customers',
      }),
    );
    expect(confirmSpy).toHaveBeenCalledWith(
      'Make available to all customers',
      jasmine.stringContaining('Confirm making this image available'),
      'Make available to all customers',
    );
    expect(api.put).toHaveBeenCalledWith(
      `${IMAGES_ENDPOINT}/00000007-1111-4222-8333-444444444444/access`,
      jasmine.objectContaining({
        revision: '7',
        visibility: 'public',
        reason: 'Approve public image availability for customers',
      }),
      { idempotencyKey: keyBeforeSave },
    );
    expect(operations.observe).toHaveBeenCalledWith(
      acceptedResponse,
      jasmine.anything(),
      jasmine.any(Function),
    );
  });

  it('navigates from provider row action to /system/vps/images with providerUUID query parameter', async () => {
    const api = jasmine.createSpyObj<ApiService>('ApiService', ['get']);
    api.get.and.resolveTo({ data: { items: [], total: 0 } });
    const snackbar = jasmine.createSpyObj('SnackbarService', ['success', 'warning', 'error']);

    await TestBed.configureTestingModule(
      configurableCrudTestingModule({
        page: HostingVpsProviderPage,
        api,
        snackbar,
        providers: [
          { provide: BreakpointObserver, useValue: { observe: () => of({ matches: false }) } },
          {
            provide: ActivatedRoute,
            useValue: {
              snapshot: {
                data: { scope: 'master', context: 'system' },
                queryParamMap: convertToParamMap({}),
              },
            },
          },
        ],
      }),
    ).compileComponents();

    const router = TestBed.inject(Router);
    const navSpy = spyOn(router, 'navigate').and.resolveTo(true);

    const fixture = TestBed.createComponent(HostingVpsProviderPage);
    await fixture.whenStable();
    const page = fixture.componentInstance;

    await page.handleRowAction(
      { key: 'imageAccess', label: 'VPS images', icon: 'album' },
      { HvrUUID: '00000008-1111-4222-8333-444444444444', HvrProvider: 'proxmox' },
    );

    expect(navSpy).toHaveBeenCalledWith(['/system/vps/images'], {
      queryParams: { providerUUID: '00000008-1111-4222-8333-444444444444' },
    });
  });
});
