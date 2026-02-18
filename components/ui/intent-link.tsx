"use client";

import { useRouter } from "next/navigation";
import Link, { type LinkProps } from "next/link";
import { forwardRef, type AnchorHTMLAttributes, type ReactNode, useCallback } from "react";
import { cn } from "@/lib/utils";

type IntentLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> &
  Omit<LinkProps, "href"> & {
    href: string;
    children: ReactNode;
  };

export const IntentLink = forwardRef<HTMLAnchorElement, IntentLinkProps>(function IntentLink(
  { href, children, className, onMouseEnter, onFocus, onTouchStart, prefetch = true, ...props },
  ref
) {
  const router = useRouter();

  const prefetchIntent = useCallback(() => {
    if (href.startsWith("/")) {
      router.prefetch(href);
    }
  }, [href, router]);

  return (
    <Link
      ref={ref}
      href={href}
      prefetch={prefetch}
      className={cn(className)}
      onMouseEnter={(event) => {
        prefetchIntent();
        onMouseEnter?.(event);
      }}
      onFocus={(event) => {
        prefetchIntent();
        onFocus?.(event);
      }}
      onTouchStart={(event) => {
        prefetchIntent();
        onTouchStart?.(event);
      }}
      {...props}
    >
      {children}
    </Link>
  );
});
