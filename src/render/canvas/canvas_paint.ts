import type { CanvasNode } from "./canvas_types";

// ---------------------------------------------------------------------------
// Color parsing (for native Canvas 2D — just pass through CSS colors)
// ---------------------------------------------------------------------------

// No parsing needed — Canvas 2D accepts CSS color strings directly.

// ---------------------------------------------------------------------------
// Font weight mapping
// ---------------------------------------------------------------------------

function resolveFontWeight(w: number | string): string {
  if (typeof w === "number") return String(w);
  return w === "bold" ? "700" : "400";
}

// ---------------------------------------------------------------------------
// Paint context — native Canvas 2D
// ---------------------------------------------------------------------------

export type PaintContext = {
  ctx: CanvasRenderingContext2D;
  dpr: number;
};

// ---------------------------------------------------------------------------
// Paint the full tree
// ---------------------------------------------------------------------------

export function paintTree(pctx: PaintContext, root: CanvasNode): void {
  const { ctx, dpr } = pctx;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);

  ctx.scale(dpr, dpr);
  paintNode(ctx, root);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}

function paintNode(ctx: CanvasRenderingContext2D, node: CanvasNode): void {
  const s = node.style;
  const l = node.layout;

  if (s.display === "none") return;
  if (l.w <= 0 || l.h <= 0) return;

  ctx.save();

  if (s.opacity < 1) {
    ctx.globalAlpha *= s.opacity;
  }

  const hasClip = s.overflow === "hidden" || s.overflow === "scroll";
  if (hasClip) {
    ctx.beginPath();
    ctx.rect(l.x, l.y, l.w, l.h);
    ctx.clip();
  }

  // Draw background
  if (s.backgroundColor) {
    ctx.fillStyle = s.backgroundColor;
    if (s.borderRadius > 0) {
      roundRect(ctx, l.x, l.y, l.w, l.h, s.borderRadius);
      ctx.fill();
    } else {
      ctx.fillRect(l.x, l.y, l.w, l.h);
    }
  }

  // Draw border
  if (s.borderWidth > 0 && s.borderColor) {
    ctx.strokeStyle = s.borderColor;
    ctx.lineWidth = s.borderWidth;
    const half = s.borderWidth / 2;
    if (s.borderRadius > 0) {
      roundRect(ctx, l.x + half, l.y + half, l.w - s.borderWidth, l.h - s.borderWidth, s.borderRadius);
      ctx.stroke();
    } else {
      ctx.strokeRect(l.x + half, l.y + half, l.w - s.borderWidth, l.h - s.borderWidth);
    }
  }

  // Draw text
  if (node.tag === "text" && node.text) {
    drawText(ctx, node);
  }

  // Draw input placeholder/value when not focused (overlay handles focused state)
  if ((node.tag === "input" || node.tag === "textarea") && !s.backgroundColor) {
    // Default input appearance: white bg + border
    ctx.fillStyle = "#ffffff";
    roundRect(ctx, l.x, l.y, l.w, l.h, s.borderRadius);
    ctx.fill();
    ctx.strokeStyle = s.borderColor || "#cccccc";
    ctx.lineWidth = s.borderWidth || 1;
    roundRect(ctx, l.x + 0.5, l.y + 0.5, l.w - 1, l.h - 1, s.borderRadius);
    ctx.stroke();
    // Draw value or placeholder text
    const value = node.prevProps?.value as string | undefined;
    const placeholder = node.prevProps?.placeholder as string | undefined;
    const displayText = value || placeholder || "";
    if (displayText) {
      const weight = resolveFontWeight(s.fontWeight);
      ctx.font = `${weight} ${s.fontSize}px ${s.fontFamily}`;
      ctx.fillStyle = value ? s.color : "#999999";
      ctx.textBaseline = "middle";
      ctx.textAlign = "left";
      const px = s.paddingLeft || 8;
      ctx.fillText(displayText, l.x + px, l.y + l.h / 2, l.w - px * 2);
    }
  }

  // Draw children
  for (const child of node.children) {
    paintNode(ctx, child);
  }

  ctx.restore();
}

// ---------------------------------------------------------------------------
// Text rendering
// ---------------------------------------------------------------------------

function drawText(ctx: CanvasRenderingContext2D, node: CanvasNode): void {
  const s = node.style;
  const l = node.layout;
  if (!node.text) return;

  const weight = resolveFontWeight(s.fontWeight);
  const size = s.fontSize;
  ctx.font = `${weight} ${size}px ${s.fontFamily}`;
  ctx.fillStyle = s.color;
  ctx.textBaseline = "middle";

  if (s.textAlign === "center") {
    ctx.textAlign = "center";
    ctx.fillText(String(node.text), l.x + l.w / 2, l.y + l.h / 2, l.w);
  } else if (s.textAlign === "right") {
    ctx.textAlign = "right";
    ctx.fillText(String(node.text), l.x + l.w, l.y + l.h / 2, l.w);
  } else {
    ctx.textAlign = "left";
    ctx.fillText(String(node.text), l.x, l.y + l.h / 2, l.w);
  }
}

// ---------------------------------------------------------------------------
// Rounded rect helper
// ---------------------------------------------------------------------------

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
): void {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
