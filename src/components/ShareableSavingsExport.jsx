import React, { useRef, useState } from 'react';
import { Download, Copy, Check } from 'lucide-react';
import ShareableSavingsCard from './ShareableSavingsCard';

export default function ShareableSavingsExport({ savings, location }) {
  const cardRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const exportToCanvas = async () => {
    if (!cardRef.current) return null;
    
    // Use html2canvas for reliable rendering
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(cardRef.current, {
      scale: 2, // 2x for retina
      backgroundColor: null,
      logging: false,
    });
    return canvas;
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const canvas = await exportToCanvas();
      if (!canvas) return;
      
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `joule-savings-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (error) {
      console.error('Export failed:', error);
    } finally {
      setDownloading(false);
    }
  };

  const handleCopy = async () => {
    try {
      const canvas = await exportToCanvas();
      if (!canvas) return;
      
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': blob })
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch (err) {
          console.warn('Clipboard write failed, falling back to download', err);
          handleDownload();
        }
      }, 'image/png');
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">Share Your Savings</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Download or copy your personalized savings graphic to share on social media.
      </p>

      {/* Preview at smaller scale */}
      <div className="mb-4 overflow-hidden rounded-lg shadow-lg" style={{ maxWidth: '600px', margin: '0 auto' }}>
        <div style={{ transform: 'scale(0.5)', transformOrigin: 'top left', width: '200%' }}>
          <div ref={cardRef}>
            <ShareableSavingsCard savings={savings} location={location} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          <Download size={16} />
          {downloading ? 'Exporting...' : 'Download PNG'}
        </button>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-semibold transition-colors"
        >
          {copied ? <Check size={16} /> : <Copy size={16} />}
          {copied ? 'Copied!' : 'Copy Image'}
        </button>
      </div>
    </div>
  );
}
