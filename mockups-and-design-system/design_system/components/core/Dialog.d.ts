import * as React from "react";
export interface DialogProps {
  open: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  children?: React.ReactNode;
  /** Footer node, usually the action Buttons. */
  footer?: React.ReactNode;
  width?: number;
  style?: React.CSSProperties;
}
/** Centered modal over a blurred, rain-dimming scrim. */
export function Dialog(props: DialogProps): JSX.Element;
