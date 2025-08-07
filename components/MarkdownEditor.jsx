'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Link from '@tiptap/extension-link';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import { toast } from 'sonner';
import { 
    Loader2, 
    Bold, 
    Italic, 
    Strikethrough, 
    Code, 
    List, 
    ListOrdered, 
    Quote, 
    Undo, 
    Redo,
    Heading1,
    Heading2,
    Heading3,
    Link2,
    CheckSquare,
    Highlighter
} from 'lucide-react';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Toolbar button component
const ToolbarButton = ({ onClick, isActive, disabled, children, title }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        title={title}
        className={`
            p-2 rounded-md text-sm font-medium transition-colors relative
            ${isActive 
                ? 'bg-primary text-primary-foreground shadow-sm' 
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }
            ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
    >
        {children}
    </button>
);

// Toolbar separator
const ToolbarSeparator = () => (
    <div className="w-px h-6 bg-border mx-1" />
);

export default function MarkdownEditor({ fileId, fileName, user }) {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(null);
    const [showLinkDialog, setShowLinkDialog] = useState(false);
    const [linkUrl, setLinkUrl] = useState('');
    // Add state to force toolbar re-renders
    const [, setForceUpdate] = useState({});
    
    const saveTimeoutRef = useRef(null);

    // Force re-render function
    const forceUpdate = useCallback(() => {
        setForceUpdate({});
    }, []);

    // Save content to database
    const saveContent = useCallback(async (content) => {
        if (!fileId || !user) return;

        setSaving(true);
        
        const { error } = await supabase
            .from('file_contents')
            .update({
                content: content,
                auto_saved_at: new Date().toISOString()
            })
            .eq('file_id', fileId);

        if (error) {
            console.error('Error saving content:', error);
            toast.error('Failed to save file');
        } else {
            setLastSaved(new Date());
        }
        
        setSaving(false);
    }, [fileId, user]);

    // Auto-save with debounce
    const debouncedSave = useCallback((content) => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        
        saveTimeoutRef.current = setTimeout(() => {
            saveContent(content);
        }, 1000);
    }, [saveContent]);

    // Initialize Tiptap editor
    const editor = useEditor({
        immediatelyRender: false,
        extensions: [
            StarterKit.configure({
                bulletList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                orderedList: {
                    keepMarks: true,
                    keepAttributes: false,
                },
                // Don't disable listItem completely, just configure it properly
                listItem: {
                    keepMarks: true,
                    keepAttributes: false,
                },
            }),
            Placeholder.configure({
                placeholder: 'Start writing your thoughts...',
            }),
            Typography,
            TaskList.configure({
                itemTypeName: 'taskItem',
                HTMLAttributes: {
                    class: 'task-list',
                },
            }),
            TaskItem.configure({
                nested: true,
                HTMLAttributes: {
                    class: 'task-item',
                },
            }),
            Link.configure({
                openOnClick: false,
                HTMLAttributes: {
                    class: 'editor-link',
                },
            }),
            Highlight.configure({
                multicolor: true,
                HTMLAttributes: {
                    class: 'editor-highlight',
                },
            }),
            Image.configure({
                inline: false,
                allowBase64: true,
                HTMLAttributes: {
                    class: 'editor-image',
                },
            }),
        ],
        content: '',
        editorProps: {
            attributes: {
                class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl mx-auto focus:outline-none min-h-full p-6 max-w-none',
                spellcheck: 'false', 
                autocorrect: 'off',  
                autocapitalize: 'off', 
                'data-gramm': 'false' 
            },
            handleDrop: (view, event, slice, moved) => {
                if (!moved && event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0]) {
                    const file = event.dataTransfer.files[0];
                    if (file.type.startsWith('image/')) {
                        event.preventDefault();
                        uploadImage(file).then(imageUrl => {
                            if (imageUrl) {
                                const { schema } = view.state;
                                const coordinates = view.posAtCoords({ left: event.clientX, top: event.clientY });
                                if (coordinates) {
                                    const node = schema.nodes.image.create({ src: imageUrl, alt: file.name });
                                    const transaction = view.state.tr.insert(coordinates.pos, node);
                                    view.dispatch(transaction);
                                }
                            }
                        });
                        return true;
                    }
                }
                return false;
            },
            handlePaste: (view, event, slice) => {
                const items = Array.from(event.clipboardData?.items || []);
                const imageItem = items.find(item => item.type.startsWith('image/'));
                
                if (imageItem) {
                    event.preventDefault();
                    const file = imageItem.getAsFile();
                    if (file) {
                        uploadImage(file).then(imageUrl => {
                            if (imageUrl) {
                                editor?.chain().focus().setImage({ src: imageUrl, alt: 'Pasted image' }).run();
                            }
                        });
                    }
                    return true;
                }
                return false;
            },
        },
        onUpdate: ({ editor }) => {
            const content = editor.getHTML();
            debouncedSave(content);
            // Force toolbar update on content change
            forceUpdate();
        },
        onSelectionUpdate: ({ editor }) => {
            // Force toolbar update on selection change
            forceUpdate();
        },
        onFocus: ({ editor }) => {
            // Force toolbar update on focus
            forceUpdate();
        },
    });

    // Load file content
    const loadContent = useCallback(async () => {
        if (!fileId || !user || !editor) return;

        setLoading(true);
        
        // First try to get existing content
        let { data: contentData, error } = await supabase
            .from('file_contents')
            .select('content, updated_at')
            .eq('file_id', fileId)
            .single();

        if (error && error.code === 'PGRST116') {
            // No content exists, create it
            const { data: newContent, error: insertError } = await supabase
                .from('file_contents')
                .insert({
                    file_id: fileId,
                    content: '',
                    version: 1
                })
                .select('content, updated_at')
                .single();

            if (insertError) {
                console.error('Error creating file content:', insertError);
                toast.error('Failed to load file');
                return;
            }
            
            contentData = newContent;
        } else if (error) {
            console.error('Error loading content:', error);
            toast.error('Failed to load file');
            return;
        }

        editor.commands.setContent(contentData.content || '');
        setLastSaved(new Date(contentData.updated_at));
        setLoading(false);
        
        // Force toolbar update after loading content
        forceUpdate();
    }, [fileId, user, editor, forceUpdate]);

    // Load content when file or editor changes
    useEffect(() => {
        if (editor) {
            loadContent();
        }
    }, [loadContent, editor]);

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, []);

    // Manual save on Ctrl+S
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (saveTimeoutRef.current) {
                    clearTimeout(saveTimeoutRef.current);
                }
                if (editor) {
                    saveContent(editor.getHTML());
                }
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => document.removeEventListener('keydown', handleKeyDown);
    }, [editor, saveContent]);

    // Handle link insertion
    const setLink = useCallback(() => {
        if (!editor) return;

        const previousUrl = editor.getAttributes('link').href;
        setLinkUrl(previousUrl || '');
        setShowLinkDialog(true);
    }, [editor]);

    const insertLink = useCallback(() => {
        if (!editor) return;

        if (linkUrl === '') {
            editor.chain().focus().extendMarkRange('link').unsetLink().run();
        } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
        }

        setShowLinkDialog(false);
        setLinkUrl('');
        
        // Force toolbar update after link insertion
        forceUpdate();
    }, [editor, linkUrl, forceUpdate]);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="w-6 h-6 animate-spin" />
            </div>
        );
    }

    if (!editor) {
        return (
            <div className="flex items-center justify-center h-full">
                <span className="text-muted-foreground">Loading editor...</span>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col bg-background">
            {/* Status bar */}
            <div className="flex justify-between items-center px-4 py-2 border-b border-border bg-muted/30 text-xs text-muted-foreground">
                <span>{fileName}</span>
                <div className="flex items-center gap-2">
                    {saving && (
                        <span className="flex items-center gap-1">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Saving...
                        </span>
                    )}
                    {lastSaved && !saving && (
                        <span>
                            Saved {lastSaved.toLocaleTimeString()}
                        </span>
                    )}
                </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background overflow-x-auto">
                {/* History */}
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().undo().run();
                        forceUpdate();
                    }}
                    disabled={!editor.can().undo()}
                    isActive={false}
                    title="Undo (Ctrl+Z)"
                >
                    <Undo className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().redo().run();
                        forceUpdate();
                    }}
                    disabled={!editor.can().redo()}
                    isActive={false}
                    title="Redo (Ctrl+Y)"
                >
                    <Redo className="w-4 h-4" />
                </ToolbarButton>

                <ToolbarSeparator />

                {/* Text formatting */}
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleBold().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('bold')}
                    title="Bold (Ctrl+B)"
                >
                    <Bold className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleItalic().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('italic')}
                    title="Italic (Ctrl+I)"
                >
                    <Italic className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleStrike().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('strike')}
                    title="Strikethrough"
                >
                    <Strikethrough className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleCode().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('code')}
                    title="Inline Code"
                >
                    <Code className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleHighlight().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('highlight')}
                    title="Highlight"
                >
                    <Highlighter className="w-4 h-4" />
                </ToolbarButton>

                <ToolbarSeparator />

                {/* Headings */}
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleHeading({ level: 1 }).run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('heading', { level: 1 })}
                    title="Heading 1"
                >
                    <Heading1 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleHeading({ level: 2 }).run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('heading', { level: 2 })}
                    title="Heading 2"
                >
                    <Heading2 className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleHeading({ level: 3 }).run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('heading', { level: 3 })}
                    title="Heading 3"
                >
                    <Heading3 className="w-4 h-4" />
                </ToolbarButton>

                <ToolbarSeparator />

                {/* Lists */}
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleBulletList().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('bulletList')}
                    title="Bullet List"
                >
                    <List className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleOrderedList().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('orderedList')}
                    title="Numbered List"
                >
                    <ListOrdered className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleTaskList().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('taskList')}
                    title="Task List"
                >
                    <CheckSquare className="w-4 h-4" />
                </ToolbarButton>

                <ToolbarSeparator />

                {/* Block elements */}
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleBlockquote().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('blockquote')}
                    title="Quote"
                >
                    <Quote className="w-4 h-4" />
                </ToolbarButton>
                <ToolbarButton
                    onClick={() => {
                        editor.chain().focus().toggleCodeBlock().run();
                        forceUpdate();
                    }}
                    isActive={editor.isActive('codeBlock')}
                    title="Code Block"
                >
                    <Code className="w-4 h-4" />
                </ToolbarButton>

                <ToolbarSeparator />

                {/* Insert elements */}
                <ToolbarButton
                    onClick={setLink}
                    isActive={editor.isActive('link')}
                    title="Insert Link"
                >
                    <Link2 className="w-4 h-4" />
                </ToolbarButton>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-y-auto">
                <EditorContent 
                    editor={editor} 
                    className="h-full editor-content"
                />
            </div>

            {/* Link Dialog */}
            {showLinkDialog && (
                <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
                    <div className="bg-background border border-border rounded-md p-6 max-w-md w-full">
                        <h3 className="text-lg font-semibold mb-4">Add Link</h3>
                        <input
                            type="url"
                            placeholder="Enter URL..."
                            value={linkUrl}
                            onChange={(e) => setLinkUrl(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    insertLink();
                                } else if (e.key === 'Escape') {
                                    setShowLinkDialog(false);
                                    setLinkUrl('');
                                }
                            }}
                            className="w-full px-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
                            autoFocus
                        />
                        <div className="flex gap-2 mt-4 justify-end">
                            <button
                                onClick={() => {
                                    setShowLinkDialog(false);
                                    setLinkUrl('');
                                }}
                                className="px-4 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={insertLink}
                                className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
                            >
                                Add Link
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}