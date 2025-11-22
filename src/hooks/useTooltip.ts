import { useState, useCallback } from "react";

export const useTooltip = () => {
  const [hoveredTooltip, setHoveredTooltip] = useState<string | null>(null);

  const showTooltip = useCallback((id: string) => {
    setHoveredTooltip(id);
  }, []);

  const hideTooltip = useCallback(() => {
    setHoveredTooltip(null);
  }, []);

  const isTooltipVisible = useCallback(
    (id: string) => {
      return hoveredTooltip === id;
    },
    [hoveredTooltip],
  );

  return {
    hoveredTooltip,
    showTooltip,
    hideTooltip,
    isTooltipVisible,
  };
};
