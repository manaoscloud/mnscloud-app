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
import { trigger, transition, style, animate } from '@angular/animations';

// Shared
import { BreadcrumbComponent } from '../../shared/breadcrumb/breadcrumb';

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
import { I18nService, AppLanguage, LanguageOptionCode } from '../../services/i18n.service';
import { TranslatePipe } from '../../shared/i18n/translate.pipe';

// =======================================================
// Types
// =======================================================

interface NavItem {
  id: string;
  label: string;
  icon?: string;
  route?: string;
  children?: NavItem[];

  // ✅ Controle de visibilidade por role
  roles?: AppRole[];

  // ✅ Controle de visibilidade por TENANT (exige EnvironmentUUID selecionado)
  requiresEnvironment?: boolean;
}

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
    TranslatePipe,
  ],
  templateUrl: './main-layout.html',
  styleUrls: ['./main-layout.scss'],
  animations: [
    trigger('fadeContent', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(8px)' }),
        animate('250ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
      ]),
      transition(':leave', [
        animate('200ms ease-in', style({ opacity: 0, transform: 'translateY(4px)' })),
      ]),
    ]),
  ],
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
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

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
  readonly menuSearch = signal('');
  readonly isSearching = computed(() => this.menuSearch().trim().length > 0);
  readonly isHandset = signal(this.checkHandset());
  readonly currentYear = new Date().getFullYear();
  readonly expandedSections = signal<Set<string>>(new Set());
  readonly currentLanguage = this.i18n.language;
  readonly currentLanguageOption = this.i18n.selectedLanguageOption;
  readonly languageOptions = this.i18n.languageOptions;

  // =======================================================
  // Tenant Signals
  // =======================================================
  readonly environments = signal<UserEnvironment[]>([]);
  readonly activeEnvironmentId = signal<string | null>(null);
  readonly loadingEnvironments = signal<boolean>(false);

  readonly currentEnvironment = computed(() => {
    const list = this.environments();
    const id = this.activeEnvironmentId();
    return list.find((e) => e.EnvironmentUUID === id) ?? null;
  });

  readonly currentEnvironmentName = computed(
    () => this.currentEnvironment()?.EnvironmentName ?? this.i18n.t('layout.noEnvironment'),
  );

  private static readonly ENV_STORAGE_KEY = 'mc_current_env';
  private static readonly LAYOUT_COMPACT_STORAGE_KEY = 'mc_layout_compact';
  private compactCloseTimer: ReturnType<typeof setTimeout> | null = null;

  @HostBinding('class') themeClass = '';

  constructor() {
    // Atualiza tema automaticamente
    effect(() => {
      this.themeClass = `${this.theme()}-theme`;
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
    const sub = this.router.events.subscribe((e) => {
      if (e instanceof NavigationEnd) this.autoExpandSections();
    });

    this.destroyRef.onDestroy(() => sub.unsubscribe());
    this.destroyRef.onDestroy(() => this.clearCompactCloseTimer());
    setTimeout(() => this.autoExpandSections(), 0);

    // Carrega environments (tenants)
    this.initEnvironments();
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
    return this.router.url === route;
  }

  isActiveSection(item: NavItem): boolean {
    return (
      (item.route && this.isActiveRoute(item.route)) ||
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
    if (!item.route) return;
    await this.router.navigate([item.route]);
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
    this.compactRootFlyoutTop.set(this.computeFlyoutTop(event, item.children?.length ?? 0));
    this.compactFlyoutLeft.set(this.computeFlyoutLeft(event));
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
    this.compactChildFlyoutTop.set(this.computeFlyoutTop(event, item.children?.length ?? 0));
  }

  onCompactGrandEnter(item: NavItem, event?: MouseEvent) {
    this.clearCompactCloseTimer();

    if (!item.children?.length) {
      this.compactHoverGrandId.set(null);
      return;
    }

    this.compactHoverGrandId.set(item.id);
    this.compactGrandFlyoutTop.set(this.computeFlyoutTop(event, item.children?.length ?? 0));
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

  private computeFlyoutTop(event: MouseEvent | undefined, itemCount: number): number {
    const target = event?.currentTarget as HTMLElement | null;
    if (!target || typeof window === 'undefined') return this.compactRootFlyoutTop();

    const viewportHeight = window.innerHeight;
    const maxFlyoutHeight = Math.min(Math.floor(viewportHeight * 0.7), 560);
    const estimatedHeight = Math.min(Math.max(itemCount * 40 + 16, 112), maxFlyoutHeight);
    const targetRect = target.getBoundingClientRect();
    const preferredTop = targetRect.top;
    const maxTop = Math.max(8, viewportHeight - estimatedHeight - 8);
    return Math.max(8, Math.min(preferredTop, maxTop));
  }

  private computeFlyoutLeft(event?: MouseEvent): number {
    const target = event?.currentTarget as HTMLElement | null;
    const sidenav = target?.closest('mat-sidenav') as HTMLElement | null;
    if (!sidenav) return this.compactFlyoutLeft();
    return Math.round(sidenav.getBoundingClientRect().right + 8);
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
  private hasTenantSelected(): boolean {
    return !!this.activeEnvironmentId();
  }

  private hasRole(item: NavItem): boolean {
    const role = this.user()?.role;

    // MASTER enxerga tudo
    if (role === 'MASTER') return true;

    // Se não tem roles, aparece para todos
    if (!item.roles || item.roles.length === 0) return true;

    // Se o user ainda não carregou role, esconde itens restritos
    if (!role) return false;

    return item.roles.includes(role);
  }

  private canShowByEnvironment(item: NavItem): boolean {
    const role = this.user()?.role;
    if (role === 'MASTER') return true;

    // Se não exige environment, ok
    if (!item.requiresEnvironment) return true;

    // Exige EnvironmentUUID selecionado
    return this.hasTenantSelected();
  }

  private filterMenu(items: NavItem[]): NavItem[] {
    return items
      .map((i) => {
        // 1) Role
        if (!this.hasRole(i)) return null;

        // 2) Tenant selection (EnvironmentUUID)
        if (!this.canShowByEnvironment(i)) return null;

        // 3) Filtra filhos
        const children = i.children ? this.filterMenu(i.children) : undefined;

        // Se era grupo e perdeu todos os filhos, remove
        if (i.children?.length && (!children || children.length === 0)) return null;

        return { ...i, children };
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

      const list = resp?.data?.access ?? [];

      this.environments.set(list);

      if (!list.length) {
        this.activeEnvironmentId.set(null);

        // ✅ mantém AuthService coerente
        this.auth.updateUser({ EnvironmentUUID: null });
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(MainLayout.ENV_STORAGE_KEY);
        }

        return;
      }

      const stored = localStorage.getItem(MainLayout.ENV_STORAGE_KEY);
      const valid = list.some((t) => t.EnvironmentUUID === stored) ? stored : null;

      const defaultEnv = list.find((t) => Number(t.IsDefault ?? 0) === 1)?.EnvironmentUUID ?? null;
      const finalEnv = valid ?? defaultEnv ?? list[0].EnvironmentUUID;

      this.activeEnvironmentId.set(finalEnv);
      localStorage.setItem(MainLayout.ENV_STORAGE_KEY, finalEnv);

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
    } catch (e) {
      console.error('❌ Failed to load environments:', e);
      this.environments.set([]);
      this.activeEnvironmentId.set(null);

      this.auth.updateUser({ EnvironmentUUID: null });
    } finally {
      this.loadingEnvironments.set(false);
    }
  }

  switchEnvironment(env: UserEnvironment) {
    if (!env || env.EnvironmentUUID === this.activeEnvironmentId()) return;

    this.activeEnvironmentId.set(env.EnvironmentUUID);
    localStorage.setItem(MainLayout.ENV_STORAGE_KEY, env.EnvironmentUUID);

    // ✅ Mantém AuthService sincronizado (guards/menu)
    this.auth.updateUser({
      EnvironmentUUID: env.EnvironmentUUID,
      role:
        (this.auth.user()?.role === 'MASTER'
          ? 'MASTER'
          : ((Number(env.Master ?? 0) === 1 ? 'MASTER' : env.Role) as AppRole | undefined)) ??
        this.auth.user()?.role ??
        'USER',
    });
    this.router.navigate(['/dashboard']);
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
      label: this.i18n.translateMenuLabel(item.label),
      children: item.children ? this.localizeMenu(item.children) : undefined,
    }));
  }

  // =======================================================
  // Menu Data (RAW)
  // =======================================================
  readonly navItemsRaw: NavItem[] = [
    { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: '/dashboard' },

    // ✅ MASTER AREA (somente MASTER enxerga)
    {
      id: 'system',
      label: 'System',
      icon: 'admin_panel_settings',
      roles: ['MASTER'],
      children: [
        {
          id: 'system/financial',
          label: 'Financial',
          icon: 'account_balance',
          children: [
            {
              id: 'system/payment-gateway',
              label: 'Payment Gateways',
              icon: 'credit_card',
              route: '/system/payment-gateway',
              roles: ['MASTER'],
            },
          ],
        },
        {
          id: 'system/monitoring',
          label: 'Monitoring',
          icon: 'monitor_heart',
          children: [
            {
              id: 'system/monitoring/agents',
              label: 'Agents',
              icon: 'sensors',
              route: '/system/monitoring/agents',
              roles: ['MASTER'],
            },
            {
              id: 'monitoring/activity-logs',
              label: 'Activity Logs',
              icon: 'fact_check',
              route: '/system/monitoring/activity-logs',
              roles: ['MASTER'],
            },
          ],
        },
        {
          id: 'system/settings',
          label: 'Settings',
          icon: 'tune',
          children: [
            {
              id: 'system/parameters',
              label: 'Parameters',
              icon: 'tune',
              route: '/system/parameters',
              roles: ['MASTER'],
            },
          ],
        },
        {
          id: 'system/hosting',
          label: 'Hosting',
          icon: 'dns',
          children: [
            {
              id: 'system/hosting/smtp',
              label: 'SMTP',
              icon: 'mark_email_read',
              roles: ['MASTER'],
              children: [
                {
                  id: 'system/hosting/smtp/providers',
                  label: 'Provider',
                  icon: 'cloud_sync',
                  route: '/system/hosting/smtp/providers',
                  roles: ['MASTER'],
                },
                {
                  id: 'system/hosting/smtp/accounts',
                  label: 'Account',
                  icon: 'alternate_email',
                  route: '/system/hosting/smtp/accounts',
                  roles: ['MASTER'],
                },
                {
                  id: 'system/hosting/smtp/routes',
                  label: 'Route',
                  icon: 'route',
                  route: '/system/hosting/smtp/routes',
                  roles: ['MASTER'],
                },
              ],
            },
            {
              id: 'system/hosting/storage',
              label: 'Storage',
              icon: 'storage',
              roles: ['MASTER'],
              children: [
                {
                  id: 'system/hosting/storage/providers',
                  label: 'Provider',
                  icon: 'cloud_sync',
                  route: '/system/hosting/storage/providers',
                  roles: ['MASTER'],
                },
                {
                  id: 'system/hosting/storage/accounts',
                  label: 'Storage',
                  icon: 'inventory_2',
                  route: '/system/hosting/storage/accounts',
                  roles: ['MASTER'],
                },
              ],
            },
            {
              id: 'system/vps',
              label: 'VPS',
              icon: 'cloud',
              roles: ['MASTER'],
              children: [
                {
                  id: 'system/vps/provider',
                  label: 'Provider',
                  icon: 'cloud_sync',
                  route: '/system/vps/provider',
                  roles: ['MASTER'],
                },
                {
                  id: 'system/vps/plans',
                  label: 'Plans',
                  icon: 'view_list',
                  route: '/system/vps/plans',
                  roles: ['MASTER'],
                },
                {
                  id: 'system/vps/instances',
                  label: 'Instances',
                  icon: 'dns',
                  route: '/system/vps/instances',
                  roles: ['MASTER'],
                },
              ],
            },
            {
              id: 'system/vps-container',
              label: 'VPS Container',
              icon: 'apps',
              roles: ['MASTER'],
              children: [
                {
                  id: 'system/vps-container/provider',
                  label: 'Provider',
                  icon: 'cloud_sync',
                  route: '/system/vps-container/provider',
                  roles: ['MASTER'],
                },
                {
                  id: 'system/vps-container/plans',
                  label: 'Plans',
                  icon: 'view_list',
                  route: '/system/vps-container/plans',
                  roles: ['MASTER'],
                },
                {
                  id: 'system/vps-container/instances',
                  label: 'Instances',
                  icon: 'dns',
                  route: '/system/vps-container/instances',
                  roles: ['MASTER'],
                },
              ],
            },
          ],
        },
        {
          id: 'system/isp',
          label: 'ISP',
          icon: 'network_check',
          children: [
            {
              id: 'system/isp/radius-server',
              label: 'Radius Server',
              icon: 'security',
              route: '/system/isp/radius-server',
              roles: ['MASTER'],
            },
          ],
        },
        {
          id: 'system/voip',
          label: 'VoIP',
          icon: 'call',
          children: [
            {
              id: 'system/softswitch',
              label: 'Softswitch',
              icon: 'router',
              route: '/system/softswitch',
              roles: ['MASTER'],
            },
            {
              id: 'system/sbc',
              label: 'SBC',
              icon: 'settings_input_component',
              route: '/system/sbc',
              roles: ['MASTER'],
            },
            {
              id: 'system/pabx',
              label: 'PABX',
              icon: 'phone_in_talk',
              children: [
                {
                  id: 'system/pabx/registry',
                  label: 'PABX',
                  icon: 'badge',
                  route: '/system/pabx',
                  roles: ['MASTER'],
                },
              ],
            },
          ],
        },
      ],
    },

    {
      id: 'user',
      label: 'User',
      icon: 'person',
      children: [
        { id: 'user/profile', label: 'My Profile', icon: 'badge', route: '/user/profile' },
      ],
    },

    // ✅ ERP TENANT (exige env) — não aparece para MASTER e não aparece sem Environment selecionado
    {
      id: 'erp',
      label: 'ERP',
      icon: 'apps',
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
      ],
    },

    // ✅ ISP (tenant) — requer ambiente selecionado
    {
      id: 'isp',
      label: 'ISP',
      icon: 'network_check',
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
        {
          id: 'isp/geomap',
          label: 'GeoMap',
          icon: 'map',
          children: [
            { id: 'isp/geomap/map', label: 'Map', icon: 'map', route: '/isp/geomap/map' },
            {
              id: 'isp/geomap/projects',
              label: 'Projects',
              icon: 'folder',
              route: '/isp/geomap/projects',
            },
            {
              id: 'isp/geomap/assets',
              label: 'Assets',
              icon: 'public',
              children: [
                {
                  id: 'isp/geomap/assets/types',
                  label: 'Types',
                  icon: 'category',
                  route: '/isp/geomap/asset-type',
                },
                {
                  id: 'isp/geomap/assets/models',
                  label: 'Models',
                  icon: 'badge',
                  route: '/isp/geomap/asset',
                },
              ],
            },
            {
              id: 'isp/geomap/ftth',
              label: 'FTTH',
              icon: 'fiber_smart_record',
              route: '/isp/geomap/ftth',
            },
            {
              id: 'isp/geomap/viability',
              label: 'Viability',
              icon: 'fact_check',
              route: '/isp/geomap/viability',
            },
            {
              id: 'isp/geomap/capacity',
              label: 'Capacity',
              icon: 'speed',
              route: '/isp/geomap/capacity',
            },
          ],
        },
      ],
    },

    // ✅ VoIP (tenant) — requer ambiente selecionado
    {
      id: 'voip',
      label: 'VoIP',
      icon: 'call',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
        { id: 'voip/domain', label: 'Domain', icon: 'language', route: '/voip/domain' },
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
              id: 'voip/did/operator',
              label: 'Operator',
              icon: 'badge',
              route: '/voip/did/operator',
            },
            { id: 'voip/did/number', label: 'Number', icon: 'dialpad', route: '/voip/did' },
            {
              id: 'voip/did/customer',
              label: 'Customer',
              icon: 'person',
              route: '/voip/did/customer',
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
              route: '/system/sbc/server',
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
          id: 'voip/webrtc',
          label: 'WebRTC',
          icon: 'settings_input_antenna',
          children: [
            {
              id: 'voip/webrtc/server',
              label: 'Server',
              icon: 'dns',
              route: '/voip/webrtc/server',
            },
            {
              id: 'voip/webrtc/parameter',
              label: 'Parameter',
              icon: 'tune',
              route: '/voip/webrtc/parameter',
            },
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
              route: '/system/softswitch/server',
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
              id: 'voip/pabx/server',
              label: 'Server',
              icon: 'dns',
              route: '/system/pabx/server',
              roles: ['MASTER'],
            },
            {
              id: 'voip/pabx/registry',
              label: 'PABX',
              icon: 'settings_phone',
              route: '/voip/pabx',
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
            {
              id: 'voip/pabx/outbound-routes',
              label: 'Outbound Route',
              icon: 'call_made',
              route: '/voip/pabx/outbound-routes',
            },
            { id: 'voip/pabx/ivr', label: 'IVR', icon: 'account_tree', route: '/voip/pabx/ivr' },
            {
              id: 'voip/pabx/group',
              label: 'Group',
              icon: 'ring_volume',
              route: '/voip/pabx/group',
            },
            { id: 'voip/pabx/queue', label: 'Queue', icon: 'groups', route: '/voip/pabx/queue' },
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

    // ✅ Hosting (tenant) — requer ambiente selecionado
    {
      id: 'hosting',
      label: 'Hosting',
      icon: 'dns',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
      children: [
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
              id: 'hosting/smtp/providers',
              label: 'Provider',
              icon: 'cloud_sync',
              route: '/hosting/smtp/providers',
            },
            {
              id: 'hosting/smtp/accounts',
              label: 'Account',
              icon: 'alternate_email',
              route: '/hosting/smtp/accounts',
            },
            {
              id: 'hosting/smtp/routes',
              label: 'Route',
              icon: 'route',
              route: '/hosting/smtp/routes',
            },
          ],
        },
        {
          id: 'hosting/storage',
          label: 'Storage',
          icon: 'storage',
          children: [
            {
              id: 'hosting/storage/providers',
              label: 'Provider',
              icon: 'cloud_sync',
              route: '/hosting/storage/providers',
            },
            {
              id: 'hosting/storage/accounts',
              label: 'Storage',
              icon: 'inventory_2',
              route: '/hosting/storage/accounts',
            },
          ],
        },
        {
          id: 'hosting/vps',
          label: 'VPS',
          icon: 'cloud',
          children: [
            {
              id: 'hosting/vps/provider',
              label: 'Provider',
              icon: 'cloud_sync',
              route: '/hosting/vps/provider',
            },
            {
              id: 'hosting/vps/plans',
              label: 'Plans',
              icon: 'view_list',
              route: '/hosting/vps/plans',
            },
            {
              id: 'hosting/vps/instances',
              label: 'Instances',
              icon: 'dns',
              route: '/hosting/vps/instances',
            },
          ],
        },
        {
          id: 'hosting/vps-container',
          label: 'VPS Container',
          icon: 'apps',
          children: [
            {
              id: 'hosting/vps-container/provider',
              label: 'Provider',
              icon: 'cloud_sync',
              route: '/hosting/vps-container/provider',
            },
            {
              id: 'hosting/vps-container/plans',
              label: 'Plans',
              icon: 'view_list',
              route: '/hosting/vps-container/plans',
            },
            {
              id: 'hosting/vps-container/instances',
              label: 'Instances',
              icon: 'dns',
              route: '/hosting/vps-container/instances',
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
      children: [
        {
          id: 'monitoring/agents',
          label: 'Agents',
          icon: 'sensors',
          route: '/monitoring/agents',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'monitoring/activity-logs',
          label: 'Activity Logs',
          icon: 'fact_check',
          route: '/monitoring/activity-logs',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
      ],
    },
    {
      id: 'cyber-security',
      label: 'Cyber Security',
      icon: 'security',
      roles: ['OWNER', 'ADMIN'],
      requiresEnvironment: true,
      children: [
        {
          id: 'cyber-security/dashboard',
          label: 'Dashboard',
          icon: 'dashboard',
          route: '/cyber-security',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/servers',
          label: 'Servers',
          icon: 'dns',
          route: '/cyber-security/servers',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/profiles',
          label: 'Security Profiles',
          icon: 'shield',
          route: '/cyber-security/profiles',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/services',
          label: 'Protected Services',
          icon: 'settings_applications',
          route: '/cyber-security/services',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/decisions',
          label: 'Decisions',
          icon: 'gavel',
          route: '/cyber-security/decisions',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/alerts',
          label: 'Alerts',
          icon: 'notification_important',
          route: '/cyber-security/alerts',
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
        {
          id: 'cyber-security/lists',
          label: 'Allowlist / Blocklist',
          icon: 'rule',
          route: '/cyber-security/lists',
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
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
    },

    // ✅ Laboratory (tenant) — requer ambiente selecionado
    {
      id: 'laboratory',
      label: 'Laboratório',
      icon: 'biotech',
      roles: ['OWNER', 'ADMIN', 'USER'],
      requiresEnvironment: true,
    },

    // ✅ CRM (tenant) — abaixo do ERP, requer ambiente selecionado
    {
      id: 'crm',
      label: 'CRM',
      icon: 'contact_page',
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
          roles: ['OWNER', 'ADMIN'],
          requiresEnvironment: true,
        },
      ],
    },
  ];
}
