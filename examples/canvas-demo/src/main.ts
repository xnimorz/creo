import { createApp } from "@/public/app";
import { CanvasRender } from "@/render/canvas/canvas_render";
import { CanvasStyleSheet } from "@/render/canvas/canvas_style";
import { App } from "./app";

const status = document.getElementById("status")!;

const canvasEl = document.getElementById("canvas") as HTMLCanvasElement;

const styleSheet = new CanvasStyleSheet().registerAll({
  root: {
    padding: 16,
    gap: 16,
    flexDirection: "column",
  },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#1a1a1a",
    height: 32,
  },
  card: {
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#dddddd",
    borderRadius: 6,
    flexDirection: "column",
  },
  "card-header": {
    padding: 12,
    backgroundColor: "#f9f9f9",
    fontWeight: "bold",
    fontSize: 14,
    color: "#333333",
    height: 40,
    borderColor: "#dddddd",
    borderWidth: 1,
  },
  "card-body": {
    padding: 12,
    flexDirection: "column",
    gap: 8,
  },
  counter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 40,
  },
  btn: {
    backgroundColor: "#4a90d9",
    color: "#ffffff",
    padding: 8,
    borderRadius: 4,
    width: 40,
    height: 32,
    fontSize: 16,
    textAlign: "center",
  },
  count: {
    fontSize: 20,
    fontWeight: "bold",
    width: 40,
    height: 28,
    textAlign: "center",
  },
  row: {
    flexDirection: "row",
    gap: 8,
  },
  box: {
    width: 80,
    height: 40,
    borderRadius: 4,
    padding: 8,
    color: "#ffffff",
    fontWeight: "bold",
    textAlign: "center",
  },
  "box-red": { backgroundColor: "#e74c3c" },
  "box-green": { backgroundColor: "#27ae60" },
  "box-blue": { backgroundColor: "#2980b9" },
});

const renderer = new CanvasRender(canvasEl, { styleSheet });

createApp(() => App(), renderer).mount();

status.textContent = "Running! Click the +/- buttons.";
