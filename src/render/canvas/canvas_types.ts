// ---------------------------------------------------------------------------
// Style types
// ---------------------------------------------------------------------------

export type CanvasStyle = {
  // Layout (flexbox)
  display?: "flex" | "none";
  flexDirection?: "row" | "column";
  justifyContent?: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems?: "flex-start" | "center" | "flex-end" | "stretch";
  alignSelf?: "auto" | "flex-start" | "center" | "flex-end" | "stretch";
  flexGrow?: number;
  flexShrink?: number;
  flexBasis?: number | "auto";
  flexWrap?: "nowrap" | "wrap";
  gap?: number;

  // Dimensions
  width?: number | string;
  height?: number | string;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;

  // Spacing (number = all sides, or use specific sides)
  padding?: number;
  paddingTop?: number;
  paddingRight?: number;
  paddingBottom?: number;
  paddingLeft?: number;
  margin?: number;
  marginTop?: number;
  marginRight?: number;
  marginBottom?: number;
  marginLeft?: number;

  // Position (for absolute-positioned nodes like drag ghosts)
  position?: "relative" | "absolute";
  top?: number;
  left?: number;
  right?: number;
  bottom?: number;

  // Visual
  backgroundColor?: string;
  color?: string;
  opacity?: number;
  borderRadius?: number;
  borderWidth?: number;
  borderColor?: string;

  // Text
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: number | "normal" | "bold";
  textAlign?: "left" | "center" | "right";
  lineHeight?: number;

  // Overflow
  overflow?: "visible" | "hidden" | "scroll";

  // Cursor hint (for hit testing feedback)
  cursor?: string;
};

// ---------------------------------------------------------------------------
// Resolved style — all optional fields resolved to concrete values for paint
// ---------------------------------------------------------------------------

export type ResolvedStyle = Required<
  Pick<
    CanvasStyle,
    | "flexDirection"
    | "justifyContent"
    | "alignItems"
    | "flexGrow"
    | "flexShrink"
    | "gap"
    | "overflow"
    | "opacity"
    | "fontSize"
    | "fontWeight"
    | "textAlign"
    | "position"
  >
> & {
  display: "flex" | "none";
  flexBasis: number | "auto";
  flexWrap: "nowrap" | "wrap";
  alignSelf: "auto" | "flex-start" | "center" | "flex-end" | "stretch";

  width: number | "auto";
  height: number | "auto";
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;

  paddingTop: number;
  paddingRight: number;
  paddingBottom: number;
  paddingLeft: number;
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;

  top: number | "auto";
  left: number | "auto";
  right: number | "auto";
  bottom: number | "auto";

  backgroundColor: string | null;
  color: string;
  borderRadius: number;
  borderWidth: number;
  borderColor: string | null;

  fontFamily: string;
  lineHeight: number;
  cursor: string;
};

// ---------------------------------------------------------------------------
// Layout rect — absolute position after layout pass
// ---------------------------------------------------------------------------

export type LayoutRect = {
  x: number;
  y: number;
  w: number;
  h: number;
};

// ---------------------------------------------------------------------------
// CanvasNode — stored in view.renderRef for primitives
// ---------------------------------------------------------------------------

export type CanvasNode = {
  tag: string;
  parent: CanvasNode | null;
  children: CanvasNode[];
  style: ResolvedStyle;
  events: Record<string, Function>;
  layout: LayoutRect;
  text: string | null;
  prevProps: Record<string, unknown> | null;
};

