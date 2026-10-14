import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../features/auth/AuthContext";
import { Navbar } from "../components/layout/Navbar";

export const metadata: Metadata = {
  title: "CareerAI - AI Powered Career Guidance",
  description: "Upload your resume and get AI-driven insights for your career.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-50 min-h-screen flex flex-col">
        <AuthProvider>
          <Navbar />
          <main className="flex-1 flex flex-col">
            {children}
          </main>
        </AuthProvider>
      </body>
    </html>
  );
}
