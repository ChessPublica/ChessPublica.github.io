/* ChessPublica bundle entry-point (used by build.js, not the site).
   pgn-player must come first so customElements.define() runs before
   ChessPublica.js's loadPgnPlayer() check. */
import "./pgn-player.js";
import "./ChessPublica.js";
