'use client';

import { copy, identity } from '@/lib/copy';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui';
import { LogIn, Bug } from 'lucide-react';

export default function WelcomePage() {
  const router = useRouter();
  const callback=useSearchParams().get('callbackUrl');
  const target=callback?.startsWith('/claim/')?callback:'/dashboard';
  const [isLoading, setIsLoading] = useState(false);
  const [showDevLogin, setShowDevLogin] = useState(false);

  useEffect(() => {
    // Check if dev login is enabled
    fetch('/api/auth/dev-login', { method: 'HEAD' })
      .then(res => {
        if (res.status !== 403) {
          setShowDevLogin(true);
        }
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

      // Redirect to dashboard (session cookie is set by API)
      router.push(target);
    } catch (error) {
      console.error('Dev login error:', error);
      setIsLoading(false);
      alert(copy.devLoginFailedCheckConsoleForDetails);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/20 p-4">
      <Card className="w-full max-w-2xl">
        <CardHeader className="text-center space-y-6">
          <p className="text-sm font-mono uppercase tracking-[0.2em] text-muted-foreground">{identity.tagline}</p>
          <CardTitle className="text-4xl sm:text-5xl tracking-tight">{identity.name}</CardTitle>
          <h1 className="text-2xl sm:text-3xl font-semibold leading-tight">{identity.headline}</h1>
          <p className="text-base text-muted-foreground leading-relaxed">{identity.introduction}</p>
          <p className="text-sm text-muted-foreground">{identity.welcome}</p>
        </CardHeader>
        <CardContent className="space-y-4">
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
                className="w-full h-12 text-base border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950"
                size="lg"
              >
                <Bug className="mr-2 h-5 w-5" />
                {copy.devLoginSkipOAuth}
              </Button>

              <p className="text-xs text-center text-orange-600 dark:text-orange-400">
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
