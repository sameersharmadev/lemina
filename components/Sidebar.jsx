'use client';

import {
    ChevronDown,
    ChevronRight,
    File,
    FilePlus,
    Folder,
    FolderPlus,
    Settings,
    ChevronRight as Separator,
    Home,
    Edit3,
    Trash2,
    Plus,
    LogOut,
    User, // Keep User icon
    ChevronUp
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Database helper functions - Updated to include created_at in ordering
async function loadFileTree(userId) {
    const { data, error } = await supabase
        .from('file_tree')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }); // Keep newest first for creation date

    if (error) {
        console.error('Error loading file tree:', error);
        return [];
    }

    // Convert flat structure to tree structure with proper sorting
    const buildTree = (items, parentId = null) => {
        const children = items
            .filter(item => item.parent_id === parentId)
            .map(item => ({
                ...item,
                children: item.type === 'folder' ? buildTree(items, item.id) : undefined
            }))
            .sort((a, b) => {
                // First sort by type (folders first)
                const aIsFolder = a.type === 'folder';
                const bIsFolder = b.type === 'folder';
                
                if (aIsFolder !== bIsFolder) {
                    return aIsFolder ? -1 : 1; // Folders first
                }
                
                // Then sort by creation date (newest first within same type)
                const aDate = new Date(a.created_at);
                const bDate = new Date(b.created_at);
                return bDate - aDate; // Newest first
            });
        
        return children;
    };

    return buildTree(data);
}

async function saveFileItem(userId, name, type, parentId = null, content = '') {
    // Generate path
    let path = name;
    if (parentId) {
        const { data: parent } = await supabase
            .from('file_tree')
            .select('path')
            .eq('id', parentId)
            .single();
        
        if (parent) {
            path = `${parent.path}/${name}`;
        }
    }

    const { data, error } = await supabase
        .from('file_tree')
        .insert({
            user_id: userId,
            name,
            type,
            parent_id: parentId,
            content,
            path,
            created_at: new Date().toISOString() // Ensure new items have current timestamp
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving file item:', error);
        return null;
    }

    return data;
}

async function deleteFileItem(itemId) {
    // First get all children if it's a folder
    const { data: children, error: childrenError } = await supabase
        .from('file_tree')
        .select('id')
        .eq('parent_id', itemId);

    if (childrenError) {
        console.error('Error getting children:', childrenError);
        return false;
    }

    // Delete children first (recursively)
    if (children && children.length > 0) {
        for (const child of children) {
            await deleteFileItem(child.id);
        }
    }

    // Then delete the item itself
    const { error } = await supabase
        .from('file_tree')
        .delete()
        .eq('id', itemId);

    if (error) {
        console.error('Error deleting file item:', error);
        return false;
    }

    return true;
}

async function updateFileItem(itemId, updates) {
    const { data, error } = await supabase
        .from('file_tree')
        .update(updates)
        .eq('id', itemId)
        .select()
        .single();

    if (error) {
        console.error('Error updating file item:', error);
        return null;
    }

    return data;
}

// Helper function to generate a path string for a folder or file
function generatePath(item, tree) {
    if (!item) return '/';
    
    const findPath = (nodes, target, currentPath = '') => {
        for (const node of nodes) {
            if (node === target) {
                return currentPath + '/' + node.name;
            }
            
            if (node.children) {
                const found = findPath(node.children, target, currentPath + '/' + node.name);
                if (found) return found;
            }
        }
        return null;
    };
    
    return findPath(tree, item) || '/';
}

function InputWithIcon({ icon, value, onChange, onSubmit, onCancel, placeholder, depth = 0 }) {
    const ref = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (ref.current && !ref.current.contains(e.target)) {
                onCancel();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onCancel]);

    return (
        <div ref={ref} className="flex items-center gap-1 px-2 py-1" style={{ paddingLeft: `${depth * 14}px` }}>
            {icon}
            <input
                autoFocus
                type="text"
                placeholder={placeholder}
                value={value}
                onChange={onChange}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') onSubmit();
                    else if (e.key === 'Escape') onCancel();
                }}
                className="w-full text-sm bg-transparent border-b border-muted focus:outline-none"
            />
        </div>
    );
}

function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
    const dialogRef = useRef(null);

    useEffect(() => {
        if (isOpen) {
            const handleEscape = (e) => {
                if (e.key === 'Escape') {
                    onCancel();
                }
            };
            
            document.addEventListener('keydown', handleEscape);
            return () => document.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onCancel]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div 
                ref={dialogRef}
                className="bg-background border border-border rounded-md p-6 max-w-md w-full"
            >
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-muted-foreground mb-6">{message}</p>
                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="px-4 py-2 text-sm bg-muted text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function Breadcrumbs({ path, onNavigate, selectedFile }) {
    const segments = path.split('/').filter(Boolean);
    const isFileSelected = !!selectedFile;
    
    return (
        <div className="flex items-center gap-1 text-xs text-muted-foreground overflow-x-auto px-2 py-1 border-b border-border">
            <button 
                onClick={() => onNavigate(null)} 
                className="flex items-center hover:text-foreground"
            >
                root
            </button>
            
            {segments.map((segment, index) => {
                // Build the path up to this segment
                const segmentPath = '/' + segments.slice(0, index + 1).join('/');
                const isLastSegment = index === segments.length - 1;
                
                // Last segment could be a file if we have a selected file
                const isFile = isFileSelected && isLastSegment;
                
                return (
                    <div key={index} className="flex items-center">
                        <Separator className="w-3 h-3 mx-1" />
                        <button 
                            onClick={() => onNavigate(segmentPath)} 
                            className={`hover:text-foreground truncate max-w-[100px] ${isFile ? 'text-foreground font-medium' : ''}`}
                        >
                            {isFile && <File className="w-3 h-3 mr-1 inline-block" />}
                            {!isFile && isLastSegment && <Folder className="w-3 h-3 mr-1 inline-block" />}
                            {segment}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}

function TreeItem({
    item,
    onAddFile,
    onAddFolder,
    onFileSelect,
    onSelect,
    selectedFolder,
    selectedFile,
    depth = 0,
    pendingAdd,
    setPendingAdd,
    setContextMenu,
    expandedPaths,
    toggleExpanded,
    path,
    fullTree,
    renameItem,
    deleteItem,
    contextMenuOpenFor
}) {
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameValue, setRenameValue] = useState(item.name);
    const [longPressTimer, setLongPressTimer] = useState(null);
    const [confirmDelete, setConfirmDelete] = useState(null);
    const [clickCount, setClickCount] = useState(0);
    const [clickTimer, setClickTimer] = useState(null);

    const isFolder = !!item.children;
    const currentPath = path + '/' + item.name;
    const isExpanded = expandedPaths.includes(currentPath);
    const isSelected = selectedFolder === item || selectedFile === item;
    const hasContextMenu = contextMenuOpenFor === item;
    
    const toggle = () => {
        if (isFolder && !isRenaming) {
            toggleExpanded(currentPath);
        }
    };

    // Updated sorting - folders always first, then files by creation date
    const sortedChildren = isFolder
        ? [...item.children].sort((a, b) => {
            // First sort by type (folders always first)
            const aIsFolder = a.type === 'folder';
            const bIsFolder = b.type === 'folder';
            
            if (aIsFolder !== bIsFolder) {
                return aIsFolder ? -1 : 1; // Folders first
            }
            
            // Within same type, sort by creation date (newest first)
            const aDate = new Date(a.created_at);
            const bDate = new Date(b.created_at);
            return bDate - aDate; // Newest first
        })
        : [];

    const showInput = pendingAdd?.parent === item;

    useEffect(() => {
        if (pendingAdd?.parent === item && !isExpanded) {
            toggleExpanded(currentPath, true);
        }
    }, [pendingAdd, item, isExpanded, toggleExpanded, currentPath]);

    // Clean up timers on unmount
    useEffect(() => {
        return () => {
            if (clickTimer) {
                clearTimeout(clickTimer);
            }
            if (longPressTimer) {
                clearTimeout(longPressTimer);
            }
        };
    }, [clickTimer, longPressTimer]);

    const handleItemClick = () => {
        if (isRenaming) return;
        
        if (isFolder) {
            toggle();
            onSelect(item, null);
        } else {
            onFileSelect(item);
        }
    };

    // Updated handleNameClick for double-click detection
    const handleNameClick = (e) => {
        e.stopPropagation();
        if (isRenaming) return;

        // Clear any existing timer
        if (clickTimer) {
            clearTimeout(clickTimer);
            setClickTimer(null);
        }

        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);

        if (newClickCount === 1) {
            // First click - set timer for single click action
            const timer = setTimeout(() => {
                setClickCount(0);
                // Single click - just select the item (no rename)
                if (isFolder) {
                    onSelect(item, null);
                } else {
                    onFileSelect(item);
                }
            }, 300); // 300ms delay to detect double click
            setClickTimer(timer);
        } else if (newClickCount === 2) {
            // Double click - start renaming
            setClickCount(0);
            setIsRenaming(true);
            setRenameValue(item.name);
        }
    };

    const handleRenameSubmit = () => {
        if (renameValue.trim() && renameValue !== item.name) {
            renameItem(item, renameValue.trim());
        }
        setIsRenaming(false);
    };

    const handleRenameCancel = () => {
        setIsRenaming(false);
        setRenameValue(item.name);
    };

    // Fixed context menu - pass the correct item and handlers
    const handleContextMenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setContextMenu({
            x: e.pageX,
            y: e.pageY,
            item: item,
            onRename: () => {
                setIsRenaming(true);
                setRenameValue(item.name);
                setContextMenu(null);
            },
            onDelete: () => {
                setConfirmDelete({
                    title: `Delete ${isFolder ? 'Folder' : 'File'}`,
                    message: `Are you sure you want to delete "${item.name}"?${isFolder ? ' This will also delete all files and folders inside it.' : ''} This action cannot be undone.`,
                    onConfirm: () => {
                        deleteItem(item);
                        setConfirmDelete(null);
                    },
                    onCancel: () => setConfirmDelete(null)
                });
                setContextMenu(null);
            },
            onAddFile: isFolder ? (folder) => {
                setPendingAdd({ parent: folder, type: 'file', input: '' });
                setContextMenu(null);
            } : undefined,
            onAddFolder: isFolder ? (folder) => {
                setPendingAdd({ parent: folder, type: 'folder', input: '' });
                setContextMenu(null);
            } : undefined
        });
    };

    // Fixed mobile long press handlers
    const handleTouchStart = (e) => {
        e.preventDefault();
        const timer = setTimeout(() => {
            const touch = e.touches[0];
            setContextMenu({
                x: touch.pageX,
                y: touch.pageY,
                item: item,
                onRename: () => {
                    setIsRenaming(true);
                    setRenameValue(item.name);
                    setContextMenu(null);
                },
                onDelete: () => {
                    setConfirmDelete({
                        title: `Delete ${isFolder ? 'Folder' : 'File'}`,
                        message: `Are you sure you want to delete "${item.name}"?${isFolder ? ' This will also delete all files and folders inside it.' : ''} This action cannot be undone.`,
                        onConfirm: () => {
                            deleteItem(item);
                            setConfirmDelete(null);
                        },
                        onCancel: () => setConfirmDelete(null)
                    });
                    setContextMenu(null);
                },
                onAddFile: isFolder ? (folder) => {
                    setPendingAdd({ parent: folder, type: 'file', input: '' });
                    setContextMenu(null);
                } : undefined,
                onAddFolder: isFolder ? (folder) => {
                    setPendingAdd({ parent: folder, type: 'folder', input: '' });
                    setContextMenu(null);
                } : undefined
            });
        }, 500);
        setLongPressTimer(timer);
    };

    const handleTouchEnd = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            setLongPressTimer(null);
        }
    };

    return (
        <>
            <div
                onContextMenu={handleContextMenu}
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                onTouchMove={handleTouchEnd}
            >
                <div className="flex items-center justify-between pr-2">
                    <button
                        onClick={handleItemClick}
                        className={`flex items-center gap-1 hover:bg-accent hover:opacity-80 py-1 px-2 rounded w-full text-left ${
                            isSelected 
                                ? 'bg-muted' 
                                : hasContextMenu 
                                    ? 'bg-muted/50'
                                    : ''
                        }`}
                        style={{ paddingLeft: `${depth * 12}px` }}
                    >
                        {isFolder ? (
                            isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )
                        ) : (
                            <File className="mx-1 w-4 h-4 text-muted-foreground" />
                        )}
                        
                        {isRenaming ? (
                            <input
                                autoFocus
                                type="text"
                                value={renameValue}
                                onChange={(e) => setRenameValue(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleRenameSubmit();
                                    } else if (e.key === 'Escape') {
                                        e.preventDefault();
                                        handleRenameCancel();
                                    }
                                }}
                                onBlur={handleRenameSubmit}
                                className="flex-1 bg-transparent border-b border-muted focus:outline-none focus:border-foreground text-sm"
                                onClick={(e) => e.stopPropagation()}
                            />
                        ) : (
                            <span 
                                className="truncate select-none"
                                onClick={handleNameClick}
                            >
                                {item.name}
                            </span>
                        )}
                    </button>
                </div>

                {isExpanded && isFolder && (
                    <div className="space-y-1">
                        {/* Show input at the top if adding to this folder */}
                        {showInput && (
                            <InputWithIcon
                                icon={
                                    pendingAdd.type === 'folder' ? (
                                        <Folder className="w-4 h-4 text-muted-foreground mr-1" />
                                    ) : (
                                        <File className="w-4 h-4 text-muted-foreground mr-1" />
                                    )
                                }
                                value={pendingAdd.input}
                                onChange={(e) =>
                                    setPendingAdd({ ...pendingAdd, input: e.target.value })
                                }
                                onSubmit={() => {
                                    if (!pendingAdd.input.trim()) return;
                                    if (pendingAdd.type === 'folder') {
                                        onAddFolder(item, pendingAdd.input.trim());
                                    } else {
                                        onAddFile(item, pendingAdd.input.trim());
                                    }
                                    setPendingAdd(null);
                                }}
                                onCancel={() => setPendingAdd(null)}
                                placeholder={pendingAdd.type === 'folder' ? 'New folder name' : 'New note'}
                                depth={depth + 1}
                            />
                        )}

                        {/* Then show the sorted children */}
                        {sortedChildren.map((child) => (
                            <TreeItem
                                key={child.id || child.name}
                                item={child}
                                onAddFile={onAddFile}
                                onAddFolder={onAddFolder}
                                onFileSelect={onFileSelect}
                                onSelect={onSelect}
                                selectedFolder={selectedFolder}
                                selectedFile={selectedFile}
                                depth={depth + 1}
                                pendingAdd={pendingAdd}
                                setPendingAdd={setPendingAdd}
                                setContextMenu={setContextMenu}
                                expandedPaths={expandedPaths}
                                toggleExpanded={toggleExpanded}
                                path={currentPath}
                                fullTree={fullTree}
                                renameItem={renameItem}
                                deleteItem={deleteItem}
                                contextMenuOpenFor={contextMenuOpenFor}
                            />
                        ))}
                    </div>
                )}
            </div>

            {confirmDelete && (
                <ConfirmDialog
                    isOpen={true}
                    title={confirmDelete.title}
                    message={confirmDelete.message}
                    onConfirm={confirmDelete.onConfirm}
                    onCancel={confirmDelete.onCancel}
                />
            )}
        </>
    );
}

// Updated ContextMenu to handle the passed handlers correctly
function ContextMenu({ x, y, item, onRename, onDelete, onAddFile, onAddFolder, onClose }) {
    const menuRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                onClose();
            }
        };
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);
        
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    // Adjust position if menu would go off screen
    useEffect(() => {
        if (menuRef.current) {
            const rect = menuRef.current.getBoundingClientRect();
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            
            if (rect.right > viewportWidth) {
                menuRef.current.style.left = `${x - rect.width}px`;
            }
            
            if (rect.bottom > viewportHeight) {
                menuRef.current.style.top = `${y - rect.height}px`;
            }
        }
    }, [x, y]);

    const isFolder = !!item.children;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-background leading-tight text-popover-foreground border border-border rounded-md text-xs min-w-[130px] py-1"
            style={{ top: y, left: x }}
        >
            {isFolder && onAddFile && onAddFolder && (
                <>
                    <button
                        onClick={() => onAddFile(item)}
                        className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 transition-colors"
                    >
                        <FilePlus className="w-3 h-3" />
                        Add File
                    </button>
                    <button
                        onClick={() => onAddFolder(item)}
                        className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 transition-colors"
                    >
                        <FolderPlus className="w-3 h-3" />
                        Add Folder
                    </button>
                    <div className="h-px bg-border my-1" />
                </>
            )}
            <button
                onClick={onRename}
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 transition-colors"
            >
                <Edit3 className="w-3 h-3" />
                Rename
            </button>
            <button
                onClick={onDelete}
                className="w-full text-left px-3 py-2 hover:bg-muted hover:text-destructive-foreground flex items-center gap-2 transition-colors text-red-500"
            >
                <Trash2 className="w-3 h-3" />
                Delete
            </button>
        </div>
    );
}

function getParent(child, nodes = [], parent = null) {
    for (const node of nodes) {
        if (node === child) return parent;
        if (node.children) {
            const res = getParent(child, node.children, node);
            if (res) return res;
        }
    }
    return null;
}

// Find a node (folder or file) by path
function findNodeByPath(path, tree) {
    if (path === '/' || !path) return null; // Root level
    
    const segments = path.split('/').filter(Boolean);
    let currentNodes = tree;
    let current = null;
    
    for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        const isLastSegment = i === segments.length - 1;
        
        // For the last segment, search for both files and folders
        if (isLastSegment) {
            current = currentNodes.find(node => node.name === segment);
        } else {
            // For intermediate segments, only search for folders
            current = currentNodes.find(node => node.name === segment && node.children);
        }
        
        if (!current) return null;
        
        // If it's a folder and not the last segment, continue traversing
        if (current.children && !isLastSegment) {
            currentNodes = current.children;
        } else if (!current.children && !isLastSegment) {
            // We hit a file in the middle of the path, which is invalid
            return null;
        }
    }
    
    return current;
}

// Add Account Section Component
function AccountSection({ user, onLogout }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const initials = (user?.user_metadata?.full_name || user?.user_metadata?.username || 'Unknown User')
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || 'US';

    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.username || 'Unknown User';

    return (
        <div className="border-t border-border relative">
            {/* Account Header - now shows user icon instead of chevron */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 text-sm flex justify-between items-center hover:bg-muted/50 transition-colors"
            >
                <span className="text-xs text-muted-foreground uppercase">Account & Personalisation</span>
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Expanded Options - now appear above the button */}
            {isExpanded && (
                <div className="absolute bottom-full left-0 right-0 bg-background border border-border border-b-0 rounded-t-md">
                    {/* Profile */}
                    <Link
                        href="/account"
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors"
                        onClick={() => setIsExpanded(false)}
                    >
                        <div className="w-6 h-6 rounded-full bg-muted text-xs flex items-center justify-center font-medium">
                            {initials}
                        </div>
                        <div className="flex flex-col">
                            <span className="text-sm font-medium">{fullName}</span>
                            <span className="text-xs text-muted-foreground">View profile</span>
                        </div>
                    </Link>

                    {/* Logout */}
                    <button
                        onClick={() => {
                            onLogout();
                            setIsExpanded(false);
                        }}
                        className="w-full flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors text-red-500 hover:text-red-400"
                    >
                        <LogOut className="w-4 h-4" />
                        <span>Logout</span>
                    </button>
                </div>
            )}
        </div>
    );
}

// Updated Skeleton - removed hardcoded dark background
function SidebarSkeleton() {
    return (
        <aside className="h-screen w-72 border-r border-border flex flex-col text-foreground bg-background">
            {/* Header Skeleton */}
            <div className="flex items-center gap-3 p-4 border-b border-border">
                <Skeleton className="w-8 h-8 rounded-full" />
                <div className="flex flex-col gap-1">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                </div>
            </div>

            {/* Explorer Header Skeleton */}
            <div className="flex items-center justify-between p-2 border-b border-border">
                <Skeleton className="h-3 w-16" />
                <div className="flex gap-3">
                    <Skeleton className="w-6 h-6 rounded" />
                    <Skeleton className="w-6 h-6 rounded" />
                </div>
            </div>

            {/* Breadcrumbs Skeleton */}
            <div className="flex items-center gap-1 px-2 py-1 border-b border-border">
                <Skeleton className="h-3 w-8" />
                <Skeleton className="h-3 w-3 mx-1" />
                <Skeleton className="h-3 w-12" />
            </div>

            {/* File Tree Skeleton */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {/* Root level items */}
                <div className="space-y-1">
                    {/* Folder with children */}
                    <div className="flex items-center gap-1 py-1 px-2">
                        <Skeleton className="w-4 h-4" />
                        <Skeleton className="h-4 flex-1" />
                    </div>
                    
                    {/* Nested items */}
                    <div className="ml-4 space-y-1">
                        <div className="flex items-center gap-1 py-1 px-2">
                            <Skeleton className="w-4 h-4" />
                            <Skeleton className="h-4 flex-1" />
                        </div>
                        <div className="flex items-center gap-1 py-1 px-2">
                            <Skeleton className="w-4 h-4" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>

                    {/* Another folder */}
                    <div className="flex items-center gap-1 py-1 px-2">
                        <Skeleton className="w-4 h-4" />
                        <Skeleton className="h-4 w-4/5" />
                    </div>

                    {/* Files at root */}
                    <div className="flex items-center gap-1 py-1 px-2">
                        <Skeleton className="w-4 h-4 mx-1" />
                        <Skeleton className="h-4 w-2/3" />
                    </div>
                    
                    <div className="flex items-center gap-1 py-1 px-2">
                        <Skeleton className="w-4 h-4 mx-1" />
                        <Skeleton className="h-4 w-3/5" />
                    </div>

                    <div className="flex items-center gap-1 py-1 px-2">
                        <Skeleton className="w-4 h-4 mx-1" />
                        <Skeleton className="h-4 w-4/5" />
                    </div>

                    {/* Another nested structure */}
                    <div className="flex items-center gap-1 py-1 px-2">
                        <Skeleton className="w-4 h-4" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                    
                    <div className="ml-4 space-y-1">
                        <div className="flex items-center gap-1 py-1 px-2">
                            <Skeleton className="w-4 h-4 mx-1" />
                            <Skeleton className="h-4 w-4/5" />
                        </div>
                        <div className="flex items-center gap-1 py-1 px-2">
                            <Skeleton className="w-4 h-4 mx-1" />
                            <Skeleton className="h-4 w-2/3" />
                        </div>
                        <div className="flex items-center gap-1 py-1 px-2">
                            <Skeleton className="w-4 h-4 mx-1" />
                            <Skeleton className="h-4 w-3/4" />
                        </div>
                    </div>

                    {/* More root items */}
                    <div className="flex items-center gap-1 py-1 px-2">
                        <Skeleton className="w-4 h-4 mx-1" />
                        <Skeleton className="h-4 w-3/5" />
                    </div>

                    <div className="flex items-center gap-1 py-1 px-2">
                        <Skeleton className="w-4 h-4 mx-1" />
                        <Skeleton className="h-4 w-1/2" />
                    </div>
                </div>
            </div>

            {/* Account Section Skeleton */}
            <div className="border-t border-border">
                <div className="px-4 py-3 flex justify-between items-center">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="w-4 h-4" />
                </div>
            </div>

            {/* Settings Link Skeleton */}
            <div className="border-t border-border px-4 py-3 flex justify-between items-center">
                <Skeleton className="h-4 w-12" />
                <Skeleton className="w-4 h-4" />
            </div>
        </aside>
    );
}

export default function Sidebar({ onFileSelect: externalFileSelectHandler }) {
    const [tree, setTree] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [pendingAdd, setPendingAdd] = useState(null);
    const [user, setUser] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [expandedPaths, setExpandedPaths] = useState([]);
    const [currentPath, setCurrentPath] = useState('/');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            setUser(user);
            if (user) {
                await loadUserFileTree(user.id, true); // Pass true for initial load
            }
            setLoading(false);
        };
        fetchUser();
    }, []);

    const loadUserFileTree = async (userId, isInitialLoad = false) => {
        if (isInitialLoad) {
            setLoading(true);
        }
        
        // Preserve expanded paths during reload (except for initial load)
        const previousExpandedPaths = isInitialLoad ? [] : expandedPaths;
        
        const treeData = await loadFileTree(userId);
        setTree(treeData);
        
        // Restore expanded paths after tree reload
        if (!isInitialLoad && previousExpandedPaths.length > 0) {
            setExpandedPaths(previousExpandedPaths);
        }
        
        if (isInitialLoad) {
            setLoading(false);
        }
    };

    // Update current path when selected folder or file changes
    useEffect(() => {
        if (selectedFile) {
            const path = generatePath(selectedFile, tree);
            setCurrentPath(path);
        } else if (selectedFolder) {
            const path = generatePath(selectedFolder, tree);
            setCurrentPath(path);
        } else {
            setCurrentPath('/');
        }
    }, [selectedFolder, selectedFile, tree]);

    const toggleExpanded = (path, forceExpand = false) => {
        setExpandedPaths(prev => {
            if (forceExpand && prev.includes(path)) {
                return prev; // Already expanded
            }
            return prev.includes(path) && !forceExpand
                ? prev.filter(p => p !== path)
                : [...prev, path];
        });
    };

    const handleSelection = (folder, file = null) => {
        setSelectedFolder(folder);
        setSelectedFile(file);
        
        if (file && externalFileSelectHandler) {
            externalFileSelectHandler(file);
        }
    };

    const handleFileSelection = (file) => {
        // Only select the file, don't select its parent folder
        setSelectedFile(file);
        setSelectedFolder(null); // Clear folder selection
        if (externalFileSelectHandler) {
            externalFileSelectHandler(file);
        }
    };

    const navigateToPath = (path) => {
        if (!path) {
            // Root level
            setSelectedFolder(null);
            setSelectedFile(null);
            return;
        }
        
        const node = findNodeByPath(path, tree);
        if (!node) return;
        
        if (node.children) {
            // It's a folder
            setSelectedFolder(node);
            setSelectedFile(null);
        } else {
            // It's a file
            setSelectedFile(node);
            setSelectedFolder(getParent(node, tree));
            if (externalFileSelectHandler) {
                externalFileSelectHandler(node);
            }
        }
        
        // Ensure path to this node is expanded
        const segments = path.split('/').filter(Boolean);
        let currentPath = '';
        
        for (let i = 0; i < segments.length; i++) {
            const isLastSegment = i === segments.length - 1;
            const segment = segments[i];
            currentPath += '/' + segment;
            
            // Don't expand the last segment if it's a file
            if (isLastSegment && !node.children) continue;
            
            if (!expandedPaths.includes(currentPath)) {
                toggleExpanded(currentPath, true);
            }
        }
    };

    // Add the missing logout function
    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                toast.error('Failed to logout. Please try again.');
            } else {
                toast.success('Logged out successfully');
                // Redirect to login page or home
                window.location.href = '/auth/login';
            }
        } catch (error) {
            console.error('Logout error:', error);
            toast.error('An error occurred during logout');
        }
    };

    // Helper function to get the correct parent folder for adding items
    const getCurrentParentFolder = () => {
        if (selectedFolder) {
            // If a folder is selected, add to that folder
            return selectedFolder;
        } else if (selectedFile) {
            // If a file is selected, add to its parent folder
            return getParent(selectedFile, tree);
        } else {
            // Nothing selected, add to root
            return null;
        }
    };

    const addItem = (parent, newItem) => {
        const update = (nodes) =>
            nodes.map((node) =>
                node === parent
                    ? { ...node, children: [...node.children, newItem] }
                    : node.children
                        ? { ...node, children: update(node.children) }
                        : node
            );
        return update(tree);
    };

    // Updated addFile function with proper path handling
    const addFile = async (parent, fileName = null) => {
        if (!user) return;

        const parentId = parent?.id || null;
        const name = fileName || 'Untitled';
        
        // Check for duplicates
        if (checkNameExists(name, parentId, tree)) {
            toast.error(`A file named "${name}" already exists in this location.`);
            return;
        }

        const newFile = await saveFileItem(user.id, name, 'file', parentId);
        if (newFile) {
            // Reload tree but preserve expanded state
            await loadUserFileTree(user.id, false); // false = not initial load
            
            // Auto-expand parent if needed
            if (parent) {
                const parentPath = getItemPath(parent, tree);
                if (parentPath && !expandedPaths.includes(parentPath)) {
                    setExpandedPaths(prev => [...prev, parentPath]);
                }
            }
            
        } else {
            toast.error('Failed to create file. Please try again.');
        }
    };

    // Updated addFolder function with proper path handling
    const addFolder = async (parent, folderName = null) => {
        if (!user) return;

        const parentId = parent?.id || null;
        const name = folderName || 'New Folder';
        
        // Check for duplicates
        if (checkNameExists(name, parentId, tree)) {
            toast.error(`A folder named "${name}" already exists in this location.`);
            return;
        }

        const newFolder = await saveFileItem(user.id, name, 'folder', parentId);
        if (newFolder) {
            // Reload tree but preserve expanded state
            await loadUserFileTree(user.id, false); // false = not initial load
            
            // Auto-expand parent if needed
            if (parent) {
                const parentPath = getItemPath(parent, tree);
                if (parentPath && !expandedPaths.includes(parentPath)) {
                    setExpandedPaths(prev => [...prev, parentPath]);
                }
            }
            
        } else {
            toast.error('Failed to create folder. Please try again.');
        }
    };

    // Helper function to check if name exists in parent
    function checkNameExists(name, parentId, tree, excludeId = null) {
        // Find the parent folder or use root
        let parentChildren;
        
        if (parentId === null) {
            // Root level
            parentChildren = tree;
        } else {
            // Find parent folder
            const findParent = (items) => {
                for (const item of items) {
                    if (item.id === parentId) {
                        return item.children || [];
                    }
                    if (item.children) {
                        const found = findParent(item.children);
                        if (found) return found;
                    }
                }
                return null;
            };
            parentChildren = findParent(tree) || [];
        }
        
        // Check if name exists (excluding the item being renamed)
        return parentChildren.some(child => 
            child.name.toLowerCase() === name.toLowerCase() && 
            child.id !== excludeId
        );
    }

    // Updated renameItem function to preserve expanded state
    const renameItem = async (item, newName) => {
        if (!user || !item.id) return;

        // Get the parent ID
        const parent = getParent(item, tree);
        const parentId = parent?.id || null;
        
        // Check if new name already exists (excluding current item)
        if (checkNameExists(newName, parentId, tree, item.id)) {
            const itemType = item.children ? 'folder' : 'file';
            toast.error(`A ${itemType} named "${newName}" already exists in this location.`);
            return;
        }

        // Store current expanded paths before rename
        const currentExpandedPaths = [...expandedPaths];
        
        const success = await updateFileItem(item.id, { name: newName });
        if (success) {
            // Reload tree but preserve expanded state
            await loadUserFileTree(user.id, false); // false = not initial load
            
            // Update any expanded paths that reference the renamed item
            if (item.children) {
                const oldPath = getItemPath(item, tree);
                if (oldPath) {
                    const updatedPaths = currentExpandedPaths.map(path => {
                        if (path.includes(oldPath)) {
                            // Replace the old name with new name in the path
                            const pathSegments = path.split('/');
                            const itemNameIndex = pathSegments.findIndex(segment => segment === item.name);
                            if (itemNameIndex !== -1) {
                                pathSegments[itemNameIndex] = newName;
                                return pathSegments.join('/');
                            }
                        }
                        return path;
                    });
                    setExpandedPaths(updatedPaths);
                }
            }
            
        } else {
            toast.error('Failed to rename. Please try again.');
        }
    };

    // Updated deleteItem function to preserve expanded state
    const deleteItem = async (item) => {
        if (!user || !item.id) return;

        let success = false;
        
        if (item.children) {
            // It's a folder - use recursive deletion
            success = await deleteFolderRecursively(item.id);
        } else {
            // It's a file - use simple deletion
            success = await deleteFileItem(item.id);
        }
        
        if (success) {
            // Clean up expanded paths for deleted items
            const itemPath = getItemPath(item, tree);
            if (itemPath) {
                setExpandedPaths(prev => 
                    prev.filter(path => !path.startsWith(itemPath))
                );
            }
            
            // Reload tree but preserve remaining expanded state
            await loadUserFileTree(user.id, false); // false = not initial load
            
            // Clear selection if deleted item was selected
            if (selectedFile?.id === item.id) {
                setSelectedFile(null);
            }
            if (selectedFolder?.id === item.id) {
                setSelectedFolder(null);
            }
            
            const itemType = item.children ? 'Folder' : 'File';
            toast.success(`${itemType} "${item.name}" deleted successfully.`);
        } else {
            toast.error('Failed to delete. Please try again.');
        }
    };

    const initials = (user?.user_metadata?.full_name || user?.user_metadata?.username || 'Unknown User')
        ?.split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase() || 'US';

    const fullName = user?.user_metadata?.full_name || user?.user_metadata?.username || 'Unknown User';

    // Format the current date
    const currentDate = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    if (loading) {
        return <SidebarSkeleton />;
    }

    return (
        <aside className="h-screen w-72 border-r border-border flex flex-col text-foreground bg-background">
            <div className="flex items-center gap-3 p-4 border-b border-border">
                <div className="w-8 h-8 rounded-full bg-muted text-sm flex items-center justify-center font-medium uppercase">
                    {initials}
                </div>
                <div className="flex flex-col">
                    <Link href="/account" className="text-sm font-medium hover:opacity-80">
                        {fullName}
                    </Link>
                    <span className="text-xs text-muted-foreground">
                        {currentDate}
                    </span>
                </div>
            </div>

            <div className="flex items-center justify-between p-2 border-b border-border">
                <span className="text-xs text-muted-foreground uppercase">Explorer</span>
                <div className="flex gap-3">
                    <button 
                        onClick={() => setPendingAdd({ 
                            parent: getCurrentParentFolder(), 
                            type: 'file', 
                            input: '' 
                        })}
                        className="hover:bg-muted p-1 rounded"
                        title="Add File"
                    >
                        <FilePlus className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button 
                        onClick={() => setPendingAdd({ 
                            parent: getCurrentParentFolder(), 
                            type: 'folder', 
                            input: '' 
                        })}
                        className="hover:bg-muted p-1 rounded"
                        title="Add Folder"
                    >
                        <FolderPlus className="w-4 h-4 text-muted-foreground" />
                    </button>
                </div>
            </div>

            <Breadcrumbs 
                path={currentPath} 
                onNavigate={navigateToPath} 
                selectedFile={selectedFile}
            />

            <div
                className="flex-1 overflow-y-auto p-2 text-sm space-y-1"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        handleSelection(null, null);
                    }
                }}
            >
                {/* Show root-level input at the top if adding to root */}
                {pendingAdd && pendingAdd.parent === null && (
                    <InputWithIcon
                        icon={
                            pendingAdd.type === 'folder' ? (
                                <Folder className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <File className="w-4 h-4 text-muted-foreground" />
                            )
                        }
                        value={pendingAdd.input}
                        onChange={(e) => setPendingAdd({ ...pendingAdd, input: e.target.value })}
                        onSubmit={() => {
                            if (!pendingAdd.input.trim()) return;
                            if (pendingAdd.type === 'folder') addFolder(null, pendingAdd.input.trim());
                            else addFile(null, pendingAdd.input.trim());
                            setPendingAdd(null);
                        }}
                        onCancel={() => setPendingAdd(null)}
                        placeholder={pendingAdd.type === 'folder' ? 'New folder name' : 'New note'}
                    />
                )}

                {/* Then show the tree items */}
                {tree.map((item, i) => (
                    <TreeItem
                        key={item.id || i}
                        item={item}
                        onAddFile={addFile}
                        onAddFolder={addFolder}
                        onFileSelect={handleFileSelection}
                        onSelect={handleSelection}
                        selectedFolder={selectedFolder}
                        selectedFile={selectedFile}
                        pendingAdd={pendingAdd}
                        setPendingAdd={setPendingAdd}
                        setContextMenu={setContextMenu}
                        expandedPaths={expandedPaths}
                        toggleExpanded={toggleExpanded}
                        path=""
                        fullTree={tree}
                        renameItem={renameItem}
                        deleteItem={deleteItem}
                        contextMenuOpenFor={contextMenu?.item}
                    />
                ))}
            </div>

            {/* Updated Account Section */}
            <AccountSection user={user} onLogout={handleLogout} />

            {/* Settings Link */}
            <Link
                href="/settings"
                className="hover:opacity-80 border-t border-border px-4 py-3 text-sm flex justify-between items-center"
            >
                Settings
                <Settings className="w-4 h-4 text-muted-foreground" />
            </Link>

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    onRename={contextMenu.onRename}
                    onDelete={contextMenu.onDelete}
                    onAddFile={contextMenu.onAddFile}
                    onAddFolder={contextMenu.onAddFolder}
                    onClose={() => setContextMenu(null)}
                />
            )}
        </aside>
    );
}

// Helper function to update paths when an item is renamed
function updatePathsAfterRename(paths, oldItemPath, newName) {
    return paths.map(path => {
        if (path === oldItemPath) {
            // Direct path to the renamed item
            const pathParts = path.split('/');
            pathParts[pathParts.length - 1] = newName;
            return pathParts.join('/');
        } else if (path.startsWith(oldItemPath + '/')) {
            // Child paths of the renamed item
            const pathParts = path.split('/');
            const oldNameIndex = oldItemPath.split('/').length - 1;
            pathParts[oldNameIndex] = newName;
            return pathParts.join('/');
        }
        return path;
    });
}

async function deleteFolderRecursively(itemId) {
    // First get all direct children
    const { data: children, error: childrenError } = await supabase
        .from('file_tree')
        .select('id, type')
        .eq('parent_id', itemId);

    if (childrenError) {
        console.error('Error getting children:', childrenError);
        return false;
    }

    // Delete children first (recursively for folders)
    if (children && children.length > 0) {
        for (const child of children) {
            if (child.type === 'folder') {
                await deleteFolderRecursively(child.id);
            } else {
                await deleteFileItem(child.id);
            }
        }
    }

    // Then delete the folder itself
    const { error } = await supabase
        .from('file_tree')
        .delete()
        .eq('id', itemId);

    if (error) {
        console.error('Error deleting folder:', error);
        return false;
    }

    return true;
}

// Add the missing getItemPath function after the existing helper functions
function getItemPath(item, tree, currentPath = '') {
    for (const node of tree) {
        const nodePath = currentPath + '/' + node.name;
        
        if (node === item) {
            return nodePath;
        }
        
        if (node.children) {
            const found = getItemPath(item, node.children, nodePath);
            if (found) return found;
        }
    }
    return null;
}