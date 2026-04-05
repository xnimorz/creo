import { createApp } from "@/public/app";
import { CanvasRender } from "@/render/canvas/canvas_render";
import { CanvasStyleSheet } from "@/render/canvas/canvas_style";
import { App } from "./app";

const canvasEl = document.getElementById("canvas") as HTMLCanvasElement;

const CELL_W = 120;

const styleSheet = new CanvasStyleSheet().registerAll({
  // Toolbar
  toolbar: { flexDirection: "row", gap: 8, marginBottom: 16, height: 36 },
  btn: {
    padding: 6,
    paddingLeft: 14,
    paddingRight: 14,
    borderWidth: 1,
    borderColor: "#cccccc",
    borderRadius: 4,
    backgroundColor: "#ffffff",
    fontSize: 14,
    height: 34,
    textAlign: "center",
  },

  // Table container
  table: {
    flexDirection: "column",
    borderWidth: 1,
    borderColor: "#bbbbbb",
    borderRadius: 4,
    overflow: "hidden",
    backgroundColor: "#ffffff",
  },

  // Rows
  row: { flexDirection: "row", borderColor: "#dddddd", borderWidth: 0 },
  header: {},

  // Cells
  cell: {
    width: CELL_W,
    minWidth: CELL_W,
    padding: 8,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
    height: 36,
    borderColor: "#dddddd",
    borderWidth: 0,
  },
  selected: {
    backgroundColor: "#e8f0fe",
    borderWidth: 2,
    borderColor: "#4a90d9",
  },
  "header-cell": {
    fontWeight: 600,
    backgroundColor: "#f9f9f9",
    width: CELL_W,
    height: 36,
    padding: 8,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
  },

  // Edit input
  "cell-input": {
    width: CELL_W,
    minWidth: CELL_W,
    padding: 8,
    paddingLeft: 12,
    paddingRight: 12,
    fontSize: 14,
    height: 36,
    borderWidth: 2,
    borderColor: "#4a90d9",
  },
});

const renderer = new CanvasRender(canvasEl, { styleSheet });
createApp(() => App(), renderer).mount();
