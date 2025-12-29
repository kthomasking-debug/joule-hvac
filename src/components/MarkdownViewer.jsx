import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';

// Helper function to generate ID from heading text
const generateId = (children) => {
  if (!children) return '';
  // Extract text from React children (handles strings, arrays, etc.)
  const extractText = (node) => {
    if (typeof node === 'string') return node;
    if (typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(extractText).join('');
    if (node?.props?.children) return extractText(node.props.children);
    return '';
  };
  const text = extractText(children);
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
    .trim();
};

/**
 * MarkdownViewer Component
 * Renders markdown content with syntax highlighting, tables, and proper styling
 */
export default function MarkdownViewer({ content, className = '' }) {
  const [isDark, setIsDark] = useState(false);
  const contentRef = useRef(null);

  useEffect(() => {
    // Check for dark mode
    const checkDarkMode = () => {
      const isDarkMode = document.documentElement.classList.contains('dark') ||
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      setIsDark(isDarkMode);
    };

    checkDarkMode();
    
    // Watch for dark mode changes
    const observer = new MutationObserver(checkDarkMode);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', checkDarkMode);

    return () => {
      observer.disconnect();
      mediaQuery.removeEventListener('change', checkDarkMode);
    };
  }, []);

  // Handle anchor link clicks with smooth scrolling
  useEffect(() => {
    const handleAnchorClick = (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      
      const href = link.getAttribute('href');
      if (!href || href === '#') return;
      
      const targetId = href.substring(1); // Remove the #
      const targetElement = document.getElementById(targetId);
      
      if (targetElement) {
        e.preventDefault();
        targetElement.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
        
        // Update URL without scrolling
        window.history.pushState(null, '', href);
      }
    };

    const contentElement = contentRef.current;
    if (contentElement) {
      contentElement.addEventListener('click', handleAnchorClick);
      return () => {
        contentElement.removeEventListener('click', handleAnchorClick);
      };
    }
  }, [content]);

  // Handle initial hash in URL (e.g., when page loads with #section)
  useEffect(() => {
    if (window.location.hash) {
      const targetId = window.location.hash.substring(1);
      setTimeout(() => {
        const targetElement = document.getElementById(targetId);
        if (targetElement) {
          targetElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          });
        }
      }, 100); // Small delay to ensure content is rendered
    }
  }, [content]);

  return (
    <div ref={contentRef} className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom image component to handle relative/absolute paths
          img: ({ ...props }) => {
            // Ensure images use absolute paths from root
            const src = props.src?.startsWith('/') ? props.src : `/${props.src}`;
            return (
              <img
                {...props}
                src={src}
                alt={props.alt || ''}
                className="max-w-full h-auto rounded-lg shadow-md my-4 border border-gray-200 dark:border-gray-700"
                loading="lazy"
              />
            );
          },
          // Custom code block with syntax highlighting
          code: ({ inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            
            if (!inline && language) {
              return (
                <SyntaxHighlighter
                  style={isDark ? oneDark : oneLight}
                  language={language}
                  PreTag="div"
                  className="rounded-lg my-4"
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              );
            }
            
            return (
              <code
                className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-red-600 dark:text-red-400"
                {...props}
              >
                {children}
              </code>
            );
          },
          // Custom heading components with anchor links and IDs
          h1: ({ children, ...props }) => {
            const id = generateId(children);
            return (
              <h1 
                id={id}
                className="text-3xl font-bold mt-8 mb-4 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2 scroll-mt-4" 
                {...props}
              >
                {children}
              </h1>
            );
          },
          h2: ({ children, ...props }) => {
            const id = generateId(children);
            return (
              <h2 
                id={id}
                className="text-2xl font-bold mt-6 mb-3 text-gray-900 dark:text-gray-100 border-b border-gray-200 dark:border-gray-700 pb-2 scroll-mt-4" 
                {...props}
              >
                {children}
              </h2>
            );
          },
          h3: ({ children, ...props }) => {
            const id = generateId(children);
            return (
              <h3 
                id={id}
                className="text-xl font-semibold mt-5 mb-2 text-gray-900 dark:text-gray-100 scroll-mt-4" 
                {...props}
              >
                {children}
              </h3>
            );
          },
          h4: ({ children, ...props }) => {
            const id = generateId(children);
            return (
              <h4 
                id={id}
                className="text-lg font-semibold mt-4 mb-2 text-gray-900 dark:text-gray-100 scroll-mt-4" 
                {...props}
              >
                {children}
              </h4>
            );
          },
          // Custom link component - handle anchor links
          a: ({ href, children, ...props }) => {
            const isAnchor = href?.startsWith('#');
            return (
              <a
                href={href}
                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
                target={href?.startsWith('http') ? '_blank' : undefined}
                rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
                onClick={isAnchor ? (e) => {
                  const targetId = href.substring(1);
                  const targetElement = document.getElementById(targetId);
                  if (targetElement) {
                    e.preventDefault();
                    targetElement.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                    window.history.pushState(null, '', href);
                  }
                } : undefined}
                {...props}
              >
                {children}
              </a>
            );
          },
          // Custom table components
          table: ({ ...props }) => (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full border-collapse border border-gray-300 dark:border-gray-600" {...props} />
            </div>
          ),
          thead: ({ ...props }) => (
            <thead className="bg-gray-100 dark:bg-gray-800" {...props} />
          ),
          th: ({ ...props }) => (
            <th className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100" {...props} />
          ),
          td: ({ ...props }) => (
            <td className="border border-gray-300 dark:border-gray-600 px-4 py-2 text-gray-700 dark:text-gray-300" {...props} />
          ),
          // Custom blockquote
          blockquote: ({ ...props }) => (
            <blockquote
              className="border-l-4 border-blue-500 dark:border-blue-400 pl-4 py-2 my-4 bg-blue-50 dark:bg-blue-900/20 italic text-gray-700 dark:text-gray-300"
              {...props}
            />
          ),
          // Custom list components
          ul: ({ ...props }) => (
            <ul className="list-disc list-inside my-4 space-y-2 text-gray-700 dark:text-gray-300" {...props} />
          ),
          ol: ({ ...props }) => (
            <ol className="list-decimal list-inside my-4 space-y-2 text-gray-700 dark:text-gray-300" {...props} />
          ),
          li: ({ ...props }) => (
            <li className="ml-4" {...props} />
          ),
          // Custom paragraph
          p: ({ ...props }) => (
            <p className="my-3 text-gray-700 dark:text-gray-300 leading-relaxed" {...props} />
          ),
          // Custom horizontal rule
          hr: ({ ...props }) => (
            <hr className="my-6 border-gray-300 dark:border-gray-600" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

