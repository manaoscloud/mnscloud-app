import { Component, computed, input, output, signal } from '@angular/core';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoPipe } from '@jsverse/transloco';

type Field = {
  key: string;
  label: string;
  kind?: string;
  options?: { value: string; label: string }[];
};
const ENGINES = ['mysql', 'mariadb', 'postgres', 'sqlserver', 'mongodb'];
const PORTS: Record<string, number> = {
  mysql: 3306,
  mariadb: 3306,
  postgres: 5432,
  sqlserver: 1433,
  mongodb: 27017,
};
@Component({
  selector: 'mns-secret-content-field',
  standalone: true,
  imports: [
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    TranslocoPipe,
  ],
  template: `<div class="form-grid">
    @if (type() === 'certificate') {
      <p class="span-4">{{ 'Certificate validity follows its expiration date.' | transloco }}</p>
    }

    @for (field of fields(); track field.key) {
      <mat-form-field
        appearance="outline"
        [class]="field.kind === 'textarea' ? 'span-4' : 'span-1'"
      >
        <mat-label>{{ field.label | transloco }}{{ isRequired(field.key) ? '*' : '' }}</mat-label>
        @if (field.options) {
          <mat-select
            [value]="data()[field.key]"
            (selectionChange)="change(field.key, $event.value)"
          >
            @for (option of field.options; track option.value) {
              <mat-option [value]="option.value">{{ option.label | transloco }}</mat-option>
            }
          </mat-select>
        } @else if (field.kind === 'textarea') {
          <textarea
            matInput
            rows="4"
            autocomplete="off"
            autocapitalize="off"
            [spellcheck]="false"
            [value]="data()[field.key] ?? ''"
            (input)="change(field.key, $any($event.target).value)"
          ></textarea>
        } @else {
          <input
            matInput
            [type]="
              field.kind === 'password' && !revealed().has(field.key)
                ? 'password'
                : field.kind === 'number'
                  ? 'number'
                  : 'text'
            "
            autocomplete="off"
            autocapitalize="off"
            [spellcheck]="false"
            [value]="data()[field.key] ?? ''"
            (input)="
              change(
                field.key,
                field.kind === 'number' ? +$any($event.target).value : $any($event.target).value
              )
            "
          />
        }
        @if (field.kind === 'password') {
          <button
            mat-icon-button
            matSuffix
            type="button"
            [attr.aria-label]="'Show or hide value' | transloco"
            (click)="toggle(field.key)"
          >
            <mat-icon>{{ revealed().has(field.key) ? 'visibility_off' : 'visibility' }}</mat-icon>
          </button>
        }
      </mat-form-field>
    }
    @if (pairs()) {
      @for (entry of entries(); track $index; let i = $index) {
        <mat-form-field appearance="outline" class="span-1"
          ><mat-label>{{ 'Field name' | transloco }}</mat-label
          ><input
            matInput
            autocomplete="off"
            [value]="entry.name"
            (input)="pair(i, 'name', $any($event.target).value)"
        /></mat-form-field>
        <mat-form-field appearance="outline" class="span-2"
          ><mat-label>{{ 'Value' | transloco }}</mat-label
          ><input
            matInput
            autocomplete="off"
            [type]="revealed().has('pair' + i) ? 'text' : 'password'"
            [value]="entry.value"
            (input)="pair(i, 'value', $any($event.target).value)"
          /><button
            mat-icon-button
            matSuffix
            type="button"
            [attr.aria-label]="'Show or hide value' | transloco"
            (click)="toggle('pair' + i)"
          >
            <mat-icon>visibility</mat-icon>
          </button></mat-form-field
        >
        <button
          mat-icon-button
          type="button"
          [attr.aria-label]="'Remove field' | transloco"
          (click)="remove(i)"
        >
          <mat-icon>delete</mat-icon>
        </button>
      }
      <button mat-stroked-button type="button" (click)="add()" [disabled]="entries().length >= 100">
        <mat-icon>add</mat-icon>{{ 'Add field' | transloco }}
      </button>
    }
  </div>`,
})
export class SecretContentFieldComponent {
  readonly type = input('generic');
  readonly value = input<unknown>(null);
  readonly valueChange = output<Record<string, unknown>>();
  readonly revealed = signal(new Set<string>());
  readonly data = computed<Record<string, any>>(() => ({
    ...(this.type() === 'database'
      ? { engine: 'mysql', port: 3306 }
      : this.type() === 'api_token'
        ? { mode: 'token' }
        : this.type() === 'generic'
          ? { mode: 'text' }
          : {}),
    ...((this.value() as Record<string, unknown>) ?? {}),
  }));
  readonly pairs = computed(
    () =>
      this.type() === 'runtime_env' ||
      (this.type() === 'generic' && this.data()['mode'] === 'pairs'),
  );
  readonly entries = computed<{ name: string; value: string }[]>(
    () => this.data()['entries'] ?? [],
  );
  readonly fields = computed<Field[]>(() => {
    const type = this.type();
    if (type === 'database')
      return [
        {
          key: 'engine',
          label: 'Database engine',
          options: ENGINES.map((value) => ({
            value,
            label:
              value === 'postgres'
                ? 'PostgreSQL'
                : value === 'sqlserver'
                  ? 'SQL Server'
                  : value === 'mongodb'
                    ? 'MongoDB'
                    : value === 'mariadb'
                      ? 'MariaDB'
                      : 'MySQL',
          })),
        },
        { key: 'host', label: 'Host' },
        { key: 'port', label: 'Port', kind: 'number' },
        { key: 'dbname', label: 'Database name' },
        { key: 'username', label: 'Username' },
        { key: 'password', label: 'Password', kind: 'password' },
      ];
    if (type === 'password')
      return [
        { key: 'username', label: 'Username' },
        { key: 'password', label: 'Password', kind: 'password' },
        { key: 'url', label: 'Service URL (optional)' },
      ];
    if (type === 'api_token')
      return [
        {
          key: 'mode',
          label: 'Credential format',
          options: [
            { value: 'token', label: 'API token' },
            { value: 'access_key', label: 'Access key pair' },
          ],
        },
        ...(this.data()['mode'] === 'access_key'
          ? [
              { key: 'accessKeyId', label: 'Access key ID' },
              { key: 'secretAccessKey', label: 'Secret access key', kind: 'password' },
            ]
          : [{ key: 'token', label: 'API token', kind: 'password' }]),
        { key: 'url', label: 'Service URL (optional)' },
      ];
    if (type === 'ssh_key')
      return [
        { key: 'username', label: 'Username (optional)' },
        { key: 'host', label: 'Host (optional)' },
        { key: 'passphrase', label: 'Passphrase (optional)', kind: 'password' },
        { key: 'privateKey', label: 'Private key', kind: 'textarea' },
      ];
    if (type === 'certificate')
      return [
        { key: 'certificate', label: 'Certificate (PEM)', kind: 'textarea' },
        { key: 'chain', label: 'Certificate chain (optional)', kind: 'textarea' },
        { key: 'privateKey', label: 'Private key (optional)', kind: 'textarea' },
        { key: 'passphrase', label: 'Passphrase (optional)', kind: 'password' },
      ];
    if (type === 'generic')
      return [
        {
          key: 'mode',
          label: 'Content format',
          options: [
            { value: 'text', label: 'Text' },
            { value: 'pairs', label: 'Name/value pairs' },
          ],
        },
        ...(this.data()['mode'] === 'text'
          ? [{ key: 'text', label: 'Secret value', kind: 'textarea' }]
          : []),
      ];
    return [];
  });
  isRequired(key: string): boolean {
    const required: Record<string, string[]> = {
      database: ['engine', 'host', 'port', 'username', 'password'],
      password: ['username', 'password'],
      api_token:
        this.data()['mode'] === 'access_key'
          ? ['mode', 'accessKeyId', 'secretAccessKey']
          : ['mode', 'token'],
      certificate: ['certificate'],
      ssh_key: ['privateKey'],
      generic: ['mode', 'text'],
      runtime_env: [],
    };
    return (required[this.type()] ?? []).includes(key);
  }

  change(key: string, value: unknown) {
    let next = { ...this.data(), [key]: value };
    if (key === 'mode') next = { mode: value };
    if (key === 'engine') next['port'] = PORTS[String(value)];
    this.valueChange.emit(next);
  }
  toggle(key: string) {
    this.revealed.update((old) => {
      const next = new Set(old);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }
  pair(index: number, key: string, value: string) {
    this.valueChange.emit({
      ...this.data(),
      entries: this.entries().map((entry, i) => (i === index ? { ...entry, [key]: value } : entry)),
    });
  }
  add() {
    this.valueChange.emit({
      ...this.data(),
      entries: [...this.entries(), { name: '', value: '' }],
    });
  }
  remove(index: number) {
    this.valueChange.emit({
      ...this.data(),
      entries: this.entries().filter((_, i) => i !== index),
    });
  }
}
