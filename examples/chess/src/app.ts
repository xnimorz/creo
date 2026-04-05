import { view } from "@/public/view";
import { div, text, span, button } from "@/public/primitives/primitives";
import type { PointerEventData } from "@/public/primitives/primitives";

// ===================================================================
// Types
// ===================================================================

type Color = "w" | "b";
type PieceType = "K" | "Q" | "R" | "B" | "N" | "P";
type Piece = { color: Color; type: PieceType };
type Square = Piece | null;
type Board = Square[]; // 64 elements, row-major. 0=a8, 63=h1

type Move = {
  from: number;
  to: number;
  promotion?: PieceType;
  castle?: "K" | "Q";
  enPassant?: boolean;
};

type GameStatus = "playing" | "check" | "checkmate" | "stalemate";

type GameState = {
  board: Board;
  turn: Color;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  enPassant: number | null;
  status: GameStatus;
};

type DragState = {
  from: number;
  piece: Piece;
  x: number;
  y: number;
  originX: number;
  originY: number;
};

// ===================================================================
// Constants
// ===================================================================

const PIECE_CHAR: Record<string, string> = {
  wK: "\u265A",
  wQ: "\u265B",
  wR: "\u265C",
  wB: "\u265D",
  wN: "\u265E",
  wP: "\u265F",
  bK: "\u265A",
  bQ: "\u265B",
  bR: "\u265C",
  bB: "\u265D",
  bN: "\u265E",
  bP: "\u265F",
};

function pieceChar(p: Piece): string {
  return PIECE_CHAR[p.color + p.type]!;
}

// ===================================================================
// Position helpers
// ===================================================================

function pos(row: number, col: number): number {
  return row * 8 + col;
}
function row(p: number): number {
  return p >> 3;
}
function col(p: number): number {
  return p & 7;
}
function onBoard(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function findKing(board: Board, color: Color): number {
  for (let i = 0; i < 64; i++) {
    const sq = board[i];
    if (sq && sq.color === color && sq.type === "K") return i;
  }
  return -1;
}

// ===================================================================
// Attack detection (from king outward — no move generation needed)
// ===================================================================

const SLIDE_DIRS: [number, number][] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1], // orthogonal
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1], // diagonal
];

const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

function isAttacked(board: Board, target: number, byColor: Color): boolean {
  const tr = row(target),
    tc = col(target);

  // Knight attacks
  for (const [dr, dc] of KNIGHT_OFFSETS) {
    const r2 = tr + dr,
      c2 = tc + dc;
    if (onBoard(r2, c2)) {
      const sq = board[pos(r2, c2)];
      if (sq && sq.color === byColor && sq.type === "N") return true;
    }
  }

  // Sliding attacks (rook/bishop/queen) + adjacent king
  for (let d = 0; d < 8; d++) {
    const [dr, dc] = SLIDE_DIRS[d]!;
    const isDiag = dr !== 0 && dc !== 0;
    for (let dist = 1; dist < 8; dist++) {
      const r2 = tr + dr * dist,
        c2 = tc + dc * dist;
      if (!onBoard(r2, c2)) break;
      const sq = board[pos(r2, c2)];
      if (!sq) continue;
      if (sq.color !== byColor) break;
      if (dist === 1 && sq.type === "K") return true;
      if (isDiag && (sq.type === "B" || sq.type === "Q")) return true;
      if (!isDiag && (sq.type === "R" || sq.type === "Q")) return true;
      break;
    }
  }

  // Pawn attacks
  const pawnDir = byColor === "w" ? 1 : -1; // pawns of byColor attack in this row direction relative to target
  for (const dc of [-1, 1]) {
    const r2 = tr + pawnDir,
      c2 = tc + dc;
    if (onBoard(r2, c2)) {
      const sq = board[pos(r2, c2)];
      if (sq && sq.color === byColor && sq.type === "P") return true;
    }
  }

  return false;
}

function isInCheck(board: Board, color: Color): boolean {
  const k = findKing(board, color);
  if (k === -1) return false;
  return isAttacked(board, k, color === "w" ? "b" : "w");
}

// ===================================================================
// Pseudo-legal move generation
// ===================================================================

function pseudoLegalMoves(game: GameState, from: number): Move[] {
  const board = game.board;
  const piece = board[from];
  if (!piece || piece.color !== game.turn) return [];

  const moves: Move[] = [];
  const r = row(from),
    c = col(from);
  const color = piece.color;
  const enemy = color === "w" ? "b" : "w";

  function addIfValid(toR: number, toC: number, extra?: Partial<Move>) {
    if (!onBoard(toR, toC)) return;
    const to = pos(toR, toC);
    const target = board[to];
    if (target && target.color === color) return;
    moves.push({ from, to, ...extra });
  }

  function slide(dirs: [number, number][]) {
    for (const [dr, dc] of dirs) {
      for (let dist = 1; dist < 8; dist++) {
        const r2 = r + dr * dist,
          c2 = c + dc * dist;
        if (!onBoard(r2, c2)) break;
        const to = pos(r2, c2);
        const target = board[to];
        if (target) {
          if (target.color === enemy) moves.push({ from, to });
          break;
        }
        moves.push({ from, to });
      }
    }
  }

  switch (piece.type) {
    case "P": {
      const dir = color === "w" ? -1 : 1;
      const startRow = color === "w" ? 6 : 1;
      const promoRow = color === "w" ? 0 : 7;

      // Forward
      const f1 = r + dir;
      if (onBoard(f1, c) && !board[pos(f1, c)]) {
        if (f1 === promoRow) {
          for (const pr of ["Q", "R", "B", "N"] as PieceType[])
            moves.push({ from, to: pos(f1, c), promotion: pr });
        } else {
          moves.push({ from, to: pos(f1, c) });
        }
        // Double push
        const f2 = r + dir * 2;
        if (r === startRow && !board[pos(f2, c)]) {
          moves.push({ from, to: pos(f2, c) });
        }
      }
      // Captures
      for (const dc of [-1, 1]) {
        const cc = c + dc;
        if (!onBoard(f1, cc)) continue;
        const to = pos(f1, cc);
        const target = board[to];
        if (target && target.color === enemy) {
          if (f1 === promoRow) {
            for (const pr of ["Q", "R", "B", "N"] as PieceType[])
              moves.push({ from, to, promotion: pr });
          } else {
            moves.push({ from, to });
          }
        }
        // En passant
        if (to === game.enPassant) {
          moves.push({ from, to, enPassant: true });
        }
      }
      break;
    }
    case "N":
      for (const [dr, dc] of KNIGHT_OFFSETS) addIfValid(r + dr, c + dc);
      break;
    case "B":
      slide(SLIDE_DIRS.slice(4));
      break;
    case "R":
      slide(SLIDE_DIRS.slice(0, 4));
      break;
    case "Q":
      slide(SLIDE_DIRS);
      break;
    case "K": {
      for (const [dr, dc] of SLIDE_DIRS) addIfValid(r + dr, c + dc);
      // Castling
      const cr = color === "w" ? 7 : 0;
      if (r === cr && c === 4) {
        // Kingside
        const canK = color === "w" ? game.castling.wK : game.castling.bK;
        if (
          canK &&
          !board[pos(cr, 5)] &&
          !board[pos(cr, 6)] &&
          board[pos(cr, 7)]?.type === "R"
        ) {
          moves.push({ from, to: pos(cr, 6), castle: "K" });
        }
        // Queenside
        const canQ = color === "w" ? game.castling.wQ : game.castling.bQ;
        if (
          canQ &&
          !board[pos(cr, 3)] &&
          !board[pos(cr, 2)] &&
          !board[pos(cr, 1)] &&
          board[pos(cr, 0)]?.type === "R"
        ) {
          moves.push({ from, to: pos(cr, 2), castle: "Q" });
        }
      }
      break;
    }
  }

  return moves;
}

// ===================================================================
// Legal move filtering
// ===================================================================

function applyMoveRaw(board: Board, move: Move, color: Color): Board {
  const b = [...board] as Board;
  const piece = b[move.from]!;
  b[move.from] = null;

  if (move.promotion) {
    b[move.to] = { color, type: move.promotion };
  } else {
    b[move.to] = piece;
  }

  if (move.enPassant) {
    const captureRow = row(move.from);
    b[pos(captureRow, col(move.to))] = null;
  }

  if (move.castle) {
    const cr = row(move.from);
    if (move.castle === "K") {
      b[pos(cr, 5)] = b[pos(cr, 7)]!;
      b[pos(cr, 7)] = null;
    } else {
      b[pos(cr, 3)] = b[pos(cr, 0)]!;
      b[pos(cr, 0)] = null;
    }
  }

  return b;
}

function legalMoves(game: GameState, from: number): Move[] {
  const pseudo = pseudoLegalMoves(game, from);
  const color = game.turn;
  const enemy = color === "w" ? "b" : "w";

  return pseudo.filter((move) => {
    // Castling: king must not be in check, and must not cross/land on attacked squares
    if (move.castle) {
      if (isInCheck(game.board, color)) return false;
      const cr = row(move.from);
      const through = move.castle === "K" ? pos(cr, 5) : pos(cr, 3);
      if (isAttacked(game.board, through, enemy)) return false;
      if (isAttacked(game.board, move.to, enemy)) return false;
      return true;
    }
    const newBoard = applyMoveRaw(game.board, move, color);
    return !isInCheck(newBoard, color);
  });
}

function allLegalMoves(game: GameState): Move[] {
  const moves: Move[] = [];
  for (let i = 0; i < 64; i++) {
    const sq = game.board[i];
    if (sq && sq.color === game.turn) {
      moves.push(...legalMoves(game, i));
    }
  }
  return moves;
}

// ===================================================================
// Apply move + status detection
// ===================================================================

function applyMove(game: GameState, move: Move): GameState {
  const color = game.turn;
  const nextTurn: Color = color === "w" ? "b" : "w";
  const board = applyMoveRaw(game.board, move, color);

  // Update castling rights
  const c = { ...game.castling };
  if (move.from === pos(7, 4)) {
    c.wK = false;
    c.wQ = false;
  } // white king moved
  if (move.from === pos(0, 4)) {
    c.bK = false;
    c.bQ = false;
  } // black king moved
  if (move.from === pos(7, 7) || move.to === pos(7, 7)) c.wK = false;
  if (move.from === pos(7, 0) || move.to === pos(7, 0)) c.wQ = false;
  if (move.from === pos(0, 7) || move.to === pos(0, 7)) c.bK = false;
  if (move.from === pos(0, 0) || move.to === pos(0, 0)) c.bQ = false;

  // En passant target
  let ep: number | null = null;
  const piece = game.board[move.from]!;
  if (piece.type === "P" && Math.abs(row(move.to) - row(move.from)) === 2) {
    ep = pos((row(move.from) + row(move.to)) / 2, col(move.from));
  }

  const next: GameState = {
    board,
    turn: nextTurn,
    castling: c,
    enPassant: ep,
    status: "playing",
  };

  // Compute status for the side that must now move
  const opponentMoves = allLegalMoves(next);
  const inCheck = isInCheck(board, nextTurn);
  if (opponentMoves.length === 0) {
    next.status = inCheck ? "checkmate" : "stalemate";
  } else if (inCheck) {
    next.status = "check";
  }

  return next;
}

// ===================================================================
// Initial position
// ===================================================================

function initialGame(): GameState {
  const board: Board = new Array(64).fill(null);
  const backRank: PieceType[] = ["R", "N", "B", "Q", "K", "B", "N", "R"];

  for (let c = 0; c < 8; c++) {
    board[pos(0, c)] = { color: "b", type: backRank[c]! };
    board[pos(1, c)] = { color: "b", type: "P" };
    board[pos(6, c)] = { color: "w", type: "P" };
    board[pos(7, c)] = { color: "w", type: backRank[c]! };
  }

  return {
    board,
    turn: "w",
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    enPassant: null,
    status: "playing",
  };
}

// ===================================================================
// Views
// ===================================================================

const SQ_SIZE = 64;

// -- Status bar -------------------------------------------------------

const StatusBar = view<{ game: GameState }>(({ props }) => ({
  render() {
    const g = props().game;
    const turnLabel = g.turn === "w" ? "White" : "Black";
    let msg = `${turnLabel} to move`;
    if (g.status === "check") msg = `${turnLabel} is in check`;
    if (g.status === "checkmate")
      msg = `Checkmate! ${g.turn === "w" ? "Black" : "White"} wins`;
    if (g.status === "stalemate") msg = "Stalemate — draw";

    div({ class: "status-bar" }, () => {
      div({ class: `turn-dot ${g.turn === "w" ? "white" : "black"}` });
      span({ class: "status-text" }, msg);
    });
  },
}));

// -- Promotion dialog -------------------------------------------------

const PromotionDialog = view<{
  color: Color;
  onSelect: (type: PieceType) => void;
}>(({ props }) => ({
  render() {
    const { color, onSelect } = props();
    div({ class: "promo-overlay" }, () => {
      div({ class: "promo-dialog" }, () => {
        for (const t of ["Q", "R", "B", "N"] as PieceType[]) {
          button({ class: "promo-btn", onClick: () => onSelect(t) },
            pieceChar({ color, type: t }),
          );
        }
      });
    });
  },
}));

// -- Drag ghost -------------------------------------------------------

const DragGhost = view<{ piece: Piece; x: number; y: number }>(({ props }) => ({
  render() {
    const { piece, x, y } = props();
    div(
      {
        class: "drag-ghost",
        style: `left:${x}px;top:${y}px`,
      },
      pieceChar(piece),
    );
  },
}));

// -- Square -----------------------------------------------------------

const SquareView = view<{
  pos: number;
  piece: Square;
  isLight: boolean;
  isSelected: boolean;
  isValidTarget: boolean;
  isCheck: boolean;
  isLastMove: boolean;
  onPointerDown: (e: PointerEventData) => void;
  onPointerUp: () => void;
}>(({ props }) => {
  const handleDown = (e: PointerEventData) => {
    e.preventDefault();
    props().onPointerDown(e);
  };
  const handleUp = () => props().onPointerUp();

  return {
    render() {
      const p = props();
      const cls = [
        "square",
        p.isLight ? "light" : "dark",
        p.isSelected ? "selected" : "",
        p.isValidTarget ? "valid-target" : "",
        p.isCheck ? "in-check" : "",
        p.isLastMove ? "last-move" : "",
        p.isValidTarget && p.piece ? "capture-target" : "",
      ]
        .filter(Boolean)
        .join(" ");

      div(
        { class: cls, onPointerDown: handleDown, onPointerUp: handleUp },
        () => {
          if (p.piece) {
            span(
              {
                class: `piece ${p.piece.color === "w" ? "white-piece" : "black-piece"}`,
              },
              pieceChar(p.piece!),
            );
          }
          if (p.isValidTarget && !p.piece) {
            div({ class: "move-dot" });
          }
        },
      );
    },
  };
});

// -- App --------------------------------------------------------------

export const App = view(({ use }) => {
  const game = use<GameState>(initialGame());
  const selected = use<number | null>(null);
  const validMovesState = use<Move[]>([]);
  const dragInfo = use<DragState | null>(null);
  const pendingPromotion = use<{ from: number; to: number } | null>(null);
  const lastMove = use<{ from: number; to: number } | null>(null);

  const isGameOver = () => {
    const s = game.get().status;
    return s === "checkmate" || s === "stalemate";
  };

  // -- Selection / move -----------------------------------------------

  const selectSquare = (sqPos: number, e?: PointerEventData) => {
    if (isGameOver()) return;
    const g = game.get();
    const piece = g.board[sqPos];
    const sel = selected.get();

    // If clicking a valid target, execute move
    if (sel !== null) {
      const moves = validMovesState.get();
      const move = moves.find((m) => m.to === sqPos);
      if (move) {
        executeMove(move);
        return;
      }
    }

    // Select own piece
    if (piece && piece.color === g.turn) {
      selected.set(sqPos);
      const moves = legalMoves(g, sqPos);
      validMovesState.set(moves);
      if (e) {
        dragInfo.set({
          from: sqPos,
          piece,
          x: e.x,
          y: e.y,
          originX: e.x,
          originY: e.y,
        });
      }
    } else {
      selected.set(null);
      validMovesState.set([]);
    }
  };

  const executeMove = (move: Move) => {
    // Check if promotion choice needed
    if (move.promotion) {
      // Find if there are multiple promotion options
      const moves = validMovesState.get();
      const promoMoves = moves.filter((m) => m.to === move.to && m.promotion);
      if (promoMoves.length > 1) {
        pendingPromotion.set({ from: move.from, to: move.to });
        dragInfo.set(null);
        return;
      }
    }
    completeMove(move);
  };

  const completeMove = (move: Move) => {
    const g = game.get();
    game.set(applyMove(g, move));
    lastMove.set({ from: move.from, to: move.to });
    selected.set(null);
    validMovesState.set([]);
    dragInfo.set(null);
    pendingPromotion.set(null);
  };

  const handlePromotion = (type: PieceType) => {
    const pp = pendingPromotion.get();
    if (!pp) return;
    completeMove({ from: pp.from, to: pp.to, promotion: type });
  };

  // -- Pointer handlers -----------------------------------------------

  const handleSquareDown = (sqPos: number, e: PointerEventData) => {
    selectSquare(sqPos, e);
  };

  const handleSquareUp = (sqPos: number) => {
    if (isGameOver()) return;
    const d = dragInfo.get();
    if (!d) return;
    if (d.from === sqPos) return; // released on same square — keep selected

    const moves = validMovesState.get();
    const move = moves.find((m) => m.to === sqPos);
    if (move) {
      executeMove(move);
    } else {
      // Invalid drop — cancel drag but keep selection
      dragInfo.set(null);
    }
  };

  const handlePointerMove = (e: PointerEventData) => {
    const d = dragInfo.get();
    if (!d) return;
    dragInfo.set({ ...d, x: e.x, y: e.y });
  };

  const handlePointerUp = () => {
    const d = dragInfo.get();
    if (!d) return;
    dragInfo.set(null);
  };

  const resetGame = () => {
    game.set(initialGame());
    selected.set(null);
    validMovesState.set([]);
    dragInfo.set(null);
    pendingPromotion.set(null);
    lastMove.set(null);
  };

  // -- Render ---------------------------------------------------------

  return {
    render() {
      const g = game.get();
      const sel = selected.get();
      const moves = validMovesState.get();
      const d = dragInfo.get();
      const promo = pendingPromotion.get();
      const lm = lastMove.get();

      const validTargets = new Set(moves.map((m) => m.to));
      const kingPos = findKing(g.board, g.turn);
      const inCheck = g.status === "check" || g.status === "checkmate";

      div(
        {
          class: d ? "chess-app dragging-active" : "chess-app",
          onPointerMove: handlePointerMove,
          onPointerUp: handlePointerUp,
        },
        () => {
          div({ class: "header" }, () => {
            span({ class: "title" }, "Chess");
            button({ class: "reset-btn", onClick: resetGame }, "New Game");
          });

          StatusBar({ game: g });

          // Board
          div({ class: "board" }, () => {
            for (let p = 0; p < 64; p++) {
              const r = row(p),
                c = col(p);
              const isLight = (r + c) % 2 === 0;
              const piece = g.board[p] ?? null;
              const isDragged = d && d.from === p;

              SquareView({
                key: p,
                pos: p,
                piece: isDragged ? null : piece,
                isLight,
                isSelected: sel === p,
                isValidTarget: validTargets.has(p),
                isCheck: inCheck && p === kingPos,
                isLastMove: lm !== null && (lm.from === p || lm.to === p),
                onPointerDown: (e: PointerEventData) => handleSquareDown(p, e),
                onPointerUp: () => handleSquareUp(p),
              });
            }
          });

          // File labels
          div({ class: "file-labels" }, () => {
            for (const f of ["a", "b", "c", "d", "e", "f", "g", "h"]) {
              span({ class: "file-label" }, f);
            }
          });

          // Promotion dialog
          if (promo) {
            PromotionDialog({
              color: g.turn,
              onSelect: handlePromotion,
            });
          }

          // Drag ghost
          if (d) {
            DragGhost({ piece: d.piece, x: d.x, y: d.y });
          }
        },
      );
    },
  };
});
