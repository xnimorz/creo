import { createApp } from "@/public/app";
import { CanvasRender } from "@/render/canvas/canvas_render";
import { CanvasStyleSheet } from "@/render/canvas/canvas_style";
import { App } from "./app";

const canvasEl = document.getElementById("canvas") as HTMLCanvasElement;

const SQ = 64;

const styleSheet = new CanvasStyleSheet().registerAll({
  "chess-app": {
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: 16,
  },
  "dragging-active": {},

  // Header
  header: { flexDirection: "row", alignItems: "center", gap: 16, width: SQ * 8, height: 36 },
  title: { fontSize: 22, fontWeight: "bold", flexGrow: 1, color: "#eeeeee", height: 30 },
  "reset-btn": {
    padding: 6,
    paddingLeft: 14,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: "#555555",
    borderRadius: 4,
    backgroundColor: "#2a2a4a",
    color: "#cccccc",
    fontSize: 13,
    height: 32,
    textAlign: "center",
  },

  // Status bar
  "status-bar": {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: SQ * 8,
    padding: 8,
    paddingLeft: 12,
    paddingRight: 12,
    backgroundColor: "#2a2a4a",
    borderRadius: 6,
    fontSize: 14,
    height: 36,
    color: "#cccccc",
  },
  "turn-dot": { width: 14, height: 14, borderRadius: 7, borderWidth: 2, borderColor: "#666666" },
  white: { backgroundColor: "#ffffff", borderColor: "#999999" },
  black: { backgroundColor: "#222222", borderColor: "#666666" },
  "status-text": { flexGrow: 1, height: 20 },

  // Board — flex-wrap to simulate 8x8 grid
  board: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: SQ * 8,
    height: SQ * 8,
    borderWidth: 3,
    borderColor: "#444444",
    borderRadius: 4,
    overflow: "hidden",
  },

  // Squares
  square: { width: SQ, height: SQ, alignItems: "center", justifyContent: "center" },
  light: { backgroundColor: "#f0d9b5" },
  dark: { backgroundColor: "#b58863" },
  selected: { backgroundColor: "#f7ec5a" },
  "valid-target": {},
  "in-check": { backgroundColor: "#ff4444" },
  "last-move": { backgroundColor: "#e8d44d" },
  "capture-target": {},

  // Move dot
  "move-dot": { width: 18, height: 18, borderRadius: 9, backgroundColor: "rgba(0,0,0,0.2)" },

  // Pieces
  piece: { fontSize: 46, textAlign: "center", width: SQ, height: SQ },
  "white-piece": { color: "#eeeeee" },
  "black-piece": { color: "#222222" },

  // File labels
  "file-labels": { flexDirection: "row", width: SQ * 8, height: 20 },
  "file-label": { width: SQ, textAlign: "center", fontSize: 12, color: "#888888", height: 20 },

  // Drag ghost
  "drag-ghost": {
    position: "absolute",
    fontSize: 54,
    textAlign: "center",
    width: 60,
    height: 60,
    opacity: 0.9,
  },

  // Promotion overlay
  "promo-overlay": {
    position: "absolute",
    top: 0,
    left: 0,
    width: SQ * 8 + 32,
    height: SQ * 8 + 200,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  "promo-dialog": {
    flexDirection: "row",
    gap: 8,
    padding: 16,
    backgroundColor: "#2a2a4a",
    borderWidth: 2,
    borderColor: "#555555",
    borderRadius: 10,
  },
  "promo-btn": {
    width: 72,
    height: 72,
    fontSize: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#555555",
    borderRadius: 8,
    backgroundColor: "#3a3a5a",
    textAlign: "center",
  },
});

const renderer = new CanvasRender(canvasEl, { styleSheet });
createApp(() => App(), renderer).mount();
