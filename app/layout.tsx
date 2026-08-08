import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "클래스플로우 | 강사 배정 운영 플랫폼",
  description: "수업 모집부터 강사 응답, 역할별 수업료와 최종 배정까지 한곳에서 관리하세요.",
  openGraph: {
    title: "클래스플로우",
    description: "강사 배정의 모든 순간을 한곳에서",
    images: [{ url: "/og.png", width: 1728, height: 909, alt: "클래스플로우 강사 배정 운영 화면" }],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "클래스플로우",
    description: "강사 배정의 모든 순간을 한곳에서",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
