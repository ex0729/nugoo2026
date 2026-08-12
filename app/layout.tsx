import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "클래스플로우 | 수업 요청부터 배정까지, 한곳에서",
  description: "NGN-X 운영센터와 강사를 연결해 수업 요청, 응답, 역할별 수업료와 확정 일정을 한곳에서 관리합니다.",
  openGraph: {
    title: "클래스플로우",
    description: "운영센터에는 빠른 배정을, 강사에게는 명확한 요청과 일정을.",
    images: [{ url: "/og.png", width: 1734, height: 909, alt: "수업 요청부터 배정까지 연결하는 클래스플로우" }],
    locale: "ko_KR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "클래스플로우",
    description: "운영센터에는 빠른 배정을, 강사에게는 명확한 요청과 일정을.",
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
