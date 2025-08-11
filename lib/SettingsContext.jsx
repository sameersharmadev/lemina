'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const defaultSettings = {
    sortBy: 'creationDate',
    sortOrder: 'desc',
    foldersFirst: true,
    showHiddenFiles: false,
    autoExpandFolders: false,
    autoSave: true,
    autoSaveDelay: 2000,
    tabSize: 4,
    wordWrap: true,
    lineNumbers: true,
    theme: 'system',
    sidebarWidth: 280,
    compactMode: false,
    showBreadcrumbs: true,
    showFileIcons: true,
    confirmDelete: true,
    openFilesInNewTab: false,
    closeTabsOnDelete: true,
    restoreTabsOnStartup: true,
    showNotifications: true,
    soundEnabled: false,
    notificationDuration: 3000,
};

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const [settings, setSettings] = useState(defaultSettings);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserAndLoadSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                const savedSettings = localStorage.getItem(`userSettings_${user.id}`);
                if (savedSettings) {
                    try {
                        const parsed = JSON.parse(savedSettings);
                        setSettings(prev => ({ ...prev, ...parsed }));
                    } catch (e) {
                        console.error("Failed to parse settings from localStorage", e);
                    }
                }
            }
            setLoading(false);
        };
        fetchUserAndLoadSettings();
    }, []);

    const updateSettings = (newSettings) => {
        setSettings(prev => {
            const updated = { ...prev, ...newSettings };
            if (user) {
                localStorage.setItem(`userSettings_${user.id}`, JSON.stringify(updated));
            }
            return updated;
        });
    };
    
    const handleSettingChange = (key, value) => {
        const newSettings = { ...settings, [key]: value };
        setSettings(newSettings);
        if (user) {
            localStorage.setItem(`userSettings_${user.id}`, JSON.stringify(newSettings));
        }
    };

    const resetSettings = () => {
        setSettings(defaultSettings);
        if (user) {
            localStorage.removeItem(`userSettings_${user.id}`);
        }
    };

    // Apply theme to the document
    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        if (settings.theme === 'system') {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            root.classList.add(systemTheme);
        } else {
            root.classList.add(settings.theme);
        }
    }, [settings.theme]);

    const value = { settings, updateSettings, handleSettingChange, resetSettings, loading, user };

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    const context = useContext(SettingsContext);
    if (context === undefined) {
        throw new Error('useSettings must be used within a SettingsProvider');
    }
    return context;
}