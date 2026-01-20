import React from "react"
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Download Portal',
  description: 'Secure download portal',
};

export default function TokenLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
