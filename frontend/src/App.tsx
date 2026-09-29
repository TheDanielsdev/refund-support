import AdminPage from '@/pages/AdminPage';
import ChatPage from '@/pages/ChatPage';
import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom';

const link = ({ isActive }: { isActive: boolean }) =>
  `rounded px-3 py-1.5 text-sm ${isActive ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`;

export default function App() {
  return (
    <BrowserRouter>
      <header className="flex items-center justify-between border-b px-6 py-3">
        <span className="font-semibold">Refund Support</span>
        <nav className="flex gap-2">
          <NavLink to="/" end className={link}>Customer</NavLink>
          <NavLink to="/admin" className={link}>Admin</NavLink>
        </nav>
      </header>
      <Routes>
        <Route path="/" element={<ChatPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}