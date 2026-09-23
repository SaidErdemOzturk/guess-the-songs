import React from 'react';
import styles from './Input.module.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  errorMessage?: string;
}

export const Input: React.FC<InputProps> = ({ label, errorMessage, id, className = '', ...props }) => {
  const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  return (
    <div className={styles.container}>
      {label && (
        <label htmlFor={inputId} className={styles.label}>
          {label}
        </label>
      )}
      <input id={inputId} className={`${styles.input} ${className}`} {...props} />
      {errorMessage && <span className={styles.error}>{errorMessage}</span>}
    </div>
  );
};
