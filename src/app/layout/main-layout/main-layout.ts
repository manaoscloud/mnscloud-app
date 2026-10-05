import { MatDialog } from '@angular/material/dialog';
// ==========================================================
// Layout: main-layout.ts
// ----------------------------------------------------------
// Menu lateral, Topbar, Tenant Switch, Responsividade,
// Avatar, Logout, Breadcrumb e integração com API.
// ==========================================================

import {
  Component,
  computed,
  DestroyRef,
  effect,
  HostBinding,
  inject,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';

import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// Shared
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb';
import { isSignedStorageUrl } from '../../shared/storage/signed-url';
import { NavigationLoadingService } from '../../shared/route-loader/navigation-loading.service';
import { AsyncOperationActivityComponent } from '../../shared/operations/async-operation-activity';
import { AsyncOperationsService } from '../../shared/operations/async-operations.service';

// Material
import { MatBadgeModule } from '@angular/material/badge';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

// Services
import { ThemeMode, ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';
import { NetworkService } from '../../services/network.service';
import { SessionService } from '../../services/session.service';
import { ApiService } from '../../services/api.service';
import { AppI18nService, AppLanguage, LanguageOptionCode } from '../../services/app-i18n.service';
import { RuntimeVersionService } from '../../services/runtime-version.service';
import { SystemParameterService } from '../../services/system-parameter.service';
import { BillingService } from '../../pages/billing/shared/billing.service';
import { SupportReportService } from '../../services/support-report.service';
import { MenuScope, NAV_ITEMS, NavItem } from '../navigation/nav-registry';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  extractEnvironmentAccess,
  normalizeEnvironmentUUID,
  readStoredEnvironmentUUID,
  resolveSelectedEnvironmentUUID,
  writeStoredEnvironmentUUID,
} from '../../core/environment/environment-context';

// =======================================================
// Types
// =======================================================

/** Localized menu entry; `path` is the full translated trail used for search and tooltips. */
interface ShellNavItem extends NavItem {
  path: string;
  children?: ShellNavItem[];
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

type ContextMode = 'master' | 'tenant';

export interface UserEnvironment {
  EnvironmentUUID: string;
  EnvironmentName: string;
  RoleCode: string;
  RoleName: string;
  Status: number;
  IsDefault?: number;
}

interface UserAccessResponse {
  status: string;
  message: string;
  data?: {
    access?: UserEnvironment[];
  };
}

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    BreadcrumbComponent,
    AsyncOperationActivityComponent,
    MatBadgeModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatButtonModule,
    MatToolbarModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss'],
})
export class MainLayout {
  // =======================================================
  // Injected Services
  // =======================================================
  private readonly themeService = inject(ThemeService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly network = inject(NetworkService);
  private readonly session = inject(SessionService);
  private readonly api = inject(ApiService);
  private readonly i18n = inject(AppI18nService);
  private readonly runtimeVersion = inject(RuntimeVersionService);
  private readonly parameters = inject(SystemParameterService);
  private readonly billing = inject(BillingService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly navigationLoadingService = inject(NavigationLoadingService);
  private readonly navigationEvent = toSignal(this.router.events, { initialValue: null });
  readonly asyncOperations = inject(AsyncOperationsService);
  private readonly reportService = inject(SupportReportService);
  private readonly dialogs = inject(MatDialog);

  // =======================================================
  // Signals — Core UI State
  // =======================================================
  readonly theme = this.themeService.theme;
  readonly themeOptions: { value: ThemeMode; label: string; icon: string }[] = [
    { value: 'light', label: 'topbar.themeLight', icon: 'light_mode' },
    { value: 'dark', label: 'topbar.themeDark', icon: 'dark_mode' },
    { value: 'system', label: 'topbar.themeSystem', icon: 'settings_suggest' },
  ];
  readonly user = this.auth.user;
  readonly online = this.network.online;

  readonly drawerOpened = signal(true);
  readonly drawerCompact = signal(false);
  readonly isDesktopCompact = computed(() => this.drawerCompact() && !this.isHandset());
  readonly compactHoverRootId = signal<string | null>(null);
  readonly compactHoverChildId = signal<string | null>(null);
  readonly compactHoverGrandId = signal<string | null>(null);
  readonly compactRootFlyoutTop = signal(8);
  readonly compactChildFlyoutTop = signal(8);
  readonly compactGrandFlyoutTop = signal(8);
  readonly compactFlyoutLeft = signal(92);
  readonly compactChildFlyoutLeft = signal(334);
  readonly compactGrandFlyoutLeft = signal(576);
  readonly compactRootFlyoutMaxHeight = signal(560);
  readonly compactChildFlyoutMaxHeight = signal(560);
  readonly compactGrandFlyoutMaxHeight = signal(560);
  readonly menuSearch = signal('');
  readonly isSearching = computed(() => this.menuSearch().trim().length > 0);
  readonly isHandset = signal(this.checkHandset());
  readonly currentYear = new Date().getFullYear();
  readonly expandedSections = signal<Set<string>>(new Set());
  readonly currentLanguage = this.i18n.language;
  readonly currentLanguageOption = this.i18n.selectedLanguageOption;
  readonly languageOptions = this.i18n.languageOptions;
  readonly appVersion = this.runtimeVersion.appVersion;
  readonly navigationLoading = this.navigationLoadingService.isNavigating;

  // =======================================================
  // Tenant Signals
  // =======================================================
  readonly environments = signal<UserEnvironment[]>([]);
  readonly activeEnvironmentId = signal<string | null>(null);
  readonly commercialEntitlements = signal<string[]>([]);
  readonly loadingEnvironments = signal<boolean>(false);
  readonly contextMode = signal<ContextMode>(this.readInitialContextMode());
  readonly isMasterUser = computed(() => {
    const user = this.user();
    return (user?.permissions ?? []).includes('platform.master.access');
  });
  readonly effectiveContextMode = computed<ContextMode>(() =>
    this.isMasterUser() ? this.contextMode() : 'tenant',
  );

  readonly currentEnvironment = computed(() => {
    const list = this.environments();
    const id = this.activeEnvironmentId();
    return list.find((e) => e.EnvironmentUUID === id) ?? null;
  });

  readonly currentEnvironmentName = computed(
    () => this.currentEnvironment()?.EnvironmentName ?? this.i18n.t('layout.noEnvironment'),
  );

  private static readonly CONTEXT_MODE_STORAGE_KEY = 'mc_context_mode';
  private static readonly LAYOUT_COMPACT_STORAGE_KEY = 'mc_layout_compact';
  private compactCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private autoExpandScheduled = false;

  @HostBinding('class')
  themeClass = '';

  constructor() {
    // Atualiza tema automaticamente
    effect(() => {
      this.themeClass = `${this.theme()}-theme`;
    });

    effect(() => {
      this.localizedNavItems();
      this.scheduleAutoExpandSections();
    });

    effect(() => {
      this.billing.entitlementRevision();
      if (this.auth.isLoggedIn() && this.activeEnvironmentId()) {
        void this.refreshCommercialEntitlements();
      }
    });

    effect(() => {
      if (this.auth.isLoggedIn()) return;
      this.activeEnvironmentId.set(null);
      this.environments.set([]);
      this.commercialEntitlements.set([]);
      this.closeCompactFlyouts();
    });

    // Responsividade
    if (typeof window !== 'undefined') {
      const compactStored = localStorage.getItem(MainLayout.LAYOUT_COMPACT_STORAGE_KEY) === '1';
      if (compactStored && !this.checkHandset()) {
        this.drawerCompact.set(true);
      }

      const resize = () => {
        const mobile = this.checkHandset();
        const wasHandset = this.isHandset();
        this.isHandset.set(mobile);

        if (mobile) {
          this.drawerOpened.set(false);
          this.drawerCompact.set(false);
          this.closeCompactFlyouts();
        } else if (wasHandset) {
          this.drawerOpened.set(true);
          const restoreCompact =
            localStorage.getItem(MainLayout.LAYOUT_COMPACT_STORAGE_KEY) === '1';
          this.drawerCompact.set(restoreCompact);
          this.closeCompactFlyouts();
        }
      };

      resize();
      window.addEventListener('resize', resize);
      this.destroyRef.onDestroy(() => window.removeEventListener('resize', resize));
    }

    // Auto expand menus
    effect(() => {
      const event = this.navigationEvent();
      if (event instanceof NavigationEnd) {
        this.scheduleAutoExpandSections();
        void this.refreshCommercialEntitlements();
      }
    });

    this.destroyRef.onDestroy(() => this.clearCompactCloseTimer());
    this.scheduleAutoExpandSections();

    // Carrega environments (tenants)
    this.initEnvironments();
    void this.runtimeVersion.refresh();

    effect(() => {
      const loggedIn = this.auth.isLoggedIn();
      const tenant = this.activeEnvironmentId();
      const master = this.effectiveContextMode() === 'master';
      if (!loggedIn || (!tenant && !master)) return;
      void this.asyncOperations.resume(this.destroyRef);
    });
  }

  // =======================================================
  // Responsividade
  // =======================================================
  private checkHandset(): boolean {
    return typeof window !== 'undefined' && window.innerWidth <= 960;
  }

  toggleDrawer() {
    if (this.isHandset()) {
      this.drawerOpened.set(!this.drawerOpened());
      return;
    }

    this.closeCompactFlyouts();
    this.setDesktopCompact(!this.drawerCompact());
  }

  closeDrawerOnMobile() {
    if (this.isHandset()) this.drawerOpened.set(false);
  }

  // =======================================================
  // Navegação e Menu
  // =======================================================
  isActiveRoute(route?: string): boolean {
    if (!route) return false;
    const normalize = (url: string) => {
      const path = url.split(/[?#]/)[0]?.replace(/\/+$/, '');
      return path || '/';
    };

    return normalize(this.router.url) === normalize(route);
  }

  private routeForItem(item: NavItem): string | undefined {
    const scope = item.scope ?? 'public';
    const mode = this.effectiveContextMode();

    if (scope === 'public') return item.route;
    if (scope === 'master') {
      return this.isMasterUser() && mode === 'master' ? item.masterRoute : undefined;
    }
    if (scope === 'both') {
      if (this.isMasterUser() && mode === 'master') return item.masterRoute;
      return item.route;
    }
    return mode === 'tenant' ? item.route : undefined;
  }

  isActiveItem(item: NavItem): boolean {
    return this.isActiveRoute(item.route) || this.isActiveRoute(item.masterRoute);
  }

  isActiveSection(item: NavItem): boolean {
    return (
      this.isActiveRoute(item.route) ||
      this.isActiveRoute(item.masterRoute) ||
      (item.children?.some((child) => this.isActiveSection(child)) ?? false)
    );
  }

  autoExpandSections() {
    const expanded = new Set<string>();
    const scan = (items: NavItem[]) => {
      for (const it of items) {
        if (this.isActiveSection(it)) expanded.add(it.id);
        if (it.children) scan(it.children);
      }
    };
    scan(this.localizedNavItems());
    this.expandedSections.set(expanded);
  }

  private scheduleAutoExpandSections() {
    if (this.autoExpandScheduled) return;
    this.autoExpandScheduled = true;

    queueMicrotask(() => {
      this.autoExpandScheduled = false;
      this.autoExpandSections();
    });
  }

  isExpanded(id: string) {
    return this.expandedSections().has(id);
  }

  toggleSection(id: string) {
    const current = new Set(this.expandedSections());
    if (current.has(id)) current.delete(id);
    else current.add(id);
    this.expandedSections.set(current);
  }

  async navigateTo(item: NavItem) {
    const route = this.routeForItem(item);
    if (!route) return;
    await this.router.navigate([route]);
    this.closeDrawerOnMobile();
  }

  onRootItemClick(item: NavItem) {
    if (!this.isHandset() && this.drawerCompact() && item.children?.length) {
      this.onCompactRootEnter(item);
      return;
    }

    if (item.children?.length) this.toggleSection(item.id);
    else this.navigateTo(item);
  }

  private setDesktopCompact(enabled: boolean) {
    this.drawerCompact.set(enabled);
    this.closeCompactFlyouts();

    if (typeof localStorage !== 'undefined') {
      if (enabled) {
        localStorage.setItem(MainLayout.LAYOUT_COMPACT_STORAGE_KEY, '1');
      } else {
        localStorage.removeItem(MainLayout.LAYOUT_COMPACT_STORAGE_KEY);
      }
    }
  }

  readonly compactHoverRootItem = computed(() => {
    if (!this.isDesktopCompact()) return null;
    const id = this.compactHoverRootId();
    if (!id) return null;
    return this.localizedNavItems().find((item) => item.id === id) ?? null;
  });

  readonly compactHoverChildItem = computed(() => {
    const root = this.compactHoverRootItem();
    const id = this.compactHoverChildId();
    if (!root || !id) return null;
    return root.children?.find((child) => child.id === id) ?? null;
  });

  readonly compactHoverGrandItem = computed(() => {
    const child = this.compactHoverChildItem();
    const id = this.compactHoverGrandId();
    if (!child || !id) return null;
    return child.children?.find((grand) => grand.id === id) ?? null;
  });

  onCompactRootEnter(item: NavItem, event?: MouseEvent) {
    if (!this.isDesktopCompact()) return;

    this.clearCompactCloseTimer();

    if (!item.children?.length) {
      this.closeCompactFlyouts();
      return;
    }

    this.compactHoverRootId.set(item.id);
    this.compactHoverChildId.set(null);
    this.compactHoverGrandId.set(null);
    const placement = this.computeFlyoutPlacement(event, item.children?.length ?? 0);
    this.compactRootFlyoutTop.set(placement.top);
    this.compactFlyoutLeft.set(placement.left);
    this.compactRootFlyoutMaxHeight.set(placement.maxHeight);
  }

  onCompactRootLeave() {
    this.scheduleCompactClose();
  }

  onCompactChildEnter(item: NavItem, event?: MouseEvent) {
    this.clearCompactCloseTimer();

    if (!item.children?.length) {
      this.compactHoverChildId.set(null);
      this.compactHoverGrandId.set(null);
      return;
    }

    this.compactHoverChildId.set(item.id);
    this.compactHoverGrandId.set(null);
    const placement = this.computeFlyoutPlacement(event, item.children?.length ?? 0);
    this.compactChildFlyoutTop.set(placement.top);
    this.compactChildFlyoutLeft.set(placement.left);
    this.compactChildFlyoutMaxHeight.set(placement.maxHeight);
  }

  onCompactGrandEnter(item: NavItem, event?: MouseEvent) {
    this.clearCompactCloseTimer();

    if (!item.children?.length) {
      this.compactHoverGrandId.set(null);
      return;
    }

    this.compactHoverGrandId.set(item.id);
    const placement = this.computeFlyoutPlacement(event, item.children?.length ?? 0);
    this.compactGrandFlyoutTop.set(placement.top);
    this.compactGrandFlyoutLeft.set(placement.left);
    this.compactGrandFlyoutMaxHeight.set(placement.maxHeight);
  }

  onCompactFlyoutEnter() {
    this.clearCompactCloseTimer();
  }

  onCompactFlyoutLeave() {
    this.scheduleCompactClose();
  }

  async onCompactFlyoutNavigate(item: NavItem) {
    await this.navigateTo(item);
    this.closeCompactFlyouts();
  }

  private computeFlyoutPlacement(event: MouseEvent | undefined, itemCount: number) {
    const target = event?.currentTarget as HTMLElement | null;
    if (!target || typeof window === 'undefined') {
      return {
        top: this.compactRootFlyoutTop(),
        left: this.compactFlyoutLeft(),
        maxHeight: this.compactRootFlyoutMaxHeight(),
      };
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const margin = 16;
    const gap = 8;
    const flyoutWidth = 234;
    const maxFlyoutHeight = Math.min(560, Math.max(112, viewportHeight - margin * 2));
    const estimatedHeight = Math.min(Math.max(itemCount * 42 + 18, 112), maxFlyoutHeight);
    const targetRect = target.getBoundingClientRect();
    const sidenav = target.closest('mat-sidenav') as HTMLElement | null;
    const sidenavRect = sidenav?.getBoundingClientRect();
    const preferredTop = targetRect.top;
    const maxTop = Math.max(margin, viewportHeight - estimatedHeight - margin);
    const preferredLeft =
      target.classList.contains('root-item') && sidenavRect
        ? sidenavRect.right + gap
        : targetRect.right + gap;
    const fallbackLeft = targetRect.left - flyoutWidth - gap;
    const maxLeft = Math.max(margin, viewportWidth - flyoutWidth - margin);
    const left =
      preferredLeft <= maxLeft ? preferredLeft : Math.max(margin, Math.min(fallbackLeft, maxLeft));

    return {
      top: Math.round(Math.max(margin, Math.min(preferredTop, maxTop))),
      left: Math.round(left),
      maxHeight: Math.round(maxFlyoutHeight),
    };
  }

  private scheduleCompactClose() {
    this.clearCompactCloseTimer();
    this.compactCloseTimer = setTimeout(() => this.closeCompactFlyouts(), 140);
  }

  private clearCompactCloseTimer() {
    if (!this.compactCloseTimer) return;
    clearTimeout(this.compactCloseTimer);
    this.compactCloseTimer = null;
  }

  private closeCompactFlyouts() {
    this.clearCompactCloseTimer();
    this.compactHoverRootId.set(null);
    this.compactHoverChildId.set(null);
    this.compactHoverGrandId.set(null);
  }

  // =======================================================
  // ✅ MENU: autoridade de plataforma vs tenant
  // =======================================================
  private currentKnownEnvironmentUUID(): string | null {
    return (
      normalizeEnvironmentUUID(this.activeEnvironmentId()) ??
      readStoredEnvironmentUUID() ??
      normalizeEnvironmentUUID(this.auth.user()?.EnvironmentUUID)
    );
  }

  private hasTenantSelected(): boolean {
    return !!this.currentKnownEnvironmentUUID();
  }

  private readInitialContextMode(): ContextMode {
    if (typeof localStorage === 'undefined') return 'master';
    return localStorage.getItem(MainLayout.CONTEXT_MODE_STORAGE_KEY) === 'tenant'
      ? 'tenant'
      : 'master';
  }

  setContextMode(mode: ContextMode) {
    if (!this.isMasterUser()) return;
    this.contextMode.set(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MainLayout.CONTEXT_MODE_STORAGE_KEY, mode);
    }
    this.closeCompactFlyouts();
    void this.refreshCommercialEntitlements();
    this.scheduleAutoExpandSections();
  }

  contextModeLabel() {
    return this.i18n.t(
      this.effectiveContextMode() === 'master' ? 'topbar.system' : 'topbar.tenant',
    );
  }

  private hasPermission(required: string): boolean {
    const normalizedRequired = required.toLowerCase();
    const permissions = this.user()?.permissions ?? [];
    return permissions.some((permission) => {
      const normalizedPermission = String(permission ?? '').toLowerCase();
      if (normalizedPermission === normalizedRequired) return true;
      if (normalizedPermission === 'platform.master.access') return true;
      if (normalizedPermission === 'tenant.*' && normalizedRequired.startsWith('tenant.'))
        return true;
      if (!normalizedPermission.includes('*')) return false;
      const pattern = `^${normalizedPermission
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')}$`;
      return new RegExp(pattern).test(normalizedRequired);
    });
  }

  private hasPermissions(item: NavItem): boolean {
    if (!item.permissions || item.permissions.length === 0) return true;
    return item.permissions.every((permission) => this.hasPermission(permission));
  }

  private canShowByEnvironment(item: NavItem): boolean {
    const scope = item.scope ?? 'public';
    const mode = this.effectiveContextMode();

    if (scope === 'public') return true;
    if (scope === 'master') return this.isMasterUser() && mode === 'master';
    if (scope === 'both') {
      if (this.isMasterUser() && mode === 'master') return !!item.masterRoute;
      return !!item.route && (!this.isMasterUser() || this.hasTenantSelected());
    }
    if (scope === 'tenant') {
      return mode === 'tenant' && (!this.isMasterUser() || this.hasTenantSelected());
    }
    return false;
  }

  private resolveMenuScope(item: NavItem, inheritedScope?: MenuScope): MenuScope {
    if (item.scope) return item.scope;
    if (item.masterRoute && item.route) return 'both';
    if (item.masterRoute) return 'master';
    if (item.requiresEnvironment) return 'tenant';
    return inheritedScope ?? 'public';
  }

  private hasCommercialEntitlement(required?: string): boolean {
    if (!required) return true;
    if (this.isMasterUser() && this.effectiveContextMode() === 'master') return true;

    const normalizedRequired = required.toLowerCase();
    const requiredModulePrefix = normalizedRequired.endsWith('.*')
      ? normalizedRequired.slice(0, -1)
      : null;
    return this.commercialEntitlements().some((grant) => {
      const normalizedGrant = grant.toLowerCase();
      if (normalizedGrant === normalizedRequired) return true;
      if (
        requiredModulePrefix &&
        !normalizedGrant.includes('*') &&
        normalizedGrant.startsWith(requiredModulePrefix)
      ) {
        return true;
      }
      if (!normalizedGrant.includes('*')) return false;
      const pattern = `^${normalizedGrant
        .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
        .replace(/\*/g, '.*')}$`;
      return new RegExp(pattern).test(normalizedRequired);
    });
  }

  private filterMenu(
    items: NavItem[],
    inheritedScope?: MenuScope,
    inheritedEntitlement?: string,
  ): NavItem[] {
    return items
      .map((i) => {
        const scope = this.resolveMenuScope(i, inheritedScope);
        const entitlementCode = i.entitlementCode ?? inheritedEntitlement;
        const scopedItem = { ...i, scope };

        if (!this.hasPermissions(scopedItem)) return null;

        // 2) Commercial entitlement projection. API remains the source of truth.
        if (scope === 'tenant' || scope === 'both') {
          if (!this.hasCommercialEntitlement(entitlementCode)) return null;
        }

        // 3) Filtra filhos antes do escopo do grupo, porque grupos tenant podem conter filhos both.
        const children = scopedItem.children
          ? this.filterMenu(scopedItem.children, scope, entitlementCode)
          : undefined;

        // Se era grupo e perdeu todos os filhos, remove
        if (scopedItem.children?.length && (!children || children.length === 0)) return null;

        // 4) Escopo/contexto
        if (!scopedItem.children?.length && !this.canShowByEnvironment(scopedItem)) return null;

        return { ...scopedItem, children };
      })
      .filter(Boolean) as NavItem[];
  }

  // menu final (filtrado)
  readonly localizedNavItems = computed(() => {
    this.i18n.language();
    return this.localizeMenu(this.filterMenu(this.navItemsRaw));
  });

  // Getter filtrado por busca (usa o menu filtrado)
  // Labels are short and contextual, so search matches the full localized path
  // (for example "Suporte › Chamados › Origens" for "chamado origens").
  get filteredNavItems(): ShellNavItem[] {
    const terms = normalizeSearchText(this.menuSearch()).split(/\s+/).filter(Boolean);
    const base = this.localizedNavItems();

    if (!terms.length) return base;

    const filter = (items: ShellNavItem[]): ShellNavItem[] =>
      items
        .map((i) => {
          const path = normalizeSearchText(i.path);
          const match = terms.every((term) => path.includes(term));
          const children = i.children ? filter(i.children) : undefined;
          if (match || (children && children.length)) return { ...i, children };
          return null;
        })
        .filter(Boolean) as ShellNavItem[];

    return filter(base);
  }

  // =======================================================
  // Avatar
  // =======================================================
  readonly avatarUrl = computed(() => {
    const u = this.user();
    if (!u?.avatarUrl) return null;
    if (isSignedStorageUrl(u.avatarUrl)) return u.avatarUrl;
    const version = u.avatarVersion ?? 0;
    return `${u.avatarUrl}${u.avatarUrl.includes('?') ? '&' : '?'}v=${version}`;
  });

  get avatarLetter() {
    const u = this.user();
    return u?.firstName?.[0]?.toUpperCase() || u?.email?.[0]?.toUpperCase() || 'U';
  }

  readonly greeting = computed(() => {
    const h = new Date().getHours();
    return h < 12
      ? this.i18n.t('greeting.morning')
      : h < 18
        ? this.i18n.t('greeting.afternoon')
        : this.i18n.t('greeting.evening');
  });

  readonly currentLanguageLabel = computed(
    () =>
      this.languageOptions.find((lang) => lang.code === this.currentLanguageOption())?.labelKey ??
      'lang.english',
  );

  // =======================================================
  // Tema
  // =======================================================
  changeTheme(mode: ThemeMode) {
    this.themeService.setTheme(mode);
  }

  openSupportReport() {
    void this.reportService.openReportDialog();
  }

  changeLanguage(language: LanguageOptionCode) {
    if (language === 'auto') {
      this.i18n.useSystemLanguage(true);
      return;
    }
    this.i18n.setLanguage(language as AppLanguage, true);
  }

  // =======================================================
  // Tenant Switch
  // =======================================================
  private async initEnvironments() {
    this.loadingEnvironments.set(true);

    try {
      const resp = await this.api.get<UserAccessResponse>('user/access');
      const list = extractEnvironmentAccess(resp);

      this.environments.set(list);

      if (!list.length) {
        const preservedEnv = this.currentKnownEnvironmentUUID();
        this.activeEnvironmentId.set(preservedEnv);

        if (preservedEnv) {
          writeStoredEnvironmentUUID(preservedEnv);
          this.auth.updateUser({ EnvironmentUUID: preservedEnv });
        } else {
          this.auth.updateUser({ EnvironmentUUID: null });
          writeStoredEnvironmentUUID(null);
        }

        return;
      }

      const finalEnv = resolveSelectedEnvironmentUUID(
        list,
        readStoredEnvironmentUUID() ?? this.auth.user()?.EnvironmentUUID,
      );
      if (!finalEnv) return;

      this.activeEnvironmentId.set(finalEnv);
      writeStoredEnvironmentUUID(finalEnv);

      // Keeps AuthService coherent with the selected environment for guards.
      this.auth.updateUser({
        EnvironmentUUID: finalEnv,
      });
      await this.syncEnvironmentLanguage();
      await this.refreshCommercialEntitlements();
    } catch (e) {
      console.error('❌ Failed to load environments:', e);
      this.environments.set([]);

      const preservedEnv =
        readStoredEnvironmentUUID() ?? normalizeEnvironmentUUID(this.auth.user()?.EnvironmentUUID);
      this.activeEnvironmentId.set(preservedEnv);
      if (preservedEnv) {
        this.auth.updateUser({ EnvironmentUUID: preservedEnv });
        await this.syncEnvironmentLanguage();
        await this.refreshCommercialEntitlements();
      } else {
        this.commercialEntitlements.set([]);
      }
    } finally {
      this.loadingEnvironments.set(false);
    }
  }

  async switchEnvironment(env: UserEnvironment) {
    const environmentUUID = normalizeEnvironmentUUID(env?.EnvironmentUUID);
    if (!environmentUUID || environmentUUID === this.activeEnvironmentId()) return;

    this.dialogs.closeAll();
    this.reportService.clearDraft();
    this.activeEnvironmentId.set(environmentUUID);
    writeStoredEnvironmentUUID(environmentUUID);
    if (this.isMasterUser()) {
      this.setContextMode('tenant');
    }

    // Mantém AuthService sincronizado (guards/menu)
    this.auth.updateUser({
      EnvironmentUUID: environmentUUID,
    });
    await this.syncEnvironmentLanguage();
    await this.refreshCommercialEntitlements();
    this.router.navigate(['/dashboard']);
  }

  private async syncEnvironmentLanguage() {
    if (this.i18n.languageMode() !== 'auto') return;
    this.parameters.clearCache('DEFAULT_LANGUAGE');
    try {
      const language = await this.parameters.resolveDefaultLanguage(this.currentLanguage());
      this.i18n.applyResolvedSystemLanguage(language);
    } catch (error) {
      console.error('❌ Failed to resolve default environment language:', error);
    }
  }

  private async refreshCommercialEntitlements() {
    if (!this.auth.isLoggedIn() || this.isLoggingOut() || !this.activeEnvironmentId()) {
      this.commercialEntitlements.set([]);
      return;
    }
    if (this.isMasterUser() && this.effectiveContextMode() === 'master') {
      this.commercialEntitlements.set([]);
      return;
    }
    try {
      const grants = await this.billing.listEntitlementGrants();
      if (!this.auth.isLoggedIn() || this.isLoggingOut()) return;
      this.commercialEntitlements.set(grants.map((grant) => grant.entitlementCode).filter(Boolean));
    } catch (error) {
      if (
        !this.auth.isLoggedIn() ||
        this.isLoggingOut() ||
        (error instanceof HttpErrorResponse && error.status === 401)
      ) {
        this.commercialEntitlements.set([]);
        return;
      }
      console.error('❌ Failed to load commercial entitlements:', error);
      this.commercialEntitlements.set([]);
    }
  }

  async setDefaultEnvironment(env: UserEnvironment, event?: Event) {
    event?.stopPropagation();
    event?.preventDefault();

    if (!env || Number(env.IsDefault ?? 0) === 1) return;

    try {
      await this.api.post<any>('user/access/default', { environmentUUID: env.EnvironmentUUID });

      this.environments.update((list) =>
        list.map((item) => ({
          ...item,
          IsDefault: item.EnvironmentUUID === env.EnvironmentUUID ? 1 : 0,
        })),
      );
    } catch (err) {
      console.error('❌ Failed to set default environment:', err);
    }
  }

  // =======================================================
  // Logout
  // =======================================================
  isLoggingOut = signal(false);

  async logout() {
    if (this.isLoggingOut()) return;
    this.isLoggingOut.set(true);
    this.commercialEntitlements.set([]);
    this.activeEnvironmentId.set(null);
    this.environments.set([]);
    try {
      await this.api.post('auth/signout', {});
    } catch (error) {
      console.warn('Failed to revoke remote session during logout.', error);
    }
    this.auth.logout();
    await new Promise((r) => setTimeout(r, 120));
    this.router.navigate(['/signin']);
    this.isLoggingOut.set(false);
  }

  private localizeMenu(items: NavItem[], parentPath = ''): ShellNavItem[] {
    return items.map((item) => {
      const label = this.i18n.t(item.label);
      const path = parentPath ? `${parentPath} › ${label}` : label;
      return {
        ...item,
        label,
        path,
        children: item.children ? this.localizeMenu(item.children, path) : undefined,
      };
    });
  }

  // =======================================================
  // Menu Data (RAW) — see layout/navigation/nav-registry.ts
  // =======================================================
  readonly navItemsRaw: NavItem[] = NAV_ITEMS;
}
