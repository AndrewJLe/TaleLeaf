import React from "react";

interface TokenBudgetDisplayProps {
  className?: string;
  compact?: boolean;
}

export const TokenBudgetDisplay: React.FC<TokenBudgetDisplayProps> = ({
  className = "",
  compact = false,
}) => {
  // Token budget features have been removed from the AI service.
  // Render a lightweight placeholder to keep the UI stable while avoiding
  // runtime calls to removed APIs.

  if (compact) return null;

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
          <p className="text-xs text-emerald-600">Disabled in this build</p>
        </div>
      </div>

      <div className="text-sm text-emerald-700">Token budget tracking is currently disabled.</div>
    </div>
  );
};
