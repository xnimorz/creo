import { createApp } from "@/public/app";
import { CanvasRender } from "@/render/canvas/canvas_render";
import { CanvasStyleSheet } from "@/render/canvas/canvas_style";
import { App } from "./app";

const canvasEl = document.getElementById("canvas") as HTMLCanvasElement;

const styleSheet = new CanvasStyleSheet().registerAll({
  // Bootstrap-like grid
  container: { padding: 16, flexDirection: "column" },
  jumbotron: { padding: 20, marginBottom: 10, flexDirection: "column" },
  row: { flexDirection: "row" },
  "col-md-1": { width: 80, padding: 4, fontSize: 14 },
  "col-md-4": { width: 320, padding: 4, fontSize: 14 },
  "col-md-6": { flexGrow: 1, flexDirection: "column", padding: 4 },
  "col-sm-6": { width: 160, padding: 4 },
  smallpad: { padding: 4, paddingLeft: 8, paddingRight: 8 },

  // Buttons
  btn: {
    padding: 6,
    paddingLeft: 12,
    paddingRight: 12,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 4,
    backgroundColor: "#ffffff",
    fontSize: 14,
    height: 34,
    textAlign: "center",
  },
  "btn-primary": {
    backgroundColor: "#337ab7",
    color: "#ffffff",
    borderColor: "#2e6da4",
  },
  "btn-block": { flexGrow: 1 },

  // Table
  table: {
    flexDirection: "column",
    borderWidth: 1,
    borderColor: "#dddddd",
    backgroundColor: "#ffffff",
  },
  "table-hover": {},
  "table-striped": {},
  "test-data": {},

  // Rows and cells — table elements map to flex containers
  // (tr → row, td → cell)

  // Selected row
  danger: { backgroundColor: "#f9f2f4" },

  // Glyphicon (render as "x" text)
  glyphicon: { width: 16, height: 16 },
  "glyphicon-remove": { color: "#999999", fontSize: 14, textAlign: "center" },
  preloadicon: { display: "none" },
});

const renderer = new CanvasRender(canvasEl, { styleSheet });
createApp(() => App(), renderer).mount();
