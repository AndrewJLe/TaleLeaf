import React, { useCallback, useRef, useState } from 'react';
import { MaximizeIcon, PanelLeftIcon, PanelRightIcon } from './Icons';

interface SplitLayoutProps {
    leftPanel: React.ReactNode;
    rightPanel: React.ReactNode;
    defaultLeftWidth?: number;
    minLeftWidth?: number;
    maxLeftWidth?: number;
    className?: string;
}

export const SplitLayout: React.FC<SplitLayoutProps> = ({
    leftPanel,
    rightPanel,
    defaultLeftWidth = 40,
    minLeftWidth = 25,
    maxLeftWidth = 75,
    className = ''
}) => {
    const [leftWidth, setLeftWidth] = useState(defaultLeftWidth);
    const [isLeftCollapsed, setIsLeftCollapsed] = useState(false);
    const [isRightCollapsed, setIsRightCollapsed] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!isDragging || !containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const newLeftWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100;

        const clampedWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newLeftWidth));
        setLeftWidth(clampedWidth);
    }, [isDragging, minLeftWidth, maxLeftWidth]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    React.useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };
    }, [isDragging, handleMouseMove, handleMouseUp]);

    const toggleLeftPanel = () => {
        setIsLeftCollapsed(!isLeftCollapsed);
        if (isRightCollapsed) setIsRightCollapsed(false);
    };

    const toggleRightPanel = () => {
        setIsRightCollapsed(!isRightCollapsed);
        if (isLeftCollapsed) setIsLeftCollapsed(false);
    };

    return (
        <div
            ref={containerRef}
            className={`bg-gray-50 relative ${className}`}
            style={{
                display: 'grid',
                gridTemplateColumns: isLeftCollapsed
                    ? '0px 1fr'
                    : isRightCollapsed
                        ? '1fr 0px'
                        : `minmax(300px, ${leftWidth}%) 4px minmax(300px, ${100 - leftWidth}%)`,
                height: 'calc(100vh - 140px)', // Full viewport height minus header
                minHeight: '600px', // Ensure minimum usable height
                overflow: 'hidden', // Prevent overall scroll
            }}
        >
            {/* Left Panel */}
            <div
                className={`flex flex-col bg-white transition-all duration-300 ease-in-out min-w-0 ${isLeftCollapsed ? 'overflow-hidden' : 'overflow-hidden'
                    }`}
            >
                {/* Left Panel Header */}
                <div className="flex items-center justify-between p-2 sm:p-4 border-b border-gray-200 bg-white flex-shrink-0">
                    <h2 className="text-sm sm:text-lg font-semibold text-gray-900 truncate">Book Editor</h2>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <button
                            onClick={toggleRightPanel}
                            className="p-1 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title={isRightCollapsed ? "Show document viewer" : "Hide document viewer"}
                        >
                            {isRightCollapsed ? <PanelRightIcon size={16} /> : <MaximizeIcon size={16} />}
                        </button>
                        <button
                            onClick={toggleLeftPanel}
                            className="p-1 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Minimize editor"
                        >
                            <PanelLeftIcon size={16} />
                        </button>
                    </div>
                </div>

                {/* Left Panel Content */}
                <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isLeftCollapsed ? 'hidden' : 'block'}`}>
                    {leftPanel}
                </div>
            </div>

            {/* Resize Handle */}
            {!isLeftCollapsed && !isRightCollapsed && (
                <div
                    className={`bg-gray-200 hover:bg-gray-300 cursor-col-resize transition-colors relative group ${isDragging ? 'bg-emerald-300' : ''}
                        `}
                    onMouseDown={handleMouseDown}
                    style={{ width: '4px' }}
                >
                    <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-gray-300/50" />
                </div>
            )}

            {/* Right Panel */}
            <div
                className={`flex flex-col bg-gray-50 transition-all duration-300 ease-in-out min-w-0 ${isRightCollapsed ? 'overflow-hidden' : 'overflow-hidden'
                    }`}
            >
                {/* Right Panel Header */}
                <div className="flex items-center justify-between p-2 sm:p-4 border-b border-gray-200 bg-white flex-shrink-0">
                    <h2 className="text-sm sm:text-lg font-semibold text-gray-900 truncate">Document Viewer</h2>
                    <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                        <button
                            onClick={toggleLeftPanel}
                            className="p-1 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title={isLeftCollapsed ? "Show editor" : "Hide editor"}
                        >
                            {isLeftCollapsed ? <PanelLeftIcon size={16} /> : <MaximizeIcon size={16} />}
                        </button>
                        <button
                            onClick={toggleRightPanel}
                            className="p-1 sm:p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Minimize viewer"
                        >
                            <PanelRightIcon size={16} />
                        </button>
                    </div>
                </div>

                {/* Right Panel Content */}
                <div className={`flex-1 overflow-y-auto overflow-x-hidden ${isRightCollapsed ? 'hidden' : 'block'}`}>
                    {rightPanel}
                </div>
            </div>

            {/* Collapsed Panel Indicators */}
            {isLeftCollapsed && (
                <div className="fixed left-4 top-1/2 transform -translate-y-1/2 z-50">
                    <button
                        onClick={toggleLeftPanel}
                        className="p-3 bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl transition-all text-gray-600 hover:text-gray-900"
                        title="Show book editor"
                    >
                        <PanelLeftIcon size={20} />
                    </button>
                </div>
            )}

            {isRightCollapsed && (
                <div className="fixed right-4 top-1/2 transform -translate-y-1/2 z-50">
                    <button
                        onClick={toggleRightPanel}
                        className="p-3 bg-white border border-gray-200 rounded-lg shadow-lg hover:shadow-xl transition-all text-gray-600 hover:text-gray-900"
                        title="Show document viewer"
                    >
                        <PanelRightIcon size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};
