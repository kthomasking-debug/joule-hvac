import React, { useState } from 'react';
import { ThumbsUp, MessageCircle, Send } from 'lucide-react';
import { getSortedTips, upvoteTip, submitTip } from '../lib/community/tipsEngine';

export default function CommunityTips() {
  const [tips, setTips] = useState(() => getSortedTips());
  const [showSubmit, setShowSubmit] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [author, setAuthor] = useState('');

  const handleUpvote = (tipId) => {
    upvoteTip(tipId);
    setTips(getSortedTips());
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    submitTip(title.trim(), content.trim(), author.trim() || 'Anonymous');
    setTitle('');
    setContent('');
    setAuthor('');
    setShowSubmit(false);
    alert('Tip submitted for moderation. Thank you!');
  };

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
          <MessageCircle className="text-blue-600" size={20} />
          Community Tips & Stories
        </h2>
        <button
          type="button"
          onClick={() => setShowSubmit(!showSubmit)}
          className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
        >
          {showSubmit ? 'Cancel' : '+ Share a Tip'}
        </button>
      </div>

      {showSubmit && (
        <form onSubmit={handleSubmit} className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <input
            type="text"
            placeholder="Tip title (e.g., 'Lower your thermostat at night')"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          />
          <textarea
            placeholder="Share your energy-saving tip or story..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
          />
          <input
            type="text"
            placeholder="Your name (optional, defaults to Anonymous)"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg mb-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            type="submit"
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold"
          >
            <Send size={14} />
            Submit Tip
          </button>
        </form>
      )}

      <div className="space-y-3">
        {tips.map((tip) => (
          <div key={tip.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => handleUpvote(tip.id)}
                className="flex flex-col items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400"
              >
                <ThumbsUp size={18} />
                <span className="text-xs font-semibold">{tip.upvotes || 0}</span>
              </button>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 dark:text-white mb-1">{tip.title}</h3>
                <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">{tip.content}</p>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  by <span className="font-medium">{tip.author}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
