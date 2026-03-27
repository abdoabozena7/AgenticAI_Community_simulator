import { motion, AnimatePresence } from 'framer-motion';
import { Bell, CheckCircle, AlertTriangle, Brain, Zap, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/lib/utils';

export interface NotificationItem {
  id: string;
  type: 'success' | 'warning' | 'info' | 'ai';
  title: string;
  titleAr: string;
  message: string;
  messageAr: string;
  time: string;
  read: boolean;
}

interface NotificationsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  items: NotificationItem[];
  loading?: boolean;
  onMarkAllRead?: () => void;
  onMarkRead?: (id: string) => void;
}

export default function NotificationsPanel({
  isOpen,
  onClose,
  items,
  loading = false,
  onMarkAllRead,
  onMarkRead,
}: NotificationsPanelProps) {
  const { isRTL } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const unreadCount = items.filter((n) => !n.read).length;

  const getIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-emerald-500" />;
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-500" />;
      case 'ai':
        return <Brain className="h-5 w-5 text-slate-700 dark:text-white" />;
      case 'info':
        return <Zap className="h-5 w-5 text-slate-700 dark:text-white" />;
    }
  };

  const shellClass = cn(
    'absolute top-full z-50 mt-2 w-[24rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-[28px] shadow-[0_28px_70px_-36px_rgba(0,0,0,0.5)]',
    isDark ? 'bg-zinc-950 text-white ring-1 ring-white/10' : 'bg-white text-slate-900 ring-1 ring-black/5',
  );
  const surfaceClass = isDark ? 'bg-white/5 text-white/80 ring-1 ring-white/10' : 'bg-slate-50 text-slate-800 ring-1 ring-black/5';
  const mutedClass = isDark ? 'text-white/55' : 'text-slate-500';
  const titleClass = isDark ? 'text-white' : 'text-slate-900';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            className={cn(shellClass, isRTL ? 'left-0' : 'right-0')}
          >
            <div className={cn('flex items-center justify-between px-4 py-4', isDark ? 'bg-white/[0.03]' : 'bg-slate-50')}>
              <div className="flex items-center gap-2">
                <span className={cn('flex h-9 w-9 items-center justify-center rounded-2xl', isDark ? 'bg-white/5' : 'bg-white')}>
                  <Bell className={cn('h-4.5 w-4.5', titleClass)} />
                </span>
                <div>
                  <p className={cn('text-sm font-semibold', titleClass)}>{isRTL ? 'الإشعارات' : 'Notifications'}</p>
                  <p className={cn('text-xs', mutedClass)}>{isRTL ? 'سجل الأحداث والتنبيهات' : 'Event and alert stream'}</p>
                </div>
                {unreadCount > 0 ? (
                  <span className={cn('ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium', isDark ? 'bg-emerald-500/15 text-emerald-300' : 'bg-emerald-50 text-emerald-700')}>
                    {unreadCount}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && onMarkAllRead ? (
                  <button
                    onClick={onMarkAllRead}
                    className={cn('rounded-full px-3 py-1 text-xs font-medium transition-colors', isDark ? 'bg-white/5 text-white/75 hover:bg-white/10' : 'bg-slate-100 text-slate-700 hover:bg-slate-200')}
                  >
                    {isRTL ? 'قراءة الكل' : 'Mark all read'}
                  </button>
                ) : null}
                <button
                  onClick={onClose}
                  className={cn('rounded-full p-2 transition-colors', isDark ? 'bg-white/5 text-white/70 hover:bg-white/10' : 'bg-slate-100 text-slate-600 hover:bg-slate-200')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className={cn('max-h-96 overflow-y-auto p-2', isDark ? 'bg-black' : 'bg-white')}>
              {loading ? (
                <div className={cn('rounded-2xl px-4 py-6 text-sm', surfaceClass)}>
                  {isRTL ? 'جارٍ تحميل الإشعارات...' : 'Loading notifications...'}
                </div>
              ) : items.length === 0 ? (
                <div className={cn('rounded-2xl px-4 py-6 text-sm', surfaceClass)}>
                  {isRTL ? 'لا توجد إشعارات بعد.' : 'No notifications yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {items.map((notif) => (
                    <button
                      key={notif.id}
                      type="button"
                      onClick={() => onMarkRead?.(notif.id)}
                      className={cn(
                        'w-full rounded-[22px] px-4 py-4 text-left transition-colors',
                        notif.read
                          ? isDark
                          ? 'bg-white/5 hover:bg-white/10'
                            : 'bg-slate-50 hover:bg-slate-100'
                          : isDark
                            ? 'bg-white/10 hover:bg-white/10'
                            : 'bg-slate-100 hover:bg-slate-200',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl', notif.type === 'ai' ? (isDark ? 'bg-white/10' : 'bg-slate-100') : surfaceClass)}>
                          {getIcon(notif.type)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className={cn('text-sm font-medium', titleClass)}>{isRTL ? notif.titleAr : notif.title}</p>
                            {!notif.read ? <span className={cn('h-2 w-2 rounded-full', isDark ? 'bg-emerald-400' : 'bg-emerald-500')} /> : null}
                          </div>
                          <p className={cn('mt-1 line-clamp-2 text-xs leading-6', mutedClass)}>{isRTL ? notif.messageAr : notif.message}</p>
                          <span className={cn('mt-1 block text-[11px]', mutedClass)}>{notif.time}</span>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
