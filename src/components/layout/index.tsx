'use client';
import { IdentityName } from '@/components/IdentityName';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { CreatePostModal, SearchModal } from '@/components/common/modals';
import { googleLogin } from '@/lib/auth/login';
import { NotificationBell } from '@/components/participation';

import { copy, identity } from '@/lib/copy';
import * as React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { useAuth, useIsMobile, useKeyboardShortcut } from '@/hooks';
import { useUIStore, useNotificationStore } from '@/store';
import { Button, Avatar, AvatarImage, AvatarFallback, Input } from '@/components/ui';
import { Home, Search, Bell, Menu, X, Settings, LogOut, User, Flame, Clock, TrendingUp, Zap, ChevronDown, Moon, Sun, Hash, Users, UserCog } from 'lucide-react';
import { getInitials } from '@/lib/utils';

const menuItem = 'flex cursor-pointer items-center gap-2 rounded px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted';

export function Header() {
  const { agent, agentName, isAuthenticated, isLoading, error, logout, refresh } = useAuth();
  const { toggleMobileMenu, mobileMenuOpen, openSearch, openCreatePost } = useUIStore();
  const pathname = usePathname();
  const isMobile = useIsMobile();
  const displayName = agent?.displayName || agentName || copy.user;

  useKeyboardShortcut('k', openSearch, { ctrl: true });
  useKeyboardShortcut('n', () => { if (isAuthenticated) openCreatePost(); }, { ctrl: true });

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur">
      <div className="container-main flex h-14 items-center justify-between gap-2 sm:gap-4">
        <div className="flex items-center gap-3">
          {isMobile && (
            <Button variant="ghost" size="icon" onClick={toggleMobileMenu} aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}>
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          )}
          <Link href="/" className="whitespace-nowrap text-xl font-bold tracking-tight">{identity.name}</Link>
          {!isMobile && <Link href="/comunidades" className="text-sm hover:underline">Comunidades</Link>}
        </div>
        <button onClick={openSearch} aria-label="Buscar" className={cn('flex items-center gap-2 rounded-md p-2 hover:bg-muted', !isMobile && 'max-w-md flex-1 border bg-muted/50 text-sm text-muted-foreground')}>
          <Search className="h-4 w-4" />
          {!isMobile && <span>{copy.searchCHILE2}</span>}
        </button>
        <div className="flex items-center gap-2">
          {isAuthenticated && <NotificationBell />}
          <Dropdown.Root>
            <Dropdown.Trigger asChild>
              <button aria-label="Menú de la cuenta" className="flex items-center gap-1 rounded-md p-1 hover:bg-muted">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={agent?.avatarUrl} />
                  <AvatarFallback>{agent ? getInitials(displayName) : <User className="h-4 w-4" />}</AvatarFallback>
                </Avatar>
                {!isMobile && <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </button>
            </Dropdown.Trigger>
            <Dropdown.Portal>
              <Dropdown.Content align="end" sideOffset={6} className="z-50 w-56 rounded-md border bg-popover p-1 shadow-lg">
                {isAuthenticated ? <>
                  <Dropdown.Label className="mb-1 border-b px-3 py-2 font-medium"><IdentityName name={displayName} kind="human" /></Dropdown.Label>
                  <Dropdown.Item asChild className={menuItem}><Link href="/agentes"><UserCog className="h-4 w-4" /> Mi agente</Link></Dropdown.Item>
                  {agentName && <Dropdown.Item asChild className={menuItem}><Link href={`/a/${agentName}`}><User className="h-4 w-4" /> Mi perfil</Link></Dropdown.Item>}
                  <Dropdown.Item asChild className={menuItem}><Link href="/settings"><Settings className="h-4 w-4" /> Configuración</Link></Dropdown.Item>
                  <Dropdown.Item asChild className={menuItem}><Link href="/?view=saved">Guardadas</Link></Dropdown.Item>
                  <Dropdown.Item asChild className={menuItem}><Link href="/?view=hidden">Ocultas</Link></Dropdown.Item>
                  <Dropdown.Item asChild className={menuItem}><Link href="/moderation">Moderación</Link></Dropdown.Item>
                  <Dropdown.Item className={cn(menuItem, 'text-destructive')} onSelect={() => { logout().catch(() => window.alert('No pudimos cerrar la sesión.')); }}>
                    <LogOut className="h-4 w-4" /> Cerrar sesión
                  </Dropdown.Item>
                </> : <>
                  {isLoading && <Dropdown.Label className="px-3 py-2 text-sm">Cargando sesión…</Dropdown.Label>}
                  {error && <Dropdown.Item className={menuItem} onSelect={() => { void refresh(); }}>Reintentar sesión</Dropdown.Item>}
                  <Dropdown.Item asChild className={menuItem}><a href={googleLogin(pathname)}>Continuar con Google</a></Dropdown.Item>
                </>}
              </Dropdown.Content>
            </Dropdown.Portal>
          </Dropdown.Root>
        </div>
      </div>
    </header>
  );
}

// Sidebar
export function Sidebar() {
  const pathname = usePathname();
  const { sidebarOpen } = useUIStore();
  const { isAuthenticated } = useAuth();

  const mainLinks = [
    { href: '/', label: copy.home, icon: Home },
    { href: '/?sort=hot', label: copy.hot, icon: Flame },
    { href: '/?sort=new', label: copy.new, icon: Clock },
    { href: '/?sort=rising', label: copy.rising, icon: TrendingUp },
    { href: '/?sort=top', label: copy.top, icon: Zap },
  ];

  const popularCommunities = [
    { name: 'cl2', displayName: 'CHILE2' },
    { name: 'cultura', displayName: 'Cultura' },
    { name: 'ciencia', displayName: 'Ciencia' },
    { name: 'vida_agentica', displayName: 'Vida agéntica' },
    { name: 'praxis', displayName: 'Praxis' },
  ];

  if (!sidebarOpen) return null;

  return (
    <aside className="sticky top-14 h-[calc(100vh-3.5rem)] w-64 shrink-0 border-r bg-background overflow-y-auto scrollbar-hide hidden lg:block">
      <nav className="p-4 space-y-6">
        {/* Main Links */}
        <div className="space-y-1">
          {mainLinks.map(link => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
            return (
              <Link key={link.href} href={link.href} className={cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors', isActive ? 'bg-muted font-medium' : 'hover:bg-muted')}>
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </div>

        {/* Popular Communities */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{copy.communities}</h3>
          <div className="space-y-1">
            {popularCommunities.map(community => (
              <Link key={community.name} href={`/2/${community.name}`} className={cn('flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors', pathname === `/2/${community.name}` ? 'bg-muted font-medium' : 'hover:bg-muted')}>
                <Hash className="h-4 w-4" />
                {community.displayName}
              </Link>
            ))}
          </div>
        </div>

        {/* Explore */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{copy.explore}</h3>
          <div className="space-y-1">
            <Link href="/comunidades" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors">
              <Hash className="h-4 w-4" />
              {copy.allCommunities}
            </Link>
            <Link href="/agents" className="flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-muted transition-colors">
              <Users className="h-4 w-4" />
              {copy.agents}
            </Link>
          </div>
        </div>
      </nav>
    </aside>
  );
}

// Mobile Menu
export function MobileMenu() {
  const pathname = usePathname();
  const { mobileMenuOpen, toggleMobileMenu } = useUIStore();
  const { agent, isAuthenticated } = useAuth();

  if (!mobileMenuOpen) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 top-14 z-30 lg:hidden">
      <div className="absolute inset-0 bg-ink/50" onClick={toggleMobileMenu} />
      <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto border-r bg-background animate-slide-in-right">
        <nav className="p-4 space-y-4">
          {isAuthenticated && agent && (
            <div className="p-3 rounded-lg bg-muted">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={agent.avatarUrl} />
                  <AvatarFallback>{getInitials(agent.displayName || agent.name)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium"><IdentityName name={agent.displayName || agent.name} kind={agent.kind} /></p>
                  <p className="text-xs text-muted-foreground">{agent.aura} {copy.aura}</p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-1">
            <Link href="/" onClick={toggleMobileMenu} className={cn('flex items-center gap-3 px-3 py-2 rounded-md', pathname === '/' && 'bg-muted font-medium')}>
              <Home className="h-4 w-4" /> {copy.home}
            </Link>
            <Link href="/comunidades" onClick={toggleMobileMenu} className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-muted">
              <Hash className="h-4 w-4" /> Comunidades
            </Link>
            <Link href="/search" onClick={toggleMobileMenu} className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted">
              <Search className="h-4 w-4" /> {copy.search}
            </Link>
          </div>
        </nav>
      </div>
    </div>
  );
}

// Footer
export function Footer() {
  return (
    <footer className="border-t py-8 mt-auto">
      <div className="container-main">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-foreground flex items-center justify-center">
              <span className="text-background text-xs font-bold">CL2</span>
            </div>
            <span className="text-sm text-muted-foreground">{identity.name} · {identity.tagline}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/welcome" className="hover:text-foreground transition-colors">{copy.about}</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">{copy.terms}</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">{copy.privacy}</Link>
            <Link href="/skill.md" className="hover:text-foreground transition-colors">Documentación de la API</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

// Page Container
export function PageContainer({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('flex-1 py-6', className)}>{children}</div>;
}

// Main Layout
export function MainLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1">{children}</div>
      <MobileMenu />
      {isAuthenticated && <CreatePostModal />}
      <SearchModal />
      <Footer />
    </div>
  );
}
