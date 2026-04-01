import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Moon, Sun, User, Languages, ArrowLeft, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useTheme } from '@/contexts/ThemeContext';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDarkTheme = theme === 'dark';

  const [appSettings, setAppSettings] = useState(() => {
    if (typeof window === 'undefined') {
      return { language: 'ar' as 'en' | 'ar', theme: 'dark' as 'dark' | 'light' };
    }
    try {
      const saved = window.localStorage.getItem('appSettings');
      if (!saved) return { language: 'ar' as 'en' | 'ar', theme: 'dark' as 'dark' | 'light' };
      const parsed = JSON.parse(saved);
      return {
        language: parsed?.language === 'en' ? 'en' : 'ar',
        theme: parsed?.theme === 'light' ? 'light' : 'dark',
      } as { language: 'en' | 'ar'; theme: 'dark' | 'light' };
    } catch {
      return { language: 'ar' as 'en' | 'ar', theme: 'dark' as 'dark' | 'light' };
    }
  });

  const [profileSettings, setProfileSettings] = useState(() => {
    if (typeof window === 'undefined') {
      return { name: '', email: '', photo: '' };
    }
    try {
      const saved = window.localStorage.getItem('profileSettings');
      if (!saved) return { name: '', email: '', photo: '' };
      const parsed = JSON.parse(saved);
      return {
        name: typeof parsed?.name === 'string' ? parsed.name : '',
        email: typeof parsed?.email === 'string' ? parsed.email : '',
        photo: typeof parsed?.photo === 'string' ? parsed.photo : '',
      };
    } catch {
      return { name: '', email: '', photo: '' };
    }
  });

  const t = (en: string, ar: string) => (appSettings.language === 'ar' ? ar : en);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.lang = appSettings.language;
    root.dir = appSettings.language === 'ar' ? 'rtl' : 'ltr';
    root.classList.toggle('rtl', appSettings.language === 'ar');
    root.classList.toggle('lang-ar', appSettings.language === 'ar');
    root.classList.remove('theme-dark', 'theme-light');
    root.classList.add(`theme-${appSettings.theme}`);
    setTheme(appSettings.theme);
    try {
      const saved = window.localStorage.getItem('appSettings');
      const parsed = saved ? JSON.parse(saved) : {};
      window.localStorage.setItem('appSettings', JSON.stringify({ ...parsed, ...appSettings }));
    } catch {
      // ignore
    }
  }, [appSettings, setTheme]);

  const handleSaveProfile = () => {
    try {
      window.localStorage.setItem('profileSettings', JSON.stringify(profileSettings));
    } catch {
      // ignore
    }
  };

  const shellClassName = isDarkTheme ? 'bg-[#050505] text-zinc-100' : 'bg-[#f4f1eb] text-slate-900';
  const panelClassName = isDarkTheme ? 'bg-[#111113] text-zinc-100 border-white/10' : 'bg-white text-slate-900 border-black/10';
  const panelSoftClassName = isDarkTheme ? 'bg-[#141416] text-zinc-100 border-white/10' : 'bg-[#fffdfa] text-slate-900 border-black/10';
  const mutedTextClassName = isDarkTheme ? 'text-zinc-400' : 'text-slate-500';
  const inputClassName = isDarkTheme
    ? 'bg-[#111113] border-white/10 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-white/20'
    : 'bg-white border-black/10 text-slate-900 placeholder:text-slate-400 focus-visible:ring-[#006a61]/20';
  const buttonPillClassName = isDarkTheme
    ? 'border-white/10 bg-[#111113] text-zinc-300 hover:bg-white/5'
    : 'border-black/10 bg-white text-slate-600 hover:bg-black/5';
  const buttonPillActiveClassName = isDarkTheme
    ? 'border-white/15 bg-white text-black'
    : 'border-black/10 bg-[#100c3d] text-white';

  const updateLanguage = (language: 'en' | 'ar') => {
    setAppSettings((prev) => ({ ...prev, language }));
  };

  const updateTheme = (nextTheme: 'dark' | 'light') => {
    setAppSettings((prev) => ({ ...prev, theme: nextTheme }));
  };

  return (
    <div className={cn('relative min-h-screen overflow-hidden transition-colors duration-300', shellClassName)}>
      <div
        className={cn(
          'pointer-events-none absolute inset-0 opacity-80',
          isDarkTheme
            ? 'bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.08),_transparent_28%),radial-gradient(circle_at_top_right,_rgba(22,163,74,0.12),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.02),_transparent_35%)]'
            : 'bg-[radial-gradient(circle_at_top_left,_rgba(16,12,61,0.08),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(0,106,97,0.10),_transparent_25%),linear-gradient(180deg,_rgba(255,255,255,0.55),_transparent_35%)]'
        )}
      />

      <div className="relative mx-auto w-full max-w-5xl px-6 py-8 lg:px-10 lg:py-10">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className={cn('text-xs uppercase tracking-[0.32em]', mutedTextClassName)}>{t('System settings', 'إعدادات النظام')}</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t('Settings', 'الإعدادات')}</h1>
            <p className={cn('mt-2 text-sm leading-7', mutedTextClassName)}>
              {t(
                'Keep language, theme, and profile details aligned with the shared architectural system.',
                'حافظ على اللغة والمظهر وبيانات الملف الشخصي متوافقة مع النظام البصري المشترك.',
              )}
            </p>
          </div>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className={cn(
              'inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition-colors',
              isDarkTheme ? 'border-white/10 bg-[#111113] text-zinc-100 hover:bg-white/5' : 'border-black/10 bg-white text-slate-900 hover:bg-black/5',
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            {t('Back', 'رجوع')}
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <section className={cn('rounded-[1.75rem] border p-6 shadow-[0_24px_60px_-45px_rgba(0,0,0,0.55)]', panelClassName)}>
            <div className="flex items-center gap-3">
              <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', isDarkTheme ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10')}>
                <User className={cn('h-5 w-5', isDarkTheme ? 'text-zinc-100' : 'text-slate-900')} />
              </div>
              <div>
                <div className="text-sm font-medium">{t('Profile', 'الملف الشخصي')}</div>
                <div className={cn('text-xs', mutedTextClassName)}>{t('Name, email, and avatar are saved locally.', 'يتم حفظ الاسم والبريد والصورة محليًا.')}</div>
              </div>
            </div>

            <div className="mt-6 grid gap-4">
              <div>
                <label className={cn('mb-2 block text-sm font-medium', mutedTextClassName)}>{t('Name', 'الاسم')}</label>
                <Input
                  value={profileSettings.name}
                  placeholder={t('Your display name', 'اسم العرض')}
                  onChange={(event) => setProfileSettings((prev) => ({ ...prev, name: event.target.value }))}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className={cn('mb-2 block text-sm font-medium', mutedTextClassName)}>{t('Email', 'البريد الإلكتروني')}</label>
                <Input
                  value={profileSettings.email}
                  placeholder={t('name@example.com', 'name@example.com')}
                  onChange={(event) => setProfileSettings((prev) => ({ ...prev, email: event.target.value }))}
                  className={inputClassName}
                />
              </div>
              <div>
                <label className={cn('mb-2 block text-sm font-medium', mutedTextClassName)}>{t('Photo URL', 'رابط الصورة')}</label>
                <Input
                  value={profileSettings.photo}
                  placeholder={t('Paste an image URL', 'ألصق رابط صورة')}
                  onChange={(event) => setProfileSettings((prev) => ({ ...prev, photo: event.target.value }))}
                  className={inputClassName}
                />
              </div>
            </div>
          </section>

          <div className="grid gap-6">
            <section className={cn('rounded-[1.75rem] border p-6', panelClassName)}>
              <div className="flex items-center gap-3">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', isDarkTheme ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10')}>
                  <Languages className={cn('h-5 w-5', isDarkTheme ? 'text-zinc-100' : 'text-slate-900')} />
                </div>
                <div>
                  <div className="text-sm font-medium">{t('Language', 'اللغة')}</div>
                  <div className={cn('text-xs', mutedTextClassName)}>{t('Arabic is RTL and treated as a first-class layout.', 'اللغة العربية RTL ومُعالجة كاتجاه أساسي.')}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateLanguage('en')}
                  className={cn('rounded-full px-4 py-2 text-sm transition-colors', appSettings.language === 'en' ? buttonPillActiveClassName : buttonPillClassName)}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => updateLanguage('ar')}
                  className={cn('rounded-full px-4 py-2 text-sm transition-colors', appSettings.language === 'ar' ? buttonPillActiveClassName : buttonPillClassName)}
                >
                  العربية
                </button>
              </div>
            </section>

            <section className={cn('rounded-[1.75rem] border p-6', panelClassName)}>
              <div className="flex items-center gap-3">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', isDarkTheme ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10')}>
                  {isDarkTheme ? <Moon className={cn('h-5 w-5', isDarkTheme ? 'text-zinc-100' : 'text-slate-900')} /> : <Sun className={cn('h-5 w-5', isDarkTheme ? 'text-zinc-100' : 'text-slate-900')} />}
                </div>
                <div>
                  <div className="text-sm font-medium">{t('Theme', 'المظهر')}</div>
                  <div className={cn('text-xs', mutedTextClassName)}>{t('Uses the same system shell for dark and light modes.', 'يستخدم نفس نظام الواجهة في الوضعين الداكن والفاتح.')}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateTheme('dark')}
                  className={cn('rounded-full px-4 py-2 text-sm transition-colors', appSettings.theme === 'dark' ? buttonPillActiveClassName : buttonPillClassName)}
                >
                  {t('Dark', 'داكن')}
                </button>
                <button
                  type="button"
                  onClick={() => updateTheme('light')}
                  className={cn('rounded-full px-4 py-2 text-sm transition-colors', appSettings.theme === 'light' ? buttonPillActiveClassName : buttonPillClassName)}
                >
                  {t('Light', 'فاتح')}
                </button>
              </div>
            </section>

            <section className={cn('rounded-[1.75rem] border p-6', panelSoftClassName)}>
              <div className="flex items-center gap-3">
                <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', isDarkTheme ? 'bg-white/5 border-white/10' : 'bg-black/5 border-black/10')}>
                  <Check className={cn('h-5 w-5', isDarkTheme ? 'text-emerald-300' : 'text-[#006a61]')} />
                </div>
                <div>
                  <div className="text-sm font-medium">{t('Save', 'الحفظ')}</div>
                  <div className={cn('text-xs', mutedTextClassName)}>{t('Profile changes are stored locally in this browser.', 'يتم حفظ التغييرات محليًا في هذا المتصفح.')}</div>
                </div>
              </div>

              <div className="mt-5 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => navigate(-1)}
                  className={cn(
                    'rounded-full border px-4 py-2 text-sm transition-colors',
                    isDarkTheme ? 'border-white/10 bg-transparent text-zinc-300 hover:bg-white/5' : 'border-black/10 bg-transparent text-slate-600 hover:bg-black/5',
                  )}
                >
                  {t('Cancel', 'إلغاء')}
                </button>
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  className={cn(
                    'rounded-full px-4 py-2 text-sm font-semibold transition-colors',
                    isDarkTheme ? 'bg-white text-black hover:bg-zinc-200' : 'bg-[#100c3d] text-white hover:bg-[#1a154f]',
                  )}
                >
                  {t('Save changes', 'حفظ التغييرات')}
                </button>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
