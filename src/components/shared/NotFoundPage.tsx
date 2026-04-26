import React from 'react';
import { Home, AlertTriangle } from 'lucide-react';

interface NotFoundPageProps {
  onNavigate?: (page: string) => void;
}

const NotFoundPage: React.FC<NotFoundPageProps> = ({ onNavigate }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900">
      <div className="text-center max-w-md mx-auto px-4">
        <div className="mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-500/20 border border-red-500/30 rounded-full mb-4">
            <AlertTriangle className="w-8 h-8 text-red-400" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Page Not Found</h1>
          <p className="text-slate-400 text-lg">
            The page you're looking for doesn't exist or is under development.
          </p>
        </div>

        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            This feature is currently being developed. Please check back later or explore other features.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => onNavigate?.('dashboard')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Home className="w-4 h-4" />
              Return to Dashboard
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>

        <div className="mt-8 text-sm text-slate-600">
          Error Code: 404
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;