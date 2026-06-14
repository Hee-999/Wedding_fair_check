import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "2026 전국 웨딩 박람회 일정 | 무료 초대권 신청",
  description: "전국 웨딩 박람회, 허니문, 혼수 페어 일정을 지역별로 확인하고 무료 초대권을 신청하세요.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="antialiased">
      <body className="min-h-screen flex flex-col bg-[#faf8f5]">
        {/* Header */}
        <header className="sticky top-0 z-50 glass-card border-b border-pink-50 rounded-none bg-white/70 dark:bg-slate-900/40 backdrop-blur-md">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-rose-400 text-transparent bg-clip-text">
                Wedding Fairs
              </span>
              <span className="text-xs font-semibold px-2 py-1 bg-pink-50 text-pink-600 border border-pink-100 rounded-full">
                2026
              </span>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 flex flex-col w-full">
          {children}
        </main>

        {/* Footer */}
        <footer className="py-8 text-center text-sm text-slate-400 bg-white border-t border-slate-100 mt-auto">
          <p>© {new Date().getFullYear()} Wedding Fair Schedule. All rights reserved.</p>
          <p className="mt-1 text-xs">매주 최신 박람회 일정으로 업데이트됩니다.</p>
        </footer>
      </body>
    </html>
  );
}
