import { useEffect, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { Navbar } from '@/components/landing/Navbar';
import { HeroSection } from '@/components/landing/HeroSection';
import { LandingVideoSection } from '@/components/landing/LandingVideoSection';
import { ProblemSection } from '@/components/landing/ProblemSection';
import { SolutionSection } from '@/components/landing/SolutionSection';
import { SimulationSection } from '@/components/landing/SimulationSection';
import { FeaturesSection } from '@/components/landing/FeaturesSection';
import { PricingSection } from '@/components/landing/PricingSection';
import { CTASection } from '@/components/landing/CTASection';
import { FooterSection } from '@/components/landing/FooterSection';
import { isLandingOnlyMode } from '@/lib/runtime';

gsap.registerPlugin(ScrollTrigger);

const MarketingLandingPage = () => {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const navigate = useNavigate();

  const scrollToPricing = () => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const shellVars = useMemo<CSSProperties>(
    () =>
      theme === 'dark'
        ? ({
            '--background': '0 0% 4%',
            '--foreground': '40 20% 96%',
            '--card': '0 0% 7%',
            '--card-foreground': '40 20% 96%',
            '--popover': '0 0% 7%',
            '--popover-foreground': '40 20% 96%',
            '--primary': '40 20% 96%',
            '--primary-foreground': '0 0% 4%',
            '--secondary': '0 0% 11%',
            '--secondary-foreground': '40 20% 96%',
            '--muted': '0 0% 11%',
            '--muted-foreground': '0 0% 68%',
            '--accent': '0 0% 12%',
            '--accent-foreground': '40 20% 96%',
            '--destructive': '0 62.8% 55.6%',
            '--destructive-foreground': '0 0% 98%',
            '--border': '0 0% 16%',
            '--input': '0 0% 14%',
            '--ring': '40 20% 96%',
          } as CSSProperties)
        : ({
            '--background': '0 0% 97%',
            '--foreground': '230 46% 14%',
            '--card': '0 0% 100%',
            '--card-foreground': '230 46% 14%',
            '--popover': '0 0% 100%',
            '--popover-foreground': '230 46% 14%',
            '--primary': '230 46% 14%',
            '--primary-foreground': '0 0% 98%',
            '--secondary': '0 0% 92%',
            '--secondary-foreground': '230 46% 14%',
            '--muted': '0 0% 92%',
            '--muted-foreground': '230 15% 40%',
            '--accent': '0 0% 90%',
            '--accent-foreground': '230 46% 14%',
            '--destructive': '0 72% 48%',
            '--destructive-foreground': '0 0% 98%',
            '--border': '0 0% 84%',
            '--input': '0 0% 84%',
            '--ring': '230 46% 14%',
          } as CSSProperties),
    [theme]
  );

  useEffect(() => {
    document.documentElement.style.scrollBehavior = 'smooth';
    const handleResize = () => {
      ScrollTrigger.refresh();
    };
    window.addEventListener('resize', handleResize);
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  const handleProjectEntry = () => {
    if (isLandingOnlyMode) {
      scrollToPricing();
      return;
    }
    navigate('/simulate');
  };

  const handleGetStarted = () => {
    handleProjectEntry();
  };

  return (
    <div
      className={`architect-shell ${theme === 'dark' ? 'architect-shell-dark' : 'architect-shell-light'} relative min-h-screen overflow-hidden bg-background text-foreground transition-colors duration-300 ${isRTL ? 'rtl' : 'ltr'}`}
      style={shellVars}
    >
      <div className="relative z-10">
        <Navbar
          onLogin={handleProjectEntry}
          onRegister={handleGetStarted}
        />

        <HeroSection onGetStarted={handleGetStarted} />

        <LandingVideoSection />

        <ProblemSection />

        <SolutionSection />

        <SimulationSection />

        <FeaturesSection />

        <PricingSection onGetStarted={handleGetStarted} />

        <CTASection onGetStarted={handleGetStarted} />

        <FooterSection />
      </div>
    </div>
  );
};

export default MarketingLandingPage;
