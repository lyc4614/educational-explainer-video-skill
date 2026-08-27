import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame} from 'remotion';
import {CaptionBand} from '../components/CaptionBand';
import {ASPECTS, PREVIEW_LAYOUTS, STARTER_PLACEHOLDER_TOKENS} from '../config/aspect.mjs';

type Aspect = keyof typeof ASPECTS;

export const StarterPreview: React.FC<{aspect: Aspect}> = ({aspect}) => {
  const frame = useCurrentFrame();
  const config = ASPECTS[aspect];
  const layout = PREVIEW_LAYOUTS[aspect];
  const horizontal = aspect === 'horizontal';
  const contentBottom = config.safe.bottom + config.caption.height + 28;

  return (
    <AbsoluteFill
      data-delivery-blocker={STARTER_PLACEHOLDER_TOKENS[0]}
      style={{
        background: '#f4f0e7',
        color: '#1f3045',
        fontFamily: 'Microsoft YaHei, sans-serif',
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: config.safe.x,
          right: config.safe.x,
          top: config.safe.top,
          bottom: contentBottom,
          border: '3px dashed rgba(47, 146, 113, 0.35)',
          borderRadius: 36,
          display: 'flex',
          flexDirection: 'column',
          padding: `${layout.paddingY}px ${layout.paddingX}px`,
          boxSizing: 'border-box',
          gap: layout.sectionGap,
        }}
      >
        <div
          data-layout-zone="starter-title"
          style={{
            flex: `0 0 ${layout.titleMinHeight}px`,
            minHeight: layout.titleMinHeight,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            fontSize: layout.titleFontSize,
            fontWeight: 800,
            lineHeight: 1.2,
            whiteSpace: 'nowrap',
          }}
        >
          {STARTER_PLACEHOLDER_TOKENS[1]}
        </div>
        <div
          data-layout-zone="starter-geometry"
          style={{
            minHeight: 0,
            minWidth: 0,
            flex: 1,
            width: '100%',
            display: 'flex',
            flexDirection: horizontal ? 'row' : 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: layout.geometryGap,
          }}
        >
          <div
            style={{
              width: layout.primarySize,
              height: layout.primarySize,
              borderRadius: 52,
              background: '#2f9271',
              scale: interpolate(frame, [20, 110], [0.86, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          />
          <div
            style={{
              width: horizontal ? layout.connectorLength : layout.connectorThickness,
              height: horizontal ? layout.connectorThickness : layout.connectorLength,
              borderRadius: 99,
              background: '#c9c1b5',
              scale: interpolate(frame, [20, 110], [0.2, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          />
          <div
            style={{
              width: layout.primarySize,
              height: layout.primarySize,
              boxSizing: 'border-box',
              borderRadius: '50%',
              border: '18px solid #d86f3f',
              background: '#fffefa',
              opacity: interpolate(frame, [20, 110], [0.55, 1], {
                extrapolateLeft: 'clamp',
                extrapolateRight: 'clamp',
              }),
            }}
          />
        </div>
      </div>
      <CaptionBand aspect={aspect} text={STARTER_PLACEHOLDER_TOKENS[2]} />
    </AbsoluteFill>
  );
};
