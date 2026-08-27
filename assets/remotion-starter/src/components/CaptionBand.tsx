import React from 'react';
import {ASPECTS} from '../config/aspect.mjs';

type Aspect = keyof typeof ASPECTS;

export const CaptionBand: React.FC<{aspect: Aspect; text: string}> = ({aspect, text}) => {
  const config = ASPECTS[aspect];

  return (
    <div
      style={{
        position: 'absolute',
        left: config.safe.x,
        right: config.safe.x,
        bottom: config.safe.bottom,
        height: config.caption.height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 28px',
        borderRadius: 28,
        background: 'rgba(20, 32, 45, 0.88)',
        color: '#fffefa',
        fontFamily: 'Microsoft YaHei, sans-serif',
        fontSize: aspect === 'vertical' ? 46 : 42,
        fontWeight: 700,
        lineHeight: 1.25,
        textAlign: 'center',
      }}
    >
      <span
        style={{
          display: '-webkit-box',
          WebkitBoxOrient: 'vertical',
          WebkitLineClamp: config.caption.maxLines,
          overflow: 'hidden',
        }}
      >
        {text}
      </span>
    </div>
  );
};
