import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { VideoModal } from './VideoModal';
import { LANDING_DEMO_VIDEO_URL } from './landingDemo';

export function LandingVideoSection() {
  const { language } = useLanguage();
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const playButtonRef = useRef<HTMLButtonElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentPositionRef = useRef({ x: 78, y: 24 });
  const targetPositionRef = useRef({ x: 78, y: 24 });
  const playLabel = language === 'ar' ? 'شاهد المقدمة' : 'Play intro';

  useEffect(() => {
    const animate = () => {
      const current = currentPositionRef.current;
      const target = targetPositionRef.current;

      current.x += (target.x - current.x) * 0.16;
      current.y += (target.y - current.y) * 0.16;

      if (playButtonRef.current) {
        playButtonRef.current.style.left = `${current.x}%`;
        playButtonRef.current.style.top = `${current.y}%`;
      }

      animationFrameRef.current = window.requestAnimationFrame(animate);
    };

    animationFrameRef.current = window.requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  return (
    <section id="how-it-works" className="relative px-2 pb-12 pt-2 md:px-6 md:pb-16">
      <div className="mx-auto max-w-[1920px]">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-black">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_30%,rgba(89,76,255,0.22),transparent_18%),radial-gradient(circle_at_82%_72%,rgba(144,114,255,0.2),transparent_18%)]" />
          <div className="pointer-events-none absolute inset-0 opacity-70">
            <div className="absolute left-[8%] top-[18%] h-[22%] w-[22%] bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0_1.5px,transparent_1.6px)] bg-[length:22px_22px]" />
            <div className="absolute bottom-[10%] right-[6%] h-[26%] w-[26%] bg-[radial-gradient(circle,rgba(140,124,255,0.95)_0_1.5px,transparent_1.6px)] bg-[length:22px_22px]" />
          </div>

          <div className="relative px-4 py-8 md:px-12 md:py-16">
            <div className="mx-auto max-w-[1180px] overflow-hidden rounded-[2rem] bg-[#f6f4ef]">
              <div
                className="relative aspect-[16/9] cursor-none"
                onMouseEnter={() => setIsHoveringVideo(true)}
                onMouseLeave={() => {
                  setIsHoveringVideo(false);
                  targetPositionRef.current = { x: 78, y: 24 };
                }}
                onMouseMove={(event) => {
                  const rect = event.currentTarget.getBoundingClientRect();
                  const nextX = ((event.clientX - rect.left) / rect.width) * 100;
                  const nextY = ((event.clientY - rect.top) / rect.height) * 100;
                  targetPositionRef.current = {
                    x: Math.min(88, Math.max(12, nextX)),
                    y: Math.min(84, Math.max(16, nextY)),
                  };
                }}
              >
                <video
                  className="h-full w-full object-cover"
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="metadata"
                >
                  <source src={LANDING_DEMO_VIDEO_URL} type="video/mp4" />
                </video>

                <button
                  ref={playButtonRef}
                  type="button"
                  onClick={() => setIsVideoOpen(true)}
                  className="absolute hidden rounded-full bg-white/96 px-6 py-3 text-sm font-medium text-black shadow-[0_14px_34px_-18px_rgba(0,0,0,0.45)] backdrop-blur transition-[left,top,transform,opacity] duration-200 ease-out md:block"
                  style={{
                    left: '78%',
                    top: '24%',
                    transform: `translate(-50%, -50%) scale(${isHoveringVideo ? 1 : 0.96})`,
                    opacity: isHoveringVideo ? 1 : 0.88,
                    willChange: 'left, top, transform, opacity',
                  }}
                >
                  <span className="flex items-center gap-3">
                    <Play className="h-4 w-4 fill-current" />
                    {playLabel}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsVideoOpen(true)}
                  className="absolute bottom-5 right-5 rounded-full bg-white/96 px-5 py-3 text-sm font-medium text-black shadow-[0_14px_34px_-18px_rgba(0,0,0,0.45)] backdrop-blur md:hidden"
                >
                  <span className="flex items-center gap-3">
                    <Play className="h-4 w-4 fill-current" />
                    {playLabel}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <VideoModal isOpen={isVideoOpen} onClose={() => setIsVideoOpen(false)} />
    </section>
  );
}
