import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "./globals.css";

export const metadata: Metadata = {
  title: "TaskFlow — Your workspace",
  description: "Organize your projects, move tasks forward, and keep track of activity.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
