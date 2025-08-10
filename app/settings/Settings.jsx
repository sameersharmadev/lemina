'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { 
    Settings as SettingsIcon, 
    FolderTree, 
    SortAsc, 
    SortDesc, 
    Folder, 
    File, 
    Palette, 
    Monitor,
    Sun,
    Moon,
    Save,
    RotateCcw,
    Eye,
    Layout,
    Clock,
    Type,
    Calendar
} from 'lucide-react';
import { toast } from 'sonner';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function SettingsPage() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Settings state
    const [settings, setSettings] = useState({
        // File Management
        sortBy: 'creationDate', // 'creationDate', 'alphabetical', 'lastModified', 'fileType'
        sortOrder: 'desc', // 'asc', 'desc'
        foldersFirst: true,
        showHiddenFiles: false,
        autoExpandFolders: false,
        
        // Editor
        autoSave: true,
        autoSaveDelay: 2000, // milliseconds
        tabSize: 4,
        wordWrap: true,
        lineNumbers: true,
        
        // UI Preferences
        theme: 'system', // 'light', 'dark', 'system'
        sidebarWidth: 280,
        compactMode: false,
        showBreadcrumbs: true,
        showFileIcons: true,
        
        // Behavior
        confirmDelete: true,
        openFilesInNewTab: false,
        closeTabsOnDelete: true,
        restoreTabsOnStartup: true,
        
        // Notifications
        showNotifications: true,
        soundEnabled: false,
        notificationDuration: 3000,
    });

    useEffect(() => {
        const fetchUserAndSettings = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                
                if (error || !user) {
                    console.error('No user found');
                    return;
                }

                setUser(user);
                
                // Load user settings from localStorage
                const savedSettings = localStorage.getItem(`userSettings_${user.id}`);
                if (savedSettings) {
                    try {
                        const parsedSettings = JSON.parse(savedSettings);
                        setSettings(prev => ({ ...prev, ...parsedSettings }));
                    } catch (e) {
                        console.error('Error parsing saved settings:', e);
                    }
                }
            } catch (error) {
                console.error('Error fetching user:', error);
                toast.error('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };

        fetchUserAndSettings();
    }, []);

    const handleSettingChange = (key, value) => {
        setSettings(prev => ({
            ...prev,
            [key]: value
        }));
    };

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);
        try {
            // Save to localStorage
            localStorage.setItem(`userSettings_${user.id}`, JSON.stringify(settings));
            
            // Broadcast settings change to other components
            window.dispatchEvent(new CustomEvent('settingsChanged', { 
                detail: settings 
            }));
            
            toast.success('Settings saved successfully');
        } catch (error) {
            console.error('Error saving settings:', error);
            toast.error('Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    const handleReset = () => {
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
        
        setSettings(defaultSettings);
        toast.success('Settings reset to defaults');
    };

    if (loading) {
        return (
            <div className="h-full bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="h-full bg-background overflow-y-auto">
            {/* Header */}
            <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold">Settings</h1>
                            <p className="text-sm text-muted-foreground">
                                Customize your workspace preferences
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleReset}
                                variant="outline"
                                className="gap-2"
                            >
                                <RotateCcw className="w-4 h-4" />
                                Reset
                            </Button>
                            <Button 
                                onClick={handleSave}
                                disabled={saving}
                                className="gap-2"
                            >
                                {saving ? (
                                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                {saving ? 'Saving...' : 'Save Settings'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="px-6 py-8 max-w-4xl mx-auto space-y-8">
                {/* File Management */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FolderTree className="w-5 h-5" />
                            File Management
                        </CardTitle>
                        <CardDescription>
                            Configure how files and folders are displayed and organized
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-2">
                                <Label htmlFor="sortBy">Sort files by</Label>
                                <Select value={settings.sortBy} onValueChange={(value) => handleSettingChange('sortBy', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="creationDate">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                Creation Date
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="alphabetical">
                                            <div className="flex items-center gap-2">
                                                <Type className="w-4 h-4" />
                                                Alphabetical
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="lastModified">
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                Last Modified
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="fileType">
                                            <div className="flex items-center gap-2">
                                                <File className="w-4 h-4" />
                                                File Type
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sortOrder">Sort order</Label>
                                <Select value={settings.sortOrder} onValueChange={(value) => handleSettingChange('sortOrder', value)}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="asc">
                                            <div className="flex items-center gap-2">
                                                <SortAsc className="w-4 h-4" />
                                                Ascending
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="desc">
                                            <div className="flex items-center gap-2">
                                                <SortDesc className="w-4 h-4" />
                                                Descending
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Show folders first</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Display folders at the top of the file list
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.foldersFirst}
                                    onCheckedChange={(checked) => handleSettingChange('foldersFirst', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Show hidden files</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Display files and folders that start with a dot
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.showHiddenFiles}
                                    onCheckedChange={(checked) => handleSettingChange('showHiddenFiles', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Auto-expand folders</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically expand folders when navigating
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.autoExpandFolders}
                                    onCheckedChange={(checked) => handleSettingChange('autoExpandFolders', checked)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Editor Settings */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <File className="w-5 h-5" />
                            Editor
                        </CardTitle>
                        <CardDescription>
                            Configure the markdown editor behavior
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Auto-save</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically save changes while typing
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.autoSave}
                                    onCheckedChange={(checked) => handleSettingChange('autoSave', checked)}
                                />
                            </div>

                            {settings.autoSave && (
                                <div className="space-y-2">
                                    <Label htmlFor="autoSaveDelay">Auto-save delay</Label>
                                    <Select 
                                        value={settings.autoSaveDelay.toString()} 
                                        onValueChange={(value) => handleSettingChange('autoSaveDelay', parseInt(value))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="1000">1 second</SelectItem>
                                            <SelectItem value="2000">2 seconds</SelectItem>
                                            <SelectItem value="3000">3 seconds</SelectItem>
                                            <SelectItem value="5000">5 seconds</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Word wrap</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Wrap long lines in the editor
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.wordWrap}
                                    onCheckedChange={(checked) => handleSettingChange('wordWrap', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Line numbers</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Show line numbers in the editor
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.lineNumbers}
                                    onCheckedChange={(checked) => handleSettingChange('lineNumbers', checked)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Appearance */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Palette className="w-5 h-5" />
                            Appearance
                        </CardTitle>
                        <CardDescription>
                            Customize the look and feel of the interface
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="theme">Theme</Label>
                            <Select value={settings.theme} onValueChange={(value) => handleSettingChange('theme', value)}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="light">
                                        <div className="flex items-center gap-2">
                                            <Sun className="w-4 h-4" />
                                            Light
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="dark">
                                        <div className="flex items-center gap-2">
                                            <Moon className="w-4 h-4" />
                                            Dark
                                        </div>
                                    </SelectItem>
                                    <SelectItem value="system">
                                        <div className="flex items-center gap-2">
                                            <Monitor className="w-4 h-4" />
                                            System
                                        </div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <Separator />

                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Compact mode</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Reduce spacing for a more compact interface
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.compactMode}
                                    onCheckedChange={(checked) => handleSettingChange('compactMode', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Show breadcrumbs</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Display navigation breadcrumbs
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.showBreadcrumbs}
                                    onCheckedChange={(checked) => handleSettingChange('showBreadcrumbs', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Show file icons</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Display icons next to files and folders
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.showFileIcons}
                                    onCheckedChange={(checked) => handleSettingChange('showFileIcons', checked)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Behavior */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Layout className="w-5 h-5" />
                            Behavior
                        </CardTitle>
                        <CardDescription>
                            Configure application behavior and interactions
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Confirm before deleting</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Show confirmation dialog when deleting files
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.confirmDelete}
                                    onCheckedChange={(checked) => handleSettingChange('confirmDelete', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Open files in new tab</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Always open files in a new tab instead of replacing current
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.openFilesInNewTab}
                                    onCheckedChange={(checked) => handleSettingChange('openFilesInNewTab', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Close tabs on delete</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Automatically close tabs when files are deleted
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.closeTabsOnDelete}
                                    onCheckedChange={(checked) => handleSettingChange('closeTabsOnDelete', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Restore tabs on startup</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Reopen previously opened tabs when starting the app
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.restoreTabsOnStartup}
                                    onCheckedChange={(checked) => handleSettingChange('restoreTabsOnStartup', checked)}
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Notifications */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Eye className="w-5 h-5" />
                            Notifications
                        </CardTitle>
                        <CardDescription>
                            Configure notification preferences
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Show notifications</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Display toast notifications for actions
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.showNotifications}
                                    onCheckedChange={(checked) => handleSettingChange('showNotifications', checked)}
                                />
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="space-y-0.5">
                                    <Label>Sound effects</Label>
                                    <p className="text-sm text-muted-foreground">
                                        Play sounds for certain actions
                                    </p>
                                </div>
                                <Switch
                                    checked={settings.soundEnabled}
                                    onCheckedChange={(checked) => handleSettingChange('soundEnabled', checked)}
                                />
                            </div>

                            {settings.showNotifications && (
                                <div className="space-y-2">
                                    <Label htmlFor="notificationDuration">Notification duration</Label>
                                    <Select 
                                        value={settings.notificationDuration.toString()} 
                                        onValueChange={(value) => handleSettingChange('notificationDuration', parseInt(value))}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="2000">2 seconds</SelectItem>
                                            <SelectItem value="3000">3 seconds</SelectItem>
                                            <SelectItem value="4000">4 seconds</SelectItem>
                                            <SelectItem value="5000">5 seconds</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}