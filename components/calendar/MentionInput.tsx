'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';

interface MentionInputProps {
    value: string;
    onChange: (value: string, mentionedUsers: string[]) => void;
    placeholder?: string;
    className?: string;
}

interface User {
    id: string;
    full_name: string;
}

/**
 * Text input with @mention support
 * Type @ to see list of team members to mention
 */
export default function MentionInput({ value, onChange, placeholder, className }: MentionInputProps) {
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [suggestions, setSuggestions] = useState<User[]>([]);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef<HTMLTextAreaElement>(null);

    // Load team members for mentions
    useEffect(() => {
        loadTeamMembers();
    }, []);

    async function loadTeamMembers() {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name')
            .not('full_name', 'is', null)
            .order('full_name');

        if (data) setSuggestions(data as User[]);
    }

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        const cursorPos = e.target.selectionStart;

        // Check if user is typing @mention
        const textBeforeCursor = newValue.slice(0, cursorPos);
        const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

        if (lastAtSymbol !== -1) {
            const textAfterAt = textBeforeCursor.slice(lastAtSymbol + 1);
            // Show suggestions if @ is recent and no space after it
            if (!textAfterAt.includes(' ') && textAfterAt.length < 20) {
                setShowSuggestions(true);
                setCursorPosition(lastAtSymbol);
            } else {
                setShowSuggestions(false);
            }
        } else {
            setShowSuggestions(false);
        }

        // Extract all mentioned usernames
        const mentions = newValue.match(/@(\w+)/g) || [];
        const mentionedNames = mentions.map(m => m.slice(1));

        // Find user IDs for mentioned names
        const mentionedUserIds = suggestions
            .filter(u => mentionedNames.some(name => u.full_name.toLowerCase().includes(name.toLowerCase())))
            .map(u => u.id);

        onChange(newValue, mentionedUserIds);
    };

    const insertMention = (user: User) => {
        if (!inputRef.current) return;

        const textBeforeCursor = value.slice(0, cursorPosition);
        const textAfterCursor = value.slice(inputRef.current.selectionStart);
        const lastAtSymbol = textBeforeCursor.lastIndexOf('@');

        const newValue =
            value.slice(0, lastAtSymbol) +
            `@${user.full_name.replace(/\s+/g, '')} ` +
            textAfterCursor;

        // Extract mentioned user IDs
        const mentions = newValue.match(/@(\w+)/g) || [];
        const mentionedNames = mentions.map(m => m.slice(1));
        const mentionedUserIds = suggestions
            .filter(u => mentionedNames.some(name => u.full_name.toLowerCase().includes(name.toLowerCase())))
            .map(u => u.id);

        onChange(newValue, mentionedUserIds);
        setShowSuggestions(false);

        // Focus back on input
        setTimeout(() => inputRef.current?.focus(), 0);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % suggestions.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (e.key === 'Enter' && showSuggestions) {
            e.preventDefault();
            insertMention(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    return (
        <div className="relative">
            <textarea
                ref={inputRef}
                value={value}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={placeholder || 'Type @ to mention team members...'}
                className={className || 'w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent'}
                rows={3}
            />

            {/* Mention Suggestions Dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-50 mt-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {suggestions.slice(0, 10).map((user, index) => (
                        <button
                            key={user.id}
                            onClick={() => insertMention(user)}
                            className={`w-full text-left px-4 py-2 hover:bg-[rgba(0,0,255,0.1)] ${index === selectedIndex ? 'bg-[rgba(0,0,255,0.1)]' : ''
                                }`}
                        >
                            <div className="flex items-center gap-2">
                                <span className="text-gray-400">@</span>
                                <span className="font-medium text-gray-900">{user.full_name}</span>
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {/* Helper Text */}
            <p className="text-xs text-gray-500 mt-1">
                Type <span className="font-mono bg-gray-100 px-1">@</span> to mention team members
            </p>
        </div>
    );
}
