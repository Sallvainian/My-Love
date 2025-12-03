import { describe, it, expect } from 'vitest';
import {
  validateMessageContent,
  sanitizeMessageContent,
} from '../../../src/utils/messageValidation';

describe('messageValidation', () => {
  describe('validateMessageContent', () => {
    it('should reject empty messages', () => {
      const result = validateMessageContent('');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message cannot be empty');
    });

    it('should reject whitespace-only messages', () => {
      const result = validateMessageContent('   ');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message cannot be empty');
    });

    it('should reject messages exceeding 1000 characters', () => {
      const longMessage = 'a'.repeat(1001);
      const result = validateMessageContent(longMessage);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message cannot exceed 1000 characters');
    });

    it('should accept valid messages', () => {
      const result = validateMessageContent('Hello, my love!');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept messages at exactly 1000 characters', () => {
      const maxMessage = 'a'.repeat(1000);
      const result = validateMessageContent(maxMessage);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept messages with special characters', () => {
      const result = validateMessageContent('I ❤️ you! 😘 #blessed');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should accept messages with newlines', () => {
      const result = validateMessageContent('Line 1\nLine 2\nLine 3');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe('sanitizeMessageContent', () => {
    it('should remove script tags', () => {
      const malicious = 'Hello <script>alert("xss")</script> world';
      const sanitized = sanitizeMessageContent(malicious);
      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('alert');
      expect(sanitized).toContain('Hello');
      expect(sanitized).toContain('world');
    });

    it('should remove event handlers', () => {
      const malicious = '<div onclick="alert(\'xss\')">Click me</div>';
      const sanitized = sanitizeMessageContent(malicious);
      expect(sanitized).not.toContain('onclick');
      expect(sanitized).not.toContain('alert');
    });

    it('should remove iframe tags', () => {
      const malicious = 'Message <iframe src="evil.com"></iframe>';
      const sanitized = sanitizeMessageContent(malicious);
      expect(sanitized).not.toContain('<iframe');
      expect(sanitized).toContain('Message');
    });

    it('should preserve safe text content', () => {
      const safe = 'I love you ❤️';
      const sanitized = sanitizeMessageContent(safe);
      expect(sanitized).toBe(safe);
    });

    it('should handle empty strings', () => {
      const sanitized = sanitizeMessageContent('');
      expect(sanitized).toBe('');
    });

    it('should remove style tags', () => {
      const malicious = 'Text <style>body { display: none; }</style>';
      const sanitized = sanitizeMessageContent(malicious);
      expect(sanitized).not.toContain('<style>');
      expect(sanitized).toContain('Text');
    });

    it('should remove dangerous URLs', () => {
      const malicious = '<a href="javascript:alert(\'xss\')">Click</a>';
      const sanitized = sanitizeMessageContent(malicious);
      expect(sanitized).not.toContain('javascript:');
    });

    it('should preserve basic formatting like newlines', () => {
      const text = 'Line 1\nLine 2\nLine 3';
      const sanitized = sanitizeMessageContent(text);
      expect(sanitized).toBe(text);
    });
  });
});
