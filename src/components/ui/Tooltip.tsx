import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { TooltipProps } from '../../types/book';

export const Tooltip: React.FC<TooltipProps> = ({ text, children, id }) => {
    const [isVisible, setIsVisible] = useState(false);
    const [style, setStyle] = useState<React.CSSProperties>({});
    const bubbleRef = useRef<HTMLDivElement | null>(null);
    const anchorRef = useRef<HTMLDivElement | null>(null);

    // Measure anchor and bubble and compute fixed position so tooltip can escape stacking contexts
    useLayoutEffect(() => {
        if (!isVisible || !anchorRef.current) return;

        const anchorRect = anchorRef.current.getBoundingClientRect();

        // If bubble exists already, measure it to place above anchor; otherwise place roughly and let next layout refine
        const bubbleRect = bubbleRef.current?.getBoundingClientRect();
        const padding = 8;

        let left = anchorRect.left + anchorRect.width / 2;
        let top = anchorRect.top - (bubbleRect ? bubbleRect.height + padding : 24);
        let transform = 'translateX(-50%)';

        // If there's not enough space above, flip below
        if (top < padding) {
            top = anchorRect.bottom + padding;
        }

        // Clamp horizontally within viewport
        const maxLeft = window.innerWidth - padding;
        const minLeft = padding;
        left = Math.min(Math.max(left, minLeft), maxLeft);

        setStyle({ position: 'fixed', left: `${left}px`, top: `${top}px`, transform, zIndex: 2147483647 });
    }, [isVisible, text]);

    // Don't render tooltip server-side
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <div
            className="relative inline-block"
            ref={anchorRef}
            onMouseEnter={() => setIsVisible(true)}
            onMouseLeave={() => setIsVisible(false)}
            onFocus={() => setIsVisible(true)}
            onBlur={() => setIsVisible(false)}
        >
            {children}
            {mounted && isVisible && createPortal(
                <div
                    ref={bubbleRef}
                    role="tooltip"
                    id={id}
                    className="px-3 py-2 bg-emerald-900 text-white text-xs rounded-md shadow-xl max-w-xs break-words whitespace-normal text-center transition-transform"
                    style={style}
                >
                    {text}
                </div>,
                document.body
            )}
        </div>
    );
};
