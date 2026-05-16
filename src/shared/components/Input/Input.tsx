import { InputHTMLAttributes, ReactNode, forwardRef } from 'react';
import './Input.css';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, leftAddon, id, className = '', ...rest }, ref) => {
    const inputId = id ?? `in-${Math.random().toString(36).slice(2, 8)}`;
    return (
      <div className={`input-field ${className}`}>
        {label && (
          <label htmlFor={inputId} className="input-field__label">
            {label}
          </label>
        )}
        <div className={`input-field__box ${error ? 'input-field__box--error' : ''}`}>
          {leftAddon && <span className="input-field__addon">{leftAddon}</span>}
          <input id={inputId} ref={ref} className="input-field__el" {...rest} />
        </div>
        {hint && !error && <small className="input-field__hint">{hint}</small>}
        {error && <small className="input-field__error">{error}</small>}
      </div>
    );
  },
);

Input.displayName = 'Input';
