import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Dumbbell,
  CalendarDays,
  History,
  Settings,
  Play,
} from 'lucide-react';

const navItems = [
  { path: '/', label: 'Home', icon: LayoutDashboard },
  { path: '/exercises', label: 'Exercises', icon: Dumbbell },
  { path: '/workouts', label: 'Workouts', icon: Play },
  { path: '/planner', label: 'Plan', icon: CalendarDays },
  { path: '/history', label: 'History', icon: History },
  { path: '/settings', label: 'Settings', icon: Settings },
];

export default function BottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white pb-safe dark:border-slate-700 dark:bg-slate-900 md:hidden">
      <div className="flex items-center justify-around">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center py-2 px-3 text-xs transition-colors ${
                isActive
                  ? 'text-emerald-600 dark:text-emerald-400'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="h-5 w-5" strokeWidth={isActive ? 2.5 : 2} />
              <span className="mt-0.5">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
