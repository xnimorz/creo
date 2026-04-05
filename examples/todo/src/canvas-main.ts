import { createApp } from "@/public/app";
import { CanvasRender } from "@/render/canvas/canvas_render";
import { CanvasStyleSheet } from "@/render/canvas/canvas_style";
import { App } from "./app";

const canvasEl = document.getElementById("canvas") as HTMLCanvasElement;

const styleSheet = new CanvasStyleSheet().registerAll({
  app: { maxWidth: 480, flexDirection: "column" },
  "dragging-active": {},

  // Add form
  "add-form": { flexDirection: "row", gap: 8, marginBottom: 16 },
  "add-input": {
    flexGrow: 1,
    padding: 8,
    paddingLeft: 12,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 4,
    fontSize: 14,
    height: 36,
  },

  // Buttons
  btn: {
    padding: 8,
    paddingLeft: 14,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 4,
    backgroundColor: "#ffffff",
    fontSize: 14,
    height: 36,
    textAlign: "center",
  },
  "btn-primary": {
    backgroundColor: "#4a90d9",
    color: "#ffffff",
    borderColor: "#4a90d9",
  },
  "btn-filter": { fontSize: 12, padding: 4, paddingLeft: 10, paddingRight: 10, height: 28 },

  // Card
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 6,
    flexDirection: "column",
    overflow: "hidden",
  },
  "card-header": {
    padding: 12,
    paddingLeft: 16,
    paddingRight: 16,
    fontWeight: 600,
    fontSize: 14,
    backgroundColor: "#f9f9f9",
    borderColor: "#dddddd",
    borderWidth: 1,
    height: 42,
  },
  "card-body": { flexDirection: "column" },

  // Todo items
  "todo-item": {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    paddingLeft: 16,
    paddingRight: 16,
    fontSize: 14,
    borderColor: "#eeeeee",
    borderWidth: 0,
    height: 41,
  },
  done: {},
  dragging: { opacity: 0.25 },
  "drop-above": { backgroundColor: "#f0f6ff" },
  "drop-below": { backgroundColor: "#f0f6ff" },
  editing: { padding: 6, paddingLeft: 16, paddingRight: 16 },

  // Drag ghost
  "drag-ghost": {
    position: "absolute",
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    paddingLeft: 16,
    paddingRight: 16,
    fontSize: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#4a90d9",
    borderRadius: 6,
    opacity: 0.92,
    height: 41,
  },

  // Todo item parts
  "drag-handle": { color: "#aaaaaa", fontSize: 16, width: 16, height: 20, textAlign: "center" },
  "todo-check": { fontSize: 16, width: 20, height: 20, textAlign: "center" },
  "todo-text": { flexGrow: 1, padding: 2, borderRadius: 3 },
  "todo-delete": { color: "#cc4444", fontSize: 16, width: 16, height: 20, textAlign: "center" },

  // Edit input
  "edit-input": {
    flexGrow: 1,
    padding: 6,
    paddingLeft: 8,
    paddingRight: 8,
    borderWidth: 1,
    borderColor: "#4a90d9",
    borderRadius: 4,
    fontSize: 14,
    height: 32,
  },

  // Filter bar
  "filter-bar": {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 8,
  },

  // Empty state
  empty: { padding: 24, paddingLeft: 16, paddingRight: 16, textAlign: "center", color: "#999999", fontSize: 14, height: 60 },
});

const renderer = new CanvasRender(canvasEl, { styleSheet });
createApp(() => App(), renderer).mount();
