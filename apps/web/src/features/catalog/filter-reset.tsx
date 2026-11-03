'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
export function FilterReset({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={(event) => event.currentTarget.closest('form')?.reset()}
    >
      {children}
    </Link>
  );
}
