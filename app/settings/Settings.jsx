'use client';

import { useState } from 'react';
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
import { useSettings } from '../../lib/SettingsContext';
import { useCustomToast } from '../../lib/useCustomToast';
import { playSound } from '../../lib/sounds'; 

export default function SettingsPage() {
    const { settings, handleSettingChange, resetSettings, loading } = useSettings();
    const showToast = useCustomToast();
    const [saving, setSaving] = useState(false);

    const handleSave = () => {
        setSaving(true);
        // Settings are already saved on change, so we just show a toast.
        setTimeout(() => {
            showToast('success', 'Settings saved successfully');
            setSaving(false);
        }, 500);
    };

    const handleResetClick = () => {
        resetSettings();
        showToast('success', 'Settings have been reset to default');
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
                <div className="px-8 py-4">
                    <div className="flex items-center justify-between w-full max-w-none">
                        <div>
                            <h1 className="text-2xl font-semibold">Settings</h1>
                            <p className="text-sm text-muted-foreground">
                                Customize your workspace preferences
                            </p>
                        </div>
                        <div className="flex gap-2">
                            <Button 
                                onClick={handleResetClick}
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

            <div className="px-8 py-8 w-full space-y-8">
                {/* File Management */}
                <Card className="w-full">
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

                            
                        </div>
                    </CardContent>
                </Card>

                {/* Editor Settings */}
                <Card className="w-full">
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
                <Card className="w-full">
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
                <Card className="w-full">
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
                <Card className="w-full">
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
                                    onCheckedChange={(checked) => {
                                        handleSettingChange('soundEnabled', checked);
                                        // Play sound on enable to test it
                                        if (checked) {
                                            playSound('notification');
                                        }
                                    }}
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