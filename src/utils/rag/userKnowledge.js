/**
 * User-Added Knowledge Storage
 * Stores PDF-extracted text and other user-added content for RAG queries
 * Uses localStorage for persistence
 */

const STORAGE_KEY = "joule_user_knowledge";
const MAX_ENTRIES = 100; // Limit to prevent localStorage bloat

/**
 * Get all user-added knowledge entries
 */
export function getUserKnowledge() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    return JSON.parse(stored);
  } catch (error) {
    console.error("[UserKnowledge] Failed to load:", error);
    return [];
  }
}

/**
 * Add a new knowledge entry from PDF or text
 */
export function addUserKnowledge(title, content, source = "user-uploaded") {
  try {
    const entries = getUserKnowledge();
    
    // Create new entry
    const newEntry = {
      id: Date.now().toString(),
      title: title || `Document ${entries.length + 1}`,
      content: content,
      source: source,
      addedAt: new Date().toISOString(),
      keywords: extractKeywords(content),
    };
    
    // Add to beginning of array
    entries.unshift(newEntry);
    
    // Limit total entries
    if (entries.length > MAX_ENTRIES) {
      entries.splice(MAX_ENTRIES);
    }
    
    // Save to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    
    return { success: true, id: newEntry.id };
  } catch (error) {
    console.error("[UserKnowledge] Failed to add:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Remove a knowledge entry by ID
 */
export function removeUserKnowledge(id) {
  try {
    const entries = getUserKnowledge();
    const filtered = entries.filter((e) => e.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return { success: true };
  } catch (error) {
    console.error("[UserKnowledge] Failed to remove:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Clear all user knowledge
 */
export function clearUserKnowledge() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { success: true };
  } catch (error) {
    console.error("[UserKnowledge] Failed to clear:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Extract relevant snippet from content around query terms
 */
function extractRelevantSnippet(content, query, maxLength = 1000) {
  if (!content || content.length <= maxLength) {
    return content;
  }
  
  const lowerContent = content.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const keywords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
  
  // Find the best match position
  let bestPosition = -1;
  let bestScore = 0;
  
  // Try exact phrase first
  const phraseIndex = lowerContent.indexOf(lowerQuery);
  if (phraseIndex !== -1) {
    bestPosition = phraseIndex;
    bestScore = 100;
  } else {
    // Find position with most keyword matches
    for (let i = 0; i < lowerContent.length - 100; i += 50) {
      const snippet = lowerContent.substring(i, i + 200);
      let score = 0;
      keywords.forEach((kw) => {
        const matches = (snippet.match(new RegExp(kw, "g")) || []).length;
        score += matches;
      });
      if (score > bestScore) {
        bestScore = score;
        bestPosition = i;
      }
    }
  }
  
  if (bestPosition === -1) {
    // No good match, return beginning
    return content.substring(0, maxLength) + "...";
  }
  
  // Extract snippet around best position
  const start = Math.max(0, bestPosition - 200);
  const end = Math.min(content.length, bestPosition + maxLength);
  let snippet = content.substring(start, end);
  
  // Try to start at sentence boundary
  const sentenceStart = snippet.search(/[.!?]\s+[A-Z]/);
  if (sentenceStart > 50 && sentenceStart < 300) {
    snippet = snippet.substring(sentenceStart + 2);
  }
  
  // Try to end at sentence boundary
  const sentenceEnd = snippet.search(/[.!?]\s+[A-Z]/);
  if (sentenceEnd > maxLength - 100 && sentenceEnd < snippet.length - 50) {
    snippet = snippet.substring(0, sentenceEnd + 1);
  }
  
  // Add ellipsis if truncated
  if (start > 0) snippet = "..." + snippet;
  if (end < content.length) snippet = snippet + "...";
  
  return snippet;
}

/**
 * Search user knowledge for relevant entries
 */
export function searchUserKnowledge(query) {
  const entries = getUserKnowledge();
  if (entries.length === 0) return [];
  
  const lowerQuery = query.toLowerCase().trim();
  const keywords = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
  
  const results = entries
    .map((entry) => {
      let score = 0;
      const lowerContent = entry.content.toLowerCase();
      const lowerTitle = entry.title.toLowerCase();
      
      // Title matches are worth more
      if (lowerTitle.includes(lowerQuery)) score += 10;
      
      // Keyword matches in title
      keywords.forEach((kw) => {
        if (lowerTitle.includes(kw)) score += 5;
      });
      
      // Keyword matches in content
      keywords.forEach((kw) => {
        const matches = (lowerContent.match(new RegExp(kw, "g")) || []).length;
        score += matches * 2;
      });
      
      // Exact phrase match in content
      if (lowerContent.includes(lowerQuery)) score += 15;
      
      // Keyword matches in extracted keywords
      if (entry.keywords) {
        entry.keywords.forEach((kw) => {
          if (keywords.some((q) => q.includes(kw) || kw.includes(q))) {
            score += 3;
          }
        });
      }
      
      // Extract relevant snippet instead of full content
      const snippet = extractRelevantSnippet(entry.content, query, 800);
      
      return { 
        ...entry, 
        content: snippet, // Replace full content with snippet
        relevanceScore: score 
      };
    })
    .filter((entry) => entry.relevanceScore > 0)
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, 5); // Return top 5 matches
  
  return results;
}

/**
 * Extract keywords from text (simple approach)
 */
function extractKeywords(text, maxKeywords = 20) {
  if (!text) return [];
  
  // Simple keyword extraction: find common HVAC/technical terms
  const lowerText = text.toLowerCase();
  const words = lowerText.match(/\b[a-z]{4,}\b/g) || [];
  
  // Count word frequency
  const wordCounts = {};
  words.forEach((word) => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });
  
  // Filter out common stop words
  const stopWords = new Set([
    "this", "that", "with", "from", "have", "been", "will", "would",
    "could", "should", "there", "their", "they", "them", "these", "those",
    "what", "when", "where", "which", "while", "about", "above", "after",
    "before", "during", "through", "under", "until", "without", "within"
  ]);
  
  // Get top keywords
  const keywords = Object.entries(wordCounts)
    .filter(([word]) => !stopWords.has(word))
    .sort(([, a], [, b]) => b - a)
    .slice(0, maxKeywords)
    .map(([word]) => word);
  
  return keywords;
}

/**
 * Get storage usage info
 */
export function getUserKnowledgeStats() {
  const entries = getUserKnowledge();
  const totalChars = entries.reduce((sum, e) => sum + (e.content?.length || 0), 0);
  
  return {
    count: entries.length,
    totalChars,
    totalKB: (totalChars / 1024).toFixed(2),
    maxEntries: MAX_ENTRIES,
  };
}

