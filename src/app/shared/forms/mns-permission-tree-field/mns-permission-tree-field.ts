import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe } from '@jsverse/transloco';

import { MnsSearchSelectFieldOption } from '../mns-search-select-field/mns-search-select-field';

type PermissionTreeNode = {
  key: string;
  label: string;
  description?: string;
  value?: string | number | boolean | null;
  searchText: string;
  children: PermissionTreeNode[];
};

type PermissionTreeValue = readonly unknown[];

const ACTION_LABELS: Record<string, string> = {
  access: 'Access',
  create: 'Create',
  delete: 'Delete',
  manage: 'Manage',
  read: 'Read',
  update: 'Update',
  write: 'Write',
};

@Component({
  selector: 'mns-permission-tree-field',
  standalone: true,
  host: {
    '[class]': 'fieldClass()',
  },
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    NgTemplateOutlet,
    TranslocoPipe,
  ],
  template: `
    <section class="permission-tree-field" [class]="fieldClass()">
      <div class="permission-tree-label">{{ label() }}</div>

      <mat-form-field appearance="outline" class="permission-tree-search">
        <mat-icon matPrefix>search</mat-icon>
        <input
          matInput
          [placeholder]="placeholder() | transloco"
          [value]="search()"
          (input)="search.set($any($event.target).value)"
          autocomplete="off"
        />
      </mat-form-field>

      <div class="permission-tree-panel" [style.--permission-tree-visible-rows]="visibleRows()">
        @if (loading()) {
          <div class="permission-tree-state">
            <mat-spinner diameter="22" />
            <span>{{ loadingLabel() | transloco }}</span>
          </div>
        } @else {
          <ng-container
            [ngTemplateOutlet]="nodeList"
            [ngTemplateOutletContext]="{ nodes: filteredTree() }"
          />

          @if (!filteredTree().length) {
            <div class="permission-tree-state">{{ emptyLabel() | transloco }}</div>
          }
        }
      </div>

      <ng-template #nodeList let-nodes="nodes">
        <div class="permission-tree-list">
          @for (node of nodes; track trackNode(node)) {
            <div class="permission-tree-item">
              <div
                class="permission-tree-node"
                [class.permission-tree-node-branch]="hasChildren(node)"
              >
                @if (hasChildren(node)) {
                  <button
                    mat-icon-button
                    type="button"
                    [attr.aria-label]="node.label"
                    (click)="toggleExpanded(node)"
                  >
                    <mat-icon>{{ isExpanded(node) ? 'expand_more' : 'chevron_right' }}</mat-icon>
                  </button>
                } @else {
                  <span class="permission-tree-spacer"></span>
                }

                <mat-checkbox
                  [checked]="isNodeChecked(node)"
                  [indeterminate]="isNodeIndeterminate(node)"
                  (change)="toggleNode(node, $event.source.checked)"
                >
                  <span class="permission-tree-action">{{ node.label }}</span>
                  @if (node.description) {
                    <span class="permission-tree-code">{{ node.description }}</span>
                  }
                </mat-checkbox>
              </div>

              @if (hasChildren(node) && isExpanded(node)) {
                <div class="permission-tree-children">
                  <ng-container
                    [ngTemplateOutlet]="nodeList"
                    [ngTemplateOutletContext]="{ nodes: childrenAccessor(node) }"
                  />
                </div>
              }
            </div>
          }
        </div>
      </ng-template>
    </section>
  `,
  styles: [
    `
      :host {
        display: block;
        min-width: 0;
      }

      .permission-tree-field {
        min-width: 0;
      }

      .permission-tree-label {
        color: var(--mns-color-accent, #00d5d5);
        font-size: 0.78rem;
        line-height: 1.2;
        margin: 0 0 0.35rem 0.85rem;
      }

      .permission-tree-search {
        display: block;
        max-width: 24rem;
        width: min(100%, 24rem);
      }

      .permission-tree-panel {
        background: rgba(0, 0, 0, 0.16);
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 8px;
        height: min(calc(var(--permission-tree-visible-rows, 6) * 3.2rem), 48vh);
        min-height: 10rem;
        overflow: auto;
        padding: 0.45rem 0.25rem 0.7rem;
      }

      .permission-tree-node {
        align-items: center;
        display: flex;
        min-height: 42px;
        min-width: 0;
      }

      .permission-tree-node-branch {
        font-weight: 700;
      }

      .permission-tree-children {
        margin-left: 2.05rem;
      }

      .permission-tree-spacer {
        display: inline-block;
        width: 3rem;
      }

      .permission-tree-action {
        display: block;
      }

      .permission-tree-code {
        color: rgba(255, 255, 255, 0.58);
        display: block;
        font-size: 0.76rem;
        line-height: 1.2;
        overflow-wrap: anywhere;
      }

      .permission-tree-state {
        align-items: center;
        color: rgba(255, 255, 255, 0.66);
        display: flex;
        gap: 0.75rem;
        min-height: 120px;
        justify-content: center;
      }
    `,
  ],
})
export class MnsPermissionTreeFieldComponent {
  readonly value = input<PermissionTreeValue>([]);
  readonly valueChange = output<PermissionTreeValue>();
  readonly label = input.required<string>();
  readonly options = input.required<readonly MnsSearchSelectFieldOption[]>();
  readonly fieldClass = input('');
  readonly placeholder = input('Search permissions');
  readonly emptyLabel = input('No permissions found.');
  readonly loadingLabel = input('Loading permissions...');
  readonly loading = input(false);
  readonly rows = input(6);

  readonly search = signal('');
  readonly expandedKeys = signal<ReadonlySet<string>>(new Set(['platform', 'tenant']));
  readonly visibleRows = computed(() => Math.max(2, Math.min(12, Math.trunc(this.rows()))));

  readonly treeData = computed(() => this.buildTree(this.options()));
  readonly filteredTree = computed(() => {
    const term = this.normalize(this.search());
    if (!term) return this.treeData();
    return this.filterNodes(this.treeData(), term);
  });

  readonly selectedValues = computed(
    () =>
      new Set(
        this.value()
          .map((item) => String(item ?? ''))
          .filter(Boolean),
      ),
  );

  readonly childrenAccessor = (node: PermissionTreeNode) => node.children;

  trackNode(node: PermissionTreeNode): string {
    return node.key;
  }

  hasChildren(node: PermissionTreeNode): boolean {
    return this.childrenAccessor(node).length > 0;
  }

  isNodeChecked(node: PermissionTreeNode): boolean {
    const leafValues = this.nodeLeafValues(node);
    const selected = this.selectedValues();
    return leafValues.length > 0 && leafValues.every((item) => selected.has(item));
  }

  isNodeIndeterminate(node: PermissionTreeNode): boolean {
    const leafValues = this.nodeLeafValues(node);
    const selected = this.selectedValues();
    const selectedCount = leafValues.filter((item) => selected.has(item)).length;
    return selectedCount > 0 && selectedCount < leafValues.length;
  }

  isExpanded(node: PermissionTreeNode): boolean {
    return Boolean(this.search()) || this.expandedKeys().has(node.key);
  }

  toggleExpanded(node: PermissionTreeNode): void {
    this.expandedKeys.update((current) => {
      const next = new Set(current);
      if (next.has(node.key)) {
        next.delete(node.key);
      } else {
        next.add(node.key);
      }
      return next;
    });
  }

  toggleNode(node: PermissionTreeNode, checked: boolean): void {
    const leafValues = this.nodeLeafValues(node);
    if (!leafValues.length) return;

    const selected = new Set(
      this.value()
        .map((item) => String(item ?? ''))
        .filter(Boolean),
    );
    if (checked) {
      leafValues.forEach((item) => selected.add(item));
    } else {
      leafValues.forEach((item) => selected.delete(item));
    }

    const ordered = this.options()
      .map((option) => String(option.value ?? ''))
      .filter((item) => selected.has(item));
    this.valueChange.emit(ordered);
  }

  private buildTree(options: readonly MnsSearchSelectFieldOption[]): PermissionTreeNode[] {
    const roots = new Map<string, PermissionTreeNode>();

    for (const option of options) {
      const code = String(option.value ?? '').trim();
      if (!code) continue;

      const segments = code.split('.').filter(Boolean);
      const path = this.displayPathForPermission(segments, option);
      let currentMap = roots;
      let key = '';
      let currentNode: PermissionTreeNode | null = null;

      path.forEach((label, index) => {
        key = key ? `${key}.${this.normalizeKey(label)}` : this.normalizeKey(label);
        const isLeaf = index === path.length - 1;
        let node = currentMap.get(key);
        if (!node) {
          node = {
            key,
            label,
            description: isLeaf ? code : undefined,
            value: isLeaf ? option.value : undefined,
            searchText: this.normalize(
              `${label} ${option.searchText ?? ''} ${option.description ?? ''} ${code}`,
            ),
            children: [],
          };
          currentMap.set(key, node);
          currentNode?.children.push(node);
        }
        currentNode = node;
        currentMap = new Map(node.children.map((child) => [child.key, child]));
      });
    }

    return Array.from(roots.values()).sort((left, right) => left.label.localeCompare(right.label));
  }

  private displayPathForPermission(
    segments: string[],
    option: MnsSearchSelectFieldOption,
  ): string[] {
    if (!segments.length) return [option.label];
    const action = segments.at(-1) ?? '';
    const scope = segments[0] === 'platform' ? 'Platform' : 'Tenant';
    const resourceSegments = segments.slice(1, -1).map((segment) => this.humanizeSegment(segment));
    return [scope, ...resourceSegments, ACTION_LABELS[action] ?? this.humanizeSegment(action)];
  }

  private filterNodes(nodes: readonly PermissionTreeNode[], term: string): PermissionTreeNode[] {
    return nodes
      .map((node) => {
        const children = this.filterNodes(node.children, term);
        const matches = this.normalize(
          `${node.label} ${node.searchText} ${node.description ?? ''}`,
        ).includes(term);
        if (!matches && !children.length) return null;
        return { ...node, children };
      })
      .filter((node): node is PermissionTreeNode => Boolean(node));
  }

  private nodeLeafValues(node: PermissionTreeNode): string[] {
    if (!node.children.length) return node.value === undefined ? [] : [String(node.value ?? '')];
    return node.children.flatMap((child) => this.nodeLeafValues(child));
  }

  private humanizeSegment(segment: string): string {
    return segment
      .split(/[-_]/g)
      .filter(Boolean)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private normalizeKey(value: string): string {
    return this.normalize(value).replace(/[^a-z0-9]+/g, '-');
  }

  private normalize(value: string): string {
    return value
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .trim()
      .toLowerCase();
  }
}
