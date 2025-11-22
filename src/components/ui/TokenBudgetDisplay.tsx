import React, { useEffect, useState } from "react";
import { aiService, TokenBudget, TokenStats } from "../../lib/ai-service";

interface TokenBudgetDisplayProps {
  className?: string;
  compact?: boolean;
}

export const TokenBudgetDisplay: React.FC<TokenBudgetDisplayProps> = ({
  className = "",
  compact = false,
}) => {
  const [stats, setStats] = useState<TokenStats>(aiService.getTokenStats());
  const [budget, setBudget] = useState<TokenBudget>(aiService.getTokenBudget());
  const [remaining, setRemaining] = useState(aiService.getRemainingBudget());
  const [overBudget, setOverBudget] = useState(aiService.isOverBudget());

  useEffect(() => {
    const updateStats = () => {
      setStats(aiService.getTokenStats());
      setBudget(aiService.getTokenBudget());
      setRemaining(aiService.getRemainingBudget());
      setOverBudget(aiService.isOverBudget());
    };

    // Update every 5 seconds
    const interval = setInterval(updateStats, 5000);

    // Also update on window focus (in case usage happened in another tab)
    const handleFocus = () => updateStats();
    window.addEventListener("focus", handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const formatCost = (cost: number) => {
    if (cost < 0.001) return "<$0.001";
    return `$${cost.toFixed(3)}`;
  };

  const getDailyUsagePercent = () => {
    return Math.min(100, (stats.todayUsage / budget.dailyLimit) * 100);
  };

  const getUsageColor = () => {
    const percent = getDailyUsagePercent();
    if (percent >= 100) return "text-red-600 bg-red-100";
    if (percent >= budget.warningThreshold * 100)
      return "text-amber-600 bg-amber-100";
    return "text-emerald-600 bg-emerald-100";
  };

  const getProgressBarColor = () => {
    const percent = getDailyUsagePercent();
    if (percent >= 100) return "bg-red-500";
    if (percent >= budget.warningThreshold * 100) return "bg-amber-500";
    return "bg-emerald-500";
  };

  if (compact) {
    // In compact mode we intentionally render nothing to avoid header clutter.
    return null;
  }

  return (
    <div
      className={`${className} p-4 bg-white/80 backdrop-blur-sm rounded-lg border border-emerald-200 shadow-sm`}
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
          <span className="text-white text-sm">💰</span>
        </div>
        <div>
          <h3 className="font-semibold text-emerald-900">Token Budget</h3>
          <p className="text-xs text-emerald-600">Daily usage tracking</p>
        </div>
      </div>

      {/* Daily Usage Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-emerald-700">Today</span>
          <span className={getUsageColor().split(" ")[0]}>
            {formatCost(stats.todayUsage)} / {formatCost(budget.dailyLimit)}
          </span>
        </div>
        <div className="w-full bg-slate-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor()}`}
            style={{ width: `${Math.min(100, getDailyUsagePercent())}%` }}
          ></div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="text-center p-2 bg-emerald-50 rounded">
          <div className="font-medium text-emerald-900">
            {formatCost(remaining.daily)}
          </div>
          <div className="text-emerald-600">Remaining</div>
        </div>
        <div className="text-center p-2 bg-amber-50 rounded">
          <div className="font-medium text-amber-900">
            {formatCost(stats.sessionUsage)}
          </div>
          <div className="text-amber-700">This Session</div>
        </div>
      </div>

      {/* Warnings */}
      {overBudget.daily && (
        <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          ⚠️ Daily budget exceeded
        </div>
      )}
      {overBudget.warning && !overBudget.daily && (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          ⚠️ Approaching budget limit
        </div>
      )}
      {remaining.sessionWarning && (
        <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-700">
          💡 High session usage - consider taking a break
        </div>
      )}
    </div>
  );
};
