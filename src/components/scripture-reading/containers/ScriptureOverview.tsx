/**
 * ScriptureOverview Container Component
 *
 * Story 1.1: Navigation Entry Point
 * Main entry point for Scripture Reading feature.
 *
 * Handles:
 * - Partner status detection (linked/unlinked/loading/error)
 * - Mode selection (Solo always available, Together conditional on partner)
 * - Navigation to partner setup flow
 *
 * Uses container/presentational pattern:
 * - This container connects to Zustand store
 * - Passes props to presentational components
 */

import { useEffect } from 'react';
import { useAppStore } from '../../../stores/useAppStore';

// Lavender Dreams design tokens
const scriptureTheme = {
  primary: '#A855F7', // Purple-500
  background: '#F3E5F5', // Light lavender
  surface: '#FAF5FF', // Very light purple
};

// Partner status union type for explicit handling
type PartnerStatus = 'loading' | 'linked' | 'unlinked' | 'error';

interface ModeCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant: 'primary' | 'secondary';
}

function ModeCard({ title, description, icon, onClick, disabled, variant }: ModeCardProps) {
  const baseClasses =
    'w-full p-6 rounded-2xl transition-all duration-200 text-left min-h-[120px] flex flex-col';
  const variantClasses =
    variant === 'primary'
      ? 'bg-purple-500 text-white hover:bg-purple-600 active:bg-purple-700'
      : 'bg-white border-2 border-purple-200 text-gray-800 hover:border-purple-400 active:bg-purple-50';
  const disabledClasses = disabled
    ? 'opacity-50 cursor-not-allowed hover:bg-white hover:border-purple-200'
    : 'cursor-pointer';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`${baseClasses} ${variantClasses} ${disabled ? disabledClasses : ''}`}
      type="button"
    >
      <div className="flex items-center gap-3 mb-2">
        {icon}
        <span className="text-lg font-semibold">{title}</span>
      </div>
      <p className={`text-sm ${variant === 'primary' ? 'text-purple-100' : 'text-gray-600'}`}>
        {description}
      </p>
    </button>
  );
}

function PartnerStatusSkeleton() {
  return (
    <div className="animate-pulse" data-testid="partner-status-skeleton">
      <div className="h-4 bg-purple-200 rounded w-3/4 mb-2" />
      <div className="h-3 bg-purple-100 rounded w-1/2" />
    </div>
  );
}

interface PartnerLinkMessageProps {
  onLinkPartner: () => void;
}

function PartnerLinkMessage({ onLinkPartner }: PartnerLinkMessageProps) {
  return (
    <button
      onClick={onLinkPartner}
      className="w-full p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-700 hover:bg-purple-100 transition-colors text-left"
      data-testid="link-partner-message"
      type="button"
    >
      <span className="text-sm font-medium">🔗 Link your partner to do this together</span>
    </button>
  );
}

function OfflineIndicator() {
  return (
    <div
      className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl text-gray-600"
      data-testid="offline-indicator"
    >
      <span className="text-sm">📡 Unable to check partner status. Solo mode available.</span>
    </div>
  );
}

// Solo icon component
function SoloIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
      />
    </svg>
  );
}

// Together icon component
function TogetherIcon() {
  return (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
      />
    </svg>
  );
}

export function ScriptureOverview() {
  const { partner, isLoadingPartner, loadPartner, setView } = useAppStore((state) => ({
    partner: state.partner,
    isLoadingPartner: state.isLoadingPartner,
    loadPartner: state.loadPartner,
    setView: state.setView,
  }));

  // Track if partner load failed (network error)
  // We use a simple heuristic: if loading finished and partner is null,
  // we check if it was a real "no partner" or an error
  // For now, we'll treat null after loading as "unlinked"
  // Error state would require tracking in the slice (future enhancement)

  // Load partner status on mount
  useEffect(() => {
    loadPartner();
  }, [loadPartner]);

  // Determine partner status
  const getPartnerStatus = (): PartnerStatus => {
    if (isLoadingPartner) return 'loading';
    if (partner !== null) return 'linked';
    // If not loading and no partner, they're unlinked
    // Note: Error state would need slice-level tracking
    return 'unlinked';
  };

  const partnerStatus = getPartnerStatus();

  // Navigation handlers
  const handleStartSolo = () => {
    // For now, just stay on scripture view - future stories will add session creation
    console.log('[ScriptureOverview] Starting Solo mode');
  };

  const handleStartTogether = () => {
    // For now, just log - future stories will add together mode
    console.log('[ScriptureOverview] Starting Together mode');
  };

  const handleLinkPartner = () => {
    // Navigate to partner setup flow (existing ViewType)
    setView('partner');
  };

  return (
    <div
      className="min-h-screen p-4"
      style={{ backgroundColor: scriptureTheme.background }}
      data-testid="scripture-overview"
    >
      <div className="max-w-md mx-auto space-y-6">
        {/* Header */}
        <header className="text-center pt-4 pb-2">
          <h1 className="text-2xl font-bold text-purple-900">Scripture Reading</h1>
          <p className="text-purple-700 mt-1">Read and reflect together</p>
        </header>

        {/* Partner Status Area */}
        <section className="space-y-4" aria-label="Partner status">
          {partnerStatus === 'loading' && <PartnerStatusSkeleton />}
          {partnerStatus === 'unlinked' && <PartnerLinkMessage onLinkPartner={handleLinkPartner} />}
          {partnerStatus === 'error' && <OfflineIndicator />}
          {/* AC #2: When linked, no partner-related messaging shown */}
        </section>

        {/* Mode Selection Cards */}
        <section className="space-y-4" aria-label="Choose reading mode">
          {/* Solo Mode - Always accessible (AC #3, AC #6) */}
          <ModeCard
            title="Solo"
            description="Read and reflect on your own time"
            icon={<SoloIcon />}
            onClick={handleStartSolo}
            variant="secondary"
          />

          {/* Together Mode - Conditional on partner (AC #2) */}
          <ModeCard
            title="Together"
            description={
              partnerStatus === 'linked'
                ? 'Read and reflect with your partner in real-time'
                : 'Link your partner to unlock'
            }
            icon={<TogetherIcon />}
            onClick={handleStartTogether}
            disabled={partnerStatus !== 'linked'}
            variant="primary"
          />
        </section>
      </div>
    </div>
  );
}
