import React from 'react';

/**
 * Estimate password strength based on macOS‑style rules:
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one digit
 * - At least one special character
 * Returns a score from 0 (very weak) to 4 (strong).
 */
function estimateStrength(password: string): number {
  let score = 0;
  if (!password) return score;
  if (password.length >= 8) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  return Math.min(score, 4);
}

// macOS‑style colors: weak (red), medium (orange), strong (green)
const strengthColors = ['#ff3b30', '#ff9500', '#ffcc00', '#34c759', '#34c759'];
const strengthLabels = ['Çok Zayıf', 'Zayıf', 'Orta', 'İyi', 'Mükemmel'];

export const PasswordStrengthMeter: React.FC<{ password: string }> = ({ password }) => {
  const strength = estimateStrength(password);
  const color = strengthColors[strength];
  const label = strengthLabels[strength];

  return (
    <div style={{ marginTop: '4px' }} aria-live="polite">
      <div
        style={{
          height: '6px',
          borderRadius: '3px',
          backgroundColor: '#e0e0e0',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${(strength / 4) * 100}%`,
            height: '100%',
            backgroundColor: color,
            transition: 'width 0.2s',
          }}
        />
      </div>
      <div style={{ fontSize: '12px', marginTop: '2px', color }}>{label}</div>
    </div>
  );
};
