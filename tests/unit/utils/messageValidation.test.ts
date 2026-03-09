import { describe, it, expect } from 'vitest';
import {
  validateMessageContent,
  sanitizeMessageContent,
  MAX_MESSAGE_LENGTH,
} from '@/utils/messageValidation';

describe('validateMessageContent', () => {
  it('accepts a valid message', () => {
    const result = validateMessageContent('Hello love!');
    expect(result).toEqual({ valid: true });
  });

  it('rejects empty string', () => {
    const result = validateMessageContent('');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message cannot be empty');
  });

  it('rejects whitespace-only string', () => {
    const result = validateMessageContent('   \t\n  ');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message cannot be empty');
  });

  it('rejects message exceeding MAX_MESSAGE_LENGTH', () => {
    const longMessage = 'a'.repeat(MAX_MESSAGE_LENGTH + 1);
    const result = validateMessageContent(longMessage);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('Message cannot exceed 1000 characters');
  });

  it('accepts message at exactly MAX_MESSAGE_LENGTH', () => {
    const exactMessage = 'a'.repeat(MAX_MESSAGE_LENGTH);
    expect(validateMessageContent(exactMessage).valid).toBe(true);
  });

  it('exports MAX_MESSAGE_LENGTH as 1000', () => {
    expect(MAX_MESSAGE_LENGTH).toBe(1000);
  });
});

describe('sanitizeMessageContent', () => {
  it('returns plain text unchanged', () => {
    expect(sanitizeMessageContent('I love you')).toBe('I love you');
  });

  it('strips HTML tags', () => {
    expect(sanitizeMessageContent('<b>bold</b>')).toBe('bold');
  });

  it('strips script tags', () => {
    expect(sanitizeMessageContent('<script>alert("xss")</script>')).toBe('');
  });

  it('strips event handlers', () => {
    expect(sanitizeMessageContent('<img onerror="alert(1)" src="x">')).toBe('');
  });

  it('preserves text content from nested HTML', () => {
    const input = '<div><p>Hello <strong>world</strong></p></div>';
    const result = sanitizeMessageContent(input);
    expect(result).toContain('Hello');
    expect(result).toContain('world');
  });

  it('strips anchor tags but preserves text', () => {
    expect(sanitizeMessageContent('<a href="http://evil.com">click me</a>')).toBe('click me');
  });

  it('handles empty string', () => {
    expect(sanitizeMessageContent('')).toBe('');
  });
});
