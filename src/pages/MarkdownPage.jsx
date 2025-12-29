import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, FileText, Loader2, AlertCircle } from 'lucide-react';
import MarkdownViewer from '../components/MarkdownViewer';

/**
 * MarkdownPage Component
 * Loads and displays markdown files from the /docs/ directory
 */
export default function MarkdownPage() {
  const { filename } = useParams();
  const navigate = useNavigate();
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadMarkdown = async () => {
      if (!filename) {
        setError('No filename provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Ensure filename ends with .md
        const mdFilename = filename.endsWith('.md') ? filename : `${filename}.md`;
        
        // Fetch markdown file from public/docs/
        const response = await fetch(`/docs/${mdFilename}`);
        
        if (!response.ok) {
          throw new Error(`Failed to load markdown file: ${response.statusText}`);
        }
        
        const text = await response.text();
        setContent(text);
      } catch (err) {
        console.error('Error loading markdown:', err);
        setError(err.message || 'Failed to load markdown file');
      } finally {
        setLoading(false);
      }
    };

    loadMarkdown();
  }, [filename]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 dark:text-blue-400 mx-auto mb-4" />
          <p className="text-gray-600 dark:text-gray-400">Loading document...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-4 py-20">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
          <div className="flex items-start gap-3 mb-4">
            <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-1" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                Error Loading Document
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => navigate(-1)}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-300 dark:hover:bg-gray-600 transition"
            >
              Go Back
            </button>
            <Link
              to="/thermostat-diagrams"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              View All Docs
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Extract title from first h1 or use filename
  const titleMatch = content.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1] : filename?.replace('.md', '').replace(/-/g, ' ') || 'Document';

  return (
    <div>
      {/* Document Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 rounded-t-lg mb-4">
        <div className="max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
            <div className="flex items-center gap-2 flex-1">
              <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
            </div>
            <Link
              to="/thermostat-diagrams"
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 transition"
            >
              All Docs
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-5xl mx-auto">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8 prose prose-lg dark:prose-invert max-w-none">
          <MarkdownViewer content={content} />
        </div>
      </div>
    </div>
  );
}

