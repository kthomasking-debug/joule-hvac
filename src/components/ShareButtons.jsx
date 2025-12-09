import React, { useState } from 'react';
import { Share2, Copy, Check, Mail, Twitter, Facebook } from 'lucide-react';
import CopyToClipboard from './CopyToClipboard';

/**
 * Share Buttons Component
 * Provides sharing functionality for analysis results
 * 
 * @param {Object} props
 * @param {string} props.title - Title of the content to share
 * @param {string} props.text - Text description to share
 * @param {string} props.url - URL to share (defaults to current page)
 * @param {Object} props.data - Optional data object to include in share
 */
export default function ShareButtons({ title, text, url, data = null }) {
  const [showMenu, setShowMenu] = useState(false);
  const shareUrl = url || window.location.href;
  const shareText = text || title || 'Check out this analysis';

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text: shareText,
          url: shareUrl,
        });
        setShowMenu(false);
      } catch (err) {
        // User cancelled or error occurred
        if (err.name !== 'AbortError') {
          console.error('Error sharing:', err);
        }
      }
    } else {
      // Fallback: show menu
      setShowMenu(!showMenu);
    }
  };

  const handleEmailShare = () => {
    const subject = encodeURIComponent(title || 'Analysis Results');
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    setShowMenu(false);
  };

  const handleTwitterShare = () => {
    const tweetText = encodeURIComponent(shareText);
    const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(shareUrl)}`;
    window.open(twitterUrl, '_blank', 'width=550,height=420');
    setShowMenu(false);
  };

  const handleFacebookShare = () => {
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`;
    window.open(facebookUrl, '_blank', 'width=550,height=420');
    setShowMenu(false);
  };

  const shareData = data ? JSON.stringify(data, null, 2) : null;

  return (
    <div className="relative inline-block">
      <button
        onClick={handleNativeShare}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-sm"
        aria-label="Share analysis results"
      >
        <Share2 size={18} />
        <span>Share</span>
      </button>

      {showMenu && !navigator.share && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
          <div className="p-2">
            <button
              onClick={handleEmailShare}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <Mail size={16} />
              Email
            </button>
            <button
              onClick={handleTwitterShare}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <Twitter size={16} />
              Twitter
            </button>
            <button
              onClick={handleFacebookShare}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
            >
              <Facebook size={16} />
              Facebook
            </button>
            {shareData && (
              <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
                <CopyToClipboard
                  text={shareData}
                  label="Copy Data"
                  successMessage="Data copied!"
                  className="w-full"
                />
              </div>
            )}
            <div className="border-t border-gray-200 dark:border-gray-700 mt-2 pt-2">
              <CopyToClipboard
                text={shareUrl}
                label="Copy Link"
                successMessage="Link copied!"
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}






