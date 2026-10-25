import React from 'react';
import {Composition, registerRoot} from 'remotion';
import {Explainer} from './Explainer';
import {DURATION_SECONDS} from './state.mjs';

const Root: React.FC = () => <Composition
  id="LayeredExplainer"
  component={Explainer}
  durationInFrames={DURATION_SECONDS * 30}
  fps={30}
  width={1920}
  height={1080}
/>;

registerRoot(Root);
