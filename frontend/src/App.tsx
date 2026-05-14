import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import Index from "./pages/Index";
import MarketingLandingPage from "./pages/MarketingLandingPage";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { PageTransition } from "@/components/PageTransition";
import { isLandingOnlyMode } from "@/lib/runtime";

const queryClient = new QueryClient();
const routerBasename = (import.meta.env.BASE_URL || "/").replace(/\/$/, "") || "/";

const applyLanguageSettings = (language?: string | null) => {
  if (typeof document === 'undefined') return;
  const lang = language === 'ar' ? 'ar' : language === 'en' ? 'en' : null;
  if (!lang) return;
  const root = document.documentElement;
  root.lang = lang;
  root.dir = lang === 'ar' ? 'rtl' : 'ltr';
  root.classList.toggle('rtl', lang === 'ar');
  root.classList.toggle('lang-ar', lang === 'ar');
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <LanguageProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <ErrorBoundary>
            <BrowserRouter basename={routerBasename}>
              <PageTransition>
                <AppShell />
              </PageTransition>
            </BrowserRouter>
          </ErrorBoundary>
        </TooltipProvider>
      </LanguageProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

const AppShell = () => {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem('appSettings');
      if (!saved) return;
      const parsed = JSON.parse(saved);
      applyLanguageSettings(parsed?.language);
    } catch {
      // ignore
    }
  }, []);

  if (isLandingOnlyMode) {
    return (
      <Routes>
        <Route path="*" element={<MarketingLandingPage />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<MarketingLandingPage />} />
      <Route path="/simulate" element={<Index />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

export default App;
