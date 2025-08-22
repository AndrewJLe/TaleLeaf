import React from 'react';
import { TokenEstimate, aiService } from '../../lib/ai-service';
import { Button } from './Button';

interface TokenConfirmDialogProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  estimate: TokenEstimate;
  action: string;
}

export const TokenConfirmDialog: React.FC<TokenConfirmDialogProps> = ({
  isOpen,
  onConfirm,
  onCancel,
  estimate,
  action
}) => {
  if (!isOpen) return null;

  const formatCost = (cost: number) => {
    if (cost < 0.01) return '<$0.01';
    return `$${cost.toFixed(3)}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Confirm AI Action
        </h3>

        <div className="space-y-3 mb-6">
          <p className="text-gray-700">
            You're about to <strong>{action}</strong> using AI.
          </p>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-medium text-amber-800 mb-2">Token Usage Estimate:</h4>
            <ul className="text-sm text-amber-700 space-y-1">
              <li>• Provider: {estimate.provider}</li>
              <li>• Input tokens: {estimate.inputTokens.toLocaleString()}</li>
              <li>• Estimated output: {estimate.estimatedOutputTokens.toLocaleString()}</li>
              <li>• Total tokens: {estimate.totalTokens.toLocaleString()}</li>
              <li>• <strong>Estimated cost: {formatCost(estimate.estimatedCost)}</strong></li>
            </ul>
          </div>

          {/* Rate limit details are intentionally omitted here to keep the dialog focused on the estimated cost and any blocking checks shown below. */}

          {estimate.totalTokens > 10000 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">
                ⚠️ This is a large request that may take longer and cost more than expected.
              </p>
            </div>
          )}

          {(() => {
            const rateLimitCheck = aiService.canMakeRequest(estimate.totalTokens);
            if (!rateLimitCheck.allowed) {
              return (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-700 font-medium">
                    ❌ Request will be rate limited
                  </p>
                  <p className="text-xs text-red-600 mt-1">
                    {rateLimitCheck.reason}
                    {rateLimitCheck.waitTime && ` Wait ${Math.ceil(rateLimitCheck.waitTime / 60)} minutes.`}
                  </p>
                </div>
              );
            }
            return null;
          })()}
        </div>

        <div className="flex gap-3 justify-end">
          <Button
            onClick={onCancel}
            variant="secondary"
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            variant="primary"
          >
            Proceed ({formatCost(estimate.estimatedCost)})
          </Button>
        </div>
      </div>
    </div>
  );
};
