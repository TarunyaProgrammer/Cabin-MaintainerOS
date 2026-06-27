import React from 'react';
import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ReviewQueue } from './components/ReviewQueue';
import { Repositories } from './components/Repositories';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { ReviewPage } from './components/ReviewPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/queue" element={<ReviewQueue />} />
            <Route path="/repos" element={<Repositories />} />
            <Route path="/history" element={<History />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/review/:prNumber" element={<ReviewPage />} />
          </Route>
        </Routes>
      </Router>
    </QueryClientProvider>
  );
};
