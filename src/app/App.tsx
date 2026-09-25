import React, { useEffect } from 'react';
import { AppProviders } from './providers/AppProviders';
import { AppRouter } from './router/AppRouter';
import { spotifyService } from '@/services/api/spotifyService';

export const App: React.FC = () => {
  useEffect(() => {
    // Spotify OAuth yönlendirmesinden sonra URL'deki ?code=... parametresini yakalar ve user token alır
    spotifyService.handleAuthCallback();
  }, []);

  return (
    <AppProviders>
      <AppRouter />
    </AppProviders>
  );
};

export default App;
