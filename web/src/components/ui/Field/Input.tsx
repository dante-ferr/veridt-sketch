import type { InputHTMLAttributes, SelectHTMLAttributes } from "react";
import { forwardRef } from "react";
import { cx } from "../utils/cx";
import "./Field.css";

/** 36px text input. */
export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }
>(function Input({ invalid, className, ...rest }, ref) {
  return (
    <input
      ref={ref}
      className={cx("ui-input", invalid && "ui-input--invalid", className)}
      {...rest}
    />
  );
});

/** Select with the same look as Input and no arrow, as in the Figma. */
export function Select({
  className,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx("ui-input", className)} {...rest} />;
}
