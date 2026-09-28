import { ErrorBoundary } from '@shared/components/ErrorBoundary/ErrorBoundary';
import { AppRoutes } from './routes/AppRoutes';

export default function App() {
  return (
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  );
}
