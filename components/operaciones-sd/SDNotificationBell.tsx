import React, { useEffect, useRef, useState } from 'react';
import { SDNotification, SDTask } from '../../types';
import { formatDate } from '../../utils/helpers';

interface Props {
  notifications: SDNotification[];
  tasks: SDTask[];
  onOpenTask: (task: SDTask) => void;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
}

const TYPE_ICON: Record<string, string> = {
  assignment: 'fa-user-check text-blue-500',
  date_change: 'fa-calendar-day text-amber-500',
  comment: 'fa-comment text-indigo-500',
  block: 'fa-lock text-red-500',
  vendor_support: 'fa-headset text-purple-500',
  due_soon: 'fa-clock text-orange-500',
  dependency_resolved: 'fa-link text-emerald-500'
};

const SDNotificationBell: React.FC<Props> = ({ notifications, tasks, onOpenTask, onMarkRead, onMarkAllRead }) => {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleClick = (n: SDNotification) => {
    if (!n.isRead) onMarkRead(n.id);
    const task = tasks.find(t => t.id === n.taskId);
    if (task) onOpenTask(task);
    setOpen(false);
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <button onClick={() => setOpen(!open)} className="relative w-11 h-11 rounded-2xl bg-white dark:bg-dark-card border border-gray-100 dark:border-dark-border flex items-center justify-center text-gray-500 dark:text-gray-300 hover:text-blue-600 transition-colors shadow-sm">
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-black flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-[100] mt-2 w-96 bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 rounded-2xl shadow-2xl max-h-[28rem] overflow-y-auto">
          <div className="flex items-center justify-between p-4 border-b border-gray-50 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
            <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Notificaciones</span>
            {unreadCount > 0 && (
              <button onClick={onMarkAllRead} className="text-[10px] font-bold text-blue-600 uppercase hover:underline">Marcar todo leído</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p className="p-6 text-xs text-gray-400 italic text-center">Sin notificaciones.</p>
          ) : (
            notifications.slice(0, 30).map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left flex items-start gap-3 p-4 border-b border-gray-50 dark:border-slate-700/60 hover:bg-gray-50 dark:hover:bg-slate-700/40 transition-colors ${!n.isRead ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
              >
                <i className={`fas ${TYPE_ICON[n.type] || 'fa-bell text-gray-400'} mt-0.5 text-sm`}></i>
                <div className="flex-1">
                  <p className={`text-xs ${!n.isRead ? 'font-bold text-gray-800 dark:text-white' : 'text-gray-500 dark:text-gray-400'}`}>{n.message}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{formatDate(n.createdAt)}</p>
                </div>
                {!n.isRead && <span className="w-2 h-2 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default SDNotificationBell;
