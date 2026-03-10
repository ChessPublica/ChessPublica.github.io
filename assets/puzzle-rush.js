 /* ================================================================
     PUZZLE-RUSH RENDERER
  ================================================================ */

  var RUSH_KEY = "jekyllchess_puzzle_rush_index";

  function renderPuzzleRush(container, url) {
    container.textContent = "Loading...";

    fetch(url, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) throw new Error("HTTP " + res.status);
        return res.text();
      })
      .then(function (text) {
        var puzzles = splitIntoPgnGames(text)
          .map(parseGame)
          .filter(function (p) {
            return !p.error;
          });

        var idx = parseInt(localStorage.getItem(RUSH_KEY), 10) || 0;

        container.innerHTML = "";
        var holder = document.createElement("div");
        holder.className = "puzzle-rush-wrap";
        container.appendChild(holder);

        var counterDiv = document.createElement("div");
        counterDiv.className = "puzzle-rush-counter";
        holder.appendChild(counterDiv);

        function updateCounter() {
          counterDiv.textContent =
            "Puzzle " +
            Math.min(idx + 1, puzzles.length) +
            " / " +
            puzzles.length;
        }

        function loadNext() {
          if (!puzzles[idx]) {
            localStorage.removeItem(RUSH_KEY);
            holder.innerHTML =
              "<div class='jc-finished'>All puzzles completed ✔</div>";
            return;
          }

          updateCounter();

          var fenParts = puzzles[idx].fen.split(" ");
          var solverSide = fenParts[1] === "w" ? "b" : "w";
          var orientation = solverSide === "w" ? "white" : "black";

          renderLocalPuzzle(
            holder,
            puzzles[idx].fen,
            puzzles[idx].moves,
            true,
            false,
            function () {
              idx++;
              localStorage.setItem(RUSH_KEY, idx);
              holder.innerHTML = "";
              var newCounter = document.createElement("div");
              newCounter.className = "puzzle-rush-counter";
              holder.appendChild(newCounter);
              counterDiv.remove();
              requestAnimationFrame(loadNext);
            },
            orientation,
            null,
            true,
          );
        }

        loadNext();
      })
      .catch(function () {
        container.textContent = "Failed to load PGN.";
      });
  }
