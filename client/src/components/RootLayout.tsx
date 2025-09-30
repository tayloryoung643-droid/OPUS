import { Outlet } from 'react-router-dom';
import { OpusProvider } from '@/contexts/OpusProvider';
import OpusDock from '@/components/OpusDock';

export default function RootLayout() {
  return (
    <OpusProvider>
      {/* Page content */}
      <Outlet />
      
      {/* Global Opus Dock - appears on all pages */}
      <OpusDock />
    </OpusProvider>
  );
}