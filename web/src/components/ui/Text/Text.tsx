import type { HTMLAttributes } from "react";
import { cx } from "../utils/cx";
import "./Text.css";

/** Body text 15/22, ink or muted. */
export function Text({
  muted,
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement> & { muted?: boolean }) {
  return (
    <p
      className={cx("ui-text", muted && "ui-text--muted", className)}
      {...rest}
    />
  );
}

/** Small muted note 12/16. */
export function Hint({
  className,
  ...rest
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cx("ui-hint", className)} {...rest} />;
}
