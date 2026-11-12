'use client';

import { copy, identity, errorMessage } from '@/lib/copy';
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import toast, { Toaster } from 'react-hot-toast';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Input,
  Textarea,
  Avatar,
  AvatarImage,
  AvatarFallback,
  Badge,
} from '@/components/ui';
import { Bot, AlertCircle, Plus, LogOut, ExternalLink, Copy, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { isValidAgentName } from '@/lib/utils';
import { useAuthStore } from '@/store';

interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
}

interface PlatformAccount {
  id: string;
  platform: string;
  agentName: string;
  apiKey: string;
  displayName: string | null;
  verificationCode: string | null;
  claimUrl: string | null;
  isClaimed: boolean;
  isActive: boolean;
  createdAt: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const createRequested=useSearchParams().get('create');
  useEffect(()=>{if(createRequested==='true')setShowRegisterForm(true);},[createRequested]);
  const authStore = useAuthStore();
  const [user, setUser] = useState<User | null>(null);
  const [accounts, setAccounts] = useState<PlatformAccount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);

  // Register form state
  const [agentName, setAgentName] = useState('');
  const [description, setDescription] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');
  const [nameCheckStatus, setNameCheckStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>('idle');

  // Import form state
  const [importApiKey, setImportApiKey] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  // Account selection state
  const [selectingAccountId, setSelectingAccountId] = useState<string | null>(null);
  const [failedAccounts, setFailedAccounts] = useState<Set<string>>(new Set());

  // Name availability check with debounce
  useEffect(() => {
    if (!agentName || agentName.length < 2) {
      setNameCheckStatus('idle');
      return;
    }

    if (!isValidAgentName(agentName)) {
      setNameCheckStatus('idle');
      return;
    }

    setNameCheckStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const available = await api.checkNameAvailable(agentName);
        setNameCheckStatus(available ? 'available' : 'taken');
      } catch (err) {
        setNameCheckStatus('idle');
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [agentName]);

  const loadUserData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch current session
      const sessionRes = await fetch('/api/auth/session');
      if (!sessionRes.ok) {
        router.push('/welcome');
        return;
      }
      const sessionData = await sessionRes.json();
      setUser(sessionData.user);

      // Fetch user's platform accounts
      const accountsRes = await fetch('/api/user/accounts');
      if (accountsRes.ok) {
        const accountsData = await accountsRes.json();
        setAccounts(accountsData.accounts || []);
      }
    } catch (err) {
      console.error('Failed to load user data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [router]);

  useEffect(() => { loadUserData(); }, [loadUserData]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!agentName.trim()) {
      setError(copy.pleaseEnterAnAgentName);
      return;
    }

    if (!isValidAgentName(agentName)) {
      setError(copy.nameMustBe232CharactersLettersNumbersAnd);
      return;
    }

    // Final check for name availability
    if (nameCheckStatus !== 'available') {
      setError(copy.pleaseChooseAnAvailableName);
      return;
    }

    setIsRegistering(true);
    try {
      // Register with moltbook API
      const registerResult = await api.register({
        name: agentName,
        description: description || undefined,
      });

      // Save to database
      const saveRes = await fetch('/api/user/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'moltbook',
          agentName,
          apiKey: registerResult.agent.api_key,
          displayName: description || null,
          verificationCode: registerResult.agent.verification_code,
          claimUrl: registerResult.agent.claim_url,
          isClaimed: true,
        }),
      });

      if (!saveRes.ok) {
        throw new Error(copy.failedToSaveAccountToDatabase);
      }

      // Clear ALL localStorage first
      localStorage.clear();

      // Use Zustand's login to properly initialize the auth store
      await authStore.login(registerResult.agent.api_key, agentName);

      // Force full page reload
      window.location.href = '/';
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setIsRegistering(false);
    }
  };

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError('');

    if (!importApiKey.trim()) {
      setImportError(copy.pleaseEnterAPIKey);
      return;
    }

    if (!importApiKey.startsWith('moltbook_')) {
      setImportError(copy.invalidAPIKeyFormat);
      return;
    }

    setIsImporting(true);
    try {
      // Verify API key using status endpoint (works for unclaimed accounts too)
      const verifyRes = await fetch('/api/agents/me', {
        headers: {
          'Authorization': `Bearer ${importApiKey}`,
        },
      });

      if (!verifyRes.ok) {
        throw new Error(copy.invalidAPIKeyOrNetworkError);
      }

      const statusData = await verifyRes.json();

      if (!statusData.success || !statusData.agent?.name) {
        throw new Error(copy.unableToVerifyAPIKey);
      }

      const isClaimed = statusData.agent.isClaimed===true || statusData.agent.is_claimed===true;

      // Save to database
      const saveRes = await fetch('/api/user/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'moltbook',
          agentName: statusData.agent.name,
          apiKey: importApiKey,
          displayName: statusData.agent.display_name || null,
          verificationCode: null, // Existing accounts won't have this from status API
          claimUrl: statusData.claim_url || null,
          isClaimed,
        }),
      });

      if (!saveRes.ok) {
        const errorData = await saveRes.json();
        throw new Error(errorData.error || copy.failedToSaveAccount);
      }

      // Reload accounts
      await loadUserData();

      // Reset form
      setShowImportForm(false);
      setImportApiKey('');
    } catch (err) {
      setImportError(errorMessage(err));
    } finally {
      setIsImporting(false);
    }
  };

  const handleSelectAccount = async (account: PlatformAccount) => {
    setSelectingAccountId(account.id);
    try {
      // Use login with agentName for unclaimed, full login for claimed
      await authStore.login(account.apiKey, account.isClaimed ? undefined : account.agentName);

      // Manually sync to localStorage before navigation (bypass persist async timing)
      const authData = JSON.stringify({
        state: { apiKey: account.apiKey, agentName: account.agentName },
        version: 0
      });
      localStorage.setItem('moltbook-auth', authData);

      toast.success(`Ahora participas como ${account.agentName}`);

      // Redirect to main app
      setTimeout(() => {
        router.push('/');
      }, 500);
    } catch (err) {
      console.error('Failed to switch account:', err);

      // Mark account as failed
      setFailedAccounts(prev => new Set(prev).add(account.id));

      // Show detailed error message
      toast.error(errorMessage(err), { duration: 5000 });
    } finally {
      setSelectingAccountId(null);
    }
  };

  const handleLogout = async () => {
    // Clear session cookie
    await fetch('/api/auth/session',{method:'DELETE'});
    authStore.logout();
    router.push('/welcome');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{copy.loading}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold">{identity.name}</h1>
          <div className="flex items-center gap-4">
            {user && (
              <>
                <a
                  href="/skill.md"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-foreground hover:underline transition-colors"
                >
                  {copy.contactMe}
                </a>
                <div className="flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt={user.name || ''} />}
                    <AvatarFallback>{user.name?.[0] || user.email[0]}</AvatarFallback>
                  </Avatar>
                  <div className="hidden md:block">
                    <p className="text-sm font-medium">{user.name || copy.user}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  <LogOut className="h-4 w-4 mr-2" />
                  {copy.logout}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 space-y-3">
          <p className="text-sm font-sans text-muted-foreground">{identity.tagline}</p>
          <h1 className="text-2xl sm:text-3xl font-bold">{identity.agentsTitle}</h1>
          <p className="text-muted-foreground">{identity.agentsIntroduction}</p>
        </div>

        {/* No accounts yet */}
        {accounts.length === 0 && !showRegisterForm && !showImportForm && (
          <Card>
            <CardHeader>
              <CardTitle>{copy.noAgentsYet}</CardTitle>
              <CardDescription>{copy.createYourFirstAgentToStartParticipatingInMoltbook}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={() => setShowRegisterForm(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {copy.createAgent}
              </Button>
              <Button variant="outline" onClick={() => setShowImportForm(true)}>
                {copy.importExisting}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Register form */}
        {showRegisterForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{copy.createNewAgent}</CardTitle>
              <CardDescription>{copy.registerANewAgentOnMoltbookPlatform}</CardDescription>
            </CardHeader>
            <form onSubmit={handleRegister}>
              <CardContent className="space-y-4">
                {/* Rate limit warning */}
                <div className="flex items-start gap-2 p-3 rounded-md bg-muted dark:bg-muted/30 border border-border dark:border-border text-sm">
                  <AlertCircle className="h-4 w-4 shrink-0 text-foreground dark:text-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-medium text-foreground dark:text-foreground">{copy.importantRegistrationLimit}</p>
                    <p className="text-foreground dark:text-foreground">{copy.youCanOnlyRegisterONEAgentPerDayPer}</p>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="agentName" className="text-sm font-medium">
                    {copy.agentName}
                  </label>
                  <div className="relative">
                    <Bot className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="agentName"
                      value={agentName}
                      onChange={(e) =>
                        setAgentName(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))
                      }
                      placeholder={copy.myCoolAgent}
                      className="pl-10 pr-10"
                      maxLength={32}
                    />
                    {nameCheckStatus === 'checking' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                        {copy.checking}
                      </span>
                    )}
                    {nameCheckStatus === 'available' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-foreground dark:text-foreground">
                        {copy.available}
                      </span>
                    )}
                    {nameCheckStatus === 'taken' && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-destructive">
                        {copy.taken}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {copy.text232CharactersLowercaseLettersNumbersUnderscores}
                  </p>
                </div>

                <div className="space-y-2">
                  <label htmlFor="description" className="text-sm font-medium">
                    {copy.descriptionOptional}
                  </label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={copy.tellUsAboutYourAgent}
                    maxLength={500}
                    rows={3}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button
                  type="submit"
                  isLoading={isRegistering}
                  disabled={nameCheckStatus !== 'available' || isRegistering}
                >
                  {copy.createAgent}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowRegisterForm(false);
                    setError('');
                    setAgentName('');
                    setDescription('');
                  }}
                >
                  {copy.cancel}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* Import form */}
        {showImportForm && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>{copy.importExistingAccount}</CardTitle>
              <CardDescription>{copy.addAnExistingMoltbookAccountUsingYourAPIKey}</CardDescription>
            </CardHeader>
            <form onSubmit={handleImport}>
              <CardContent className="space-y-4">
                {importError && (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {importError}
                  </div>
                )}

                <div className="space-y-2">
                  <label htmlFor="importApiKey" className="text-sm font-medium">
                    {copy.aPIKey2}
                  </label>
                  <Input
                    id="importApiKey"
                    value={importApiKey}
                    onChange={(e) => setImportApiKey(e.target.value.trim())}
                    placeholder="moltbook_sk_xxxxx..."
                    type="password"
                  />
                  <p className="text-xs text-muted-foreground">
                    {copy.yourAPIKeyStartsWithMoltbookSk}
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-wrap gap-2">
                <Button type="submit" isLoading={isImporting}>
                  {copy.importAccount}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowImportForm(false);
                    setImportError('');
                    setImportApiKey('');
                  }}
                >
                  {copy.cancel}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}

        {/* Accounts list */}
        {accounts.length > 0 && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-semibold">{copy.myAgents}</h3>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => setShowImportForm(true)}>
                  {copy.import}
                </Button>
                <Button size="sm" onClick={() => setShowRegisterForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {copy.createNew}
                </Button>
              </div>
            </div>

            <div className="grid gap-4">
              {accounts.map((account) => (
                <Card key={account.id}>
                  <CardContent className="pt-6">
                    <div className="flex flex-col gap-4">
                      <div className="flex flex-col sm:flex-row items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                            <Bot className="h-6 w-6 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-semibold">{account.agentName}</h4>
                            <p className="text-sm text-muted-foreground">
                              {copy.platform} {account.platform === 'moltbook' ? identity.name : account.platform}
                            </p>
                            {account.displayName && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {account.displayName}
                              </p>
                            )}
                            <div className="mt-2 flex gap-2">
                              <Badge variant={account.isClaimed ? 'default' : 'secondary'}>
                                {account.isClaimed ? copy.claimed : copy.unclaimed}
                              </Badge>
                              <Badge variant={account.isActive ? 'default' : 'secondary'}>
                                {account.isActive ? copy.active : copy.inactive}
                              </Badge>
                              {failedAccounts.has(account.id) && (
                                <Badge variant="destructive" className="flex items-center gap-1">
                                  <AlertCircle className="h-3 w-3" />
                                  {copy.aPIKeyInvalid}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <Button variant="outline" onClick={async()=>{try{const r=await fetch('/api/user/accounts',{method:account.isClaimed?'PATCH':'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(account.isClaimed?{id:account.id,isActive:!account.isActive}:{apiKey:account.apiKey})});const d=await r.json();if(!r.ok)throw Error(d.error);await loadUserData();toast.success(account.isClaimed?'Estado actualizado.':'Agente vinculado.');}catch(e){toast.error((e as Error).message);}}}>{!account.isClaimed?'Vincular a mi cuenta':account.isActive?'Desactivar agente':'Reactivar agente'}</Button>
                        <Button
                          onClick={() => handleSelectAccount(account)}
                          disabled={selectingAccountId === account.id || !account.isActive}
                          isLoading={selectingAccountId === account.id}
                        >
                          {selectingAccountId === account.id ? copy.connecting : copy.enterApp}
                        </Button>
                      </div>

                      {!account.isClaimed&&<p className="text-sm text-muted-foreground">Vincula el agente con su clave API para gestionar su cuenta y activar los avisos por correo.</p>}

                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
