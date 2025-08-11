'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
    User, 
    Mail, 
    Calendar, 
    FileText, 
    Folder, 
    ArrowLeft, 
    Save,
    LogOut,
    Shield,
    Database,
    Clock,
    TrendingUp,
    GitCommit
} from 'lucide-react';
import { useCustomToast } from '../../lib/useCustomToast';
import Link from 'next/link';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function AccountPage() {
    const router = useRouter();
    const customToast = useCustomToast();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [emailChanging, setEmailChanging] = useState(false);
    const [showEmailChange, setShowEmailChange] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [stats, setStats] = useState({
        totalFiles: 0,
        totalFolders: 0,
        lastActivity: null,
        contributionData: [],
        totalContributions: 0,
        currentStreak: 0,
        longestStreak: 0
    });
    
    // Form data
    const [formData, setFormData] = useState({
        fullName: '',
        email: ''
    });

    // Add ref for the scrollable container
    const scrollContainerRef = useRef(null);

    useEffect(() => {
        const fetchUserAndStats = async () => {
            try {
                const { data: { user }, error } = await supabase.auth.getUser();
                
                if (error || !user) {
                    router.push('/login');
                    return;
                }

                setUser(user);
                setFormData({
                    fullName: user.user_metadata?.full_name || '',
                    email: user.email || ''
                });

                // Fetch user stats
                const { data: fileStats } = await supabase
                    .from('file_tree')
                    .select('type, created_at, updated_at')
                    .eq('user_id', user.id);

                if (fileStats) {
                    const files = fileStats.filter(item => item.type === 'file').length;
                    const folders = fileStats.filter(item => item.type === 'folder').length;
                    const lastActivity = fileStats.length > 0 
                        ? new Date(Math.max(...fileStats.map(item => new Date(item.updated_at))))
                        : null;

                    // Generate contribution data for the last ~1 year (52 weeks)
                    const { contributionData, totalContributions, currentStreak, longestStreak } = generateContributionData(fileStats);

                    setStats({
                        totalFiles: files,
                        totalFolders: folders,
                        lastActivity,
                        contributionData,
                        totalContributions,
                        currentStreak,
                        longestStreak
                    });
                }
            } catch (error) {
                console.error('Error fetching user data:', error);
                customToast.error('Failed to load account data');
            } finally {
                setLoading(false);
            }
        };

        fetchUserAndStats();
    }, [router]);

    // Add useEffect to scroll to end when data loads
    useEffect(() => {
        if (scrollContainerRef.current && stats.contributionData.length > 0) {
            // Scroll to the right end to show recent contributions
            scrollContainerRef.current.scrollLeft = scrollContainerRef.current.scrollWidth;
        }
    }, [stats.contributionData]);

    const generateContributionData = (fileStats) => {
        const contributions = [];
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0];
        
        // Start from exactly 52 weeks ago, but align to Sunday (week start)
        const startDate = new Date();
        startDate.setDate(today.getDate() - 363); // Go back 363 days to get 52 full weeks
        
        // Align to start on Sunday
        const dayOfWeek = startDate.getDay();
        startDate.setDate(startDate.getDate() - dayOfWeek);
        
        // Create a map of date strings to contribution counts
        const contributionMap = {};
        
        fileStats.forEach(item => {
            const date = new Date(item.created_at).toISOString().split('T')[0];
            contributionMap[date] = (contributionMap[date] || 0) + 1;
        });

        // Generate exactly 53 weeks to ensure we include the current week
        for (let week = 0; week < 53; week++) {
            const weekData = [];
            for (let day = 0; day < 7; day++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + (week * 7) + day);
                const dateStr = currentDate.toISOString().split('T')[0];
                
                // Use string comparison to include today
                if (dateStr <= todayStr) {
                    const count = contributionMap[dateStr] || 0;
                    weekData.push({
                        date: dateStr,
                        count,
                        day: currentDate.getDay()
                    });
                } else {
                    // Future dates should be null
                    weekData.push(null);
                }
            }
            contributions.push(weekData);
        }
        
        // Keep only the last 52 weeks (remove the oldest week if we have 53)
        if (contributions.length > 52) {
            contributions.shift(); // Remove the first (oldest) week
        }
        
        // Calculate total contributions, current streak, and longest streak
        let totalContributions = 0;
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;

        contributions.flat().forEach((day, index) => {
            if (day) {
                totalContributions += day.count;
                tempStreak++;
                if (index === 0 || contributions.flat()[index - 1]?.count > 0) {
                    currentStreak = tempStreak;
                }
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                if (currentStreak === tempStreak) {
                    currentStreak = 0;
                }
                tempStreak = 0;
            }
        });

        longestStreak = Math.max(longestStreak, tempStreak);
        
        return { contributionData: contributions, totalContributions, currentStreak, longestStreak };
    };

    const getContributionLevel = (count) => {
        if (count === 0) return 0;
        if (count <= 2) return 1;
        if (count <= 4) return 2;
        if (count <= 6) return 3;
        return 4;
    };

    const getContributionColor = (level) => {
        const colors = [
            'bg-muted/30', // 0 contributions
            'bg-green-200', // 1-2 contributions
            'bg-green-400', // 3-4 contributions
            'bg-green-600', // 5-6 contributions
            'bg-green-800'  // 7+ contributions
        ];
        return colors[level];
    };

    const handleInputChange = (field, value) => {
        setFormData(prev => ({
            ...prev,
            [field]: value
        }));
    };

    const handleSave = async () => {
        if (!user) return;

        setSaving(true);
        try {
            const { error } = await supabase.auth.updateUser({
                data: {
                    full_name: formData.fullName
                }
            });

            if (error) {
                customToast.error('Failed to update profile');
                console.error('Error updating user:', error);
            } else {
                customToast.success('Profile updated successfully');
                // Re-fetch user data to reflect changes
                const { data: { user: updatedUser } } = await supabase.auth.getUser();
                setUser(updatedUser);
            }
        } catch (error) {
            console.error('Unexpected error:', error);
            customToast.error('An unexpected error occurred');
        } finally {
            setSaving(false);
        }
    };

    const handleEmailChange = async () => {
        if (!newEmail || newEmail === formData.email) {
            customToast.error('Please enter a different email address');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(newEmail)) {
            customToast.error('Please enter a valid email address');
            return;
        }

        setEmailChanging(true);
        try {
            const { error } = await supabase.auth.updateUser({ email: newEmail });
            if (error) {
                console.error('Error changing email:', error);
                customToast.error('Failed to change email');
            } else {
                customToast.success('Email change initiated. Please check your inbox to confirm.');
                setShowEmailChange(false);
                setNewEmail('');
                // Note: The email won't actually change in the UI until the user confirms via email
            }
        } catch (error) {
            console.error('Unexpected error:', error);
            customToast.error('An unexpected error occurred');
        } finally {
            setEmailChanging(false);
        }
    };

    const cancelEmailChange = () => {
        setShowEmailChange(false);
        setNewEmail('');
    };

    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                customToast.error('Failed to logout');
            } else {
                customToast.success('Logged out successfully');
                router.push('/login');
            }
        } catch (error) {
            console.error('Logout error:', error);
            customToast.error('An error occurred during logout');
        }
    };

    const getInitials = (name, email) => {
        if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase();
        if (email) return email.slice(0, 2).toUpperCase();
        return 'U';
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    return (
        <div className="h-full bg-background overflow-y-auto">
            {/* Simplified Header - no back button since it's in a tab */}
            <div className="border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                <div className="px-8 py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold">Account Settings</h1>
                            <p className="text-sm text-muted-foreground">
                                Manage your profile and preferences
                            </p>
                        </div>
                        <Button 
                            onClick={handleLogout}
                            variant="outline"
                            className="gap-2"
                        >
                            <LogOut className="w-4 h-4" />
                            Sign Out
                        </Button>
                    </div>
                </div>
            </div>

            <div className="px-8 py-8 w-full">
                <div className="grid gap-8 lg:grid-cols-3 w-full max-w-7xl mx-auto">
                    {/* Profile Card */}
                    <div className="lg:col-span-2 space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <User className="w-5 h-5" />
                                    Profile Information
                                </CardTitle>
                                <CardDescription>
                                    Update your personal details and preferences
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <Avatar className="w-20 h-20">
                                        <AvatarFallback className="text-xl font-semibold">
                                            {getInitials(formData.fullName, formData.email)}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <h3 className="text-lg font-semibold">
                                            {formData.fullName || 'Unnamed User'}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {formData.email}
                                        </p>
                                    </div>
                                </div>

                                <Separator />

                                <div className="grid gap-6 md:grid-cols-2">
                                    <div className="space-y-2">
                                        <Label htmlFor="fullName">Full Name</Label>
                                        <Input
                                            id="fullName"
                                            value={formData.fullName}
                                            onChange={(e) => handleInputChange('fullName', e.target.value)}
                                            placeholder="Enter your full name"
                                            className="h-10"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="email">Email Address</Label>
                                        {!showEmailChange ? (
                                            <div className="flex gap-2">
                                                <Input
                                                    id="email"
                                                    type="email"
                                                    value={formData.email}
                                                    disabled
                                                    className="bg-muted h-10 flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setShowEmailChange(true);
                                                        setNewEmail(formData.email);
                                                    }}
                                                    className="h-10 px-3"
                                                >
                                                    Change
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <Input
                                                    id="newEmail"
                                                    type="email"
                                                    value={newEmail}
                                                    onChange={(e) => setNewEmail(e.target.value)}
                                                    placeholder="Enter new email address"
                                                    className="h-10"
                                                />
                                                <div className="flex gap-2">
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        onClick={handleEmailChange}
                                                        disabled={emailChanging}
                                                        className="flex-1"
                                                    >
                                                        {emailChanging ? (
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                                                        ) : null}
                                                        {emailChanging ? 'Updating...' : 'Update Email'}
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={cancelEmailChange}
                                                        disabled={emailChanging}
                                                        className="flex-1"
                                                    >
                                                        Cancel
                                                    </Button>
                                                </div>
                                            </div>
                                        )}
                                        {!showEmailChange && (
                                            <p className="text-xs text-muted-foreground">
                                                Click "Change" to update your email address
                                            </p>
                                        )}
                                        {showEmailChange && (
                                            <p className="text-xs text-muted-foreground">
                                                You'll need to confirm the new email address before it takes effect
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="flex justify-end pt-4">
                                    <Button 
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="gap-2 px-6"
                                    >
                                        {saving ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                        ) : (
                                            <Save className="w-4 h-4" />
                                        )}
                                        {saving ? 'Saving...' : 'Save Changes'}
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Contribution Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <GitCommit className="w-5 h-5" />
                                    {stats.totalContributions} notes created in the last year
                                </CardTitle>
                                <CardDescription>
                                    Your note creation activity over the past 12 months
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {/* Fixed day labels and scrollable contribution grid */}
                                    <div className="flex gap-2">
                                        {/* Day labels - fixed outside scrollable area */}
                                        <div className="flex flex-col gap-0.5 flex-shrink-0">
                                            <div className="h-3 mb-2"></div> {/* Spacer for month labels */}
                                            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((day, i) => (
                                                <div key={i} className="h-3 text-[10px] text-muted-foreground flex items-center justify-end pr-1 w-8">
                                                    {day}
                                                </div>
                                            ))}
                                        </div>

                                        {/* Scrollable contribution grid */}
                                        <div 
                                            ref={scrollContainerRef}
                                            className="overflow-x-auto flex-1 scrollbar-hide"
                                            style={{
                                                scrollbarWidth: 'none', /* Firefox */
                                                msOverflowStyle: 'none', /* IE and Edge */
                                            }}
                                        >
                                            <style jsx>{`
                                                div::-webkit-scrollbar {
                                                    display: none; /* Chrome, Safari and Opera */
                                                }
                                            `}</style>
                                            <div className="flex gap-0.5" style={{ minWidth: '600px' }}>
                                                {/* Month labels and contribution squares container */}
                                                <div className="flex-1 min-w-0">
                                                    {/* Month labels - positioned above corresponding weeks */}
                                                    <div className="flex mb-2 h-3 relative">
                                                        {(() => {
                                                            const monthLabels = [];
                                                            let currentMonth = -1;
                                                            let monthStartWeek = 0;
                                                            let weekCount = 0;
                                                            let isFirstMonth = true; // Track if this is the first month

                                                            stats.contributionData.forEach((week, weekIndex) => {
                                                                const firstDay = week.find(day => day);
                                                                if (firstDay) {
                                                                    const date = new Date(firstDay.date);
                                                                    const month = date.getMonth();
                                                                    
                                                                    if (month !== currentMonth) {
                                                                        if (currentMonth !== -1 && weekCount > 0 && !isFirstMonth) { // Skip first month
                                                                            // Add the previous month label with unique key
                                                                            const prevDate = new Date();
                                                                            prevDate.setMonth(currentMonth);
                                                                            monthLabels.push(
                                                                                <div 
                                                                                    key={`${currentMonth}-${monthStartWeek}`}
                                                                                    className="absolute text-[10px] text-muted-foreground"
                                                                                    style={{ 
                                                                                        left: `${monthStartWeek * 14}px`,
                                                                                        width: `${weekCount * 14}px`
                                                                                    }}
                                                                                >
                                                                                    {prevDate.toLocaleDateString('en-US', { month: 'short' })}
                                                                                </div>
                                                                            );
                                                                        }
                                                                        
                                                                        currentMonth = month;
                                                                        monthStartWeek = weekIndex;
                                                                        weekCount = 1;
                                                                        isFirstMonth = false; // After first iteration, set to false
                                                                    } else {
                                                                        weekCount++;
                                                                    }
                                                                }
                                                            });

                                                            // Add the last month with unique key (always show the last month)
                                                            if (currentMonth !== -1 && weekCount > 0) {
                                                                const date = new Date();
                                                                date.setMonth(currentMonth);
                                                                monthLabels.push(
                                                                    <div 
                                                                        key={`${currentMonth}-${monthStartWeek}-last`}
                                                                        className="absolute text-[10px] text-muted-foreground"
                                                                        style={{ 
                                                                            left: `${monthStartWeek * 14}px`,
                                                                            width: `${weekCount * 14}px`
                                                                        }}
                                                                    >
                                                                        {date.toLocaleDateString('en-US', { month: 'short' })}
                                                                    </div>
                                                                );
                                                            }

                                                            return monthLabels;
                                                        })()}
                                                    </div>

                                                    {/* Contribution squares */}
                                                    <div className="flex gap-0.5">
                                                        {stats.contributionData.map((week, weekIndex) => (
                                                            <div key={weekIndex} className="flex flex-col gap-0.5 flex-shrink-0">
                                                                {week.map((day, dayIndex) => (
                                                                    <div
                                                                        key={dayIndex}
                                                                        className={`w-3 h-3 rounded-sm ${
                                                                            day 
                                                                                ? getContributionColor(getContributionLevel(day.count))
                                                                                : 'bg-muted/20'
                                                                        }`}
                                                                        title={
                                                                            day 
                                                                                ? `${day.count} notes created on ${new Date(day.date).toLocaleDateString()}`
                                                                                : ''
                                                                        }
                                                                    />
                                                                ))}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Legend */}
                                    <div className="flex items-center justify-between pt-2">
                                        <span className="text-xs text-muted-foreground">Less</span>
                                        <div className="flex items-center gap-1">
                                            {[0, 1, 2, 3, 4].map(level => (
                                                <div
                                                    key={level}
                                                    className={`w-3 h-3 rounded-sm ${getContributionColor(level)}`}
                                                />
                                            ))}
                                        </div>
                                        <span className="text-xs text-muted-foreground">More</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        {/* Account Stats */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Database className="w-5 h-5" />
                                    Account Stats
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-primary">{stats.totalFiles}</div>
                                        <div className="text-xs text-muted-foreground">Files</div>
                                    </div>
                                    <div className="text-center p-4 bg-muted/50 rounded-lg">
                                        <div className="text-2xl font-bold text-primary">{stats.totalFolders}</div>
                                        <div className="text-xs text-muted-foreground">Folders</div>
                                    </div>
                                </div>
                                
                                <Separator />
                                
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">Total Items</span>
                                        </div>
                                        <Badge variant="secondary">{stats.totalFiles + stats.totalFolders}</Badge>
                                    </div>
                                    
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">Current Streak</span>
                                        </div>
                                        <Badge variant="secondary">{stats.currentStreak} days</Badge>
                                    </div>

                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <GitCommit className="w-4 h-4 text-muted-foreground" />
                                            <span className="text-sm">Longest Streak</span>
                                        </div>
                                        <Badge variant="secondary">{stats.longestStreak} days</Badge>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Account Info */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Shield className="w-5 h-5" />
                                    Account Info
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm">Email</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground break-all">
                                        {user.email}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm">Member Since</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(user.created_at).toLocaleDateString('en-US', {
                                            year: 'numeric',
                                            month: 'long',
                                            day: 'numeric'
                                        })}
                                    </p>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-sm">Last Activity</span>
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {stats.lastActivity 
                                            ? stats.lastActivity.toLocaleDateString('en-US', {
                                                month: 'short',
                                                day: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : 'No activity yet'
                                        }
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}