import { toast } from 'sonner';
import { useSettings } from './SettingsContext';
import { playSound } from './sounds';
import { useRef, useEffect } from 'react';

/**
 * A hook that provides a toast function that is aware of the latest user settings.
 * It uses a ref to avoid stale closures, ensuring the most recent settings are always used.
 */
export function useCustomToast() {
    const { settings } = useSettings();
    const settingsRef = useRef(settings);

    // Keep the ref updated with the latest settings on every render
    useEffect(() => {
        settingsRef.current = settings;
    });

    /**
     * Shows a toast notification, respecting the user's current settings for
     * visibility and sound.
     * @param {'success' | 'error' | 'info' | 'warning' | 'message'} type - The type of toast.
     * @param {string} message - The message to display.
     * @param {object} options - Optional sonner toast options.
     */
    const showToast = (type, message, options = {}) => {
        // Always read the latest settings from the ref.
        const currentSettings = settingsRef.current;

        if (!currentSettings.showNotifications) {
            return;
        }

        if (currentSettings.soundEnabled) {
            playSound('notification');
        }

        // The <Toaster> component handles the duration.
        const toastFunction = toast[type] || toast;
        toastFunction(message, options);
    };

    return showToast;
}