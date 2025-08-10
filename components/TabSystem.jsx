'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Edit, FileText, Trash2, User, Settings } from 'lucide-react';
import MarkdownEditor from './MarkdownEditor';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';
import AccountPage from '../app/account/Account';
import SettingsPage from '../app/settings/Settings'; // Add this import

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default function TabSystem({
    tabs,
    activeTabId,
    onTabClose,
    onTabSwitch,
    onTabReorder,
    onCloseOthers, 
    onCloseAll,    
    onTabUpdate,   
    user
}) {
    const [draggedTab, setDraggedTab] = useState(null);
    const [dragOverIndex, setDragOverIndex] = useState(null);
    const [renamingTabId, setRenamingTabId] = useState(null);
    const [renameValue, setRenameValue] = useState('');
    const [contextMenu, setContextMenu] = useState(null);
    const [clickTimeout, setClickTimeout] = useState(null);
    const [clickCount, setClickCount] = useState(0);
    const tabsRef = useRef(null);
    const renameInputRef = useRef(null);

    // Handle drag start
    const handleDragStart = (e, index) => {
        setDraggedTab(index);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', ''); // Required for some browsers
        
        // Create a custom drag image (optional)
        const dragImage = e.target.cloneNode(true);
        dragImage.style.opacity = '0.8';
        dragImage.style.transform = 'rotate(5deg)';
        e.dataTransfer.setDragImage(dragImage, 0, 0);
    };

    // Handle drag over
    const handleDragOver = (e, index) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedTab !== null && draggedTab !== index) {
            setDragOverIndex(index);
        }
    };

    // Handle drag enter
    const handleDragEnter = (e, index) => {
        e.preventDefault();
        if (draggedTab !== null && draggedTab !== index) {
            setDragOverIndex(index);
        }
    };

    // Handle drag leave
    const handleDragLeave = (e) => {
        // Only clear drag over if we're leaving the tab area entirely
        if (!e.currentTarget.contains(e.relatedTarget)) {
            setDragOverIndex(null);
        }
    };

    // Handle drop
    const handleDrop = (e, index) => {
        e.preventDefault();
        
        if (draggedTab !== null && draggedTab !== index) {
            onTabReorder(draggedTab, index);
        }
        
        setDraggedTab(null);
        setDragOverIndex(null);
    };

    // Handle drag end
    const handleDragEnd = () => {
        setDraggedTab(null);
        setDragOverIndex(null);
    };

    // Handle tab click (single/double click detection)
    const handleTabClick = (tab, e) => {
        e.preventDefault();
        
        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);

        if (clickTimeout) {
            clearTimeout(clickTimeout);
        }

        if (newClickCount === 1) {
            const timeout = setTimeout(() => {
                // Single click - switch tab
                onTabSwitch(tab.id);
                setClickCount(0);
            }, 300);
            setClickTimeout(timeout);
        } else if (newClickCount === 2) {
            // Double click - start renaming
            clearTimeout(clickTimeout);
            setClickCount(0);
            if (!tab.isSpecial) { // Don't allow renaming special tabs
                startRename(tab);
            }
        }
    };

    // Start renaming a tab
    const startRename = (tab) => {
        if (tab.isSpecial) return; // Prevent renaming special tabs
        setRenamingTabId(tab.id);
        setRenameValue(tab.name);
        setContextMenu(null);
    };

    // Handle rename submit
    const handleRenameSubmit = async () => {
        if (!renamingTabId || !renameValue.trim()) {
            cancelRename();
            return;
        }

        try {
            const { error } = await supabase
                .from('file_tree')
                .update({ 
                    name: renameValue.trim(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', renamingTabId);

            if (error) {
                console.error('Error renaming file:', error);
                toast.error('Failed to rename file');
            } else {
                toast.success('File renamed successfully');
                
                // Update the tab name locally using the onTabUpdate prop
                if (onTabUpdate) {
                    onTabUpdate(renamingTabId, renameValue.trim());
                }
            }
        } catch (err) {
            console.error('Unexpected error renaming file:', err);
            toast.error('Failed to rename file');
        }

        setRenamingTabId(null);
        setRenameValue('');
    };

    // Fix the submitRename function reference
    const submitRename = () => {
        handleRenameSubmit();
    };

    // Cancel rename
    const cancelRename = () => {
        setRenamingTabId(null);
        setRenameValue('');
    };

    // Handle right-click context menu
    const handleContextMenu = (e, tab) => {
        e.preventDefault();
        e.stopPropagation();
        
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            tab: tab
        });
    };

    // Close context menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            setContextMenu(null);
        };

        if (contextMenu) {
            document.addEventListener('click', handleClickOutside);
            document.addEventListener('contextmenu', handleClickOutside);
        }

        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('contextmenu', handleClickOutside);
        };
    }, [contextMenu]);

    // Focus rename input when it appears
    useEffect(() => {
        if (renamingTabId && renameInputRef.current) {
            renameInputRef.current.focus();
            renameInputRef.current.select();
        }
    }, [renamingTabId]);

    // Context menu component
    const ContextMenu = ({ menu }) => (
        <div 
            className="fixed z-50 bg-background border border-border rounded-md shadow-lg py-1 min-w-[150px]"
            style={{ 
                left: `${Math.min(menu.x, window.innerWidth - 150)}px`, 
                top: `${Math.min(menu.y, window.innerHeight - 100)}px` 
            }}
            onClick={(e) => e.stopPropagation()}
        >
            {!menu.tab.isSpecial && (
                <>
                    <button
                        onClick={() => {
                            startRename(menu.tab);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
                    >
                        <Edit className="w-3 h-3" />
                        Rename
                    </button>
                    <div className="border-t border-border my-1" />
                </>
            )}
            <button
                onClick={() => {
                    onTabClose(menu.tab.id);
                    setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
            >
                <X className="w-3 h-3" />
                Close Tab
            </button>
            <div className="border-t border-border my-1" />
            <button
                onClick={() => {
                    if (onCloseOthers) {
                        onCloseOthers(menu.tab.id);
                    }
                    setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
            >
                <FileText className="w-3 h-3" />
                Close Others
            </button>
            <button
                onClick={() => {
                    if (onCloseAll) {
                        onCloseAll();
                    }
                    setContextMenu(null);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left text-destructive"
            >
                <Trash2 className="w-3 h-3" />
                Close All
            </button>
        </div>
    );

    const activeTab = tabs.find(tab => tab.id === activeTabId);

    // Function to render special tab content
    const renderSpecialTabContent = (tab) => {
        switch (tab.type) {
            case 'account':
                return <AccountPage />;
            case 'settings':
                return <SettingsPage />; // Update this line
            default:
                return <div className="p-8">Unknown special tab</div>;
        }
    };

    return (
        <div className="flex flex-col h-full">
            {/* Tab Bar */}
            <div className="flex-shrink-0 border-b border-border">
                <div className="flex overflow-x-auto" ref={tabsRef}>
                    {tabs.map((tab, index) => (
                        <div
                            key={tab.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDragEnter={(e) => handleDragEnter(e, index)}
                            onDragLeave={handleDragLeave}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            className={`
                                group flex items-center gap-2 px-4 py-2 border-r border-border cursor-pointer
                                min-w-0 max-w-xs relative transition-all duration-200
                                ${activeTabId === tab.id 
                                    ? 'bg-background text-foreground' 
                                    : 'bg-muted/30 text-muted-foreground hover:bg-muted/50'
                                }
                                ${draggedTab === index ? 'opacity-50 scale-95' : ''}
                                ${dragOverIndex === index && draggedTab !== index 
                                    ? 'border-l-2 border-primary bg-primary/10' 
                                    : ''
                                }
                            `}
                            onClick={(e) => handleTabClick(tab, e)}
                            onContextMenu={(e) => handleContextMenu(e, tab)}
                        >
                            {/* Drag indicator */}
                            {dragOverIndex === index && draggedTab !== index && (
                                <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-primary z-10" />
                            )}

                            {/* Tab Icon - different for special tabs */}
                            {tab.isSpecial ? (
                                tab.type === 'account' ? (
                                    <User className="w-4 h-4 flex-shrink-0" />
                                ) : tab.type === 'settings' ? (
                                    <Settings className="w-4 h-4 flex-shrink-0" />
                                ) : (
                                    <FileText className="w-4 h-4 flex-shrink-0" />
                                )
                            ) : (
                                <FileText className="w-4 h-4 flex-shrink-0" />
                            )}

                            {/* Tab Name */}
                            {renamingTabId === tab.id ? (
                                <input
                                    ref={renameInputRef}
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            submitRename();
                                        } else if (e.key === 'Escape') {
                                            cancelRename();
                                        }
                                        e.stopPropagation();
                                    }}
                                    onBlur={submitRename}
                                    className="bg-transparent border-none outline-none text-sm min-w-0 flex-1"
                                    onClick={(e) => e.stopPropagation()}
                                    onDragStart={(e) => e.preventDefault()} // Prevent dragging while renaming
                                />
                            ) : (
                                <span 
                                    className="truncate text-sm min-w-0 flex-1 select-none"
                                    onDoubleClick={() => !tab.isSpecial && startRename(tab)} // Prevent renaming special tabs
                                >
                                    {tab.name}
                                </span>
                            )}

                            {/* Close Button */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onTabClose(tab.id);
                                }}
                                onDragStart={(e) => e.preventDefault()} // Prevent dragging the close button
                                className="opacity-0 group-hover:opacity-100 hover:bg-muted/80 rounded p-1 transition-all flex-shrink-0 z-10"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && <ContextMenu menu={contextMenu} />}

            {/* Editor Area */}
            <div className="flex-1 min-h-0">
                {activeTab ? (
                    activeTab.isSpecial ? (
                        // Render special tab content
                        renderSpecialTabContent(activeTab)
                    ) : (
                        // Render normal file editor
                        <MarkdownEditor
                            key={activeTab.id}
                            fileId={activeTab.id}
                            fileName={activeTab.name}
                            user={user}
                        />
                    )
                ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                        <div className="text-center">
                            <h3 className="text-lg font-semibold mb-2">No file selected</h3>
                            <p className="text-sm">Open a file from the sidebar to start editing</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}