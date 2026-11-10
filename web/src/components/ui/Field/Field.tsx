import type { ReactNode } from "react";
import { Hint } from "../Text/Text";
import { cx } from "../utils/cx";
import "./Field.css";

type FieldProps = {
  label: ReactNode;
  /** id of the control, for the label's htmlFor. */
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  className?: string;
  children: ReactNode;
};

/** Label (13/18) + control + hint (12/16 muted) or error (12/16 fail), 4px apart. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cx("ui-field", className)}>
      <label className="ui-field-label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {hint ? <Hint>{hint}</Hint> : null}
      {error ? (
        <p className="ui-field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
