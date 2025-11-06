import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useAppStore } from '../../stores/useAppStore';
import { Search } from 'lucide-react';
import { MessageRow } from './MessageRow';
import type { CustomMessage, MessageCategory } from '../../types';

interface MessageListProps {
  onEdit: (message: CustomMessage) => void;
  onDelete: (message: CustomMessage) => void;
}

export function MessageList({ onEdit, onDelete }: MessageListProps) {
  const { messages, customMessages } = useAppStore();
  const [filterCategory, setFilterCategory] = useState<MessageCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Combine default messages and custom messages
  // Convert Message to CustomMessage format for display
  const allMessages: CustomMessage[] = useMemo(() => {
    const defaultAsCustom: CustomMessage[] = messages.map(msg => ({
      id: msg.id,
      text: msg.text,
      category: msg.category,
      isCustom: msg.isCustom,
      active: msg.active ?? true, // Story 3.5: Default messages always active
      createdAt: msg.createdAt.toISOString(),
      updatedAt: msg.updatedAt?.toISOString(),
      tags: msg.tags,
    }));

    return [...defaultAsCustom, ...customMessages];
  }, [messages, customMessages]);

  // Filter messages
  const filteredMessages = useMemo(() => {
    let filtered = allMessages;

    // Filter by category
    if (filterCategory !== 'all') {
      filtered = filtered.filter(msg => msg.category === filterCategory);
    }

    // Filter by search term
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase();
      filtered = filtered.filter(msg =>
        msg.text.toLowerCase().includes(searchLower)
      );
    }

    return filtered;
  }, [allMessages, filterCategory, searchTerm]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white rounded-xl shadow-lg overflow-hidden"
      data-testid="admin-message-list"
    >
      {/* Filter bar */}
      <div className="border-b border-gray-200 p-4 bg-gray-50">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Category filter */}
          <div className="flex-1">
            <label htmlFor="category-filter" className="block text-sm font-medium text-gray-700 mb-1">
              Filter by Category
            </label>
            <select
              id="category-filter"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as MessageCategory | 'all')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              data-testid="admin-filter-category"
            >
              <option value="all">All Categories</option>
              <option value="reason">💖 Reasons</option>
              <option value="memory">✨ Memories</option>
              <option value="affirmation">🌟 Affirmations</option>
              <option value="future">🌈 Future Plans</option>
              <option value="custom">💕 Custom</option>
            </select>
          </div>

          {/* Search */}
          <div className="flex-1">
            <label htmlFor="search" className="block text-sm font-medium text-gray-700 mb-1">
              Search Messages
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                id="search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search message text..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                data-testid="admin-search-input"
              />
            </div>
          </div>
        </div>

        {/* Results count */}
        <div className="mt-3 text-sm text-gray-600">
          Showing {filteredMessages.length} of {allMessages.length} messages
          {customMessages.length > 0 && (
            <span className="ml-2 text-pink-600 font-medium">
              ({customMessages.length} custom)
            </span>
          )}
        </div>
      </div>

      {/* Message table */}
      <div className="overflow-x-auto">
        {filteredMessages.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <p className="text-lg mb-2">No messages found</p>
            <p className="text-sm">Try adjusting your filters or create a new message</p>
          </div>
        ) : (
          <table className="w-full" data-testid="admin-message-table">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Message
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Category
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredMessages.map((message) => (
                <MessageRow
                  key={`${message.isCustom ? 'custom' : 'default'}-${message.id}`}
                  message={message}
                  onEdit={onEdit}
                  onDelete={onDelete}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </motion.div>
  );
}
