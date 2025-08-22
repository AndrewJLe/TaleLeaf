import React, { useEffect, useRef, useState } from 'react';
import { TooltipProps } from '../../types/book';

export const Tooltip: React.FC<TooltipProps> = ({ text, children, id }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [style, setStyle] = useState<React.CSSProperties>({});
    const bubbleRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (isVisible && bubbleRef.current) {
            const rect = bubbleRef.current.getBoundingClientRect();
            const padding = 8;
            let translateX = '-50%';
            let left = '50%';
            // Clamp horizontally
            if (rect.left < padding) {
                left = `${padding - rect.left + rect.width / 2}px`;
                translateX = '0';
            } else if (rect.right > window.innerWidth - padding) {
                const overflow = rect.right - (window.innerWidth - padding);
                left = `calc(50% - ${overflow}px)`;
                translateX = '-50%';
            }
            // If off top, flip below
            let placementClasses = '';
            let bottomFull = true;
            if (rect.top < padding) {
                bottomFull = false;
            }
            setStyle({
                left,
                transform: `translateX(${translateX}) ${bottomFull ? '' : 'translateY(100%)'}`.trim(),
            });
        }
    }, [isVisible]);

    return (
        <div
            className="relative inline-block"
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
        >
            {children}
            {isVisible && (
                <div
                    ref={bubbleRef}
                    className="absolute bottom-full left-1/2 mb-3 px-3 py-2 bg-emerald-900 text-white text-xs rounded-md shadow-xl z-[100] whitespace-nowrap max-w-64 text-center transition-transform"
                    style={style}
                >
                    {text}
                </div>
            )}
        </div>
    );
};
