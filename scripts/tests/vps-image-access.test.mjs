import { crudUpdateUrl } from '../../src/app/shared/crud/configurable-crud/crud-update-url.ts';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import { NAV_ITEMS } from '../../src/app/layout/navigation/nav-registry.ts';
import {
  IMAGES_ENDPOINT,
  buildImageAccessPayload,
  canManageImageRow,
  canPublishImageRow,
  minimumSpecsSummary,
  remainingSelectedGrantsCount,
  replicaAvailabilitySummary,
  vpsImageErrorKey,
} from '../../src/app/pages/hosting/vps/images/image-access-logic.ts';

test('VPS images navigation entry sits in the VPS platform category with master scope', () => {
  const hosting = NAV_ITEMS.find((item) => item.id === 'hosting');
  const vps = hosting?.children?.find((item) => item.id === 'hosting/vps');
  const images = vps?.children?.find((item) => item.id === 'hosting/vps/images');
  assert.ok(images, 'hosting/vps/images must exist in NAV_ITEMS');
  assert.equal(images.label, 'nav.hosting.vps.images');
  assert.equal(images.category, 'platform');
  assert.equal(images.masterRoute, '/system/vps/images');
  assert.equal(images.scope, 'master');
  assert.deepEqual(images.permissions, ['platform.master.access']);
});

test('dynamic updateEndpoint function resolves full access URL without duplicating record UUID', () => {
  const row = { HimUUID: '11111111-2222-4333-8444-555555555555' };
  const fnEndpoint = (r) => `${IMAGES_ENDPOINT}/${String(r.HimUUID ?? '')}/access`;
  assert.equal(
    crudUpdateUrl(
      fnEndpoint,
      row,
      () => IMAGES_ENDPOINT,
      () => row.HimUUID,
    ),
    'system/hosting/vps/images/11111111-2222-4333-8444-555555555555/access',
  );
  assert.equal(
    crudUpdateUrl(
      'system/hosting/vps/providers',
      { HvrUUID: 'p-1' },
      () => 'system/hosting/vps/providers',
      () => 'p-1',
    ),
    'system/hosting/vps/providers/p-1',
  );
  assert.equal(
    crudUpdateUrl(
      undefined,
      { HvpUUID: 'plan-1' },
      () => 'hosting/vps/plans',
      () => 'plan-1',
    ),
    'hosting/vps/plans/plan-1',
  );
});

test('buildImageAccessPayload builds bounded delta arrays and clears grants on public/platform', () => {
  const current = {
    HimUUID: '00000006-1111-4222-8333-444444444444',
    HimRevision: '9007199254740993',
    HimVisibility: 'selected',
    HimPublication: 'published',
    canPublish: 1,
    activeGrantCount: 2,
  };

  const selected = buildImageAccessPayload(
    {
      revision: '9007199254740993',
      visibility: 'selected',
      addEnvironmentUUIDs: [
        '00000003-1111-4222-8333-444444444444',
        '00000004-1111-4222-8333-444444444444',
        '00000003-1111-4222-8333-444444444444',
        ' ',
      ],
      removeEnvironmentUUIDs: [
        '00000004-1111-4222-8333-444444444444',
        '00000005-1111-4222-8333-444444444444',
      ],
      publication: 'published',
      versionUUID: '00000007-1111-4222-8333-444444444444',
      reason: '  Authorize tenant A and B, revoke C  ',
    },
    current,
  );

  assert.deepEqual(selected, {
    revision: '9007199254740993',
    visibility: 'selected',
    addEnvironmentUUIDs: [
      '00000003-1111-4222-8333-444444444444',
      '00000004-1111-4222-8333-444444444444',
    ],
    removeEnvironmentUUIDs: ['00000005-1111-4222-8333-444444444444'],
    reason: 'Authorize tenant A and B, revoke C',
    publication: 'published',
    versionUUID: '00000007-1111-4222-8333-444444444444',
  });
  assert.equal(remainingSelectedGrantsCount(selected, current, 2), 3);

  const zeroRemaining = {
    revision: '9007199254740993',
    visibility: 'selected',
    addEnvironmentUUIDs: [],
    removeEnvironmentUUIDs: [
      '00000001-1111-4222-8333-444444444444',
      '00000002-1111-4222-8333-444444444444',
    ],
    reason: 'Revoke all',
  };
  assert.equal(remainingSelectedGrantsCount(zeroRemaining, current, 2), 0);

  const publicPayload = buildImageAccessPayload(
    {
      revision: '9007199254740993',
      visibility: 'public',
      addEnvironmentUUIDs: ['00000003-1111-4222-8333-444444444444'],
      removeEnvironmentUUIDs: ['00000005-1111-4222-8333-444444444444'],
      reason: 'Make image available to all customers',
    },
    current,
  );
  assert.deepEqual(publicPayload.addEnvironmentUUIDs, []);
  assert.deepEqual(publicPayload.removeEnvironmentUUIDs, []);
  assert.equal(publicPayload.visibility, 'public');
});

test('server capabilities and error translations follow the contract', () => {
  assert.equal(canManageImageRow({ canManageAccess: false }), false);
  assert.equal(canManageImageRow({ canManageAccess: 0 }), false);
  assert.equal(canManageImageRow({ canManageAccess: 1 }), true);
  assert.equal(canManageImageRow({}), false);
  assert.equal(canPublishImageRow({ canPublish: false }), false);
  assert.equal(canPublishImageRow({ canPublish: true }), true);

  assert.equal(
    minimumSpecsSummary({ cpu: 2, memoryMb: 4096, diskGb: 40 }),
    '2 vCPU · 4 GB · 40 GB',
  );
  assert.equal(replicaAvailabilitySummary({ readyReplicas: 3, totalReplicas: 4 }), '3/4');

  assert.equal(
    vpsImageErrorKey({ error: { code: 'VPS_IMAGE_PROJECTION_READ_ONLY' } }),
    'Physical visibility tag changes are read-only outside production.',
  );
  assert.equal(
    vpsImageErrorKey({ error: { errorCode: 'VPS_IMAGE_INTERNAL_ONLY' } }),
    'Internal platform images cannot be shared with customer environments.',
  );
  assert.equal(vpsImageErrorKey({ error: { code: 'UNKNOWN_CODE' } }), null);
});

test('Activity Center maps vpsImage kind and access.reconcile action in all three locales', () => {
  const activitySource = fs.readFileSync(
    'src/app/shared/operations/async-operation-activity.ts',
    'utf8',
  );
  assert.match(activitySource, /vpsImage:\s*'operations\.kind\.vpsImage'/);
  assert.match(activitySource, /'access\.reconcile':\s*'operations\.action\.accessReconcile'/);

  for (const locale of ['en-US', 'pt-BR', 'es-ES']) {
    const dict = JSON.parse(fs.readFileSync(`public/i18n/${locale}.json`, 'utf8'));
    assert.ok(dict['operations.kind.vpsImage'], `${locale} operations.kind.vpsImage`);
    assert.ok(
      dict['operations.action.accessReconcile'],
      `${locale} operations.action.accessReconcile`,
    );
    assert.ok(dict['nav.hosting.vps.images'], `${locale} nav.hosting.vps.images`);
  }
});

test('acceptedOperations extracts 202 operation receipt for Activity Center tracking', async () => {
  const source = fs.readFileSync('src/app/shared/operations/async-operations.service.ts', 'utf8');
  const match = source.match(/export function acceptedOperations[\s\S]*?\n\}/);
  assert.ok(match, 'acceptedOperations function must exist');
  const compiled = ts.transpileModule(match[0], {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const { acceptedOperations } = await import(
    `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  );

  const receipt = {
    status: 'success',
    data: {
      item: { HimUUID: '11111111-2222-4333-8444-555555555555' },
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
  const ops = acceptedOperations(receipt);
  assert.equal(ops.length, 1);
  assert.equal(ops[0].operationUUID, 'cdc7c59d-1f8e-4b2a-9c3d-5e6f7a8b9c0d');
  assert.equal(ops[0].kind, 'vpsImage');
  assert.equal(ops[0].action, 'access.reconcile');
  assert.equal(ops[0].scope, 'platform');
});

// Compile the production methods (without Angular rendering/DI) to exercise their async behavior.
// The shared saveItem body is included so replay assertions cover the actual PUT path.
function productionMethods(path, className, names) {
  const source = ts.createSourceFile(
    path,
    fs.readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const declaration = source.statements.find(
    (node) => ts.isClassDeclaration(node) && node.name?.text === className,
  );
  return names
    .map((name) => {
      const method = declaration.members.find(
        (member) => ts.isMethodDeclaration(member) && member.name.getText(source) === name,
      );
      assert.ok(method, `production method ${name}`);
      return method.getText(source);
    })
    .join('\n');
}
const logic = await import('../../src/app/pages/hosting/vps/images/image-access-logic.ts');
const methods =
  productionMethods('src/app/pages/hosting/vps/images/images.ts', 'HostingVpsImagesPage', [
    'captureSaveContext',
    'capturePageContext',
    'fetchProviders',
    'closeDialog',
    'openManageAccess',
    'formValuesFromRecord',
    'confirmBeforeSave',
    'onFieldValueChanged',
    'saveRequestOptions',
    'augmentPayload',
    'stageGrantForRevocation',
    'selectedProviderUUID',
  ]) +
  productionMethods(
    'src/app/shared/crud/configurable-crud/configurable-crud-page-base.ts',
    'ConfigurableCrudPageBase',
    [
      'saveItem',
      'updateUrlFor',
      'updateEndpointFor',
      'updateEndpoint',
      'remoteLookupUrl',
      'fieldOptions',
    ],
  );
class Base {
  startEdit(row) {
    this.editingRecord.set(row);
    this.formValues.set(this.formValuesFromRecord(row));
    this.isFormDialogOpen.set(true);
  }
  closeDialog() {
    this.isFormDialogOpen.set(false);
  }
  formValuesFromRecord() {
    return {};
  }
}
const compiledMethods = ts.transpileModule(`class Page extends Base { ${methods} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const dependencies = { ...logic, Base, crudUpdateUrl };
const Page = new Function(...Object.keys(dependencies), `${compiledMethods};return Page;`)(
  ...Object.values(dependencies),
);
function state(initial) {
  let value = initial;
  const read = () => value;
  read.set = (next) => {
    value = next;
  };
  read.update = (change) => {
    value = change(value);
  };
  return read;
}
const imageId = '11111111-2222-4333-8444-555555555555';
const otherId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const versionId = '22222222333344448555666666666666';
const imageRow = (uuid = imageId) => ({
  HimUUID: uuid,
  HimRevision: '7',
  HimVisibility: 'platform',
  HimPublication: 'published',
  canManageAccess: 1,
  canPublish: 1,
  currentVersionUUID: versionId,
  buildRevision: 'build-149',
});
function harness() {
  const page = new Page();
  Object.assign(page, {
    openingGeneration: 0,
    confirmedIntent: null,
    previewPending: false,
    idempotencyKey: crypto.randomUUID(),
    destroyRef: { destroyed: false },
    imageAuth: { sessionGeneration: state(1) },
    imageTenants: { selectedTenant: state(null) },
    imageScope: { current: state('master'), isSystemTree: state(true) },
    editingRecord: state(null),
    formValues: state({}),
    activeGrants: state([]),
    activeGrantTotal: state(0),
    providers: state([]),
    saving: state(false),
    isFormDialogOpen: state(false),
    config: {
      endpoint: IMAGES_ENDPOINT,
      updateEndpoint: (row) => `${IMAGES_ENDPOINT}/${logic.imageUuidSegment(row.HimUUID)}/access`,
      fields: [
        {
          key: 'versionUUID',
          remoteLookup: {
            endpoint: '',
            uuidField: 'versionUUID',
            labelField: 'buildRevision',
            selectedLabelField: 'buildRevision',
          },
        },
      ],
    },
    recordUUID: (row) => row.HimUUID,
    errors: [],
    receipts: [],
    snack: { error: (error) => page.errors.push(error) },
    t: (key) => key,
    errorMessage: (error) => error.message,
    confirmAction: async () => true,
    patchFormValues: (patch) => page.formValues.update((value) => ({ ...value, ...patch })),
    canEdit: () => true,
    canCreate: () => false,
    clearFieldErrors() {},
    commitDateDrafts: () => true,
    copyEnabledAddressValues() {},
    buildPayload: () => page.formValues(),
    validatePayload: () => true,
    trackOperation: (receipt) => {
      page.receipts.push(receipt);
      return true;
    },
    itemsResource: { reload() {} },
    keepDialogOpenAfterSave: () => false,
    afterSave: async () => {},
    markServerRejectedFields() {},
    quickCreateMode: false,
    remoteOptionLabels: new Map(),
    selectedRemoteOptions: new Map(),
    fieldValue: (key) => page.formValues()[key],
    withQuickCreatedOptions: (_field, options) => options,
  });
  page.api = {
    get: async (url) =>
      url.endsWith('/access')
        ? { data: { item: imageRow() } }
        : { data: { items: [], total: 301 } },
    post: async () => ({
      data: { visibility: 'public', publication: 'published', targetCount: 0 },
    }),
    put: async () => ({ data: { operation: { operationUUID: otherId } } }),
  };
  return page;
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

test('provider options survive dialog changes but are discarded after a session change', async () => {
  const options = [{ HvrUUID: otherId, HvrName: 'Test provider', HvrProvider: 'proxmox' }];
  const page = harness();
  const loading = deferred();
  page.api.get = async () => loading.promise;
  const pending = page.fetchProviders();
  page.closeDialog();
  loading.resolve({ data: { items: options } });
  await pending;
  assert.deepEqual(page.providers(), options);

  const stale = harness();
  const delayed = deferred();
  stale.api.get = async () => delayed.promise;
  const oldSession = stale.fetchProviders();
  stale.imageAuth.sessionGeneration.set(2);
  delayed.resolve({ data: { items: options } });
  await oldSession;
  assert.deepEqual(stale.providers(), []);
});

test('late access details cannot replace another image, reopen a closed context or fall back after failure', async () => {
  const first = deferred();
  const page = harness();
  page.api.get = async (url) => {
    if (url.endsWith(`${imageId}/access`)) return first.promise;
    if (url.endsWith('/access')) return { data: { item: imageRow(otherId) } };
    return { data: { items: [], total: 0 } };
  };
  const pending = page.openManageAccess(imageRow());
  await page.openManageAccess(imageRow(otherId));
  first.resolve({ data: { item: imageRow() } });
  await pending;
  assert.equal(page.editingRecord().HimUUID, otherId);

  for (const invalidate of [
    (p) => p.imageAuth.sessionGeneration.set(2),
    (p) => p.imageTenants.selectedTenant.set({ uuid: otherId }),
    (p) => p.imageScope.current.set('tenant'),
    (p) => {
      p.destroyRef.destroyed = true;
    },
    (p) => p.closeDialog(),
  ]) {
    const p = harness();
    const detail = deferred();
    p.api.get = async (url) => (url.endsWith('/access') ? detail.promise : { data: { items: [] } });
    const opening = p.openManageAccess(imageRow());
    invalidate(p);
    detail.resolve({ data: { item: imageRow() } });
    await opening;
    assert.equal(p.editingRecord(), null);
    assert.equal(p.isFormDialogOpen(), false);
  }
  const failed = harness();
  failed.api.get = async () => {
    throw new Error('access denied');
  };
  await failed.openManageAccess(imageRow());
  assert.equal(failed.editingRecord(), null);
  assert.equal(failed.isFormDialogOpen(), false);
  assert.deepEqual(failed.errors, ['access denied']);
});

test('accepted PUT response loss retries identical key/payload without previewing stale revision', async () => {
  const page = harness();
  await page.openManageAccess(imageRow());
  page.patchFormValues({ visibility: 'public', reason: 'Publish approved image' });
  let previews = 0;
  const writes = [];
  page.api.post = async () => {
    if (++previews > 1) throw new Error('VPS_IMAGE_REVISION_CONFLICT');
    return { data: { visibility: 'public', publication: 'published' } };
  };
  page.api.put = async (url, body, options) => {
    writes.push({ url, body, options });
    if (writes.length === 1) throw new Error('response lost after committed revision 8');
    return { data: { operation: { operationUUID: otherId } } };
  };
  await page.saveItem();
  assert.equal(page.isFormDialogOpen(), true);
  await page.saveItem();
  assert.equal(previews, 1);
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[0], writes[1]);
  assert.equal(writes[1].body.revision, '7');
  assert.equal(page.receipts.length, 1);
});

test('editing a confirmed intent rotates key, and edits during preview cannot submit unreviewed values', async () => {
  const page = harness();
  await page.openManageAccess(imageRow());
  page.patchFormValues({ visibility: 'public', reason: 'Publish approved image' });
  assert.equal(await page.confirmBeforeSave(page.formValues()), true);
  const key = page.idempotencyKey;
  page.patchFormValues({ reason: 'A different operational reason' });
  page.onFieldValueChanged('reason');
  assert.notEqual(page.idempotencyKey, key);
  assert.equal(page.confirmedIntent, null);
  const preview = deferred();
  let writes = 0;
  page.api.post = async () => preview.promise;
  page.api.put = async () => {
    writes++;
  };
  const saving = page.saveItem();
  page.patchFormValues({ visibility: 'platform' });
  page.onFieldValueChanged('visibility');
  preview.resolve({ data: { visibility: 'public' } });
  await saving;
  assert.equal(writes, 0);
});

test('late accepted PUT responses do not register work in another session', async () => {
  const page = harness();
  await page.openManageAccess(imageRow());
  page.patchFormValues({ reason: 'Approved access change' });
  const response = deferred();
  const started = deferred();
  page.api.put = async () => {
    started.resolve();
    return response.promise;
  };
  const saving = page.saveItem();
  await started.promise;
  page.imageAuth.sessionGeneration.set(2);
  response.resolve({ data: { operation: { operationUUID: otherId } } });
  await saving;
  assert.deepEqual(page.receipts, []);
});

test('version lookup pages beyond 100 and retains canonical selected build outside the page', async () => {
  const page = harness();
  const requests = [];
  const get = page.api.get;
  page.api.get = (url) => {
    requests.push(url);
    return get(url);
  };
  await page.openManageAccess(imageRow());
  assert.equal(
    requests.some((url) => url.includes('/versions')),
    false,
    'opening must not preload a truncated version list',
  );
  const field = page.config.fields[0];
  const url = page.remoteLookupUrl(field, 50, 100, 'build 14', '');
  assert.equal(url, `${IMAGES_ENDPOINT}/${imageId}/versions?limit=50&offset=100&search=build%2014`);
  const versions = Array.from({ length: 50 }, (_, i) => ({
    versionUUID: (100 + i).toString(16).padStart(32, '0'),
    buildRevision: `build-${100 + i}`,
  }));
  page.remoteLookups = { value: () => ({ versionUUID: { items: versions } }) };
  assert.equal(page.fieldOptions(field)[0].value, versionId);
  assert.equal(page.fieldOptions(field)[0].label, 'build-149');
  page.stageGrantForRevocation({
    EnvironmentUUID: otherId,
    EnvironmentName: 'Grant on page seven',
  });
  page.patchFormValues({ visibility: 'selected' });
  assert.deepEqual(page.augmentPayload(page.formValues()).removeEnvironmentUUIDs, [otherId]);
  assert.equal(page.activeGrantTotal(), 301);
});

test('malformed UUID paths are rejected and omitted capabilities deny management/publication', async () => {
  assert.equal(logic.isImageUuid(imageId), true);
  assert.equal(logic.isImageUuid(versionId), true);
  for (const value of [
    '../providers/observe',
    `${imageId}?other=true`,
    'not-a-uuid',
    `${imageId}/access`,
  ]) {
    assert.equal(logic.isImageUuid(value), false);
    assert.throws(() => logic.imageUuidSegment(value));
    const page = harness();
    let requests = 0;
    page.api.get = async () => {
      requests++;
    };
    await page.openManageAccess(imageRow(value));
    page.listFilterValues = () => ({ providerUUID: value });
    page.appliedFilters = () => ({ extra: {} });
    assert.equal(page.selectedProviderUUID(), '');
    assert.equal(requests, 0);
  }
  assert.equal(canManageImageRow({}), false);
  assert.equal(canPublishImageRow({}), false);
  assert.equal(
    vpsImageErrorKey({ error: { code: 'VPS_IMAGE_SELECTED_EMPTY' } }),
    logic.VPS_IMAGE_ERROR_TEXTS.VPS_IMAGE_SELECTED_REQUIRES_GRANT,
  );
  assert.equal(
    vpsImageErrorKey({ error: { code: 'VPS_IMAGE_FLEET_BARRIER_REQUIRED' } }),
    logic.VPS_IMAGE_ERROR_TEXTS.VPS_IMAGE_FLEET_BARRIER_BLOCKED,
  );
  assert.equal(
    vpsImageErrorKey({ error: { code: 'VPS_IMAGE_RETRY_CONFLICT' } }),
    logic.VPS_IMAGE_ERROR_TEXTS.VPS_IMAGE_OPERATION_SUPERSEDED,
  );
});

test('shared update URL keeps legacy subclass endpoint overrides and callback full URLs', () => {
  const page = harness();
  page.config.updateEndpoint = undefined;
  page.updateEndpoint = () => 'legacy/subclass';
  assert.equal(page.updateUrlFor(imageRow()), `legacy/subclass/${imageId}`);
  page.updateEndpointFor = (row) => `legacy/row/${row.HimRevision}`;
  assert.equal(page.updateUrlFor(imageRow()), `legacy/row/7/${imageId}`);
  page.config.updateEndpoint = (row) => `full/${row.HimUUID}/access`;
  assert.equal(page.updateUrlFor(imageRow()), `full/${imageId}/access`);
});

test('superseded Activity Center receipts and polled transitions settle once without retrying', async () => {
  const file = 'src/app/shared/operations/async-operations.service.ts';
  const source = ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  const attention = source.statements
    .filter(
      (node) =>
        (ts.isFunctionDeclaration(node) && node.name?.text === 'needsAttention') ||
        (ts.isVariableStatement(node) &&
          node.declarationList.declarations.some(
            (item) => item.name.getText(source) === 'ATTENTION',
          )),
    )
    .map((node) => node.getText(source))
    .join('\n');
  const bodies = productionMethods(file, 'AsyncOperationsService', ['watch', 'dismiss']);
  const compiled = ts.transpileModule(`${attention}\nclass Service { ${bodies} }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  for (const initial of ['superseded', 'running']) {
    const timers = new Map();
    let nextTimer = 0;
    let reads = 0;
    let settled = 0;
    const Service = new Function(
      'readStoredEnvironmentUUID',
      'setTimeout',
      'clearTimeout',
      `${compiled};return Service;`,
    )(
      () => null,
      (fn) => {
        const id = ++nextTimer;
        timers.set(id, fn);
        return id;
      },
      (id) => timers.delete(id),
    );
    const service = new Service();
    Object.assign(service, {
      watched: new WeakMap(),
      listeners: new Map(),
      polling: new Set(),
      stops: new Map(),
      activeRequests: 0,
      states: state({}),
      auth: { isLoggedIn: () => true, sessionGeneration: () => 1 },
      remember: (operation) =>
        service.states.update((items) => ({ ...items, [operation.operationUUID]: operation })),
      clearSuccessTimer() {},
      scheduleSuccessClear() {
        assert.fail('Superseded is not success');
      },
      api: {
        get: async (url) => {
          reads++;
          assert.equal(url, `user/operations/${imageId}?scope=platform`);
          return { data: { operationUUID: imageId, state: 'superseded', scope: 'platform' } };
        },
      },
      snack: {
        success: () => assert.fail('Superseded is not success'),
        warning: () => assert.fail('Superseded needs no retry warning'),
      },
    });
    service.watch(
      { operationUUID: imageId, state: initial, scope: 'platform' },
      { destroyed: false, onDestroy() {} },
      () => {
        settled++;
      },
    );
    if (initial === 'running') {
      assert.equal(timers.size, 1);
      const [id, run] = timers.entries().next().value;
      timers.delete(id);
      run();
      for (let i = 0; i < 5; i++) await Promise.resolve();
    }
    assert.equal(reads, initial === 'running' ? 1 : 0);
    assert.equal(settled, 1);
    assert.equal(timers.size, 0, 'no subsequent status poll');
    assert.equal(service.polling.size, 0);
    assert.equal(service.states()[imageId].state, 'superseded');
    service.dismiss(imageId);
    assert.deepEqual(service.states(), {});
  }
});

test('Activity Center preserves the translated superseded label in all supported locales', () => {
  const body = productionMethods(
    'src/app/shared/operations/async-operation-activity.ts',
    'AsyncOperationActivityComponent',
    ['stateLabel'],
  );
  const compiled = ts.transpileModule(`class Activity { ${body} }`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const Activity = new Function(`${compiled};return Activity;`)();
  assert.equal(new Activity().stateLabel('superseded'), 'operations.state.superseded');
  for (const locale of ['en-US', 'pt-BR', 'es-ES']) {
    const dict = JSON.parse(fs.readFileSync(`public/i18n/${locale}.json`, 'utf8'));
    assert.ok(dict['operations.state.superseded']);
    assert.notEqual(dict['operations.state.superseded'], dict['operations.state.cancelled']);
  }
});
