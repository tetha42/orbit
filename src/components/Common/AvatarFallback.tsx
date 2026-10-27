import React from 'react';

/**
 * Circular avatar fallback that displays the first letter of a name.
 * Background color is deterministic based on the character code, using a macOS palette.
 */
export const AvatarFallback: React.FC<{ name: string; size?: number }> = ({ name, size = 32 }) => {
  const letter = (name?.trim()?.charAt(0) ?? '?').toUpperCase();
  const macosPalette = ['#007AFF', '#34C759', '#5856D6', '#FF9500', '#AF52DE', '#FF3B30'];
  const bg = macosPalette[(letter.charCodeAt(0) || 0) % macosPalette.length];
  return (
    <div
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#FFFFFF',
        fontWeight: 600,
        fontSize: Math.floor(size * 0.45) + 'px',
        userSelect: 'none',
      }}
    >
      {letter}
    </div>
  );
};
