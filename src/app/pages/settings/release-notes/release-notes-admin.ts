import { Component } from '@angular/core';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import { RELEASE_NOTE_AUDIENCES, RELEASE_NOTE_TYPES } from '../../../services/release-note.service';

const TYPE_OPTIONS = RELEASE_NOTE_TYPES.map((value) => ({
  value,
  label: `releaseNotes.type.${value}`,
}));
const AUDIENCE_OPTIONS = RELEASE_NOTE_AUDIENCES.map((value) => ({
  value,
  label: `releaseNotes.audience.${value}`,
}));
const STATUS_OPTIONS = [
  { value: 'live', label: 'releaseNotes.statusLive' },
  { value: 'pending', label: 'releaseNotes.statusPending' },
];
const VISIBILITY_OPTIONS = [
  { value: '0', label: 'releaseNotes.visible' },
  { value: '1', label: 'releaseNotes.hidden' },
];

function components(row: ConfigurableCrudRecord): string {
  const list = Array.isArray(row['Components'])
    ? (row['Components'] as Record<string, unknown>[])
    : [];
  return list
    .map(
      (item) =>
        `${String(item['product'] ?? '').replace(/^mnscloud-/, '')} ${String(item['version'] ?? '')}${
          item['deployed'] === false ? ' ⏳' : ''
        }`,
    )
    .join(', ');
}

/**
 * Platform management of the release notes (Plataforma › Novidades): every entry ingested from the
 * PRs (workspace docs/release-notes.md) with its components and whether they are deployed in this
 * environment. The master rewrites text, type, audience and modules or hides an entry; an edited
 * text is kept when the PRs are ingested again. Entries are never created or deleted here.
 */
const config = defineCrud({
  endpoint: 'system/release-notes',
  uuidField: 'ReleaseNoteUUID',
  pageTitle: 'releaseNotes.adminTitle',
  pageDescription: 'releaseNotes.adminDescription',
  editTitle: 'releaseNotes.editTitle',
  dialogDescription: 'releaseNotes.editDescription',
  searchPlaceholder: 'releaseNotes.search',
  emptyLabel: 'releaseNotes.adminEmpty',
  savedMessage: 'releaseNotes.saved',
  canCreate: false,
  canDelete: false,
  bulkDelete: false,
  statusFilter: false,
  serverSidePagination: true,
  initialValues: {},
  columns: [
    {
      id: 'title',
      field: 'TitlePt',
      label: 'releaseNotes.columnTitle',
      kind: 'identity',
      detail: (row) => String(row['FeatureKey'] ?? ''),
    },
    {
      id: 'type',
      field: 'Type',
      label: 'releaseNotes.columnType',
      options: TYPE_OPTIONS,
      translateValue: true,
    },
    { id: 'modules', field: 'Modules', label: 'releaseNotes.columnModules' },
    {
      id: 'state',
      field: 'Status',
      label: 'releaseNotes.columnState',
      kind: 'status',
      options: STATUS_OPTIONS,
      chipClass: (value) => (value === 'live' ? 'chip-success' : 'chip-warning'),
      detail: (row) => components(row),
    },
    {
      id: 'hidden',
      field: 'Hidden',
      label: 'releaseNotes.columnHidden',
      kind: 'boolean',
    },
    {
      id: 'published',
      field: 'PublishedAt',
      label: 'releaseNotes.columnPublished',
      kind: 'datetime',
    },
    {
      id: 'edited',
      field: 'Edited',
      label: 'releaseNotes.columnEdited',
      kind: 'boolean',
      optional: true,
    },
  ],
  fields: [
    {
      key: 'type',
      source: 'Type',
      payloadKey: 'type',
      label: 'releaseNotes.columnType',
      type: 'search-select',
      options: TYPE_OPTIONS,
      translateOptions: true,
      required: true,
      span: 1,
    },
    {
      key: 'audience',
      source: 'Audience',
      payloadKey: 'audience',
      label: 'releaseNotes.columnAudience',
      type: 'search-select',
      options: AUDIENCE_OPTIONS,
      translateOptions: true,
      required: true,
      span: 1,
    },
    {
      key: 'hidden',
      source: 'Hidden',
      payloadKey: 'hidden',
      label: 'releaseNotes.columnHidden',
      type: 'search-select',
      options: VISIBILITY_OPTIONS,
      translateOptions: true,
      fromRecord: (value) => String(Number(value ?? 0)),
      span: 1,
    },
    {
      key: 'modules',
      source: 'Modules',
      payloadKey: 'modules',
      label: 'releaseNotes.columnModules',
      required: true,
      help: 'releaseNotes.modulesHelp',
      span: 2,
    },
    { key: 'titlePt', source: 'TitlePt', label: 'releaseNotes.titlePt', required: true, span: 2 },
    { key: 'titleEn', source: 'TitleEn', label: 'releaseNotes.titleEn', required: true, span: 2 },
    { key: 'titleEs', source: 'TitleEs', label: 'releaseNotes.titleEs', required: true, span: 2 },
    { key: 'textPt', source: 'TextPt', label: 'releaseNotes.textPt', type: 'textarea', span: 2 },
    { key: 'textEn', source: 'TextEn', label: 'releaseNotes.textEn', type: 'textarea', span: 2 },
    { key: 'textEs', source: 'TextEs', label: 'releaseNotes.textEs', type: 'textarea', span: 2 },
    {
      key: 'actionPt',
      source: 'ActionPt',
      label: 'releaseNotes.actionPt',
      type: 'textarea',
      span: 2,
    },
    {
      key: 'actionEn',
      source: 'ActionEn',
      label: 'releaseNotes.actionEn',
      type: 'textarea',
      span: 2,
    },
    {
      key: 'actionEs',
      source: 'ActionEs',
      label: 'releaseNotes.actionEs',
      type: 'textarea',
      span: 2,
    },
  ],
  payload: (values) => ({
    type: values['type'],
    audience: values['audience'],
    hidden: String(values['hidden'] ?? '0') === '1',
    modules: String(values['modules'] ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
    titlePt: values['titlePt'],
    titleEn: values['titleEn'],
    titleEs: values['titleEs'],
    textPt: values['textPt'] || null,
    textEn: values['textEn'] || null,
    textEs: values['textEs'] || null,
    actionPt: values['actionPt'] || null,
    actionEn: values['actionEn'] || null,
    actionEs: values['actionEs'] || null,
  }),
});

@Component({
  selector: 'app-release-notes-admin',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class ReleaseNotesAdminPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  constructor() {
    super(config);
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return { ...payload, expectedRevision: this.editingRecord()?.['Revision'] };
  }
}
