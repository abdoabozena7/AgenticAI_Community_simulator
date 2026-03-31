import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { RippleButton } from '@/components/ui/ripple-button';
import { ArrowRight, Play } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { VideoModal } from './VideoModal';

interface HeroSectionProps {
  onGetStarted: () => void;
}

export function HeroSection({ onGetStarted }: HeroSectionProps) {
  const { t, isRTL } = useLanguage();
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const subtitleRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const badgeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power4.out' } });

      tl.fromTo(
        badgeRef.current,
        { opacity: 0, y: 30, scale: 0.9 },
        { opacity: 1, y: 0, scale: 1, duration: 0.8 }
      )
        .fromTo(
          titleRef.current,
          { opacity: 0, y: 60, rotateX: 15 },
          { opacity: 1, y: 0, rotateX: 0, duration: 1 },
          '-=0.4'
        )
        .fromTo(
          subtitleRef.current,
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 0.8 },
          '-=0.6'
        )
        .fromTo(
          ctaRef.current,
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 0.6 },
          '-=0.4'
        );

      // Floating animation for badge
      gsap.to(badgeRef.current, {
        y: -5,
        duration: 2,
        repeat: -1,
        yoyo: true,
        ease: 'sine.inOut',
      });

      // Parallax scroll effect
      gsap.to(titleRef.current, {
        yPercent: 30,
        ease: 'none',
        scrollTrigger: {
          trigger: containerRef.current,
          start: 'top top',
          end: 'bottom top',
          scrub: 1,
        },
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={containerRef}
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 pb-16 pt-28 md:pt-32"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_10%,rgba(120,72,190,0.14),transparent_52%),linear-gradient(180deg,rgba(0,0,0,0.02),rgba(0,0,0,0.18))]" />

      {/* Animated grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage:
            'linear-gradient(hsl(var(--foreground) / 0.1) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground) / 0.1) 1px, transparent 1px)',
          backgroundSize: '84px 84px',
        }}
      />

      {/* Ambient glow */}
      <div className="pointer-events-none absolute left-1/2 top-[40%] h-[540px] w-[540px] -translate-x-1/2 -translate-y-1/2 opacity-[0.12] blur-3xl">
        <div 
          className="w-full h-full rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(82, 39, 255, 0.92) 0%, rgba(38, 22, 86, 0.72) 48%, transparent 76%)',
          }}
        />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center text-center">
        {/* Badge */}
        <div ref={badgeRef} className="mb-7 md:mb-9">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-foreground/85 backdrop-blur-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background">
              <span className="text-[11px] font-bold leading-none">AS</span>
            </div>
            <span className="font-medium tracking-tight">ASSET</span>
          </div>
        </div>

        {/* Title */}
        <h1
          ref={titleRef}
          className={`${isRTL ? 'hero-title-ar' : 'font-display'} font-semibold text-foreground ${
            isRTL
              ? 'text-[3.4rem] leading-[1.1] tracking-[-0.02em] md:text-[4.6rem] lg:text-[5.15rem] mb-4 whitespace-nowrap'
              : 'max-w-[10.5ch] text-5xl leading-[1.02] tracking-[-0.05em] md:text-7xl lg:text-[7rem] mb-4'
          }`}
          style={{ perspective: '1000px' }}
        >
          {isRTL ? (
            <span className="block text-foreground">
              {t('hero.title1')} {t('hero.title2')}
            </span>
          ) : (
            <>
              <span className="block">{t('hero.title1')}</span>
              <span className="mt-1 block text-foreground">
                {t('hero.title2')}
              </span>
            </>
          )}
        </h1>

        {/* Subtitle */}
        <p
          ref={subtitleRef}
          className={`text-muted-foreground mx-auto ${
            isRTL
              ? 'mb-8 max-w-xl text-[1rem] leading-[1.85] md:text-[1.08rem]'
              : 'mb-8 max-w-2xl text-lg leading-relaxed md:text-[1.15rem]'
          }`}
        >
          {t('hero.subtitle')}
        </p>

        {/* CTAs */}
        <div ref={ctaRef} className="flex flex-col items-center justify-center gap-3 sm:flex-row">
          <RippleButton
            onClick={onGetStarted}
            size="lg"
            rippleColor="rgba(0, 255, 255, 0.3)"
            className="group min-w-[230px] rounded-full bg-foreground px-8 py-5 text-[0.98rem] font-semibold text-background hover:bg-foreground/90 rgb-shadow-hover"
          >
            {t('hero.cta')}
            <ArrowRight className={`w-4 h-4 ${isRTL ? 'mr-2 group-hover:-translate-x-1' : 'ml-2 group-hover:translate-x-1'} transition-transform`} />
          </RippleButton>

          <RippleButton
            onClick={() => setIsVideoOpen(true)}
            variant="ghost"
            size="lg"
            rippleColor="rgba(255, 0, 255, 0.2)"
            className="rounded-full px-7 py-5 text-[0.98rem] text-foreground/72 hover:bg-white/[0.04] hover:text-foreground rgb-shadow-hover"
          >
            <Play className={`w-4 h-4 ${isRTL ? 'ml-2' : 'mr-2'}`} />
            {t('hero.watchDemo')}
          </RippleButton>
        </div>

        <VideoModal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} />
      </div>

      {/* Scroll indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2">
        <div className="w-6 h-10 rounded-full border-2 border-border flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-muted-foreground rounded-full animate-bounce" />
        </div>
      </div>
    </section>
  );
}
