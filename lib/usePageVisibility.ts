import { useEffect, useRef } from 'react';

interface UsePageVisibilityOptions {
    onVisible?: () => void;
    onHidden?: () => void;
}

/**
 * Hook to detect when user returns to page
 * Auto-refreshes data when tab becomes visible
 */
export function usePageVisibility({ onVisible, onHidden }: UsePageVisibilityOptions = {}) {
    const wasHidden = useRef(false);

    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden) {
                // User left the tab
                wasHidden.current = true;
                onHidden?.();
            } else if (wasHidden.current) {
                // User came back - refresh data!
                onVisible?.();
                wasHidden.current = false;
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [onVisible, onHidden]);
}
