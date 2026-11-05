/**
 * ErrorBox -- the Settings pages' Error box: one sentence saying what failed,
 * in the kit's danger tint, announced as an alert. Every Settings page that
 * shows a failure draws it with this, so the box reads the same on each.
 *
 * @component
 */

import { CircleAlert } from 'lucide-react';
import { FAILURE_BOX } from '../shared/kitClasses';

interface ErrorBoxProps {
  message: string;
  testId?: string;
}

export function ErrorBox({ message, testId }: ErrorBoxProps) {
  return (
    <div className={`${FAILURE_BOX} flex items-start gap-2`} role="alert" data-testid={testId}>
      <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
