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
            className="max-w-[420px] rounded-[13px] border border-[color:var(--color-line)] bg-paper px-gr-5 py-gr-6 shadow-paper-soft"
            role="alert"
            aria-live="assertive"
          >
            <h1 className="font-mincho text-[22px] leading-snug text-sumi">問題が発生しました / Something went wrong</h1>
            <p className="mt-gr-3 text-[14px] leading-ample text-ink-muted">
              予期しないエラーが発生しました。再読み込みして、もう一度お試しください。
              <br />
              An unexpected error occurred. Please reload and try again.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-gr-5 rounded-full bg-sumi px-gr-5 py-gr-3 font-mincho text-[14px] text-washi transition-soft hover:bg-sumi/92"
            >
              再読み込み / Reload
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
