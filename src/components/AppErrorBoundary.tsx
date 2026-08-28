import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
};

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("React error boundary caught unhandled error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center px-gr-5 text-center">
          <div
            className="max-w-[420px] border border-[color:var(--color-line)] bg-paper px-gr-5 py-gr-6 shadow-paper-soft"
            style={{ borderRadius: "8px 16px 9px 14px" }}
            role="alert"
            aria-live="assertive"
          >
            <span
              aria-hidden="true"
              className="mx-auto mb-gr-4 block h-px w-gr-5 bg-gradient-to-r from-transparent via-vermilion/45 to-transparent"
            />
            <h1 className="font-mincho text-[22px] leading-[1.7] tracking-[0.06em] text-sumi">
              余白を、もう一度ひらきます。
            </h1>
            <p className="mt-gr-3 text-[14px] leading-ample text-ink-muted jp-text-discipline">
              予期しない問題が起きました。再読み込みすると、残心を開き直せます。
            </p>
            <p className="mt-gr-2 text-[11px] leading-ample tracking-[0.08em] text-ink-muted/62">
              Something unexpected happened. Reload to open Zanshin again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-gr-5 min-h-[48px] bg-sumi px-gr-5 py-gr-3 font-mincho text-[14px] tracking-[0.08em] text-washi transition-soft hover:bg-indigo active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sumi/35 focus-visible:ring-offset-2 focus-visible:ring-offset-paper"
              style={{ borderRadius: "7px 12px 8px 10px" }}
            >
              余白をひらき直す
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
