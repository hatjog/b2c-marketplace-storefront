'use client';

/**
 * SellerSelectorErrorBoundary — React class component error boundary for
 * the SellerSelector subtree (Story 5.4).
 *
 * Story: v160-5-4-seller-selector-circuit-breaker (Sprint 3, Epic 5)
 * Spec: PRD FR1-FR5 (multi-vendor PDP) + AR45 (boundary MUST NOT block render)
 *       UX-DR19 (SellerSelector spec) + persona Marta-self resilience
 *
 * Why class-based (not react-error-boundary lib):
 *  - React 18/19 still requires a class component for render-time error
 *    catch (`getDerivedStateFromError` + `componentDidCatch`) — no hook
 *    equivalent exists in stock React.
 *  - Adding `react-error-boundary` = +1 npm dep for a single feature; not
 *    justified in v1.6.0 scope when the codebase only owns one boundary.
 *  - Class component baseline = zero supply-chain risk; familiar React API.
 *
 * Boundaries:
 *  - Catches render-time errors only. Async errors (event handlers, useEffect
 *    promise rejections) MUST be propagated to the boundary explicitly via
 *    `setState` re-throw in children — see Story 5.4 Dev Notes.
 *  - Default fallback delegates to a small functional sub-component so
 *    `useTranslations` works (class components cannot consume hooks).
 *  - `onError` callback fires every catch; consumer (SellerSelectorWith
 *    Geolocation) wires it to `useCircuitBreaker.recordFailure`.
 *  - `onReset` fires on retry; consumer typically calls `breaker.reset()`.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';

export interface SellerSelectorErrorBoundaryProps {
  children: ReactNode;
  /**
   * Optional pre-rendered fallback. When omitted, the boundary renders a
   * default fallback with retry CTA via `<DefaultErrorFallback />`.
   */
  fallback?: ReactNode;
  /**
   * Fired on every caught render error. Consumer typically wires this to
   * a circuit-breaker `recordFailure` so sustained failures escalate.
   */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /**
   * Fired when the user clicks the retry button on the default fallback,
   * after the boundary clears its error state. Consumer typically calls
   * `breaker.reset()` to drop accumulated failures.
   */
  onReset?: () => void;
}

interface SellerSelectorErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Default fallback UI — extracted so we can use `useTranslations` (hooks
 * only work in functional components). The class boundary renders this
 * component when `props.fallback` is not provided.
 */
const DefaultErrorFallback = ({ onRetry }: { onRetry: () => void }) => {
  const t = useTranslations('seller.selector');
  return (
    <div
      role="alert"
      className="space-y-2 rounded-md border border-tertiary bg-component-secondary p-4"
      data-testid="seller-selector-error-boundary"
    >
      <p className="text-sm text-primary">{t('error_message')}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-sm border border-action bg-action px-3 py-1 text-xs font-medium text-on-action transition-colors hover:opacity-90"
        data-testid="seller-selector-error-retry"
      >
        {t('retry_button')}
      </button>
    </div>
  );
};

export class SellerSelectorErrorBoundary extends Component<
  SellerSelectorErrorBoundaryProps,
  SellerSelectorErrorBoundaryState
> {
  state: SellerSelectorErrorBoundaryState = {
    hasError: false,
    error: null,
  };

  static getDerivedStateFromError(
    error: Error,
  ): Partial<SellerSelectorErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Surface to consumer (typically wired to circuit-breaker recordFailure).
    // Intentionally not console.error — caller decides telemetry policy.
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback !== undefined) {
        return this.props.fallback;
      }
      return <DefaultErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
