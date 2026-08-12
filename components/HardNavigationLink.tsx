"use client";

import type { MouseEvent, ReactNode } from "react";

type HardNavigationLinkProps = {
  href: string;
  className?: string;
  children: ReactNode;
  ariaLabel?: string;
};

export default function HardNavigationLink({ href, className, children, ariaLabel }: HardNavigationLinkProps) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    window.location.assign(href);
  }

  return <a href={href} className={className} aria-label={ariaLabel} onClick={navigate}>{children}</a>;
}
