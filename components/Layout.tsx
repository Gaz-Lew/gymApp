import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav';
import { useAuth } from '../context/AuthContext';

export default function Layout() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <main className={`mx-auto max-w-4xl ${user ? 'pb-20 md:pb-6' : ''}`}>
        <Outlet />
      </main>
      {user && <BottomNav />}
    </div>
  );
}
