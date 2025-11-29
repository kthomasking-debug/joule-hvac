// src/lib/community/tipsEngine.js
// Community tips with upvote ranking and simple localStorage-based storage

const STORAGE_KEY = "communityTips";
const MODERATION_KEY = "moderationQueue";

export function loadTips() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : getDefaultTips();
  } catch {
    return getDefaultTips();
  }
}

export function saveTips(tips) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tips));
  } catch {
    // Ignore localStorage errors
  }
}

export function loadModerationQueue() {
  try {
    const raw = localStorage.getItem(MODERATION_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveModerationQueue(queue) {
  try {
    localStorage.setItem(MODERATION_KEY, JSON.stringify(queue));
  } catch {
    // Ignore localStorage errors
  }
}

export function submitTip(title, content, author = "Anonymous") {
  const queue = loadModerationQueue();
  const newTip = {
    id: Date.now() + Math.random(),
    title,
    content,
    author,
    submittedAt: new Date().toISOString(),
    status: "pending",
  };
  queue.push(newTip);
  saveModerationQueue(queue);
  return newTip;
}

export function approveTip(tipId) {
  const queue = loadModerationQueue();
  const idx = queue.findIndex((t) => t.id === tipId);
  if (idx === -1) return;
  const tip = queue[idx];
  queue.splice(idx, 1);
  saveModerationQueue(queue);

  const tips = loadTips();
  tips.push({
    id: tip.id,
    title: tip.title,
    content: tip.content,
    author: tip.author,
    upvotes: 0,
    createdAt: tip.submittedAt,
  });
  saveTips(tips);
}

export function upvoteTip(tipId) {
  const tips = loadTips();
  const tip = tips.find((t) => t.id === tipId);
  if (!tip) return;
  tip.upvotes = (tip.upvotes || 0) + 1;
  saveTips(tips);
}

export function getSortedTips() {
  const tips = loadTips();
  return tips.sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));
}

function getDefaultTips() {
  return [
    {
      id: 1,
      title: "Use ceiling fans strategically",
      content:
        "In summer, run ceiling fans counter-clockwise to push cool air down. In winter, reverse them to recirculate warm air from the ceiling.",
      author: "EnergyPro",
      upvotes: 42,
      createdAt: new Date("2025-10-15").toISOString(),
    },
    {
      id: 2,
      title: "Seal air leaks around doors and windows",
      content:
        "Use weatherstripping and caulk to seal gaps. This simple fix can reduce heating/cooling costs by 10-20%.",
      author: "DIY_Dave",
      upvotes: 38,
      createdAt: new Date("2025-10-20").toISOString(),
    },
    {
      id: 3,
      title: "Install a programmable thermostat",
      content:
        "Set back your heat 7-10°F for 8 hours a day (like while sleeping) to save ~10% annually on heating costs.",
      author: "SmartHomeFan",
      upvotes: 35,
      createdAt: new Date("2025-11-01").toISOString(),
    },
  ];
}
