import React from 'react';
import { PiggyBank, PlusCircle } from 'lucide-react';
import { getAccount, getRecentEvents, getProgress, evaluateGoals, addGoal } from '../lib/savings/savingsAccount';
import useVoiceFeedback from '../hooks/useVoiceFeedback';

const currency = (v) => `$${(v || 0).toFixed(2)}`;

export default function SavingsAccountPanel({ className = '' }) {
  const [account, setAccount] = React.useState(getAccount());
  const [goalAmount, setGoalAmount] = React.useState('');
  const [goalLabel, setGoalLabel] = React.useState('');
  const [recent, setRecent] = React.useState(getRecentEvents(5));
  const [progress, setProgress] = React.useState(getProgress());
  const prevMilestoneCountRef = React.useRef(account.milestones.filter(m => m.achieved).length);
  const voice = useVoiceFeedback();

  function refresh() {
    const acct = getAccount();
    setAccount(acct);
    setRecent(getRecentEvents(5));
    setProgress(getProgress());
  }

  React.useEffect(() => {
    evaluateGoals();
    refresh();
  }, []);

  React.useEffect(() => {
    const achievedCount = account.milestones.filter(m => m.achieved).length;
    if (achievedCount > prevMilestoneCountRef.current) {
      // New milestone reached
      const newest = account.milestones.filter(m => m.achieved).sort((a,b) => new Date(b.achievedAt) - new Date(a.achievedAt))[0];
      if (newest) {
        voice.speak(`Great job! You just crossed ${currency(newest.target)} in energy savings.`);
      }
      prevMilestoneCountRef.current = achievedCount;
    }
  }, [account, voice]);

  function handleAddGoal(e) {
    e.preventDefault();
    const amt = parseFloat(goalAmount);
    if (!isFinite(amt) || amt <= 0) return;
    addGoal(amt, goalLabel || `Goal ${amt}`);
    setGoalAmount('');
    setGoalLabel('');
    evaluateGoals();
    refresh();
  }

  const pct = Math.min(1, Math.max(0, progress.progressToNext));
  const nextTarget = progress.nextGoal?.target || (account.totalSavings + 50);

  return (
    <div className={`bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6 ${className}`}>      
      <div className="flex items-center gap-2 mb-4">
        <PiggyBank className="text-pink-600" size={20} />
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Energy Savings Account</h3>
      </div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Saved</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-white" data-testid="total-saved">{currency(account.totalSavings)}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500 dark:text-gray-400">Next Goal</div>
          <div className="text-xl font-semibold text-indigo-600 dark:text-indigo-400" data-testid="next-goal">{currency(nextTarget)}</div>
        </div>
      </div>
      <div className="mb-4">
        <div className="w-full h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden" aria-label="progress-bar">
          <div className="h-full bg-gradient-to-r from-green-400 to-green-600" style={{ width: `${pct * 100}%` }} />
        </div>
        <div className="mt-1 text-xs text-gray-600 dark:text-gray-400">{(pct * 100).toFixed(1)}% toward {currency(nextTarget)}</div>
      </div>
      {/* Milestones */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Milestones</div>
        <div className="flex flex-wrap gap-2">
          {account.milestones.slice().sort((a,b)=>a.target-b.target).map(m => (
            <span key={m.target} className={`px-2 py-1 rounded-full text-xs font-medium border ${m.achieved ? 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-600 text-green-700 dark:text-green-300' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'}`}>{currency(m.target)}</span>
          ))}
          {account.milestones.length === 0 && <span className="text-xs text-gray-500">No milestones yet</span>}
        </div>
      </div>
      {/* Recent Events */}
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">Recent Savings Events</div>
        <ul className="text-xs divide-y divide-gray-200 dark:divide-gray-700" data-testid="recent-events">
          {recent.map(ev => (
            <li key={ev.id} className="py-1 flex justify-between">
              <span>{currency(ev.amount)}</span>
              <span className="text-gray-400">{new Date(ev.ts).toLocaleDateString()}</span>
            </li>
          ))}
          {recent.length === 0 && <li className="py-1 text-gray-400">No savings recorded yet</li>}
        </ul>
      </div>
      {/* Add Goal Form */}
      <form onSubmit={handleAddGoal} className="flex items-end gap-2 mb-2" data-testid="add-goal-form">
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Goal Amount ($)</label>
          <input value={goalAmount} onChange={e=>setGoalAmount(e.target.value)} type="number" step="1" min="1" className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" placeholder="100" />
        </div>
        <div className="flex-1">
          <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Label</label>
          <input value={goalLabel} onChange={e=>setGoalLabel(e.target.value)} type="text" className="w-full px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm" placeholder="Insulation Upgrade" />
        </div>
        <button type="submit" className="px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold flex items-center gap-1">
          <PlusCircle size={14} /> Add
        </button>
      </form>
      <div className="text-[10px] text-gray-400 dark:text-gray-500">Record savings elsewhere (e.g., after adopting a suggestion) to grow your account.</div>
    </div>
  );
}
