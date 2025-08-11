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
    Edit,
    Trash2,
    Plus,
    LogOut,
    Text,
    ChevronUp,
    Copy,
    Scissors as Cut,
    Clipboard
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { createClient } from '@supabase/supabase-js';
import { Skeleton } from '@/components/ui/skeleton';
import { useCustomToast } from '../lib/useCustomToast';
import { useSettings } from '../lib/SettingsContext';

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
            path,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving file item:', error);
        return null;
    }

    // If it's a file, create content record
    if (type === 'file') {
        const { error: contentError } = await supabase
            .from('file_contents')
            .insert({
                file_id: data.id,
                content: content || '',
                version: 1
            });

        if (contentError) {
            console.error('Error creating file content:', contentError);
            // Optionally delete the file record if content creation fails
            await supabase.from('file_tree').delete().eq('id', data.id);
            return null;
        }
    }

    return data;
}

async function deleteFileItem(itemId) {
    // Close any open tabs for this file before deletion
    if (window.closeTabsForFile) {
        window.closeTabsForFile(itemId);
    }

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
// Replace your existing updateFileItem function with this updated version
async function updateFileItem(itemId, updates) {
    // Get the current item to check if it's being renamed
    const { data: currentItem, error: fetchError } = await supabase
        .from('file_tree')
        .select('*')
        .eq('id', itemId)
        .single();

    if (fetchError) {
        console.error('Error fetching current item:', fetchError);
        return null;
    }

    // If we're renaming, calculate the new path
    if (updates.name && updates.name !== currentItem.name) {
        let newPath = updates.name;

        if (currentItem.parent_id) {
            const { data: parent, error: parentError } = await supabase
                .from('file_tree')
                .select('path')
                .eq('id', currentItem.parent_id)
                .single();

            if (parentError) {
                console.error('Error getting parent path:', parentError);
                return null;
            }

            newPath = `${parent.path}/${updates.name}`;
        }

        // Add the new path to updates
        updates.path = newPath;
        updates.updated_at = new Date().toISOString();
    }

    // Update the item
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

    // If we renamed a folder, update all children paths recursively
    if (updates.name && currentItem.type === 'folder' && updates.name !== currentItem.name) {
        await updateChildrenPaths(itemId, updates.path);
    }

    return data;
}

// Add this new function to update children paths recursively
async function updateChildrenPaths(parentId, newParentPath) {
    try {
        // Get all direct children
        const { data: children, error: childrenError } = await supabase
            .from('file_tree')
            .select('id, name, type')
            .eq('parent_id', parentId);

        if (childrenError) {
            console.error('Error getting children for path update:', childrenError);
            return false;
        }

        if (!children || children.length === 0) {
            return true; // No children to update
        }

        // Update each child's path
        for (const child of children) {
            const newChildPath = `${newParentPath}/${child.name}`;

            const { error: updateError } = await supabase
                .from('file_tree')
                .update({
                    path: newChildPath,
                    updated_at: new Date().toISOString()
                })
                .eq('id', child.id);

            if (updateError) {
                console.error('Error updating child path:', updateError);
                continue; // Continue with other children even if one fails
            }

            // If this child is also a folder, recursively update its children
            if (child.type === 'folder') {
                await updateChildrenPaths(child.id, newChildPath);
            }
        }

        return true;
    } catch (error) {
        console.error('Error in updateChildrenPaths:', error);
        return false;
    }
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
                            {isFile && <Text className="w-3 h-3 mr-1 inline-block" />}
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
    contextMenuOpenFor,
    clipboard,
    onCopy,
    onCut,
    onPaste,
    settings // Pass settings down
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
        ? [...item.children]
            .filter(child => settings.showHiddenFiles || !child.name.startsWith('.'))
            .sort((a, b) => {
                if (settings.foldersFirst) {
                    const aIsFolder = a.type === 'folder';
                    const bIsFolder = b.type === 'folder';
                    if (aIsFolder !== bIsFolder) {
                        return aIsFolder ? -1 : 1;
                    }
                }

                let compareResult = 0;
                switch (settings.sortBy) {
                    case 'alphabetical':
                        compareResult = a.name.localeCompare(b.name);
                        break;
                    case 'lastModified':
                        compareResult = new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
                        break;
                    case 'fileType':
                        if (a.type !== b.type) {
                            compareResult = a.type.localeCompare(b.type);
                        } else {
                            compareResult = a.name.localeCompare(b.name);
                        }
                        break;
                    case 'creationDate':
                    default:
                        compareResult = new Date(b.created_at) - new Date(a.created_at);
                        break;
                }

                return settings.sortOrder === 'asc' ? compareResult : -compareResult;
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

    // Updated handleNameClick for double-click detection - but don't prevent folder toggle
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
                // Single click - handle normally (toggle folder or select file)
                if (isFolder) {
                    toggle();
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
                if (settings.confirmDelete) {
                    setConfirmDelete({
                        title: `Delete ${isFolder ? 'Folder' : 'File'}`,
                        message: `Are you sure you want to delete "${item.name}"?${isFolder ? ' This will also delete all files and folders inside it.' : ''} This action cannot be undone.`,
                        onConfirm: () => {
                            deleteItem(item);
                            setConfirmDelete(null);
                        },
                        onCancel: () => setConfirmDelete(null)
                    });
                } else {
                    deleteItem(item);
                }
                setContextMenu(null);
            },
            onAddFile: isFolder ? (folder) => {
                setPendingAdd({ parent: folder, type: 'file', input: '' });
                setContextMenu(null);
            } : undefined,
            onAddFolder: isFolder ? (folder) => {
                setPendingAdd({ parent: folder, type: 'folder', input: '' });
                setContextMenu(null);
            } : undefined,
            onCopy: () => onCopy(item),
            onCut: () => onCut(item),
            onPaste: () => onPaste(item),
            canPaste: clipboard !== null,
            clipboard: clipboard
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
                } : undefined,
                onCopy: () => onCopy(item),
                onCut: () => onCut(item),
                onPaste: () => onPaste(item),
                canPaste: clipboard !== null,
                clipboard: clipboard
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
                        className={`flex items-center gap-1 hover:bg-accent hover:opacity-80 py-1 px-2 rounded w-full text-left ${isSelected
                                ? 'bg-muted'
                                : hasContextMenu
                                    ? 'bg-muted/50'
                                    : ''
                            }`}
                        style={{ paddingLeft: `${depth * 20}px` }}
                    >
                        {isFolder ? (
                            isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                            ) : (
                                <ChevronRight className="w-4 h-4 text-muted-foreground" />
                            )
                        ) : (
                            settings.showFileIcons && <File className="mx-1 w-4 h-4 text-muted-foreground" />
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
                                clipboard={clipboard}
                                onCopy={onCopy}
                                onCut={onCut}
                                onPaste={onPaste}
                                settings={settings} // Pass settings down
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
function ContextMenu({ x, y, item, onRename, onDelete, onAddFile, onAddFolder, onClose, onCopy, onCut, onPaste, canPaste, clipboard }) {
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
                <Edit className="w-3 h-3" />
                Rename
            </button>
            <button
                onClick={onDelete}
                className="w-full text-left px-3 py-2 hover:bg-muted hover:text-destructive-foreground flex items-center gap-2 transition-colors text-red-500"
            >
                <Trash2 className="w-3 h-3" />
                Delete
            </button>
            {/* Added Copy, Cut, Paste options */}
            <div className="h-px bg-border my-1" />
            <button
                onClick={onCopy}
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 transition-colors"
            >
                <Copy className="w-3 h-3" />
                Copy
            </button>
            <button
                onClick={onCut}
                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center gap-2 transition-colors"
            >
                <Cut className="w-3 h-3" />
                Cut
            </button>
            <button
                onClick={onPaste}
                className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${!canPaste ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted'}`}
                disabled={!canPaste}
            >
                <Clipboard className="w-3 h-3" />
                Paste
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

    const handleAccountClick = () => {
        // Open account as a tab instead of navigating
        if (window.openSpecialTab) {
            window.openSpecialTab({
                id: 'account',
                name: 'Account Settings',
                type: 'account',
                path: '/account'
            });
        }
        setIsExpanded(false);
    };

    const handleSettingsClick = () => {
        // Open settings as a tab
        if (window.openSpecialTab) {
            window.openSpecialTab({
                id: 'settings',
                name: 'Settings',
                type: 'settings',
                path: '/settings'
            });
        }
        setIsExpanded(false); // Add this line to close the menu
    };

    return (
        <div className="border-t border-border relative">
            {/* Account Header */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full px-4 py-3 text-sm flex justify-between items-center hover:bg-muted/50 transition-colors"
            >
                <span className="text-xs text-muted-foreground uppercase">Account & Personalisation</span>
                <ChevronUp className="w-4 h-4 text-muted-foreground" />
            </button>

            {/* Expanded Options */}
            {isExpanded && (
                <div className="absolute bottom-full left-0 right-0 bg-background border border-border border-b-0 rounded-t-md">
                    {/* Profile */}
                    <button
                        onClick={handleAccountClick}
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors w-full"
                    >
                        <div className="w-6 h-6 rounded-full bg-muted text-xs flex items-center justify-center font-medium">
                            {initials}
                        </div>
                        <div className="flex flex-col text-left">
                            <span className="text-sm font-medium">{fullName}</span>
                            <span className="text-xs text-muted-foreground">Account settings</span>
                        </div>
                    </button>

                    {/* Settings */}
                    <button
                        onClick={handleSettingsClick}
                        className="flex items-center gap-3 px-4 py-2 text-sm hover:bg-muted/50 transition-colors w-full"
                    >
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        <div className="flex flex-col text-left">
                            <span className="text-sm font-medium">Settings</span>
                            <span className="text-xs text-muted-foreground">Preferences</span>
                        </div>
                    </button>

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
        </aside>
    );
}

export default function Sidebar({ onFileSelect: externalFileSelectHandler }) {
    const { settings } = useSettings();
    const showToast = useCustomToast(); // Rename to showToast for clarity
    const [tree, setTree] = useState([]);
    const [selectedFolder, setSelectedFolder] = useState(null);
    const [selectedFile, setSelectedFile] = useState(null);
    const [pendingAdd, setPendingAdd] = useState(null);
    const [user, setUser] = useState(null);
    const [contextMenu, setContextMenu] = useState(null);
    const [expandedPaths, setExpandedPaths] = useState([]);
    const [currentPath, setCurrentPath] = useState('/');
    const [loading, setLoading] = useState(true);
    const [clipboard, setClipboard] = useState(null);
    const [conflictDialog, setConflictDialog] = useState(null);

    // ADD THIS: Load expanded paths from localStorage on mount
    useEffect(() => {
        const savedExpandedPaths = localStorage.getItem('sidebarExpandedPaths');
        if (savedExpandedPaths) {
            try {
                const expandedPathsArray = JSON.parse(savedExpandedPaths);
                setExpandedPaths(expandedPathsArray);
            } catch (error) {
                console.error('Error parsing expanded paths from localStorage:', error);
                setExpandedPaths([]);
            }
        }
    }, []);

    // ADD THIS: Save expanded paths to localStorage whenever they change
    useEffect(() => {
        localStorage.setItem('sidebarExpandedPaths', JSON.stringify(expandedPaths));
    }, [expandedPaths]);

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
        if (settings.autoExpandFolders) {
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
        }
    };

    // Add the missing logout function
    const handleLogout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            if (error) {
                showToast('error', 'Failed to logout. Please try again.');
            } else {
                showToast('success', 'Logged out successfully');
                // Redirect to login page or home
                window.location.href = '/login';
            }
        } catch (error) {
            console.error('Logout error:', error);
            showToast('error', 'An error occurred during logout');
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
            showToast('error', `A file named "${name}" already exists in this location.`);
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
            showToast('error', 'Failed to create file. Please try again.');
        }
    };

    // Updated addFolder function with proper path handling
    const addFolder = async (parent, folderName = null) => {
        if (!user) return;

        const parentId = parent?.id || null;
        const name = folderName || 'New Folder';

        // Check for duplicates
        if (checkNameExists(name, parentId, tree)) {
            showToast('error', `A folder named "${name}" already exists in this location.`);
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
            showToast('error', 'Failed to create folder. Please try again.');
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
            showToast('error', `A ${itemType} named "${newName}" already exists in this location.`);
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
            showToast('error', 'Failed to rename. Please try again.');
        }
    };

    // Updated deleteItem function to preserve expanded state
    const deleteItem = async (item) => {
        if (!user || !item.id) return;

        const performDelete = async () => {
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
                if (settings.showNotifications) {
                    showToast('success', `${itemType} "${item.name}" deleted successfully.`);
                }
            } else {
                if (settings.showNotifications) {
                    showToast('error', 'Failed to delete. Please try again.');
                }
            }
        };

        if (settings.confirmDelete) {
            // This logic is now handled inside TreeItem's context menu handler
            // to avoid duplicating the dialog. For direct calls, you might add a dialog here.
            // For now, we assume deletion is initiated from the UI which has the check.
            console.warn("Direct deletion without confirmation UI is not fully handled here.");
            performDelete(); // Or show a dialog
        } else {
            performDelete();
        }
    };

    // Add clipboard operations
    const handleCopy = (item) => {
        setClipboard({ item, type: 'copy' });
        showToast('success', `Copied "${item.name}" to clipboard`);
    };

    const handleCut = (item) => {
        setClipboard({ item, type: 'cut' });
        showToast('success', `Cut "${item.name}" to clipboard`);
    };

    const handlePaste = async (destination) => {
        if (clipboard) {
            // ... (existing paste logic)
            if (success) {
                await loadUserFileTree(user.id);
                showToast('success', `Pasted "${clipboard.item.name}" successfully`);
            } else {
                showToast('error', 'Paste operation failed');
            }
        }
        setClipboard(null);
    };

    const handleEmptySpaceContextMenu = (e) => {
        e.preventDefault();
        const canPaste = clipboard !== null;

        setContextMenu({
            x: e.pageX,
            y: e.pageY,
            item: null,
            onAddFile: () => {
                setPendingAdd({ parent: null, type: 'file', input: '' });
                setContextMenu(null);
            },
            onAddFolder: () => {
                setPendingAdd({ parent: null, type: 'folder', input: '' });
                setContextMenu(null);
            },
            onPaste: canPaste ? () => handlePaste(null) : undefined,
            canPaste: canPaste,
            clipboard: clipboard,
            onRename: undefined,
            onDelete: undefined,
            onCopy: undefined,
            onCut: undefined
        });
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

            {settings.showBreadcrumbs && <Breadcrumbs
                path={currentPath}
                onNavigate={navigateToPath}
                selectedFile={selectedFile}
            />}

            <div
                className="flex-1 overflow-y-auto p-2 text-sm space-y-1"
                onClick={(e) => {
                    if (e.target === e.currentTarget) {
                        handleSelection(null, null);
                    }
                }}
                onContextMenu={handleEmptySpaceContextMenu}
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
                {tree
                    .filter(item => settings.showHiddenFiles || !item.name.startsWith('.'))
                    .sort((a, b) => {
                        if (settings.foldersFirst) {
                            const aIsFolder = a.type === 'folder';
                            const bIsFolder = b.type === 'folder';
                            if (aIsFolder !== bIsFolder) {
                                return aIsFolder ? -1 : 1;
                            }
                        }

                        let compareResult = 0;
                        switch (settings.sortBy) {
                            case 'alphabetical':
                                compareResult = a.name.localeCompare(b.name);
                                break;
                            case 'lastModified':
                                compareResult = new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
                                break;
                            case 'fileType':
                                if (a.type !== b.type) {
                                    compareResult = a.type.localeCompare(b.type);
                                } else {
                                    compareResult = a.name.localeCompare(b.name);
                                }
                                break;
                            case 'creationDate':
                            default:
                                compareResult = new Date(b.created_at) - new Date(a.created_at);
                                break;
                        }

                        return settings.sortOrder === 'asc' ? compareResult : -compareResult;
                    })
                    .map((item, i) => (
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
                        clipboard={clipboard}
                        onCopy={handleCopy}
                        onCut={handleCut}
                        onPaste={handlePaste}
                        settings={settings}
                    />
                ))}
            </div>

            {/* Updated Account Section - already includes Settings */}
            <AccountSection user={user} onLogout={handleLogout} />

            {contextMenu && (
                <ContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    item={contextMenu.item}
                    onRename={contextMenu.onRename}
                    onDelete={contextMenu.onDelete}
                    onAddFile={contextMenu.onAddFile}
                    onAddFolder={contextMenu.onAddFolder}
                    onCopy={contextMenu.onCopy}
                    onCut={contextMenu.onCut}
                    onPaste={contextMenu.onPaste}
                    canPaste={contextMenu.canPaste}
                    clipboard={contextMenu.clipboard}
                    onClose={() => setContextMenu(null)}
                />
            )}

            {conflictDialog && (
                <ConflictDialog
                    isOpen={true}
                    conflictType={conflictDialog.conflictType}
                    itemName={conflictDialog.itemName}
                    onReplace={conflictDialog.onReplace}
                    onRename={conflictDialog.onRename}
                    onCancel={conflictDialog.onCancel}
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
            // Close tabs for files being deleted
            if (child.type === 'file' && window.closeTabsForFile) {
                window.closeTabsForFile(child.id);
            }
            
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

// Conflict Dialog Component
function ConflictDialog({ isOpen, conflictType, itemName, onReplace, onRename, onCancel }) {
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
                <h3 className="text-lg font-semibold mb-2">Conflict Detected</h3>
                <p className="text-muted-foreground mb-4">
                    A {conflictType} named "{itemName}" already exists in this location.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onReplace}
                        className="px-4 py-2 text-sm bg-muted text-destructive-foreground rounded-md hover:bg-destructive/90 transition-colors"
                    >
                        Replace
                    </button>
                    <button
                        onClick={onRename}
                        className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                    >
                        Rename
                    </button>
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

// Add clipboard operations helper functions
async function copyFileItem(userId, sourceItem, targetParentId, newName = null) {
    const name = newName || sourceItem.name;

    // Generate new path
    let path = name;
    if (targetParentId) {
        const { data: parent } = await supabase
            .from('file_tree')
            .select('path')
            .eq('id', targetParentId)
            .single();

        if (parent) {
            path = `${parent.path}/${name}`;
        }
    }

    // Create new file/folder record
    const { data, error } = await supabase
        .from('file_tree')
        .insert({
            user_id: userId,
            name,
            type: sourceItem.type,
            parent_id: targetParentId,
            path,
            created_at: new Date().toISOString()
        })
        .select()
        .single();

    if (error) {
        console.error('Error copying file item:', error);
        return null;
    }

    // If it's a file, copy content
    if (sourceItem.type === 'file') {
        const { data: originalContent } = await supabase
            .from('file_contents')
            .select('content')
            .eq('file_id', sourceItem.id)
            .single();

        const { error: contentError } = await supabase
            .from('file_contents')
            .insert({
                file_id: data.id,
                content: originalContent?.content || '',
                version: 1
            });

        if (contentError) {
            console.error('Error copying file content:', contentError);
            await supabase.from('file_tree').delete().eq('id', data.id);
            return null;
        }
    }

    return data;
}

async function moveFileItem(itemId, targetParentId) {
    const { data: item, error: fetchError } = await supabase
        .from('file_tree')
        .select('*')
        .eq('id', itemId)
        .single();

    if (fetchError) {
        console.error('Error fetching item for move:', fetchError);
        return null;
    }

    let newPath = item.name;
    if (targetParentId) {
        const { data: parent } = await supabase
            .from('file_tree')
            .select('path')
            .eq('id', targetParentId)
            .single();

        if (parent) {
            newPath = `${parent.path}/${item.name}`;
        }
    }

    const { data, error } = await supabase
        .from('file_tree')
        .update({
            parent_id: targetParentId,
            path: newPath,
            updated_at: new Date().toISOString()
        })
        .eq('id', itemId)
        .select()
        .single();

    if (error) {
        console.error('Error moving item:', error);
        return null;
    }

    if (item.type === 'folder') {
        await updateChildrenPaths(itemId, newPath);
    }

    return data;
}

async function copyFolderRecursively(userId, sourceFolder, targetParentId, newName = null) {
    const copiedFolder = await copyFileItem(userId, sourceFolder, targetParentId, newName);
    if (!copiedFolder) return null;

    const { data: children, error } = await supabase
        .from('file_tree')
        .select('*')
        .eq('parent_id', sourceFolder.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error getting folder children for copy:', error);
        return copiedFolder;
    }

    if (children && children.length > 0) {
        for (const child of children) {
            if (child.type === 'folder') {
                await copyFolderRecursively(userId, child, copiedFolder.id);
            } else {
                await copyFileItem(userId, child, copiedFolder.id);
            }
        }
    }

    return copiedFolder;
}