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
    <div className="relative min-h-full w-full">
      {/* 円相の透かし — 画面の気配として、淡く一つだけ */}
      <div className="zanshin-enso" aria-hidden="true" />
      <div
        className="
          relative z-[1] mx-auto flex min-h-full w-full max-w-zanshin flex-col
          px-gr-4 safe-top safe-bottom
        "
      >
        {children}
      </div>
    </div>
  );
}

export default AppShell;
