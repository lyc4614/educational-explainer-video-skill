import React from 'react';
import {Composition} from 'remotion';
import {COMPOSITION_SPECS} from './config/aspect.mjs';
import {StarterPreview} from './scenes/StarterPreview';

export const RemotionRoot: React.FC = () => (
  <>
    {COMPOSITION_SPECS.map((spec) => (
      <Composition
        key={spec.id}
        id={spec.id}
        component={StarterPreview}
        defaultProps={{aspect: spec.aspect}}
        durationInFrames={spec.durationInFrames}
        fps={spec.fps}
        width={spec.width}
        height={spec.height}
      />
    ))}
  </>
);
