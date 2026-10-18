import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  CONFIGURABLE_CRUD_IMPORTS,
  ConfigurableCrudOption,
  ConfigurableCrudPageBase,
  ConfigurableCrudRecord,
  ConfigurableCrudRowAction,
} from '../../../shared/crud/configurable-crud/configurable-crud-page-base';
import { defineCrud } from '../../../shared/crud/configurable-crud/define-crud';
import {
  HelpVideo,
  HelpVideoService,
  appRoutePatterns,
} from '../../../services/help-video.service';

/** Languages of a tutorial video (the App languages). */
export const HELP_VIDEO_LOCALE_OPTIONS = [
  { value: 'pt-BR', label: 'Portuguese' },
  { value: 'en-US', label: 'English' },
  { value: 'es-ES', label: 'Spanish' },
] as const;

function localeLabel(value: unknown): string {
  return (
    HELP_VIDEO_LOCALE_OPTIONS.find((option) => option.value === value)?.label ?? String(value ?? '')
  );
}

const config = defineCrud({
  endpoint: 'system/help/videos',
  uuidField: 'HelpVideoUUID',
  pageTitle: 'Tutorial videos',
  pageDescription:
    'YouTube videos that teach each App page, per language. The video opens inside the App from the button beside Report problem.',
  createTitle: 'New tutorial video',
  editTitle: 'Edit tutorial video',
  dialogDescription:
    'One video per page and language. Unlisted YouTube videos work; users without a video in their language see another language.',
  searchPlaceholder: 'Page, title or video id',
  emptyLabel: 'No tutorial videos found.',
  deleteTitle: 'Delete tutorial video',
  deleteMessage:
    'Delete this tutorial video? The page stops showing it; the YouTube video is kept.',
  savedMessage: 'Tutorial video saved successfully.',
  deletedMessage: 'Tutorial video deleted successfully.',
  deleteFailedMessage: 'Failed to delete tutorial video.',
  bulkDelete: false,
  serverSidePagination: true,
  initialValues: { status: 1, route: '', locale: 'pt-BR', title: '', youtubeUrl: '' },
  rowActions: [
    {
      key: 'play',
      label: 'Watch video',
      icon: 'smart_display',
      tooltip: 'Plays the video as users see it.',
    },
  ],
  columns: [
    {
      id: 'title',
      field: 'Title',
      label: 'Title',
      kind: 'identity',
      detail: (row) => String(row['Route'] ?? ''),
    },
    {
      id: 'locale',
      field: 'Locale',
      label: 'Language',
      value: (row, translate) => translate(localeLabel(row['Locale'])),
    },
    { id: 'video', field: 'YoutubeVideoId', label: 'YouTube video' },
    { id: 'updated', field: 'DateUpdated', label: 'Updated', kind: 'datetime', optional: true },
    { id: 'status', field: 'Status', label: 'Status', kind: 'status', className: 'status-col' },
  ],
  listFilters: [
    {
      key: 'locale',
      paramKey: 'locale',
      label: 'Language',
      type: 'search-select',
      options: [...HELP_VIDEO_LOCALE_OPTIONS],
      translateOptions: true,
      span: 1,
    },
  ],
  fields: [
    {
      key: 'status',
      source: 'Status',
      payloadKey: 'status',
      label: 'Status',
      type: 'status',
      span: 1,
    },
    {
      key: 'locale',
      source: 'Locale',
      payloadKey: 'locale',
      label: 'Language',
      type: 'search-select',
      options: [...HELP_VIDEO_LOCALE_OPTIONS],
      translateOptions: true,
      required: true,
      help: 'Language spoken in the video. Record one video per language.',
      span: 1,
    },
    {
      key: 'route',
      source: 'Route',
      payloadKey: 'route',
      label: 'App page',
      type: 'search-select',
      translateOptions: false,
      required: true,
      help: 'The video appears on this page and on its dialogs.',
      span: 2,
    },
    { key: 'title', source: 'Title', payloadKey: 'title', label: 'Title', required: true, span: 2 },
    {
      key: 'youtubeUrl',
      source: 'YoutubeVideoId',
      payloadKey: 'youtubeUrl',
      label: 'YouTube link',
      required: true,
      placeholder: 'https://youtu.be/...',
      help: 'Paste the video link (watch, youtu.be, shorts or embed). Unlisted videos work.',
      fromRecord: (value) => (value ? `https://youtu.be/${String(value)}` : ''),
      span: 2,
    },
  ],
  payload: (values) => ({
    status: Number(values['status'] ?? 1),
    route: values['route'],
    locale: values['locale'],
    title: values['title'],
    youtubeUrl: values['youtubeUrl'],
  }),
});

@Component({
  selector: 'app-help-videos',
  standalone: true,
  imports: CONFIGURABLE_CRUD_IMPORTS,
  templateUrl: '../../../shared/crud/configurable-crud/configurable-crud-page.html',
  styleUrls: ['../../../shared/crud/configurable-crud/configurable-crud-page.scss'],
})
export class HelpVideosPage extends ConfigurableCrudPageBase<ConfigurableCrudRecord> {
  private readonly helpVideos = inject(HelpVideoService);
  /** Every App page, so the video is bound to a real route pattern. */
  private readonly pages: ConfigurableCrudOption[] = appRoutePatterns(inject(Router).config)
    .filter((page) => page.route !== '/')
    .map((page) => ({
      value: page.route,
      label: page.title || page.route,
      description: page.route,
    }));

  constructor() {
    super(config);
  }

  protected override lookupOptions(key: string): readonly ConfigurableCrudOption[] {
    if (key !== 'route') return [];
    const current = String(this.formValues()['route'] ?? '').trim();
    return current && !this.pages.some((page) => page.value === current)
      ? [{ value: current, label: current }, ...this.pages]
      : this.pages;
  }

  protected override augmentPayload(payload: ConfigurableCrudRecord) {
    return {
      ...payload,
      ...(this.editingRecord() ? { expectedRevision: this.editingRecord()?.['Revision'] } : {}),
    };
  }

  protected override afterSave(): void {
    void this.helpVideos.refresh();
  }

  protected override afterDelete(): void {
    void this.helpVideos.refresh();
  }

  override async handleRowAction(
    action: ConfigurableCrudRowAction,
    row: ConfigurableCrudRecord,
  ): Promise<void> {
    if (action.key !== 'play') return;
    const { openHelpVideo } = await import('../../../shared/help-video/help-video-dialog');
    openHelpVideo(this.dialog, row as unknown as HelpVideo);
  }
}
