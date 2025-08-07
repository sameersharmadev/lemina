'use client';

import { useState, useEffect, useRef } from 'react';
import { X, Edit, FileText, Trash2 } from 'lucide-react';
import MarkdownEditor from './MarkdownEditor';
import { createClient } from '@supabase/supabase-js';
import { toast } from 'sonner';

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
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    };

    // Handle drag over
    const handleDragOver = (e, index) => {
        e.preventDefault();
        if (draggedTab !== null && draggedTab !== index) {
            setDragOverIndex(index);
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
            startRename(tab);
        }
    };

    // Start renaming a tab
    const startRename = (tab) => {
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
            <button
                onClick={() => {
                    startRename(menu.tab);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
            >
                <Edit className="w-3 h-3" />
                Rename
            </button>
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

    return (
        <div className="flex flex-col h-full">
            {/* Tab Bar */}
            <div className="flex items-center border-b border-border bg-background min-h-[40px] overflow-x-auto">
                <div 
                    ref={tabsRef}
                    className="flex flex-1 min-w-0"
                >
                    {tabs.map((tab, index) => (
                        <div
                            key={tab.id}
                            draggable={renamingTabId !== tab.id}
                            onDragStart={(e) => handleDragStart(e, index)}
                            onDragOver={(e) => handleDragOver(e, index)}
                            onDrop={(e) => handleDrop(e, index)}
                            onDragEnd={handleDragEnd}
                            onContextMenu={(e) => handleContextMenu(e, tab)}
                            className={`
                                group flex items-center gap-2 px-3 py-2 border-r border-border cursor-pointer
                                min-w-[120px] max-w-[200px] relative
                                ${tab.id === activeTabId 
                                    ? 'bg-muted font-semibold' 
                                    : 'bg-muted/30 hover:bg-muted/50'
                                }
                                ${dragOverIndex === index ? 'border-l-2 border-l-primary' : ''}
                                ${draggedTab === index ? 'opacity-50' : ''}
                            `}
                            onClick={(e) => {
                                if (renamingTabId !== tab.id) {
                                    handleTabClick(tab, e);
                                }
                            }}
                        >
                            {renamingTabId === tab.id ? (
                                <input
                                    ref={renameInputRef}
                                    type="text"
                                    value={renameValue}
                                    onChange={(e) => setRenameValue(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleRenameSubmit();
                                        } else if (e.key === 'Escape') {
                                            e.preventDefault();
                                            cancelRename();
                                        }
                                    }}
                                    onBlur={handleRenameSubmit}
                                    onClick={(e) => e.stopPropagation()}
                                    className="bg-transparent border-none outline-none focus:outline-none text-sm truncate px-0 py-0 select-all w-20 min-w-16 max-w-24"
                                    style={{
                                        fontSize: '0.875rem !important',
                                        fontFamily: 'inherit',
                                        fontWeight: 'inherit',
                                        color: 'inherit',
                                        lineHeight: '1.25rem'
                                    }}
                                />
                            ) : (
                                <span className="truncate flex-1 text-sm select-none">
                                    {tab.name}
                                </span>
                            )}
                            
                            {/* Close button */}
                            {renamingTabId !== tab.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onTabClose(tab.id);
                                    }}
                                    className={`
                                        w-4 h-4 rounded hover:bg-destructive/20 flex items-center justify-center transition-opacity
                                        ${tab.id === activeTabId 
                                            ? 'opacity-100' 
                                            : 'opacity-0 group-hover:opacity-100'
                                        }
                                    `}
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Context Menu */}
            {contextMenu && <ContextMenu menu={contextMenu} />}

            {/* Editor Area */}
            <div className="flex-1 min-h-0">
                {activeTab ? (
                    <MarkdownEditor
                        key={activeTab.id}
                        fileId={activeTab.id}
                        fileName={activeTab.name}
                        user={user}
                    />
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