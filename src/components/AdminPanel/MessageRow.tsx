import { m as motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import type { CustomMessage } from '../../types';

interface MessageRowProps {
  message: CustomMessage;
  onEdit: (message: CustomMessage) => void;
  onDelete: (message: CustomMessage) => void;
}

export function MessageRow({ message, onEdit, onDelete }: MessageRowProps) {
  // Truncate message text to 100 characters
  const truncatedText =
    message.text.length > 100 ? message.text.substring(0, 100) + '...' : message.text;

  // Category display name
  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'reason':
        return '💖 Reasons';
      case 'memory':
        return '✨ Memories';
      case 'affirmation':
        return '🌟 Affirmations';
      case 'future':
        return '🌈 Future Plans';
      case 'custom':
        return '💕 Custom';
      default:
        return category;
    }
  };

  return (
    <motion.tr
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="hover:bg-gray-50 transition-colors"
      data-testid="admin-message-row"
    >
      {/* Message text */}
      <td className="px-4 py-4 text-sm text-gray-900" data-testid="message-row-text">
        {truncatedText}
      </td>

      {/* Category */}
      <td className="px-4 py-4 text-sm text-gray-600" data-testid="message-row-category">
        {getCategoryLabel(message.category)}
      </td>

      {/* Type badge */}
      <td className="px-4 py-4 text-sm" data-testid="message-row-type">
        <div className="flex items-center gap-2">
          {message.isCustom ? (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
              Custom
            </span>
          ) : (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              Default
            </span>
          )}
          {/* Draft badge (Story 3.5 AC-3.5.4) */}
          {message.isCustom && message.active === false && (
            <span
              className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
              data-testid="message-draft-badge"
            >
              Draft
            </span>
          )}
        </div>
      </td>

      {/* Actions */}
      <td className="px-4 py-4 text-sm text-right">
        {message.isCustom ? (
          <div className="flex items-center justify-end gap-2">
            {/* Edit button */}
            <button
              onClick={() => onEdit(message)}
              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              aria-label="Edit message"
              data-testid="message-row-edit-button"
            >
              <Pencil className="w-4 h-4" />
            </button>

            {/* Delete button */}
            <button
              onClick={() => onDelete(message)}
              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              aria-label="Delete message"
              data-testid="message-row-delete-button"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <span className="text-gray-400 text-xs">Read-only</span>
        )}
      </td>
    </motion.tr>
  );
}
