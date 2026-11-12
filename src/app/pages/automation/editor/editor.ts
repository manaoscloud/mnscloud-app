// crud-template-exempt: Visual flow editor (canvas, inspector, simulator); the list of flows is the CRUD page.
// Full-height workspace (src/styles/_workspace.scss): only the panes scroll, never the page.

import { DatePipe } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  ViewEncapsulation,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  FCanvasComponent,
  FCreateConnectionEvent,
  FFlowComponent,
  FFlowModule,
  FMoveNodesEvent,
  FReassignConnectionEvent,
  FSelectionChangeEvent,
} from '@foblex/flow';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { hasEffectivePermission } from '../../../core/guards/permission.guard';
import { AuthService } from '../../../services/auth.service';
import { SnackbarService } from '../../../services/snackbar.service';
import {
  AUTOMATION_PERMISSIONS,
  FlowDetail,
  FlowGraph,
  GraphEdge,
  GraphNode,
  NodeTypeDef,
  PortDef,
  TRIGGER_TYPE,
  ValidationIssue,
  ValidationResult,
  issuesFromError,
} from '../automation-adapter';
import {
  NODE_WIDTH,
  OPTIONAL_PORTS,
  addNode,
  autoLayout,
  canAddNode,
  connect,
  disconnect,
  emptyGraph,
  inputId,
  listEntries,
  moveNodes,
  nodeHeight,
  outputId,
  parseConnector,
  portsOf,
  removeNodes,
  updateConfig,
} from '../automation-graph';
import { AutomationService, PickerOption } from '../automation.service';
import { askPublish, openVersions } from './editor-dialogs';
import {
  EditorLayout,
  PhonePane,
  RightPane,
  SaveState,
  lockedByOther,
  moduleAccent,
  nodeSummary,
  paletteGroups,
  editorLayoutFor,
} from './editor-helpers';
import { AutomationSchemaField, humanize } from './schema-field';
import { AutomationTestPanel } from './test-panel';

/**
 * Carries the stylesheet of the editor panes (palette, list, inspector). A component of its own
 * because each component stylesheet has a size budget; it renders nothing.
 */
@Component({
  selector: 'app-automation-editor-styles',
  standalone: true,
  template: '',
  styleUrl: './editor-panes.scss',
  encapsulation: ViewEncapsulation.None,
})
export class AutomationEditorStyles {}

const SAVE_DELAY_MS = 1200;
const VALIDATE_DELAY_MS = 1500;

@Component({
  selector: 'app-automation-editor',
  standalone: true,
  imports: [
    AutomationEditorStyles,
    AutomationSchemaField,
    AutomationTestPanel,
    DatePipe,
    FFlowModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    MatTooltipModule,
    RouterLink,
    TranslocoPipe,
  ],
  templateUrl: './editor.html',
  styleUrl: './editor.scss',
  encapsulation: ViewEncapsulation.None,
  host: { '(keydown)': 'onKey($event)', '(window:beforeunload)': 'onUnload($event)' },
})
export class AutomationEditorPage {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(AutomationService);
  private readonly auth = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly snack = inject(SnackbarService);
  private readonly transloco = inject(TranslocoService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly uuid = this.route.snapshot.paramMap.get('uuid') ?? '';
  readonly canvas = viewChild(FCanvasComponent);
  readonly flowRef = viewChild(FFlowComponent);

  readonly flow = signal<FlowDetail | null>(null);
  readonly graph = signal<FlowGraph>(emptyGraph());
  readonly defs = signal<NodeTypeDef[]>([]);
  readonly loading = signal(true);
  readonly loadFailed = signal(false);
  readonly layout = signal<EditorLayout>('wide');
  readonly view = signal<'canvas' | 'list'>('canvas');
  readonly right = signal<RightPane>('inspector');
  readonly phonePane = signal<PhonePane>('steps');
  readonly paletteOpen = signal(false);
  readonly filter = signal('');
  readonly selectedId = signal('');
  readonly selectedEdges = signal<string[]>([]);
  readonly visited = signal<ReadonlySet<string>>(new Set());
  readonly validation = signal<ValidationResult>({ errors: [], warnings: [] });
  readonly validating = signal(false);
  readonly saveState = signal<SaveState>('saved');
  readonly pickers = signal<Record<string, PickerOption[]>>({});

  readonly defsMap = computed(() => new Map(this.defs().map((def) => [def.type, def])));
  readonly groups = computed(() => paletteGroups(this.defs(), this.filter()));
  readonly canWrite = computed(() =>
    hasEffectivePermission(this.auth.user()?.permissions ?? [], AUTOMATION_PERMISSIONS.flowsWrite),
  );
  readonly canPublish = computed(() =>
    hasEffectivePermission(
      this.auth.user()?.permissions ?? [],
      AUTOMATION_PERMISSIONS.flowsPublish,
    ),
  );
  readonly locked = computed(() => this.saveState() === 'locked');
  readonly readOnly = computed(
    () => !this.canWrite() || this.locked() || this.saveState() === 'conflict',
  );
  readonly selected = computed(
    () => this.graph().nodes.find((node) => node.id === this.selectedId()) ?? null,
  );
  readonly selectedDef = computed(() => {
    const node = this.selected();
    return node ? (this.defsMap().get(node.type) ?? null) : null;
  });
  readonly selectedFields = computed(() => {
    const properties = this.selectedDef()?.configSchema.properties ?? {};
    return Object.entries(properties).map(([name, schema]) => ({ name, schema }));
  });
  readonly entries = computed(() => listEntries(this.graph(), this.defsMap()));
  readonly issuesByNode = computed(() => {
    const map = new Map<string, { errors: number; warnings: number; text: string[] }>();
    const add = (issue: ValidationIssue, kind: 'errors' | 'warnings') => {
      if (!issue.nodeId) return;
      const entry = map.get(issue.nodeId) ?? { errors: 0, warnings: 0, text: [] };
      entry[kind]++;
      entry.text.push(issue.message || issue.code);
      map.set(issue.nodeId, entry);
    };
    this.validation().errors.forEach((issue) => add(issue, 'errors'));
    this.validation().warnings.forEach((issue) => add(issue, 'warnings'));
    return map;
  });
  readonly showPalette = computed(() => {
    const layout = this.layout();
    return (
      layout === 'wide' ||
      (layout === 'medium' ? this.paletteOpen() : this.phonePane() === 'palette')
    );
  });
  readonly showCenter = computed(() => this.layout() !== 'phone' || this.phonePane() === 'steps');
  readonly showRightPane = computed(
    () => this.layout() !== 'phone' || ['inspector', 'test', 'issues'].includes(this.phonePane()),
  );
  readonly issueCount = computed(
    () => this.validation().errors.length + this.validation().warnings.length,
  );
  readonly nextVersion = computed(() => (this.flow()?.publishedVersion ?? 0) + 1);
  readonly edgeKeys = computed(() =>
    this.graph().edges.map((edge) => ({ edge, id: outputId(edge.from, edge.port) })),
  );

  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private validateTimer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> | null = null;
  private again = false;
  private force = false;
  private tookLock = false;
  private pendingContacts: string[] | null = null;
  private baseline = '';

  constructor() {
    afterNextRender(() => this.observeWidth());
    this.destroyRef.onDestroy(() => {
      if (this.saveTimer) clearTimeout(this.saveTimer);
      if (this.validateTimer) clearTimeout(this.validateTimer);
      // Leaving with a pending change still saves it (the service outlives the page).
      if (this.dirty()) void this.save();
    });
    void this.load();
  }

  // ---- loading ----------------------------------------------------------------------------

  private async load(): Promise<void> {
    this.loading.set(true);
    try {
      const [defs, flow] = await Promise.all([
        this.service.nodeTypes(),
        this.service.flow(this.uuid),
      ]);
      this.defs.set(defs);
      this.applyFlow(flow);
      void this.loadPickers();
      this.scheduleValidate(0);
    } catch {
      this.loadFailed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  private applyFlow(flow: FlowDetail): void {
    this.flow.set(flow);
    const graph = flow.graph.nodes.length ? flow.graph : emptyGraph();
    this.graph.set(graph);
    this.baseline = JSON.stringify(graph);
    this.saveState.set(lockedByOther(flow, this.auth.user()?.uuid ?? '') ? 'locked' : 'saved');
    this.selectedId.set('');
    setTimeout(() => this.fit(), 80);
  }

  private async loadPickers(): Promise<void> {
    const [connection, team, user] = await Promise.all(
      ['connection', 'team', 'user'].map((widget) => this.service.options(widget).catch(() => [])),
    );
    this.pickers.set({ connection, team, user });
  }

  async reload(): Promise<void> {
    await this.load();
  }

  // ---- layout -------------------------------------------------------------------------------

  private observeWidth(): void {
    const element = this.host.nativeElement;
    if (typeof ResizeObserver === 'undefined') return;
    const apply = (width: number) => {
      const next = editorLayoutFor(width);
      if (next === this.layout()) return;
      this.layout.set(next);
      if (next === 'phone') this.view.set('list');
    };
    apply(element.getBoundingClientRect().width);
    const observer = new ResizeObserver((entries) => apply(entries[0].contentRect.width));
    observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }

  fit(): void {
    this.canvas()?.fitToScreen({ x: 48, y: 48 }, false, false, 1);
  }

  // ---- labels --------------------------------------------------------------------------------

  private translated(key: string, fallback: string): string {
    const text = this.transloco.translate(key);
    return text !== key ? text : fallback;
  }

  nodeLabel(type: string): string {
    return this.translated(`automation.node.${type}`, humanize(type.split('.').pop() ?? type));
  }

  nodeHelp(type: string): string {
    return this.translated(`automation.nodeHelp.${type}`, '');
  }

  moduleLabel(module: string): string {
    return this.translated(`automation.module.${module}`, humanize(module));
  }

  lockText(reason: string): string {
    return this.translated(`automation.lock.${reason}`, reason);
  }

  portLabel(port: PortDef): string {
    return this.translated(`automation.port.${port.id}`, port.label);
  }

  accent(type: string): string {
    return `var(${moduleAccent(this.defsMap().get(type)?.module ?? type.split('.')[0])})`;
  }

  iconOf(type: string): string {
    return this.defsMap().get(type)?.icon ?? 'extension';
  }

  effectOf(type: string): string {
    return this.defsMap().get(type)?.effect ?? 'read';
  }

  summaryOf(node: GraphNode): string {
    return nodeSummary(node);
  }

  portsFor(node: GraphNode): PortDef[] {
    return portsOf(node, this.defsMap().get(node.type));
  }

  hasInput(node: GraphNode): boolean {
    return node.id !== this.graph().start;
  }

  portConnected(node: GraphNode, port: PortDef): boolean {
    return this.graph().edges.some((edge) => edge.from === node.id && edge.port === port.id);
  }

  portOptional(port: PortDef): boolean {
    return OPTIONAL_PORTS.includes(port.id);
  }

  nodeTitle(id: string): string {
    const node = this.graph().nodes.find((item) => item.id === id);
    return node ? this.nodeLabel(node.type) : id;
  }

  accentOf(module: string): string {
    return moduleAccent(module);
  }

  nodeById(id: string): GraphNode | undefined {
    return this.graph().nodes.find((node) => node.id === id);
  }

  /** Nodes an output port can lead to (every node but the trigger). */
  targets(): GraphNode[] {
    return this.graph().nodes.filter((node) => node.id !== this.graph().start);
  }

  targetOf(from: string, port: string): string {
    return this.graph().edges.find((edge) => edge.from === from && edge.port === port)?.to ?? '';
  }

  /** Connects (or clears) one output port from the inspector: the way to link steps on a phone. */
  setTarget(from: string, port: string, to: string): void {
    const current = this.targetOf(from, port);
    if (current === to) return;
    const cleared = current ? disconnect(this.graph(), { from, port, to: current }) : this.graph();
    this.setGraph(to ? connect(cleared, { from, port, to }) : cleared);
  }

  readonly inputId = inputId;
  readonly outputId = outputId;

  // ---- graph edits --------------------------------------------------------------------------

  private setGraph(graph: FlowGraph): void {
    if (graph === this.graph() || this.readOnly()) return;
    this.graph.set(graph);
    this.visited.set(new Set());
    this.scheduleSave();
    this.scheduleValidate(VALIDATE_DELAY_MS);
  }

  add(def: NodeTypeDef): void {
    if (this.readOnly()) return;
    const graph = this.graph();
    if (!canAddNode(graph, def)) {
      this.snack.error(
        def.type === TRIGGER_TYPE ? 'automation.editor.oneTrigger' : 'automation.editor.limit',
      );
      return;
    }
    const from = this.selected();
    const bottom = Math.max(0, ...graph.nodes.map((n) => n.position.y + nodeHeight(2)));
    const position = from
      ? { x: from.position.x + NODE_WIDTH + 90, y: from.position.y }
      : { x: 40, y: bottom + 40 };
    const added = addNode(graph, def, position);
    let next = added.graph;
    if (from) {
      const free = this.portsFor(from).find(
        (port) =>
          !this.portOptional(port) &&
          !graph.edges.some((edge) => edge.from === from.id && edge.port === port.id),
      );
      if (free) next = connect(next, { from: from.id, port: free.id, to: added.id });
    }
    this.setGraph(next);
    this.selectNode(added.id);
    this.paletteOpen.set(false);
    if (this.layout() === 'phone') this.phonePane.set('inspector');
    setTimeout(() => this.flowRef()?.select([added.id], []), 60);
  }

  selectNode(id: string): void {
    this.selectedId.set(id);
    if (id && this.right() !== 'test') this.right.set('inspector');
    if (id && this.layout() === 'phone') this.phonePane.set('inspector');
  }

  onSelection(event: FSelectionChangeEvent): void {
    this.selectedEdges.set(event.connectionIds);
    this.selectedId.set(event.nodeIds[0] ?? '');
    if (event.nodeIds[0] && this.right() === 'issues') this.right.set('inspector');
  }

  onMove(event: FMoveNodesEvent): void {
    this.setGraph(moveNodes(this.graph(), event.nodes));
  }

  onCreate(event: FCreateConnectionEvent): void {
    const source = parseConnector(event.sourceId);
    const target = event.targetId ? parseConnector(event.targetId) : null;
    if (!source || !target || source.kind !== 'out' || target.kind !== 'in') return;
    this.setGraph(
      connect(this.graph(), { from: source.nodeId, port: source.port, to: target.nodeId }),
    );
  }

  onReassign(event: FReassignConnectionEvent): void {
    const oldSource = parseConnector(event.previousSourceId);
    const oldTarget = parseConnector(event.previousTargetId);
    if (!oldSource || !oldTarget) return;
    let graph = disconnect(this.graph(), {
      from: oldSource.nodeId,
      port: oldSource.port,
      to: oldTarget.nodeId,
    });
    const source = parseConnector(event.nextSourceId ?? '');
    const target = parseConnector(event.nextTargetId ?? '');
    if (source && target && source.kind === 'out' && target.kind === 'in')
      graph = connect(graph, { from: source.nodeId, port: source.port, to: target.nodeId });
    this.setGraph(graph);
  }

  removeSelection(): void {
    if (this.readOnly()) return;
    let graph = this.graph();
    const edgeIds = new Set(this.selectedEdges());
    for (const { edge, id } of this.edgeKeys())
      if (edgeIds.has(id)) graph = disconnect(graph, edge);
    const node = this.selectedId();
    if (node) graph = removeNodes(graph, [node]);
    this.selectedEdges.set([]);
    if (node && node !== this.graph().start) this.selectedId.set('');
    this.setGraph(graph);
  }

  removeNode(id: string): void {
    this.setGraph(removeNodes(this.graph(), [id]));
    if (this.selectedId() === id) this.selectedId.set('');
  }

  removeEdge(edge: GraphEdge): void {
    this.setGraph(disconnect(this.graph(), edge));
  }

  onConfig(name: string, value: unknown): void {
    const node = this.selected();
    if (!node) return;
    const config = { ...node.config };
    if (value === undefined) delete config[name];
    else config[name] = value;
    this.setGraph(updateConfig(this.graph(), node.id, config, this.defsMap()));
  }

  layoutNodes(): void {
    this.setGraph(autoLayout(this.graph(), (node) => nodeHeight(this.portsFor(node).length)));
    setTimeout(() => this.fit(), 80);
  }

  onKey(event: KeyboardEvent): void {
    if (event.key !== 'Delete' && event.key !== 'Backspace') return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('input, textarea, select, [contenteditable="true"], .mat-mdc-select'))
      return;
    event.preventDefault();
    this.removeSelection();
  }

  // ---- autosave ------------------------------------------------------------------------------

  private scheduleSave(): void {
    this.saveState.set('dirty');
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => void this.save(), SAVE_DELAY_MS);
  }

  /** Pending changes the user would lose by leaving. */
  dirty(): boolean {
    return (
      ['dirty', 'saving'].includes(this.saveState()) ||
      this.pendingContacts !== null ||
      this.running !== null
    );
  }

  onUnload(event: Event): void {
    if (this.dirty()) event.preventDefault();
  }

  /** Route guard: saves first; when it cannot, asks before discarding. */
  async canLeave(): Promise<boolean> {
    if (!this.dirty()) return true;
    await this.save();
    if (!this.dirty() && this.saveState() === 'saved') return true;
    return window.confirm(this.transloco.translate('automation.editor.leaveUnsaved'));
  }

  /**
   * Saves the draft (and pending test contacts) now. Every caller gets the whole queue: a request
   * that arrives while a save runs makes the loop go once more, and all of them wait for it.
   */
  async save(force = false): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    if (force) this.force = true;
    this.again = true;
    this.running ??= this.drain();
    return this.running;
  }

  private async drain(): Promise<void> {
    try {
      while (this.again) {
        this.again = false;
        await this.persist();
        await this.persistContacts();
      }
    } finally {
      this.running = null;
    }
  }

  private async persist(): Promise<void> {
    const flow = this.flow();
    const graph = this.graph();
    if (!flow || this.readOnly()) return;
    const serialized = JSON.stringify(graph);
    if (serialized === this.baseline) {
      this.saveState.set('saved');
      return;
    }
    this.saveState.set('saving');
    const force = this.force;
    try {
      const saved = await this.service.saveDraft(this.uuid, flow.revision, graph, force);
      this.tookLock = this.tookLock || force;
      this.force = false;
      this.baseline = serialized;
      this.flow.update((current) =>
        current
          ? { ...current, revision: saved.revision || current.revision, lock: null }
          : current,
      );
      this.saveState.set(JSON.stringify(this.graph()) === serialized ? 'saved' : 'dirty');
    } catch (error) {
      await this.saveFailed(error);
    }
  }

  private async saveFailed(error: unknown): Promise<void> {
    const failure = error as { status?: number; error?: { code?: string; error?: string } };
    const code = `${failure.error?.code ?? ''} ${failure.error?.error ?? ''}`.toLowerCase();
    if (failure.status === 409 && code.includes('lock')) {
      this.saveState.set('locked');
      try {
        const current = await this.service.flow(this.uuid);
        this.flow.update((flow) => (flow ? { ...flow, lock: current.lock } : flow));
      } catch {
        // The banner still explains the lock without the editor name.
      }
      return;
    }
    if (failure.status === 409) {
      await this.markConflict();
      return;
    }
    this.saveState.set('error');
  }

  /** The draft changed elsewhere: take its revision, keep the local graph, wait for the choice. */
  private async markConflict(): Promise<void> {
    this.saveState.set('conflict');
    try {
      const current = await this.service.flow(this.uuid);
      this.flow.update((flow) =>
        flow ? { ...flow, revision: current.revision, lock: current.lock } : flow,
      );
    } catch {
      // Reload stays available.
    }
  }

  /** "Overwrite": saves the local graph over the newer draft, with its fresh revision. */
  async overwrite(): Promise<void> {
    this.saveState.set('dirty');
    await this.save(true);
  }

  private async persistContacts(): Promise<void> {
    const contacts = this.pendingContacts;
    const flow = this.flow();
    if (contacts === null || !flow || !this.canWrite() || this.saveState() === 'conflict') return;
    this.pendingContacts = null;
    try {
      const saved = await this.service.saveTestContacts(this.uuid, flow.revision, contacts);
      this.flow.update((current) =>
        current ? { ...current, revision: saved.revision || current.revision } : current,
      );
    } catch (error) {
      this.snack.error('automation.test.contactsFailed');
      const status = (error as { status?: number }).status;
      if (status === 409) await this.markConflict();
      else if (this.saveState() === 'saved' || this.saveState() === 'dirty') {
        try {
          const current = await this.service.flow(this.uuid);
          this.flow.update((f) =>
            f ? { ...f, revision: current.revision, testContacts: current.testContacts } : f,
          );
        } catch {
          // Keep the optimistic list; the next save retries nothing.
        }
      }
    }
  }

  /** "Edit anyway": takes the draft lock from the other editor and saves the current graph. */
  async editAnyway(): Promise<void> {
    this.saveState.set('dirty');
    await this.save(true);
  }

  retrySave(): void {
    void this.save();
  }

  // ---- validation ----------------------------------------------------------------------------

  private scheduleValidate(delay: number): void {
    if (this.validateTimer) clearTimeout(this.validateTimer);
    this.validateTimer = setTimeout(() => void this.validate(false), delay);
  }

  async validate(show = true): Promise<ValidationResult | null> {
    this.validating.set(true);
    try {
      const result = await this.service.validate(this.uuid, this.graph());
      this.validation.set(result);
      if (show) {
        this.openRight('issues');
        if (!result.errors.length && !result.warnings.length)
          this.snack.success('automation.editor.valid');
      }
      return result;
    } catch {
      return null;
    } finally {
      this.validating.set(false);
    }
  }

  openRight(pane: RightPane): void {
    this.right.set(pane);
    if (this.layout() === 'phone') this.phonePane.set(pane);
  }

  focusIssue(issue: ValidationIssue): void {
    if (issue.nodeId) this.selectNode(issue.nodeId);
  }

  // ---- publish and versions -----------------------------------------------------------------

  async publish(): Promise<void> {
    await this.save();
    const flow = this.flow();
    if (!flow || this.saveState() !== 'saved' || this.dirty()) return;
    const result = await this.validate(false);
    if (!result) return;
    if (result.errors.length) {
      this.openRight('issues');
      this.snack.error('automation.editor.fixErrors');
      return;
    }
    const note = await askPublish(this.dialog, {
      nextVersion: this.nextVersion(),
      warnings: result.warnings,
    });
    if (note === undefined) return;
    try {
      await this.service.publish(this.uuid, flow.revision, note);
      this.snack.success('automation.publish.done');
      this.flow.set(await this.service.flow(this.uuid));
    } catch (error) {
      const issues = issuesFromError(error);
      if (issues.length) {
        this.validation.set({ errors: issues, warnings: [] });
        this.openRight('issues');
      }
    }
  }

  async versions(): Promise<void> {
    await this.save();
    const restored = await openVersions(this.dialog, {
      flowUUID: this.uuid,
      canRestore: this.canWrite() && !this.readOnly(),
      revision: this.flow()?.revision ?? 0,
      force: this.tookLock,
    });
    if (restored) {
      this.snack.success('automation.versions.restored');
      await this.reload();
    }
  }

  // ---- test panel ----------------------------------------------------------------------------

  /** Optimistic update; the save queue sends it after any draft save, with the latest revision. */
  setTestContacts(contacts: string[]): void {
    if (!this.flow()) return;
    this.flow.update((current) => (current ? { ...current, testContacts: contacts } : current));
    this.pendingContacts = contacts;
    void this.save();
  }

  onVisited(ids: string[]): void {
    this.visited.set(new Set(ids));
  }
}
