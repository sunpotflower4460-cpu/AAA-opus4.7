import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
};

/**
 * アプリ全体のレイアウト。
 * - iPhone 優先（390px 前後で美しく）
 * - PC では中央に最大 720px で収まる
 * - 上下のセーフエリアを尊重する
 */
export function AppShell({ children }: Props) {
  return (
    <div className="relative min-h-screen min-h-[100dvh] w-full">
      {/* 月の気配 — 背景に溶ける、朧な丸い余韻 */}
      <div className="zanshin-moon" aria-hidden="true" />
      <div
        className="
          relative z-[1] mx-auto flex min-h-screen min-h-[100dvh] w-full max-w-zanshin flex-col
          px-gr-4 safe-top safe-bottom
        "
      >
        {children}
      </div>
    </div>
  );
}

export default AppShell;
