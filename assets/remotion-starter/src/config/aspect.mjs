export const ASPECTS = Object.freeze({
  horizontal: Object.freeze({
    width: 1920,
    height: 1080,
    fps: 30,
    safe: Object.freeze({x: 120, top: 96, bottom: 84}),
    caption: Object.freeze({height: 180, maxLines: 2}),
  }),
  vertical: Object.freeze({
    width: 1080,
    height: 1920,
    fps: 30,
    safe: Object.freeze({x: 72, top: 160, bottom: 280}),
    caption: Object.freeze({height: 240, maxLines: 2}),
  }),
});

export const COMPOSITION_SPECS = Object.freeze([
  Object.freeze({
    id: 'StarterHorizontalPreview',
    aspect: 'horizontal',
    durationInFrames: 150,
    fps: ASPECTS.horizontal.fps,
    width: ASPECTS.horizontal.width,
    height: ASPECTS.horizontal.height,
  }),
  Object.freeze({
    id: 'StarterVerticalPreview',
    aspect: 'vertical',
    durationInFrames: 150,
    fps: ASPECTS.vertical.fps,
    width: ASPECTS.vertical.width,
    height: ASPECTS.vertical.height,
  }),
]);

export const PREVIEW_LAYOUTS = Object.freeze({
  horizontal: Object.freeze({
    paddingX: 40,
    paddingY: 24,
    titleMinHeight: 48,
    titleFontSize: 34,
    sectionGap: 16,
    geometryGap: 100,
    primarySize: 300,
    connectorLength: 360,
    connectorThickness: 18,
  }),
  vertical: Object.freeze({
    paddingX: 32,
    paddingY: 24,
    titleMinHeight: 64,
    titleFontSize: 30,
    sectionGap: 16,
    geometryGap: 24,
    primarySize: 360,
    connectorLength: 260,
    connectorThickness: 18,
  }),
});

export const STARTER_PLACEHOLDER_TOKENS = Object.freeze([
  'STARTER_PLACEHOLDER_DO_NOT_DELIVER',
  'Replace with manuscript-derived visual system',
  'Replace this preview with source-traceable explanatory content',
]);
