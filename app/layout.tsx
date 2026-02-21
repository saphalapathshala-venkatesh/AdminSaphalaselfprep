import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Saphala Self Prep Admin Console",
  description: "Admin console for Saphala Self Prep",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
