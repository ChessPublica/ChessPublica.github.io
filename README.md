# ChessPublica

Minimal chess publishing engine — turns FEN strings, PGN games, and puzzles
into custom HTML elements. Drop a `<pgn>`, `<fen>`, `<puzzle>`, or
`<pgn-player>` tag into any page and the engine renders an interactive board.

Live site & sandbox: <https://chesspublica.github.io>

## Quick start

Add two lines to your page (anywhere; bundle is self-contained — bundles
jQuery, chess.js, chessboard.js, and ChessPublica):

```html
<link rel="stylesheet" href="https://chesspublica.github.io/dist/ChessPublica.all.min.css">
<script src="https://chesspublica.github.io/dist/ChessPublica.all.min.js"></script>
```

Then write a custom element:

```html
<fen>rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1</fen>

<pgn>
  [White "Anand"]
  [Black "Carlsen"]
  1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 { Ruy Lopez }
</pgn>

<puzzle>
  [FEN "8/5K2/8/4pk2/4R3/8/8/8 w - - 0 1"]
  1. Re2! e4 2. Re1! Ke5 3. Ke7 Kd4
</puzzle>

<pgn-player src="https://lichess.org/api/study/<id>/<chapter>.pgn"></pgn-player>
```

If you already host chess.js / chessboard.js / jQuery yourself, swap the
`*.all.min.*` URLs for `ChessPublica.min.css` / `ChessPublica.min.js` and load
the vendor scripts separately.

## Elements

| Tag             | Use                                                                |
| --------------- | ------------------------------------------------------------------ |
| `<fen>`         | Static board diagram from a FEN string. Supports `[%csl]`/`[%cal]` annotations. |
| `<pgn>`         | Annotated game written out as a static move list with diagrams.    |
| `<puzzle>`      | Interactive puzzle — drag pieces, see right/wrong, with side-line variations. |
| `<pgn-player>`  | Video-style game player with autoplay, keyboard navigation, eval bar. |

Each tag accepts either inline content or a `src` attribute pointing at a
`.pgn` file.

## Authoring tips

- PGN comments accept a small subset of inline markdown (`**bold**`,
  `*italic*`, `` `code` ``, `[link](url)`) and a safe HTML allowlist
  (`<br>`, `<strong>`, `<em>`, …). Anything else is stripped.
- Lichess-style annotations work inside comments: `[%csl Ge5,Rd4]` for
  coloured squares, `[%cal Ge2e4]` for arrows.
- Drop `[D]` inside any comment to insert a board diagram at that point in
  the move list (`<pgn>` only).
- For `<pgn-player>`, you can paste any Lichess study or game URL straight
  from the address bar — common public routes are auto-rewritten to their
  CORS-enabled `/api/*` equivalents.

## Building from source

```bash
npm install
npm run build      # writes dist/
npm run watch      # rebuilds on every save under assets/
```

The `dist/` directory is regenerated automatically by GitHub Actions on every
push to `main` (see `.github/workflows/rebuild-dist.yml`), so contributors
don't need to commit built artifacts.

## License

MIT — see [LICENSE](./LICENSE).
