/**
 * RoleIndicator — Pill badge showing the user's role for the current step
 *
 * Story 4.2: AC #1
 *
 * Reader: primary purple (#A855F7), "You read this"
 * Responder: lighter purple (#C084FC), "Partner reads this"
 */

interface RoleIndicatorProps {
  role: 'reader' | 'responder';
}

export function RoleIndicator({ role }: RoleIndicatorProps) {
  const isReader = role === 'reader';
  const backgroundColor = isReader ? '#A855F7' : '#C084FC';
  const label = isReader ? 'You read this' : 'Partner reads this';

  return (
    <span
      className="inline-block rounded-full px-3 py-1 text-sm font-medium text-white"
      style={{ backgroundColor }}
      data-testid="role-indicator"
      aria-label={`Your role: ${role}. ${label}`}
    >
      {label}
    </span>
  );
}
