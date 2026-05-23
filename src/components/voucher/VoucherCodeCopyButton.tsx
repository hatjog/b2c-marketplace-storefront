'use client';

import { useState } from 'react';

type VoucherCodeCopyButtonProps = {
  code: string;
  buttonLabel: string;
  buttonAriaLabel: string;
  copiedLabel: string;
  unavailableLabel: string;
};

export function VoucherCodeCopyButton({
  code,
  buttonLabel,
  buttonAriaLabel,
  copiedLabel,
  unavailableLabel,
}: VoucherCodeCopyButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  async function onCopy() {
    if (!navigator?.clipboard?.writeText) {
      setFeedback(unavailableLabel);
      return;
    }

    try {
      await navigator.clipboard.writeText(code);
      setFeedback(copiedLabel);
    } catch {
      setFeedback(unavailableLabel);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <button
        type="button"
        onClick={onCopy}
        aria-label={buttonAriaLabel}
        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-[rgba(93,67,22,0.18)] bg-white/80 px-4 py-2 text-sm font-medium text-[#5d4316] transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8f6a2b] focus-visible:ring-offset-2"
      >
        {buttonLabel}
      </button>
      <span
        aria-live="polite"
        className="text-sm text-secondary"
      >
        {feedback}
      </span>
      <span className="sr-only">{code}</span>
    </div>
  );
}

export default VoucherCodeCopyButton;
