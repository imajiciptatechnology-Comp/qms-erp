import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AppLayout from "@/components/layout/AppLayout";
import { getCurrentUser, getRolesConfig } from "./actions/auth";
import { prisma } from "@/lib/prisma";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QMS ERP System",
  description: "Enterprise Resource Planning with ISO 9001 Compliance",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const jwtUser = await getCurrentUser();
  const rolesConfig = await getRolesConfig();
  
  let user = null;
  if (jwtUser) {
    user = await prisma.user.findUnique({ where: { id: jwtUser.id as string } });
  }

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:text-sm focus:font-medium"
        >
          Skip to main content
        </a>
        <AppLayout user={user} rolesConfig={rolesConfig}>{children}</AppLayout>
      </body>
    </html>
  );
}
