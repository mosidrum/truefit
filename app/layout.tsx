import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import { Inter, Newsreader, Source_Sans_3 } from "next/font/google";
import "./globals.scss";

const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

// Used only by the marketing landing page (components/Landing.tsx), scoped
// there via the --font-inter variable so it never touches the app's own
// Newsreader/Source Sans type system.
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrueFit",
  description: "Tailor your CV for the role you want.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${newsreader.variable} ${sourceSans.variable} ${inter.variable}`}
    >
      <body>
        <ClerkProvider>{children}</ClerkProvider>
      </body>
    </html>
  );
}