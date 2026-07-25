import * as React from "react";
export interface BreadcrumbItem { label: React.ReactNode; onClick?: () => void; }
export interface BreadcrumbProps {
  items: BreadcrumbItem[];
  /** Separator glyph; defaults to "/". */
  separator?: React.ReactNode;
  style?: React.CSSProperties;
}
/** Terminal path trail (godmodecode / code / two-sum); last item is the active leaf. */
export function Breadcrumb(props: BreadcrumbProps): JSX.Element;
