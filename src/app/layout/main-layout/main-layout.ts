// ==========================================================
// Layout: main-layout.ts
// ----------------------------------------------------------
// Menu lateral, Topbar, Tenant Switch, Responsividade,
// Avatar, Logout, Breadcrumb e integração com API.
// ==========================================================

import {
  Component,
  signal,
  computed,
  inject,
  HostBinding,
  effect,
  DestroyRef,
} from '@angular/core';

import { Router, RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

// Shared
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb';
import { isSignedStorageUrl } from '../../shared/storage/signed-url';

// Material
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatButtonModule } from '@angular/material/button';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';

// Services
import { ThemeService } from '../../services/theme.service';
import { AuthService, AppRole } from '../../services/auth.service';
import { NetworkService } from '../../services/network.service';
import { SessionService } from '../../services/session.service';
import { ApiService } from '../../services/api.service';
import { AppI18nService, AppLanguage, LanguageOptionCode } from '../../services/app-i18n.service';
import { RuntimeVersionService } from '../../services/runtime-version.service';
import { SystemParameterService } from '../../services/system-parameter.service';
import { BillingService } from '../../pages/billing/shared/billing.service';
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

interface NavItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  masterRoute?: string;
  scope?: MenuScope;
  entitlementCode?: string;
  children?: NavItem[];

  // ✅ Controle de visibilidade por role
  roles?: AppRole[];

  // ✅ Controle de visibilidade por TENANT (exige EnvironmentUUID selecionado)
  requiresEnvironment?: boolean;
}

type ContextMode = 'master' | 'tenant';
type MenuScope = 'public' | 'tenant' | 'master' | 'both';

export interface UserEnvironment {
  EnvironmentUUID: string;
  EnvironmentName: string;
  Role: string;
  Status: number;
  IsDefault?: number;
  Master?: number;
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
  private readonly navigationEvent = toSignal(this.router.events, { initialValue: null });

  // =======================================================
  // Signals — Core UI State
  // =======================================================
  readonly theme = this.themeService.theme;
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

  // =======================================================
  // Tenant Signals
  // =======================================================
  readonly environments = signal<UserEnvironment[]>([]);
  readonly activeEnvironmentId = signal<string | null>(null);
  readonly commercialEntitlements = signal<string[]>([]);
  readonly loadingEnvironments = signal<boolean>(false);
  readonly contextMode = signal<ContextMode>(this.readInitialContextMode());
  readonly isMasterUser = computed(() => this.user()?.role === 'MASTER');
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

  @HostBinding('class') themeClass = '';

  constructor() {
    // Atualiza tema automaticamente
    effect(() => {
      this.themeClass = `${this.theme()}-theme`;
    });

    effect(() => {
      this.localizedNavItems();
      this.scheduleAutoExpandSections();
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
      if (event instanceof NavigationEnd) this.scheduleAutoExpandSections();
    });

    this.destroyRef.onDestroy(() => this.clearCompactCloseTimer());
    this.scheduleAutoExpandSections();

    // Carrega environments (tenants)
    this.initEnvironments();
    void this.runtimeVersion.refresh();
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
    if (scope === 'master')
      return this.isMasterUser() && mode === 'master' ? item.masterRoute : undefined;
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
  // ✅ MENU: MASTER vs TENANT
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
    return this.effectiveContextMode() === 'master' ? 'System' : 'Tenant';
  }

  private currentRole(): AppRole | null {
    const role = String(this.user()?.role ?? '').toUpperCase();
    if (role === 'MASTER' || role === 'OWNER' || role === 'ADMIN' || role === 'USER') {
      return role;
    }

    return this.auth.isLoggedIn() ? 'USER' : null;
  }

  private hasRole(item: NavItem): boolean {
    const role = this.currentRole();

    // MASTER enxerga tudo
    if (role === 'MASTER') return true;

    // Se não tem roles, aparece para todos
    if (!item.roles || item.roles.length === 0) return true;

    // Se o user ainda não carregou role, esconde itens restritos
    if (!role) return false;

    return item.roles.includes(role);
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
    if (scope === 'tenant')
      return mode === 'tenant' && (!this.isMasterUser() || this.hasTenantSelected());
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
    return this.commercialEntitlements().some((grant) => {
      const normalizedGrant = grant.toLowerCase();
      if (normalizedGrant === normalizedRequired) return true;
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

        // 1) Role
        if (!this.hasRole(scopedItem)) return null;

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
  get filteredNavItems(): NavItem[] {
    const q = this.menuSearch().trim().toLowerCase();
    const base = this.localizedNavItems();

    if (!q) return base;

    const filter = (items: NavItem[]): NavItem[] =>
      items
        .map((i) => {
          const match = i.label.toLowerCase().includes(q);
          const children = i.children ? filter(i.children) : undefined;
          if (match || (children && children.length)) return { ...i, children };
          return null;
        })
        .filter(Boolean) as NavItem[];

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
  changeTheme() {
    this.themeService.toggleTheme();
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

      const selectedEnv = list.find((t) => t.EnvironmentUUID === finalEnv) ?? null;
      const selectedRole = selectedEnv
        ? Number(selectedEnv.Master ?? 0) === 1
          ? 'MASTER'
          : selectedEnv.Role
        : undefined;

      // ✅ mantém AuthService coerente (menu/guards)
      this.auth.updateUser({
        EnvironmentUUID: finalEnv,
        role:
          (this.auth.user()?.role === 'MASTER'
            ? 'MASTER'
            : (selectedRole as AppRole | undefined)) ??
          this.auth.user()?.role ??
          'USER',
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

    this.activeEnvironmentId.set(environmentUUID);
    writeStoredEnvironmentUUID(environmentUUID);
    if (this.isMasterUser()) {
      this.setContextMode('tenant');
    }

    // ✅ Mantém AuthService sincronizado (guards/menu)
    this.auth.updateUser({
      EnvironmentUUID: environmentUUID,
      role:
        (this.auth.user()?.role === 'MASTER'
          ? 'MASTER'
          : ((Number(env.Master ?? 0) === 1 ? 'MASTER' : env.Role) as AppRole | undefined)) ??
        this.auth.user()?.role ??
        'USER',
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
    if (!this.activeEnvironmentId()) {
      this.commercialEntitlements.set([]);
      return;
    }
    if (this.isMasterUser() && this.effectiveContextMode() === 'master') {
      this.commercialEntitlements.set([]);
      return;
    }
    try {
      const grants = await this.billing.listEntitlementGrants();
      this.commercialEntitlements.set(grants.map((grant) => grant.entitlementCode).filter(Boolean));
    } catch (error) {
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
    this.auth.logout();
    await new Promise((r) => setTimeout(r, 120));
    this.router.navigate(['/signin']);
    this.isLoggingOut.set(false);
  }

  private localizeMenu(items: NavItem[]): NavItem[] {
    return items.map((item) => ({
      ...item,
      label: this.i18n.t(item.label),
      children: item.children ? this.localizeMenu(item.children) : undefined,
    }));
  }

  // =======================================================
  // Menu Data (RAW)
  // =======================================================
  readonly navItemsRaw: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },
    {
      id: 'billing',
      label: 'Billing',
      icon: 'account_balance_wallet',
      children: [
        {
          id: 'billing/dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          route: '/billing',
          masterRoute: '/system/billing',
        },
        {
          id: 'billing/catalog-products',
          label: 'Products',
          icon: 'storefront',
          route: '/billing/catalog',
          masterRoute: '/system/billing/products',
        },
        {
          id: 'billing/prices',
          label: 'Prices',
          icon: 'sell',
          masterRoute: '/system/billing/prices',
        },
        {
          id: 'billing/packages',
          label: 'Packages',
          icon: 'redeem',
          masterRoute: '/system/billing/packages',
        },
        {
          id: 'billing/promotions',
          label: 'Promotions',
          icon: 'local_offer',
          masterRoute: '/system/billing/promotions',
        },
        {
          id: 'billing/subscriptions',
          label: 'Subscriptions',
          icon: 'subscriptions',
          route: '/billing/subscriptions',
          masterRoute: '/system/billing/subscriptions',
        },
        {
          id: 'billing/ledger-wallets',
          label: 'Ledger',
          icon: 'receipt_long',
          route: '/billing/ledger',
          masterRoute: '/system/billing/wallets',
        },
      ],
    },

    {
      id: 'user',
      label: 'User',
      icon: 'person',
      children: [
        { id: 'user/profile', label: 'My Profile', icon: 'badge', route: '/user/profile' },
        {
          id: 'user/governance',
          label: 'Governance',
          icon: 'manage_accounts',
          masterRoute: '/system/governance/users',
        },
      ],
    },

    // ✅ ERP (tenant; MASTER usa rotas globais quando disponível)
    {
      id: 'erp',
      label: 'ERP',
      icon: 'apps',
      entitlementCode: 'module.erp.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        {
          id: 'erp/registration',
          label: 'Registration',
          icon: 'assignment',
          children: [
            { id: 'erp/companies', label: 'Companies', icon: 'apartment', route: '/erp/companies' },
            { id: 'erp/customer', label: 'Customer', icon: 'person', route: '/erp/customer' },
            { id: 'erp/supplier', label: 'Supplier', icon: 'inventory_2', route: '/erp/supplier' },
            { id: 'erp/carrier', label: 'Carrier', icon: 'local_shipping', route: '/erp/carrier' },
            { id: 'erp/reseller', label: 'Reseller', icon: 'storefront', route: '/erp/reseller' },
            { id: 'erp/complex', label: 'Complex', icon: 'location_city', route: '/erp/complex' },
          ],
        },
        {
          id: 'erp/financial',
          label: 'Financial',
          icon: 'account_balance',
          children: [
            {
              id: 'erp/financial/accounts',
              label: 'Accounts',
              icon: 'account_balance_wallet',
              children: [
                {
                  id: 'erp/financial/account/payables',
                  label: 'Payables',
                  icon: 'payments',
                  route: '/erp/financial/account/payables',
                },
                {
                  id: 'erp/financial/account/receivables',
                  label: 'Receivables',
                  icon: 'receipt_long',
                  route: '/erp/financial/account/receivables',
                },
              ],
            },
            {
              id: 'erp/financial/payment',
              label: 'Payment',
              icon: 'payments',
              children: [
                {
                  id: 'erp/financial/payment-method',
                  label: 'Methods',
                  icon: 'tune',
                  route: '/erp/financial/payment-method',
                },
                {
                  id: 'erp/financial/payment-gateway',
                  label: 'Gateway',
                  icon: 'credit_card',
                  route: '/erp/financial/payment-gateway',
                  masterRoute: '/system/payment-gateway',
                },
              ],
            },
          ],
        },
        {
          id: 'erp/financial/invoicing',
          label: 'Invoicing',
          icon: 'receipt_long',
          children: [
            {
              id: 'erp/financial/invoicing/boletos',
              label: 'Boletos',
              icon: 'receipt',
              route: '/erp/financial/invoicing/boletos',
            },
            {
              id: 'erp/financial/invoicing/invoices',
              label: 'Invoices',
              icon: 'request_quote',
              route: '/erp/financial/invoicing/invoices',
            },
            {
              id: 'erp/financial/invoicing/contracts',
              label: 'Contracts',
              icon: 'description',
              route: '/erp/financial/invoicing/contracts',
            },
            {
              id: 'erp/financial/invoicing/duedays',
              label: 'Due Days',
              icon: 'event_repeat',
              route: '/erp/financial/invoicing/duedays',
            },
          ],
        },
        {
          id: 'erp/human-resources',
          label: 'Human Resources',
          icon: 'groups',
          children: [
            {
              id: 'erp/human-resources/employees',
              label: 'Employees',
              icon: 'badge',
              route: '/erp/human-resources/employees',
            },
            {
              id: 'erp/human-resources/time-clock-accounts',
              label: 'Time Clock Accounts',
              icon: 'schedule',
              route: '/erp/human-resources/time-clock-accounts',
            },
            {
              id: 'erp/human-resources/departments',
              label: 'Departments',
              icon: 'account_tree',
              route: '/erp/human-resources/departments',
            },
            {
              id: 'erp/human-resources/positions',
              label: 'Positions',
              icon: 'work',
              route: '/erp/human-resources/positions',
            },
          ],
        },
      ],
    },

    // ✅ ISP (tenant; MASTER usa rotas globais quando disponível)
    {
      id: 'isp',
      label: 'ISP',
      icon: 'network_check',
      entitlementCode: 'module.isp.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        { id: 'isp/pop', label: 'POP', icon: 'location_on', route: '/isp/pop' },
        { id: 'isp/nas', label: 'NAS', icon: 'router', route: '/isp/nas' },
        { id: 'isp/olt', label: 'OLT', icon: 'settings_input_antenna', route: '/isp/olt' },
        {
          id: 'isp/pool-ip',
          label: 'Pool IP',
          icon: 'lan',
          children: [
            {
              id: 'isp/pool-ip/pool-ipv4',
              label: 'Pool IPv4',
              icon: 'badge',
              route: '/isp/pool-ip/pool-ipv4',
            },
            {
              id: 'isp/pool-ip/pool-ipv6',
              label: 'Pool IPv6',
              icon: 'badge',
              route: '/isp/pool-ip/pool-ipv6',
            },
            {
              id: 'isp/pool-ip/fixed-ipv4',
              label: 'Fixed IPv4',
              icon: 'pin',
              route: '/isp/pool-ip/fixed-ipv4',
            },
            {
              id: 'isp/pool-ip/fixed-ipv6',
              label: 'Fixed IPv6',
              icon: 'pin',
              route: '/isp/pool-ip/fixed-ipv6',
            },
          ],
        },
        {
          id: 'isp/radius-server',
          label: 'Radius Server',
          icon: 'security',
          children: [
            {
              id: 'isp/radius-server/registry',
              label: 'Registry',
              icon: 'badge',
              route: '/isp/radius-server',
              masterRoute: '/system/isp/radius-server',
            },
            {
              id: 'isp/radius-server/pppoe-client',
              label: 'PPPoE Client',
              icon: 'vpn_key',
              route: '/isp/radius-server/pppoe-client',
            },
          ],
        },
        {
          id: 'isp/vendor',
          label: 'Vendor',
          icon: 'factory',
          children: [
            { id: 'isp/vendor/registry', label: 'Registry', icon: 'badge', route: '/isp/vendor' },
            { id: 'isp/vendor/model', label: 'Model', icon: 'memory', route: '/isp/vendor-model' },
          ],
        },
      ],
    },

    // ✅ InfraGIS (tenant)
    {
      id: 'infragis',
      label: 'InfraGIS',
      icon: 'map',
      route: '/infragis',
      entitlementCode: 'module.infragis.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
    },

    // ✅ VoIP (tenant; MASTER usa rotas globais quando disponível)
    {
      id: 'voip',
      label: 'VoIP',
      icon: 'call',
      entitlementCode: 'module.voip.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        {
          id: 'voip/dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          route: '/voip',
          masterRoute: '/system/voip',
          scope: 'both',
        },
        {
          id: 'voip/domain',
          label: 'Domain',
          icon: 'language',
          route: '/voip/domain',
          masterRoute: '/system/voip/domain',
          scope: 'both',
        },
        {
          id: 'voip/portability',
          label: 'Portability',
          icon: 'swap_horiz',
          route: '/voip/portability',
        },
        {
          id: 'voip/did',
          label: 'DID',
          icon: 'dialpad',
          children: [
            {
              id: 'voip/did/dashboard',
              label: 'Dashboard',
              icon: 'dashboard',
              route: '/voip/did',
              masterRoute: '/system/did',
            },
            {
              id: 'voip/did/operator',
              label: 'Operator',
              icon: 'badge',
              route: '/voip/did/operator',
              masterRoute: '/system/did/operator',
              roles: ['MASTER'],
            },
            {
              id: 'voip/did/number',
              label: 'Number',
              icon: 'dialpad',
              route: '/voip/did/number',
              masterRoute: '/system/did/number',
            },
            {
              id: 'voip/did/external',
              label: 'External',
              icon: 'add_ic_call',
              route: '/voip/did/external',
              masterRoute: '/system/did/external',
            },
          ],
        },
        {
          id: 'voip/sbc',
          label: 'SBC',
          icon: 'settings_input_component',
          children: [
            {
              id: 'voip/sbc/server',
              label: 'Server',
              icon: 'dns',
              route: '/voip/sbc/server',
              masterRoute: '/system/sbc/server',
              roles: ['MASTER'],
            },
            {
              id: 'voip/sbc/provider',
              label: 'Provider',
              icon: 'hub',
              route: '/voip/sbc/provider',
            },
            {
              id: 'voip/sbc/trunk',
              label: 'Trunk',
              icon: 'settings_ethernet',
              route: '/voip/sbc/trunk',
            },
            { id: 'voip/sbc/route', label: 'Route', icon: 'alt_route', route: '/voip/sbc/route' },
            { id: 'voip/sbc/policy', label: 'Policy', icon: 'policy', route: '/voip/sbc/policy' },
          ],
        },
        {
          id: 'voip/softswitch',
          label: 'Softswitch',
          icon: 'router',
          children: [
            {
              id: 'voip/softswitch/server',
              label: 'Server',
              icon: 'dns',
              route: '/voip/softswitch/server',
              masterRoute: '/system/softswitch/server',
              roles: ['MASTER'],
            },
            {
              id: 'voip/softswitch/provider',
              label: 'Provider',
              icon: 'hub',
              route: '/voip/softswitch/provider',
            },
            {
              id: 'voip/softswitch/account',
              label: 'Softswitch',
              icon: 'router',
              route: '/voip/softswitch',
              masterRoute: '/system/softswitch',
            },
            {
              id: 'voip/softswitch/subscriber',
              label: 'Subscriber',
              icon: 'person',
              route: '/voip/softswitch/subscriber',
            },
            {
              id: 'voip/softswitch/did',
              label: 'DID',
              icon: 'tag',
              route: '/voip/softswitch/did',
            },
            {
              id: 'voip/softswitch/trunks',
              label: 'Trunk',
              icon: 'settings_input_component',
              route: '/voip/softswitch/trunks',
            },
            {
              id: 'voip/softswitch/routes',
              label: 'Route',
              icon: 'alt_route',
              route: '/voip/softswitch/routes',
            },
            {
              id: 'voip/softswitch/policies',
              label: 'Policy',
              icon: 'policy',
              route: '/voip/softswitch/policies',
            },
            {
              id: 'voip/softswitch/rates',
              label: 'Rate',
              icon: 'payments',
              route: '/voip/softswitch/rates',
            },
            {
              id: 'voip/softswitch/cdrs',
              label: 'CDR/Billing',
              icon: 'receipt_long',
              route: '/voip/softswitch/cdrs',
            },
          ],
        },
        {
          id: 'voip/pabx',
          label: 'PABX',
          icon: 'phone_in_talk',
          children: [
            {
              id: 'voip/pabx/dashboard',
              label: 'Dashboard',
              icon: 'dashboard',
              route: '/voip/pabx',
              masterRoute: '/system/pabx',
            },
            {
              id: 'voip/pabx/server',
              label: 'Server',
              icon: 'dns',
              route: '/voip/pabx/server',
              masterRoute: '/system/pabx/server',
              roles: ['MASTER'],
            },
            {
              id: 'voip/pabx/registry',
              label: 'PABX',
              icon: 'settings_phone',
              route: '/voip/pabx/accounts',
            },
            {
              id: 'voip/pabx/trunks',
              label: 'Trunk',
              icon: 'settings_input_component',
              route: '/voip/pabx/trunks',
            },
            {
              id: 'voip/pabx/extension',
              label: 'Extension',
              icon: 'dialpad',
              route: '/voip/pabx/extension',
            },
            {
              id: 'voip/pabx/inbound-routes',
              label: 'Inbound Route',
              icon: 'call_received',
              route: '/voip/pabx/inbound-routes',
            },
            { id: 'voip/pabx/ivr', label: 'IVR', icon: 'account_tree', route: '/voip/pabx/ivr' },
            {
              id: 'voip/pabx/group',
              label: 'Group',
              icon: 'ring_volume',
              route: '/voip/pabx/group',
            },
            {
              id: 'voip/pabx/queue',
              label: 'Queue',
              icon: 'groups',
              children: [
                {
                  id: 'voip/pabx/queue/agents',
                  label: 'Agents',
                  icon: 'support_agent',
                  route: '/voip/pabx/queue-agents',
                },
                {
                  id: 'voip/pabx/queue/queues',
                  label: 'Queues',
                  icon: 'groups',
                  route: '/voip/pabx/queue',
                },
              ],
            },
            {
              id: 'voip/pabx/external',
              label: 'External',
              icon: 'phone_forwarded',
              route: '/voip/pabx/external',
            },
            {
              id: 'voip/pabx/cdr',
              label: 'CDR',
              icon: 'history',
              route: '/voip/pabx/cdr',
            },
            {
              id: 'voip/pabx/dial-plan',
              label: 'Dial Plan',
              icon: 'rule',
              children: [
                {
                  id: 'voip/pabx/dial-plan/plan',
                  label: 'Plan',
                  icon: 'fact_check',
                  route: '/voip/pabx/dial-plan/plan',
                },
                {
                  id: 'voip/pabx/dial-plan/rules',
                  label: 'Rules',
                  icon: 'rule',
                  route: '/voip/pabx/dial-plan/rules',
                },
              ],
            },
            {
              id: 'voip/pabx/blacklist',
              label: 'Blacklist',
              icon: 'block',
              children: [
                {
                  id: 'voip/pabx/blacklist/list',
                  label: 'List',
                  icon: 'format_list_bulleted',
                  route: '/voip/pabx/blacklist/list',
                },
                {
                  id: 'voip/pabx/blacklist/number',
                  label: 'Number',
                  icon: 'pin',
                  route: '/voip/pabx/blacklist/number',
                },
              ],
            },
            {
              id: 'voip/pabx/media-files',
              label: 'Media Files',
              icon: 'library_music',
              route: '/voip/pabx/media-files',
            },
          ],
        },
      ],
    },

    // ✅ Realtime media/signaling infrastructure
    {
      id: 'realtime',
      label: 'Realtime',
      icon: 'cell_tower',
      entitlementCode: 'module.realtime.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        {
          id: 'realtime/domain',
          label: 'Domains',
          icon: 'language',
          masterRoute: '/system/realtime/domain',
          roles: ['MASTER'],
        },
        {
          id: 'realtime/webrtc',
          label: 'WebRTC',
          icon: 'settings_input_antenna',
          children: [
            {
              id: 'realtime/webrtc/dashboard',
              label: 'Dashboard',
              icon: 'dashboard',
              route: '/realtime/webrtc',
              masterRoute: '/system/realtime/webrtc',
            },
            {
              id: 'realtime/webrtc/domain',
              label: 'Domain',
              icon: 'language',
              route: '/realtime/webrtc/domain',
              masterRoute: '/system/realtime/webrtc/domain',
            },
            {
              id: 'realtime/webrtc/server',
              label: 'Server',
              icon: 'dns',
              masterRoute: '/system/realtime/webrtc/server',
              roles: ['MASTER'],
            },
            {
              id: 'realtime/webrtc/parameter',
              label: 'Parameter',
              icon: 'tune',
              masterRoute: '/system/realtime/webrtc/parameter',
              roles: ['MASTER'],
            },
          ],
        },
        {
          id: 'realtime/turn',
          label: 'TURN/STUN',
          icon: 'router',
          scope: 'master',
          children: [
            {
              id: 'realtime/turn/server',
              label: 'Servers',
              icon: 'dns',
              masterRoute: '/system/realtime/turn/server',
              roles: ['MASTER'],
            },
            {
              id: 'realtime/turn/domains',
              label: 'Domains',
              icon: 'language',
              masterRoute: '/system/realtime/turn/domains',
              roles: ['MASTER'],
            },
          ],
        },
      ],
    },

    // ✅ Hosting (tenant; MASTER usa rotas globais quando disponível)
    {
      id: 'hosting',
      label: 'Hosting',
      icon: 'dns',
      entitlementCode: 'module.hosting.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        {
          id: 'hosting/dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          route: '/hosting',
          masterRoute: '/system/hosting',
          roles: ['OWNER', 'ADMIN', 'USER'],
          requiresEnvironment: true,
        },
        {
          id: 'hosting/dns',
          label: 'DNS',
          icon: 'language',
          children: [
            {
              id: 'hosting/dns/providers',
              label: 'Providers',
              icon: 'manage_accounts',
              route: '/hosting/dns/providers',
            },
            {
              id: 'hosting/dns/domains',
              label: 'Domains',
              icon: 'language',
              route: '/hosting/dns/domains',
            },
          ],
        },
        {
          id: 'hosting/smtp',
          label: 'SMTP',
          icon: 'mark_email_read',
          children: [
            {
              id: 'hosting/smtp/dashboard',
              label: 'Dashboard',
              icon: 'dashboard',
              route: '/hosting/smtp',
              masterRoute: '/system/hosting/smtp',
            },
            {
              id: 'hosting/smtp/providers',
              label: 'Provider',
              icon: 'cloud_sync',
              route: '/hosting/smtp/providers',
              masterRoute: '/system/hosting/smtp/providers',
            },
            {
              id: 'hosting/smtp/accounts',
              label: 'Account',
              icon: 'alternate_email',
              route: '/hosting/smtp/accounts',
              masterRoute: '/system/hosting/smtp/accounts',
            },
            {
              id: 'hosting/smtp/routes',
              label: 'Route',
              icon: 'route',
              route: '/hosting/smtp/routes',
              masterRoute: '/system/hosting/smtp/routes',
            },
          ],
        },
        {
          id: 'hosting/storage',
          label: 'Storage',
          icon: 'storage',
          children: [
            {
              id: 'hosting/storage/dashboard',
              label: 'Dashboard',
              icon: 'dashboard',
              route: '/hosting/storage',
              masterRoute: '/system/hosting/storage',
            },
            {
              id: 'hosting/storage/providers',
              label: 'Provider',
              icon: 'cloud_sync',
              route: '/hosting/storage/providers',
              masterRoute: '/system/hosting/storage/providers',
            },
            {
              id: 'hosting/storage/accounts',
              label: 'Storage',
              icon: 'inventory_2',
              route: '/hosting/storage/accounts',
              masterRoute: '/system/hosting/storage/accounts',
            },
          ],
        },
        {
          id: 'hosting/vps',
          label: 'VPS',
          icon: 'cloud',
          children: [
            {
              id: 'hosting/vps/dashboard',
              label: 'Dashboard',
              icon: 'dashboard',
              route: '/hosting/vps',
              masterRoute: '/system/vps',
            },
            {
              id: 'hosting/vps/provider',
              label: 'Provider',
              icon: 'cloud_sync',
              route: '/hosting/vps/provider',
              masterRoute: '/system/vps/provider',
            },
            {
              id: 'hosting/vps/plans',
              label: 'Plans',
              icon: 'view_list',
              route: '/hosting/vps/plans',
              masterRoute: '/system/vps/plans',
            },
            {
              id: 'hosting/vps/instances',
              label: 'Instances',
              icon: 'dns',
              route: '/hosting/vps/instances',
              masterRoute: '/system/vps/instances',
            },
          ],
        },
        {
          id: 'hosting/vps-container',
          label: 'VPS Container',
          icon: 'apps',
          children: [
            {
              id: 'hosting/vps-container/dashboard',
              label: 'Dashboard',
              icon: 'dashboard',
              route: '/hosting/vps-container',
              masterRoute: '/system/vps-container',
            },
            {
              id: 'hosting/vps-container/provider',
              label: 'Provider',
              icon: 'cloud_sync',
              route: '/hosting/vps-container/provider',
              masterRoute: '/system/vps-container/provider',
            },
            {
              id: 'hosting/vps-container/plans',
              label: 'Plans',
              icon: 'view_list',
              route: '/hosting/vps-container/plans',
              masterRoute: '/system/vps-container/plans',
            },
            {
              id: 'hosting/vps-container/instances',
              label: 'Instances',
              icon: 'dns',
              route: '/hosting/vps-container/instances',
              masterRoute: '/system/vps-container/instances',
            },
          ],
        },
        {
          id: 'hosting/webhost',
          label: 'Webhost',
          icon: 'web',
          children: [
            {
              id: 'hosting/webhost/providers',
              label: 'Providers',
              icon: 'admin_panel_settings',
              route: '/hosting/webhost/providers',
            },
            {
              id: 'hosting/webhost/plans',
              label: 'Plans',
              icon: 'view_list',
              route: '/hosting/webhost/plans',
            },
            {
              id: 'hosting/webhost/hosts',
              label: 'Hosts',
              icon: 'dns',
              route: '/hosting/webhost/hosts',
            },
            {
              id: 'hosting/webhost/emails',
              label: 'Emails',
              icon: 'alternate_email',
              route: '/hosting/webhost/emails',
            },
            {
              id: 'hosting/webhost/databases',
              label: 'Databases',
              icon: 'storage',
              route: '/hosting/webhost/databases',
            },
            {
              id: 'hosting/webhost/mailing-lists',
              label: 'Mailing Lists',
              icon: 'forward_to_inbox',
              route: '/hosting/webhost/mailing-lists',
            },
            {
              id: 'hosting/webhost/zone-editor',
              label: 'Zone Editor',
              icon: 'edit_location_alt',
              route: '/hosting/webhost/zone-editor',
            },
          ],
        },
      ],
    },

    // ✅ Support (tenant) — visible only when an environment is selected
    {
      id: 'support',
      label: 'Support',
      icon: 'support_agent',
      entitlementCode: 'module.support.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        {
          id: 'support/tickets',
          label: 'Tickets',
          icon: 'confirmation_number',
          children: [
            {
              id: 'support/tickets/registry',
              label: 'Registry',
              icon: 'badge',
              route: '/support/tickets',
            },
            {
              id: 'support/tickets/channels',
              label: 'Channels',
              icon: 'call_split',
              route: '/support/ticket-channels',
            },
            {
              id: 'support/tickets/teams',
              label: 'Teams',
              icon: 'groups',
              route: '/support/teams',
            },
          ],
        },
        { id: 'support/channels', label: 'Chat Channels', icon: 'hub', route: '/support/channels' },
        {
          id: 'support/attendance',
          label: 'Attendance',
          icon: 'forum',
          route: '/support/attendance',
        },
      ],
    },

    {
      id: 'monitoring',
      label: 'Monitoring',
      icon: 'monitor_heart',
      entitlementCode: 'module.monitoring.*',
      children: [
        {
          id: 'monitoring/dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          route: '/monitoring',
          masterRoute: '/system/monitoring',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'monitoring/agents',
          label: 'Agents',
          icon: 'sensors',
          route: '/monitoring/agents',
          masterRoute: '/system/monitoring/agents',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'monitoring/activity-logs',
          label: 'Activity Logs',
          icon: 'fact_check',
          route: '/monitoring/activity-logs',
          masterRoute: '/system/monitoring/activity-logs',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
      ],
    },
    {
      id: 'cyber-security',
      label: 'Cyber Security',
      icon: 'security',
      entitlementCode: 'module.cyber-security.*',
      roles: ['OWNER', 'ADMIN'],
      requiresEnvironment: true,
      masterRoute: '/system/cyber-security',
      children: [
        {
          id: 'cyber-security/dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          route: '/cyber-security',
          masterRoute: '/system/cyber-security',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/servers',
          label: 'Servers',
          icon: 'dns',
          route: '/cyber-security/servers',
          masterRoute: '/system/cyber-security/servers',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/profiles',
          label: 'Security Profiles',
          icon: 'shield',
          route: '/cyber-security/profiles',
          masterRoute: '/system/cyber-security/profiles',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/services',
          label: 'Protected Services',
          icon: 'settings_applications',
          route: '/cyber-security/services',
          masterRoute: '/system/cyber-security/services',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/decisions',
          label: 'Decisions',
          icon: 'gavel',
          route: '/cyber-security/decisions',
          masterRoute: '/system/cyber-security/decisions',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/alerts',
          label: 'Alerts',
          icon: 'notification_important',
          route: '/cyber-security/alerts',
          masterRoute: '/system/cyber-security/alerts',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/lists',
          label: 'Allowlist / Blocklist',
          icon: 'rule',
          route: '/cyber-security/lists',
          masterRoute: '/system/cyber-security/lists',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/trusted-nodes',
          label: 'Trusted Nodes',
          icon: 'hub',
          route: '/cyber-security/trusted-nodes',
          masterRoute: '/system/cyber-security/trusted-nodes',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/network-policies',
          label: 'Network Policies',
          icon: 'policy',
          route: '/cyber-security/network-policies',
          masterRoute: '/system/cyber-security/network-policies',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/security-events',
          label: 'Security Events',
          icon: 'manage_search',
          route: '/cyber-security/security-events',
          masterRoute: '/system/cyber-security/security-events',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
      ],
    },

    // ✅ Sale (tenant) — requer ambiente selecionado
    {
      id: 'sale',
      label: 'Sale',
      icon: 'point_of_sale',
      entitlementCode: 'module.sale.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        {
          id: 'sale/stock',
          label: 'Stock',
          icon: 'inventory_2',
          children: [
            { id: 'sale/stock/registry', label: 'Registry', icon: 'badge', route: '/sale/stock' },
            { id: 'sale/stock/type', label: 'Type', icon: 'category', route: '/sale/stock-type' },
          ],
        },
        { id: 'sale/unit', label: 'Unit of Measure', icon: 'straighten', route: '/sale/unit' },
        { id: 'sale/brand', label: 'Brand', icon: 'branding_watermark', route: '/sale/brand' },
        { id: 'sale/category', label: 'Category', icon: 'sell', route: '/sale/category' },
        { id: 'sale/product', label: 'Product', icon: 'shopping_bag', route: '/sale/product' },
        {
          id: 'sale/quotation',
          label: 'Quotation',
          icon: 'request_quote',
          route: '/sale/quotation',
        },
      ],
    },

    // ✅ Clinic (tenant) — requer ambiente selecionado
    {
      id: 'clinic',
      label: 'Clinica',
      icon: 'local_hospital',
      entitlementCode: 'module.clinic.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
    },

    // ✅ Laboratory (tenant) — requer ambiente selecionado
    {
      id: 'laboratory',
      label: 'Laboratório',
      icon: 'biotech',
      entitlementCode: 'module.laboratory.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
    },

    // ✅ CRM (tenant) — abaixo do ERP, requer ambiente selecionado
    {
      id: 'crm',
      label: 'CRM',
      icon: 'contact_page',
      entitlementCode: 'module.erp.*',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        { id: 'crm/leads', label: 'Leads', icon: 'person_add', route: '/erp/crm/leads' },
        {
          id: 'crm/opportunities',
          label: 'Opportunities',
          icon: 'track_changes',
          route: '/erp/crm/opportunities',
        },
        { id: 'crm/pipeline', label: 'Pipeline', icon: 'view_kanban', route: '/erp/crm/pipeline' },
      ],
    },

    // Settings (raiz) — última posição
    {
      id: 'settings',
      label: 'Settings',
      icon: 'settings',
      children: [
        { id: 'settings/general', label: 'General', icon: 'tune', route: '/settings' },
        { id: 'settings/themes', label: 'Themes', icon: 'palette', route: '/settings/themes' },

        // ✅ TENANT (exige env) + só OWNER/ADMIN
        {
          id: 'settings/tenants',
          label: 'Tenants',
          icon: 'apartment',
          route: '/settings/tenants',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'settings/parameters',
          label: 'Parameters',
          icon: 'tune',
          route: '/settings/parameters',
          masterRoute: '/system/parameters',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
      ],
    },
  ];
}
