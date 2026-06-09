import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: '行途 — 你的智能旅行策划师',
  description: '从"想去旅游"到"知道去哪"，只需5分钟。智能匹配你的出行人数、方式、目的，生成个性化旅行方案。',
  keywords: ['旅游策划', '旅行推荐', '中国旅游', '行程规划', '智能旅行'],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
