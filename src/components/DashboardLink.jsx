import React from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

export function DashboardLink() {
  return (
    <Link 
      to="/" 
      className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-gray-800 rounded-xl transition-all duration-300 shadow-sm hover:shadow-md hover:-translate-y-0.5 border border-transparent hover:border-blue-200 dark:hover:border-blue-800"
      title="Back to Dashboard"
    >
      <Home size={16} />
      <span className="hidden sm:inline">Dashboard</span>
    </Link>
  );
}
