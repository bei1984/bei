const LEVELS = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 },
};

const boardEl = document.querySelector('#board');
const difficultyEl = document.querySelector('#difficulty');
const newGameEl = document.querySelector('#new-game');
const mineCountEl = document.querySelector('#mine-count');
const timerEl = document.querySelector('#timer');
const statusEl = document.querySelector('#status');

let config;
let cells;
let mineSet;
let opened;
let flags;
let firstClick;
let gameOver;
let seconds;
let timerId;
let longPressTimer;
let longPressHandled;

function startGame() {
  config = LEVELS[difficultyEl.value];
  cells = Array.from({ length: config.rows * config.cols }, (_, index) => ({
    index,
    isMine: false,
    opened: false,
    flagged: false,
    nearby: 0,
  }));
  mineSet = new Set();
  opened = 0;
  flags = 0;
  firstClick = true;
  gameOver = false;
  seconds = 0;
  clearInterval(timerId);
  timerId = null;
  timerEl.textContent = seconds;
  statusEl.textContent = '准备开始';
  updateMineCount();
  renderBoard();
}

function renderBoard() {
  boardEl.innerHTML = '';
  boardEl.style.setProperty('--cols', config.cols);

  cells.forEach((cell) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'cell';
    button.dataset.index = cell.index;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-label', `第 ${cell.index + 1} 格，未翻开`);
    button.addEventListener('click', () => {
      if (longPressHandled) {
        longPressHandled = false;
        return;
      }
      openCell(cell.index);
    });
    button.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      toggleFlag(cell.index);
    });
    button.addEventListener('pointerdown', () => {
      longPressHandled = false;
      longPressTimer = setTimeout(() => {
        longPressHandled = true;
        toggleFlag(cell.index);
      }, 520);
    });
    button.addEventListener('pointerup', clearLongPress);
    button.addEventListener('pointerleave', clearLongPress);
    boardEl.appendChild(button);
  });
}

function clearLongPress() {
  clearTimeout(longPressTimer);
}

function plantMines(safeIndex) {
  while (mineSet.size < config.mines) {
    const index = Math.floor(Math.random() * cells.length);
    if (index !== safeIndex) {
      mineSet.add(index);
    }
  }

  mineSet.forEach((index) => {
    cells[index].isMine = true;
  });

  cells.forEach((cell) => {
    cell.nearby = getNeighbors(cell.index).filter((index) => cells[index].isMine).length;
  });
}

function getNeighbors(index) {
  const row = Math.floor(index / config.cols);
  const col = index % config.cols;
  const neighbors = [];

  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
      if (rowOffset === 0 && colOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextCol = col + colOffset;
      if (nextRow >= 0 && nextRow < config.rows && nextCol >= 0 && nextCol < config.cols) {
        neighbors.push(nextRow * config.cols + nextCol);
      }
    }
  }

  return neighbors;
}

function openCell(index) {
  if (gameOver || cells[index].opened || cells[index].flagged) return;

  if (firstClick) {
    firstClick = false;
    plantMines(index);
    startTimer();
    statusEl.textContent = '游戏中';
  }

  const cell = cells[index];
  if (cell.isMine) {
    revealMine(cell);
    endGame(false);
    return;
  }

  floodOpen(index);
  checkWin();
}

function floodOpen(startIndex) {
  const queue = [startIndex];
  const visited = new Set();

  while (queue.length > 0) {
    const index = queue.shift();
    if (visited.has(index)) continue;
    visited.add(index);

    const cell = cells[index];
    if (cell.opened || cell.flagged || cell.isMine) continue;

    cell.opened = true;
    opened += 1;
    paintCell(cell);

    if (cell.nearby === 0) {
      getNeighbors(index).forEach((neighborIndex) => queue.push(neighborIndex));
    }
  }
}

function toggleFlag(index) {
  if (gameOver || cells[index].opened) return;
  if (firstClick) {
    startTimer();
    firstClick = false;
    plantMines(index);
    statusEl.textContent = '游戏中';
  }

  const cell = cells[index];
  cell.flagged = !cell.flagged;
  flags += cell.flagged ? 1 : -1;
  paintCell(cell);
  updateMineCount();
}

function paintCell(cell) {
  const element = boardEl.children[cell.index];
  element.className = 'cell';
  element.textContent = '';

  if (cell.opened) {
    element.classList.add('open');
    element.setAttribute('aria-label', `第 ${cell.index + 1} 格，已翻开，周围 ${cell.nearby} 个雷`);
    if (cell.nearby > 0) {
      element.textContent = cell.nearby;
      element.classList.add(`n${cell.nearby}`);
    }
  } else if (cell.flagged) {
    element.classList.add('flagged');
    element.textContent = '🚩';
    element.setAttribute('aria-label', `第 ${cell.index + 1} 格，已插旗`);
  } else {
    element.setAttribute('aria-label', `第 ${cell.index + 1} 格，未翻开`);
  }
}

function revealMine(cell) {
  cell.opened = true;
  const element = boardEl.children[cell.index];
  element.className = 'cell mine';
  element.textContent = '💣';
}

function revealAllMines() {
  cells.forEach((cell) => {
    if (cell.isMine) revealMine(cell);
  });
}

function updateMineCount() {
  mineCountEl.textContent = Math.max(config.mines - flags, 0);
}

function startTimer() {
  if (timerId) return;
  timerId = setInterval(() => {
    seconds += 1;
    timerEl.textContent = seconds;
  }, 1000);
}

function endGame(won) {
  gameOver = true;
  clearInterval(timerId);
  if (won) {
    statusEl.textContent = '胜利！';
    cells.forEach((cell) => {
      if (cell.isMine && !cell.flagged) {
        cell.flagged = true;
        flags += 1;
        paintCell(cell);
      }
    });
    updateMineCount();
  } else {
    statusEl.textContent = '踩雷了';
    revealAllMines();
  }
}

function checkWin() {
  if (opened === cells.length - config.mines) {
    endGame(true);
  }
}

newGameEl.addEventListener('click', startGame);
difficultyEl.addEventListener('change', startGame);
startGame();
