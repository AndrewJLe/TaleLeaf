import React, { useState } from 'react';
import { TooltipProps } from '../../types/book';

export const Tooltip: React.FC<TooltipProps> = ({ text, children, id }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div
                    className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 px-3 py-2 bg-emerald-900 text-white text-sm rounded-lg shadow-xl z-[100] whitespace-nowrap max-w-64 text-center"
                    style={{ zIndex: 100 }}
                >
                    {text}
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-emerald-900"></div>
                </div>
            )}
        </div>
    );
};
