import type { CanvasNode, ResolvedStyle } from "./canvas_types";

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function createNode(
  tag: string,
  style: ResolvedStyle,
  text: string | null = null,
): CanvasNode {
  return {
    tag,
    parent: null,
    children: [],
    style,
    events: {},
    layout: { x: 0, y: 0, w: 0, h: 0 },
    text,
    prevProps: null,
  };
}

// ---------------------------------------------------------------------------
// Tree operations
// ---------------------------------------------------------------------------

export function insertChild(
  parent: CanvasNode,
  child: CanvasNode,
  index: number,
): void {
  child.parent = parent;
  if (index >= 0 && index < parent.children.length) {
    parent.children.splice(index, 0, child);
  } else {
    parent.children.push(child);
  }
}

export function removeChild(parent: CanvasNode, child: CanvasNode): void {
  const idx = parent.children.indexOf(child);
  if (idx !== -1) parent.children.splice(idx, 1);
  child.parent = null;
}

export function moveChild(
  parent: CanvasNode,
  child: CanvasNode,
  newIndex: number,
): void {
  const oldIdx = parent.children.indexOf(child);
  if (oldIdx === -1) return;
  if (oldIdx === newIndex) return;
  parent.children.splice(oldIdx, 1);
  parent.children.splice(
    Math.min(newIndex, parent.children.length),
    0,
    child,
  );
}

// ---------------------------------------------------------------------------
// Two-pass layout: (1) measure sizes bottom-up, (2) position top-down
// ---------------------------------------------------------------------------

export function layoutTree(root: CanvasNode, width: number, height: number): void {
  // Pass 1: measure intrinsic sizes bottom-up
  measureNode(root, width, height);

  // Pass 2: position top-down
  root.layout.x = 0;
  root.layout.y = 0;
  positionChildren(root);
}

/**
 * Pass 1: Determine each node's width and height.
 * - Explicit sizes are used directly.
 * - Auto sizes are computed from children (after measuring them).
 */
function measureNode(node: CanvasNode, availW: number, availH: number): void {
  const s = node.style;

  if (s.display === "none") {
    node.layout.w = 0;
    node.layout.h = 0;
    return;
  }

  // Determine own width
  if (s.width !== "auto") {
    node.layout.w = s.width as number;
  } else {
    node.layout.w = availW;
  }

  // Determine own height (may be auto — compute after children)
  const explicitH = s.height !== "auto" ? (s.height as number) : -1;

  // Content area for children
  const contentW = Math.max(0, node.layout.w - s.paddingLeft - s.paddingRight);

  // Measure children
  const isRow = s.flexDirection === "row";
  const children = node.children.filter(c => c.style.display !== "none");

  // First, measure all children to get their intrinsic sizes
  for (const child of children) {
    const cs = child.style;
    const childAvailW = isRow
      ? (cs.width !== "auto" ? (cs.width as number) : 0)
      : contentW - cs.marginLeft - cs.marginRight;
    const childAvailH = cs.height !== "auto" ? (cs.height as number) : 0;
    measureNode(child, childAvailW, childAvailH);
  }

  // Compute flex sizes for flex-grow children
  if (isRow) {
    const gapTotal = Math.max(0, (children.length - 1) * s.gap);
    let totalFixed = gapTotal;
    let totalFlex = 0;
    for (const child of children) {
      const cs = child.style;
      if (cs.flexGrow > 0) {
        totalFlex += cs.flexGrow;
      } else {
        totalFixed += child.layout.w + cs.marginLeft + cs.marginRight;
      }
    }
    const remaining = Math.max(0, contentW - totalFixed);
    for (const child of children) {
      if (child.style.flexGrow > 0 && totalFlex > 0) {
        child.layout.w = (child.style.flexGrow / totalFlex) * remaining;
        // Re-measure with new width to get correct auto-height
        measureNode(child, child.layout.w, child.layout.h);
      }
    }
  }

  // Compute auto-height from children
  if (explicitH >= 0) {
    node.layout.h = explicitH;
  } else {
    let totalH = s.paddingTop + s.paddingBottom;
    if (children.length > 0) {
      const gapTotal = Math.max(0, (children.length - 1) * s.gap);
      if (isRow && s.flexWrap === "wrap") {
        // Wrapped row: simulate wrapping to count lines
        let cursorX = 0;
        let lineH = 0;
        let totalLinesH = 0;
        for (const child of children) {
          const cs = child.style;
          const cw = child.layout.w + cs.marginLeft + cs.marginRight;
          if (cursorX + cw > contentW && cursorX > 0) {
            totalLinesH += lineH + s.gap;
            cursorX = 0;
            lineH = 0;
          }
          const ch = child.layout.h + cs.marginTop + cs.marginBottom;
          if (ch > lineH) lineH = ch;
          cursorX += cw + s.gap;
        }
        totalH += totalLinesH + lineH;
      } else if (isRow) {
        // Row: height = max child height
        let maxH = 0;
        for (const child of children) {
          const ch = child.layout.h + child.style.marginTop + child.style.marginBottom;
          if (ch > maxH) maxH = ch;
        }
        totalH += maxH;
      } else {
        // Column: height = sum of children
        for (const child of children) {
          totalH += child.layout.h + child.style.marginTop + child.style.marginBottom;
        }
        totalH += gapTotal;
      }
    }
    // Text node intrinsic height
    if (node.tag === "text" && node.text) {
      totalH = Math.max(totalH, s.fontSize * s.lineHeight);
    }
    node.layout.h = totalH;
  }

  // Apply min/max constraints
  node.layout.w = clamp(node.layout.w, s.minWidth, s.maxWidth);
  node.layout.h = clamp(node.layout.h, s.minHeight, s.maxHeight);
}

/**
 * Pass 2: Position children within their parent's content area.
 */
function positionChildren(node: CanvasNode): void {
  const s = node.style;
  const l = node.layout;

  if (s.display === "none") return;

  const children = node.children.filter(c => c.style.display !== "none");
  if (children.length === 0) return;

  const isRow = s.flexDirection === "row";
  const wrap = s.flexWrap === "wrap";

  const contentX = l.x + s.paddingLeft;
  const contentY = l.y + s.paddingTop;
  const contentW = Math.max(0, l.w - s.paddingLeft - s.paddingRight);
  const contentH = Math.max(0, l.h - s.paddingTop - s.paddingBottom);

  if (wrap && isRow) {
    // Flex-wrap: row — wrap items to next line when they exceed content width
    let cursorX = contentX;
    let cursorY = contentY;
    let lineHeight = 0;

    for (const child of children) {
      const cs = child.style;
      const cl = child.layout;

      if (cs.position === "absolute") {
        cl.x = l.x;
        cl.y = l.y;
        if (cs.left !== "auto") cl.x = l.x + (cs.left as number);
        if (cs.top !== "auto") cl.y = l.y + (cs.top as number);
        positionChildren(child);
        continue;
      }

      const childMainSize = cl.w + cs.marginLeft + cs.marginRight;

      // Wrap to next line?
      if (cursorX + childMainSize > contentX + contentW && cursorX > contentX) {
        cursorX = contentX;
        cursorY += lineHeight + s.gap;
        lineHeight = 0;
      }

      cl.x = cursorX + cs.marginLeft;
      cl.y = cursorY + cs.marginTop;
      cursorX += childMainSize + s.gap;
      lineHeight = Math.max(lineHeight, cl.h + cs.marginTop + cs.marginBottom);

      positionChildren(child);
    }
    return;
  }

  // Non-wrapping layout (original path)
  let usedSpace = Math.max(0, (children.length - 1) * s.gap);
  for (const child of children) {
    if (child.style.position === "absolute") continue;
    usedSpace += isRow
      ? child.layout.w + child.style.marginLeft + child.style.marginRight
      : child.layout.h + child.style.marginTop + child.style.marginBottom;
  }

  const mainSpace = isRow ? contentW : contentH;
  let cursor = isRow ? contentX : contentY;

  // justify-content offset
  if (s.justifyContent === "center") {
    cursor += Math.max(0, (mainSpace - usedSpace) / 2);
  } else if (s.justifyContent === "flex-end") {
    cursor += Math.max(0, mainSpace - usedSpace);
  } else if (s.justifyContent === "space-between" && children.length > 1) {
    // gap is replaced by space-between
  }

  for (const child of children) {
    const cs = child.style;
    const cl = child.layout;

    if (cs.position === "absolute") {
      cl.x = l.x;
      cl.y = l.y;
      if (cs.left !== "auto") cl.x = l.x + (cs.left as number);
      if (cs.top !== "auto") cl.y = l.y + (cs.top as number);
      if (cs.right !== "auto") cl.x = l.x + l.w - cl.w - (cs.right as number);
      if (cs.bottom !== "auto") cl.y = l.y + l.h - cl.h - (cs.bottom as number);
      positionChildren(child);
      continue;
    }

    cursor += isRow ? cs.marginLeft : cs.marginTop;

    if (isRow) {
      cl.x = cursor;
      cl.y = alignCross(contentY, contentH, cl.h, cs.marginTop, cs.marginBottom, cs.alignSelf, s.alignItems);
      cursor += cl.w + cs.marginRight + s.gap;
    } else {
      cl.y = cursor;
      cl.x = alignCross(contentX, contentW, cl.w, cs.marginLeft, cs.marginRight, cs.alignSelf, s.alignItems);
      cursor += cl.h + cs.marginBottom + s.gap;
    }

    positionChildren(child);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function alignCross(
  contentStart: number,
  contentSize: number,
  childSize: number,
  marginStart: number,
  marginEnd: number,
  alignSelf: string,
  parentAlign: string,
): number {
  const align = alignSelf !== "auto" ? alignSelf : parentAlign;
  switch (align) {
    case "center":
      return contentStart + (contentSize - childSize) / 2;
    case "flex-end":
      return contentStart + contentSize - childSize - marginEnd;
    case "stretch":
    case "flex-start":
    default:
      return contentStart + marginStart;
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val));
}
