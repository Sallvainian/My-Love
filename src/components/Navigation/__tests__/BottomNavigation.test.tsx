/**
 * BottomNavigation Component Tests
 *
 * Story 1.1: Navigation Entry Point
 * Tests for the bottom navigation bar including Scripture tab.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BottomNavigation } from '../BottomNavigation';

// Mock authService to prevent actual signout
vi.mock('../../../api/authService', () => ({
  authService: {
    signOut: vi.fn(),
  },
}));

describe('BottomNavigation', () => {
  const mockOnViewChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Scripture Tab Rendering', () => {
    it('should render Scripture tab', () => {
      render(
        <BottomNavigation currentView="home" onViewChange={mockOnViewChange} />
      );

      expect(screen.getByTestId('nav-scripture')).toBeInTheDocument();
      expect(screen.getByText('Scripture')).toBeInTheDocument();
    });

    it('should have correct aria-label for Scripture tab', () => {
      render(
        <BottomNavigation currentView="home" onViewChange={mockOnViewChange} />
      );

      const scriptureButton = screen.getByTestId('nav-scripture');
      expect(scriptureButton).toHaveAttribute('aria-label', 'Scripture');
    });
  });

  describe('Scripture Tab Navigation', () => {
    it('should call onViewChange with scripture when Scripture tab is clicked', () => {
      render(
        <BottomNavigation currentView="home" onViewChange={mockOnViewChange} />
      );

      const scriptureButton = screen.getByTestId('nav-scripture');
      fireEvent.click(scriptureButton);

      expect(mockOnViewChange).toHaveBeenCalledWith('scripture');
    });
  });

  describe('Scripture Tab Active State', () => {
    it('should show purple active color when scripture view is active', () => {
      render(
        <BottomNavigation currentView="scripture" onViewChange={mockOnViewChange} />
      );

      const scriptureButton = screen.getByTestId('nav-scripture');
      expect(scriptureButton).toHaveClass('text-purple-500');
    });

    it('should show gray inactive color when scripture view is not active', () => {
      render(
        <BottomNavigation currentView="home" onViewChange={mockOnViewChange} />
      );

      const scriptureButton = screen.getByTestId('nav-scripture');
      expect(scriptureButton).toHaveClass('text-gray-500');
    });
  });

  describe('All Navigation Tabs', () => {
    it('should render all expected navigation tabs', () => {
      render(
        <BottomNavigation currentView="home" onViewChange={mockOnViewChange} />
      );

      expect(screen.getByTestId('nav-home')).toBeInTheDocument();
      expect(screen.getByTestId('nav-mood')).toBeInTheDocument();
      expect(screen.getByTestId('nav-notes')).toBeInTheDocument();
      expect(screen.getByTestId('nav-partner')).toBeInTheDocument();
      expect(screen.getByTestId('nav-photos')).toBeInTheDocument();
      expect(screen.getByTestId('nav-scripture')).toBeInTheDocument();
      expect(screen.getByTestId('nav-logout')).toBeInTheDocument();
    });

    it('should only highlight the current view', () => {
      render(
        <BottomNavigation currentView="scripture" onViewChange={mockOnViewChange} />
      );

      // Scripture should be active (purple)
      expect(screen.getByTestId('nav-scripture')).toHaveClass('text-purple-500');

      // Other tabs should be inactive (gray)
      expect(screen.getByTestId('nav-home')).toHaveClass('text-gray-500');
      expect(screen.getByTestId('nav-mood')).toHaveClass('text-gray-500');
      expect(screen.getByTestId('nav-photos')).toHaveClass('text-gray-500');
    });
  });

  describe('Touch Target Accessibility', () => {
    it('should have minimum touch target size for Scripture tab', () => {
      render(
        <BottomNavigation currentView="home" onViewChange={mockOnViewChange} />
      );

      const scriptureButton = screen.getByTestId('nav-scripture');
      // Check for min-w and min-h classes (48px minimum per UX spec)
      expect(scriptureButton).toHaveClass('min-w-[48px]');
      expect(scriptureButton).toHaveClass('min-h-[48px]');
    });
  });
});
