'use client';

import { copy, identity } from '@/lib/copy';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Button, Card, CardHeader, CardContent } from '@/components/ui';
import { LogIn, Bug } from 'lucide-react';

export default function WelcomePage() {
  const searchParams = useSearchParams();
  const callback = searchParams.get('callbackUrl');
  const target = callback?.startsWith('/') && !callback.startsWith('//') && !callback.includes('\\') ? callback : '/';
  const [isLoading, setIsLoading] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);

  useEffect(() => {
    // Check if dev login is enabled
    fetch('/api/auth/dev-login', { method: 'HEAD' })
      .then(res => {
        setShowDevLogin(res.ok);
      })
      .catch(() => {});
  }, []);

  const handleGoogleLogin = () => {
    setIsLoading(true);
    window.location.href = `/api/auth/google?callbackUrl=${encodeURIComponent(target)}`;
  };

  const handleDevLogin = async () => {
    try {
      setIsLoading(true);

      const response = await fetch('/api/auth/dev-login', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(copy.devLoginFailed);
      }

      // Reload with the new cookie, matching the Google callback's navigation.
      window.location.assign(target);
    } catch (error) {
      console.error('Dev login error:', error);
      setIsLoading(false);
      alert(copy.devLoginFailedCheckConsoleForDetails);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-6">
          <p className="text-4xl sm:text-5xl font-semibold tracking-tight">{identity.name}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">{identity.tagline}</h1>
          <p className="text-base text-muted-foreground leading-relaxed">{identity.description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {searchParams.has('error') && <p role="alert">No pudimos completar el acceso con Google. Vuelve a intentarlo.</p>}
          <Button
            onClick={handleGoogleLogin}
            disabled={isLoading}
            isLoading={isLoading}
            className="w-full h-12 text-base"
            size="lg"
          >
            <LogIn className="mr-2 h-5 w-5" />
            {copy.continueWithGoogle}
          </Button>

          <Link href="/comunidades" className="mx-auto flex min-h-11 w-fit items-center px-3 text-center text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground">
            {copy.continueWithoutSigningIn}
          </Link>

          {showDevLogin && (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-2 text-muted-foreground">
                    {copy.developmentMode}
                  </span>
                </div>
              </div>

              <Button
                onClick={handleDevLogin}
                disabled={isLoading}
                variant="outline"
                className="w-full h-12 text-base border-border text-foreground hover:bg-muted dark:hover:bg-muted"
                size="lg"
              >
                <Bug className="mr-2 h-5 w-5" />
                {copy.devLoginSkipOAuth}
              </Button>

              <p className="text-xs text-center text-foreground dark:text-foreground">
                {copy.devModeEnabledThisButtonWillNotAppearIn}
              </p>
            </>
          )}

          <p className="text-xs text-center text-muted-foreground">
            {copy.byContinuingYouAgreeToOur}{' '}
            <a href="/terms" className="underline hover:text-foreground">
              {copy.termsOfService}
            </a>
            {' '}{copy.and}{' '}
            <a href="/privacy" className="underline hover:text-foreground">
              {copy.privacyPolicy}
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
