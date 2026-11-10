import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import { Link, type LinkProps } from "react-router-dom";
import { cx } from "../utils/cx";
import "./Button.css";

type ButtonLook = {
  /** primary = seal fill, outline = muted border on white, danger = fail border and text on white. */
  variant?: "primary" | "outline" | "danger";
  /** Stretch to the container width. */
  full?: boolean;
};

function buttonClass(
  { variant = "primary", full }: ButtonLook,
  className?: string,
): string {
  return cx(
    "ui-button",
    `ui-button--${variant}`,
    full && "ui-button--full",
    className,
  );
}

export function Button({
  variant,
  full,
  className,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & ButtonLook) {
  return (
    <button
      type={type}
      className={buttonClass({ variant, full }, className)}
      {...rest}
    />
  );
}

/** Router link that looks like a button. */
export function ButtonLink({
  variant,
  full,
  className,
  ...rest
}: LinkProps & ButtonLook) {
  return (
    <Link className={buttonClass({ variant, full }, className)} {...rest} />
  );
}

/** External link that looks like a button. */
export function ButtonAnchor({
  variant,
  full,
  className,
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & ButtonLook) {
  return <a className={buttonClass({ variant, full }, className)} {...rest} />;
}
