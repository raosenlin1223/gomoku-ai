// 五子棋人机对弈 - 微信小程序版（全功能增强）
// pages/index/index.js

const SIZE = 19;

Page({
  data: {
    // 模式选择
    modeOptions: [
      { label: '👥 双人对战', value: 'pvp' },
      { label: '🟢 人机对弈 · 低级', value: 'ai-easy' },
      { label: '🟡 人机对弈 · 中级', value: 'ai-medium' },
      { label: '🔴 人机对弈 · 高级', value: 'ai-hard' }
    ],
    modeIndex: 1,
    mode: 'ai-easy',
    // 界面状态
    turnText: '黑棋回合（你先行）',
    aiThinking: false,
    showOverlay: false,
    overlayTitle: '',
    overlaySub: '',
    celebrate: false,
    statusText: '',
    moveCount: 0,
    gameOver: false,
    canvasStyleWidth: 0,
    canvasStyleHeight: 0,
    // 音效开关
    soundOn: true,
    // 棋谱
    showRecord: false,
    recordList: [],
    // 对局统计
    stats: { wins: 0, losses: 0, draws: 0, total: 0 },
    showStats: false,
    // AI提示
    hintVisible: false,
    // 当前执棋方（用于WXML绑定）
    currentPlayer: 1
  },

  // 游戏核心状态
  board: [],
  moveHistory: [],
  winLine: null,
  aiPlayer: 2,
  humanPlayer: 1,
  aiBusy: false,
  lastStone: null,
  gameOver: false,

  // Canvas相关
  canvas: null,
  ctx: null,
  dpr: 1,
  canvasLogicWidth: 0,
  canvasLogicHeight: 0,
  cell: 0,
  pad: 0,
  stoneR: 0,
  starR1: 0,
  starR2: 0,

  // 音效
  audioPlace: null,
  audioWin: null,
  audioLose: null,
  audioUndo: null,
  audioDraw: null,

  // ====== 生命周期 ======
  onLoad() {
    this.calcDimensions();
    this.initAudio();
    this.loadStats();
    this.initBoard();
  },

  onReady() {
    this.initCanvas();
  },

  onUnload() {
    // 释放音效资源
    if (this.audioPlace) this.audioPlace.destroy();
    if (this.audioWin) this.audioWin.destroy();
    if (this.audioLose) this.audioLose.destroy();
    if (this.audioUndo) this.audioUndo.destroy();
    if (this.audioDraw) this.audioDraw.destroy();
  },

  // ====== 音效初始化 ======
  initAudio() {
    this.audioPlace = wx.createInnerAudioContext();
    this.audioPlace.src = '/audio/place.wav';

    this.audioWin = wx.createInnerAudioContext();
    this.audioWin.src = '/audio/win.wav';

    this.audioLose = wx.createInnerAudioContext();
    this.audioLose.src = '/audio/lose.wav';

    this.audioUndo = wx.createInnerAudioContext();
    this.audioUndo.src = '/audio/undo.wav';

    this.audioDraw = wx.createInnerAudioContext();
    this.audioDraw.src = '/audio/draw.wav';
  },

  playSound(type) {
    if (!this.data.soundOn) return;
    const audioMap = {
      place: this.audioPlace,
      win: this.audioWin,
      lose: this.audioLose,
      undo: this.audioUndo,
      draw: this.audioDraw
    };
    const audio = audioMap[type];
    if (audio) {
      audio.stop();
      audio.play();
    }
  },

  // ====== 对局统计（本地存储） ======
  loadStats() {
    try {
      const stats = wx.getStorageSync('gomoku_stats');
      if (stats) {
        this.setData({ stats });
      }
    } catch (e) {
      console.log('读取统计失败:', e);
    }
  },

  saveStats() {
    try {
      wx.setStorageSync('gomoku_stats', this.data.stats);
    } catch (e) {
      console.log('保存统计失败:', e);
    }
  },

  updateStats(result) {
    const stats = this.data.stats;
    stats.total++;
    if (result === 'win') stats.wins++;
    else if (result === 'lose') stats.losses++;
    else if (result === 'draw') stats.draws++;
    this.setData({ stats });
    this.saveStats();
  },

  // ====== 动态尺寸计算 ======
  calcDimensions() {
    const sysInfo = wx.getSystemInfoSync();
    const screenWidth = sysInfo.windowWidth;
    const dpr = sysInfo.pixelRatio;

    const canvasLogicWidth = Math.floor(screenWidth * 0.92);
    const canvasLogicHeight = canvasLogicWidth;
    const pad = Math.floor(canvasLogicWidth * 0.05);
    const cell = (canvasLogicWidth - 2 * pad) / (SIZE - 1);
    const stoneR = cell * 0.43;
    const starR1 = cell * 0.22;
    const starR2 = cell * 0.13;

    this.dpr = dpr;
    this.canvasLogicWidth = canvasLogicWidth;
    this.canvasLogicHeight = canvasLogicHeight;
    this.cell = cell;
    this.pad = pad;
    this.stoneR = stoneR;
    this.starR1 = starR1;
    this.starR2 = starR2;

    this.setData({
      canvasStyleWidth: canvasLogicWidth,
      canvasStyleHeight: canvasLogicHeight
    });
  },

  // ====== Canvas初始化 ======
  initCanvas() {
    const query = wx.createSelectorQuery();
    query.select('#boardCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (res && res[0]) {
          const canvas = res[0].node;
          const ctx = canvas.getContext('2d');
          canvas.width = this.canvasLogicWidth * this.dpr;
          canvas.height = this.canvasLogicHeight * this.dpr;
          ctx.scale(this.dpr, this.dpr);
          this.canvas = canvas;
          this.ctx = ctx;
          this.draw();
        }
      });
  },

  // ====== 棋盘初始化 ======
  initBoard() {
    this.board = [];
    for (let i = 0; i < SIZE; i++) {
      this.board.push(new Array(SIZE).fill(0));
    }
    this.setData({
      currentPlayer: 1,
      turnText: '黑棋回合（你先行）',
      aiThinking: false,
      showOverlay: false,
      celebrate: false,
      statusText: '',
      moveCount: 0,
      gameOver: false,
      showRecord: false,
      recordList: [],
      hintVisible: false
    });

    if (this.ctx) this.draw();
  },

  // ====== 棋谱生成 ======
  buildRecordList() {
    const list = [];
    for (let i = 0; i < this.moveHistory.length; i++) {
      const [r, c, player] = this.moveHistory[i];
      // 棋盘坐标：列用字母A-S，行用数字1-19
      const colLetter = String.fromCharCode(65 + c); // A-S
      const rowNum = SIZE - r; // 从底部开始计数，1-19
      const playerLabel = player === 1 ? '黑' : '白';
      list.push({
        num: i + 1,
        player: playerLabel,
        pos: colLetter + rowNum,
        isLast: i === this.moveHistory.length - 1
      });
    }
    return list;
  },

  // ====== 绘制棋盘 ======
  draw() {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const w = this.canvasLogicWidth;
    const h = this.canvasLogicHeight;
    const P = this.pad;
    const C = this.cell;
    const SR = this.stoneR;

    // 棋盘背景
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, '#c9a84c');
    grad.addColorStop(0.5, '#b8943a');
    grad.addColorStop(1, '#a88428');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // 木纹纹理
    ctx.strokeStyle = 'rgba(100, 65, 15, 0.12)';
    ctx.lineWidth = 1;
    for (let i = 0; i < w; i += 4) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + 10, h);
      ctx.stroke();
    }

    // 外边框
    ctx.strokeStyle = 'rgba(60, 35, 8, 0.7)';
    ctx.lineWidth = 3;
    ctx.strokeRect(P - C * 0.3, P - C * 0.3, (SIZE - 1) * C + C * 0.6, (SIZE - 1) * C + C * 0.6);

    // 网格线
    ctx.strokeStyle = 'rgba(50, 30, 8, 0.75)';
    ctx.lineWidth = 1.2;
    for (let i = 0; i < SIZE; i++) {
      ctx.beginPath();
      ctx.moveTo(P, P + i * C);
      ctx.lineTo(P + (SIZE - 1) * C, P + i * C);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(P + i * C, P);
      ctx.lineTo(P + i * C, P + (SIZE - 1) * C);
      ctx.stroke();
    }

    // 星位
    const stars = [[3,3],[3,9],[3,15],[9,3],[9,9],[9,15],[15,3],[15,9],[15,15]];
    for (const [r, c] of stars) {
      const x = P + c * C;
      const y = P + r * C;
      ctx.beginPath();
      ctx.arc(x, y, this.starR1, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(50, 30, 8, 0.2)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y, this.starR2, 0, Math.PI * 2);
      ctx.fillStyle = '#3a2206';
      ctx.fill();
    }

    // 棋子 + 手数标记
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (this.board[r][c] !== 0) {
          this.drawStone(r, c, this.board[r][c]);
          // 在棋子上显示手数（可选，仅前10手）
        }
      }
    }

    // AI提示标记
    if (this.data.hintVisible && this.hintPos) {
      const [hr, hc] = this.hintPos;
      const hx = P + hc * C;
      const hy = P + hr * C;
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 200, 255, 0.9)';
      ctx.lineWidth = C * 0.08;
      ctx.setLineDash([C * 0.1, C * 0.05]);
      ctx.beginPath();
      ctx.arc(hx, hy, SR + C * 0.2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      // 中心小圆点
      ctx.beginPath();
      ctx.arc(hx, hy, C * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 200, 255, 0.9)';
      ctx.fill();
      ctx.restore();
    }

    // 胜利连线
    if (this.winLine) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 50, 50, 0.95)';
      ctx.lineWidth = C * 0.19;
      ctx.lineCap = 'round';
      ctx.shadowColor = 'rgba(255, 50, 50, 0.8)';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      const first = this.winLine[0];
      const last = this.winLine[this.winLine.length - 1];
      ctx.moveTo(P + first[1] * C, P + first[0] * C);
      ctx.lineTo(P + last[1] * C, P + last[0] * C);
      ctx.stroke();
      ctx.restore();
    }

    // 最后一手标记
    if (this.lastStone && !this.winLine) {
      const [lr, lc] = this.lastStone;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 60, 60, 1)';
      ctx.lineWidth = C * 0.09;
      ctx.beginPath();
      ctx.arc(P + lc * C, P + lr * C, SR + C * 0.15, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  },

  // ====== 绘制棋子 ======
  drawStone(r, c, player) {
    const ctx = this.ctx;
    const P = this.pad;
    const C = this.cell;
    const SR = this.stoneR;
    const x = P + c * C;
    const y = P + r * C;

    // 阴影
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + C * 0.06, y + C * 0.06, SR + C * 0.03, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fill();
    ctx.restore();

    // 棋子
    ctx.beginPath();
    ctx.arc(x, y, SR, 0, Math.PI * 2);
    if (player === 1) {
      const g = ctx.createRadialGradient(x - C * 0.16, y - C * 0.16, C * 0.06, x, y, SR);
      g.addColorStop(0, '#555');
      g.addColorStop(0.5, '#1a1a1a');
      g.addColorStop(1, '#000000');
      ctx.fillStyle = g;
    } else {
      const g = ctx.createRadialGradient(x - C * 0.19, y - C * 0.19, C * 0.09, x, y, SR);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.6, '#f5f5f5');
      g.addColorStop(1, '#d0d0d0');
      ctx.fillStyle = g;
    }
    ctx.fill();

    // 边缘
    ctx.strokeStyle = player === 1 ? 'rgba(0,0,0,0.8)' : 'rgba(120,120,120,0.6)';
    ctx.lineWidth = C * 0.03;
    ctx.stroke();
  },

  // ====== 触摸事件 ======
  onCanvasTap(e) {
    if (this.gameOver || this.aiBusy) return;
    if (this.data.mode !== 'pvp' && this.data.currentPlayer === this.aiPlayer) return;
    // 点击后隐藏提示
    if (this.data.hintVisible) {
      this.setData({ hintVisible: false });
      this.hintPos = null;
    }

    if (!e.touches || e.touches.length === 0) return;
    const touch = e.touches[0];

    const query = wx.createSelectorQuery();
    query.select('#boardCanvas').boundingClientRect();
    query.exec((res) => {
      if (res && res[0]) {
        const rect = res[0];
        const x = touch.x - rect.left;
        const y = touch.y - rect.top;
        const scaleX = this.canvasLogicWidth / rect.width;
        const scaleY = this.canvasLogicHeight / rect.height;
        const logicX = x * scaleX;
        const logicY = y * scaleY;

        const P = this.pad;
        const C = this.cell;
        const col = Math.round((logicX - P) / C);
        const row = Math.round((logicY - P) / C);

        const distX = Math.abs(logicX - (P + col * C));
        const distY = Math.abs(logicY - (P + row * C));

        if (row >= 0 && row < SIZE && col >= 0 && col < SIZE
            && this.board[row][col] === 0
            && distX < C * 0.45 && distY < C * 0.45) {
          this.playSound('place');
          this.makeMove(row, col, this.data.currentPlayer);

          if (!this.gameOver && this.data.mode !== 'pvp' && this.data.currentPlayer === this.aiPlayer) {
            this.triggerAI();
          }
        }
      }
    });
  },

  onCanvasMove() {},
  onCanvasLeave() {},

  // ====== 落子与胜负判定 ======
  makeMove(r, c, player) {
    this.board[r][c] = player;
    this.moveHistory.push([r, c, player]);
    this.lastStone = [r, c];

    const win = this.checkWin(r, c, player);
    if (win) {
      this.gameOver = true;
      this.winLine = win;

      let resultType, overlayTitle, overlaySub, statusText;
      if (this.data.mode === 'pvp') {
        resultType = 'win';
        overlayTitle = player === 1 ? '🎉 黑棋获胜！' : '🎉 白棋获胜！';
        overlaySub = '精彩对局，棋逢对手！';
        statusText = overlayTitle;
      } else {
        const isHumanWin = (player === this.humanPlayer);
        resultType = isHumanWin ? 'win' : 'lose';
        overlayTitle = isHumanWin ? '🎉 恭喜你赢了！' : '😮 AI 获胜了！';
        overlaySub = isHumanWin ? '真是一步好棋！' : '再接再厉，下次一定行！';
        statusText = overlayTitle;
      }

      this.playSound(resultType);

      this.setData({
        showOverlay: true,
        overlayTitle,
        overlaySub,
        celebrate: resultType === 'win',
        statusText,
        gameOver: true,
        moveCount: this.moveHistory.length
      });

      this.updateStats(resultType);
      this.draw();
      return;
    }

    if (this.moveHistory.length === SIZE * SIZE) {
      this.gameOver = true;
      this.playSound('draw');
      this.setData({
        showOverlay: true,
        overlayTitle: '🤝 平局！',
        overlaySub: '势均力敌，旗鼓相当！',
        statusText: '🤝 棋盘已满，平局！',
        moveCount: this.moveHistory.length
      });
      this.updateStats('draw');
      this.draw();
      return;
    }

    this.setData({ currentPlayer: this.data.currentPlayer === 1 ? 2 : 1 });
    this.updateUI();
    this.draw();
  },

  checkWin(r, c, player) {
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      const line = [[r, c]];
      for (let i = 1; i < 5; i++) {
        const nr = r + dr * i, nc = c + dc * i;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && this.board[nr][nc] === player) {
          line.push([nr, nc]);
        } else break;
      }
      for (let i = 1; i < 5; i++) {
        const nr = r - dr * i, nc = c - dc * i;
        if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && this.board[nr][nc] === player) {
          line.unshift([nr, nc]);
        } else break;
      }
      if (line.length >= 5) return line.slice(0, 5);
    }
    return null;
  },

  updateUI() {
    let turnText = '';
    if (this.data.mode === 'pvp') {
      turnText = this.data.currentPlayer === 1 ? '黑棋回合' : '白棋回合';
    } else {
      if (this.data.currentPlayer === this.humanPlayer) {
        turnText = '你的回合 · 执黑落子';
      } else {
        turnText = 'AI 思考中 · 执白落子';
      }
    }
    this.setData({
      turnText,
      moveCount: this.moveHistory.length
    });
  },

  // ====== AI触发 ======
  triggerAI() {
    this.aiBusy = true;
    this.setData({ aiThinking: true });
    this.updateUI();

    setTimeout(() => {
      let move;
      if (this.data.mode === 'ai-easy') move = this.aiEasyMove();
      else if (this.data.mode === 'ai-medium') move = this.aiMediumMove();
      else if (this.data.mode === 'ai-hard') move = this.aiHardMove();

      this.aiBusy = false;
      this.setData({ aiThinking: false });

      if (move) {
        this.playSound('place');
        this.makeMove(move[0], move[1], this.aiPlayer);
      }
    }, 300);
  },

  // ==================== AI算法 ====================
  aiEasyMove() {
    const winMove = this.findWinningMove(this.aiPlayer);
    if (winMove) return winMove;
    if (Math.random() < 0.7) {
      const blockMove = this.findWinningMove(this.humanPlayer);
      if (blockMove) return blockMove;
    }
    const candidates = this.getCandidates(1);
    if (candidates.length > 0) {
      return candidates[Math.floor(Math.random() * candidates.length)];
    }
    return [9, 9];
  },

  aiMediumMove() {
    const winMove = this.findWinningMove(this.aiPlayer);
    if (winMove) return winMove;
    const blockMove = this.findWinningMove(this.humanPlayer);
    if (blockMove) return blockMove;
    const candidates = this.getCandidates(2);
    if (candidates.length === 0) return [9, 9];
    let bestScore = -Infinity;
    let bestMoves = [];
    for (const [r, c] of candidates) {
      const score = this.evaluatePoint(r, c, this.aiPlayer) * 1.1 + this.evaluatePoint(r, c, this.humanPlayer);
      if (score > bestScore) {
        bestScore = score;
        bestMoves = [[r, c]];
      } else if (score === bestScore) {
        bestMoves.push([r, c]);
      }
    }
    return bestMoves[Math.floor(Math.random() * bestMoves.length)];
  },

  aiHardMove() {
    const winMove = this.findWinningMove(this.aiPlayer);
    if (winMove) return winMove;
    const blockMove = this.findWinningMove(this.humanPlayer);
    if (blockMove) return blockMove;
    if (this.moveHistory.length <= 1) {
      if (this.board[9][9] === 0) return [9, 9];
      const offsets = [[-1,-1],[-1,1],[1,-1],[1,1],[0,-1],[0,1],[-1,0],[1,0]];
      const off = offsets[Math.floor(Math.random() * offsets.length)];
      return [9 + off[0], 9 + off[1]];
    }
    const depth = this.getSearchDepth();
    const candidates = this.getCandidates(2);
    if (candidates.length === 0) return [9, 9];
    const scored = candidates.map(([r, c]) => ({
      move: [r, c],
      score: this.evaluatePoint(r, c, this.aiPlayer) + this.evaluatePoint(r, c, this.humanPlayer)
    }));
    scored.sort((a, b) => b.score - a.score);
    const topMoves = scored.slice(0, Math.min(12, scored.length)).map(s => s.move);
    let bestScore = -Infinity;
    let bestMove = topMoves[0];
    for (const [r, c] of topMoves) {
      this.board[r][c] = this.aiPlayer;
      const score = this.minimax(depth - 1, false, -Infinity, Infinity);
      this.board[r][c] = 0;
      if (score > bestScore) {
        bestScore = score;
        bestMove = [r, c];
      }
    }
    return bestMove;
  },

  getSearchDepth() {
    const moves = this.moveHistory.length;
    if (moves < 10) return 4;
    if (moves < 20) return 3;
    return 2;
  },

  minimax(depth, isMaximizing, alpha, beta) {
    if (depth === 0) return this.evaluateBoard();
    const candidates = this.getCandidates(1);
    if (candidates.length === 0) return this.evaluateBoard();
    const scored = candidates.map(([r, c]) => ({
      move: [r, c],
      score: this.evaluatePoint(r, c, isMaximizing ? this.aiPlayer : this.humanPlayer)
             + this.evaluatePoint(r, c, isMaximizing ? this.humanPlayer : this.aiPlayer)
    }));
    scored.sort((a, b) => b.score - a.score);
    const top = scored.slice(0, Math.min(8, scored.length)).map(s => s.move);
    if (isMaximizing) {
      let maxEval = -Infinity;
      for (const [r, c] of top) {
        this.board[r][c] = this.aiPlayer;
        const win = this.checkWin(r, c, this.aiPlayer);
        if (win) { this.board[r][c] = 0; return 100000 + depth; }
        const evalScore = this.minimax(depth - 1, false, alpha, beta);
        this.board[r][c] = 0;
        maxEval = Math.max(maxEval, evalScore);
        alpha = Math.max(alpha, evalScore);
        if (beta <= alpha) break;
      }
      return maxEval;
    } else {
      let minEval = Infinity;
      for (const [r, c] of top) {
        this.board[r][c] = this.humanPlayer;
        const win = this.checkWin(r, c, this.humanPlayer);
        if (win) { this.board[r][c] = 0; return -100000 - depth; }
        const evalScore = this.minimax(depth - 1, true, alpha, beta);
        this.board[r][c] = 0;
        minEval = Math.min(minEval, evalScore);
        beta = Math.min(beta, evalScore);
        if (beta <= alpha) break;
      }
      return minEval;
    }
  },

  getCandidates(range) {
    const set = new Set();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (this.board[r][c] !== 0) {
          for (let dr = -range; dr <= range; dr++) {
            for (let dc = -range; dc <= range; dc++) {
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < SIZE && nc >= 0 && nc < SIZE && this.board[nr][nc] === 0) {
                set.add(nr * SIZE + nc);
              }
            }
          }
        }
      }
    }
    if (set.size === 0) return [[9, 9]];
    return Array.from(set).map(v => [Math.floor(v / SIZE), v % SIZE]);
  },

  findWinningMove(player) {
    const candidates = this.getCandidates(1);
    for (const [r, c] of candidates) {
      this.board[r][c] = player;
      const win = this.checkWin(r, c, player);
      this.board[r][c] = 0;
      if (win) return [r, c];
    }
    return null;
  },

  evaluatePoint(r, c, player) {
    if (this.board[r][c] !== 0) return 0;
    this.board[r][c] = player;
    let totalScore = 0;
    const dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      totalScore += this.evaluateLine(r, c, dr, dc, player);
    }
    this.board[r][c] = 0;
    return totalScore;
  },

  evaluateLine(r, c, dr, dc, player) {
    let count = 1;
    let openEnds = 0;
    let i = 1;
    while (true) {
      const nr = r + dr * i, nc = c + dc * i;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      if (this.board[nr][nc] === player) { count++; i++; }
      else if (this.board[nr][nc] === 0) { openEnds++; break; }
      else break;
    }
    i = 1;
    while (true) {
      const nr = r - dr * i, nc = c - dc * i;
      if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE) break;
      if (this.board[nr][nc] === player) { count++; i++; }
      else if (this.board[nr][nc] === 0) { openEnds++; break; }
      else break;
    }
    return this.scoreShape(count, openEnds);
  },

  scoreShape(count, openEnds) {
    if (count >= 5) return 100000;
    if (count === 4) {
      if (openEnds >= 2) return 10000;
      if (openEnds === 1) return 1000;
      return 0;
    }
    if (count === 3) {
      if (openEnds >= 2) return 1000;
      if (openEnds === 1) return 100;
      return 0;
    }
    if (count === 2) {
      if (openEnds >= 2) return 100;
      if (openEnds === 1) return 10;
      return 0;
    }
    if (count === 1) {
      if (openEnds >= 2) return 10;
      if (openEnds === 1) return 1;
      return 0;
    }
    return 0;
  },

  evaluateBoard() {
    let aiScore = 0, humanScore = 0;
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (this.board[r][c] === this.aiPlayer) {
          for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
            aiScore += this.evaluateLine(r, c, dr, dc, this.aiPlayer);
          }
        } else if (this.board[r][c] === this.humanPlayer) {
          for (const [dr, dc] of [[0,1],[1,0],[1,1],[1,-1]]) {
            humanScore += this.evaluateLine(r, c, dr, dc, this.humanPlayer);
          }
        }
      }
    }
    return aiScore - humanScore * 1.1;
  },

  // ====== UI交互 ======

  // 模式切换
  onModeChange(e) {
    const index = e.detail.value;
    this.setData({
      modeIndex: index,
      mode: this.data.modeOptions[index].value
    });
    this.initBoard();
  },

  // 悔棋
  onUndo() {
    if (this.moveHistory.length === 0 || this.gameOver || this.aiBusy) return;
    this.playSound('undo');

    if (this.data.mode !== 'pvp') {
      if (this.moveHistory.length >= 2 && this.data.currentPlayer === this.humanPlayer) {
        for (let i = 0; i < 2; i++) {
          const [r, c] = this.moveHistory.pop();
          this.board[r][c] = 0;
        }
      } else {
        const [r, c] = this.moveHistory.pop();
        this.board[r][c] = 0;
      }
      this.setData({ currentPlayer: this.humanPlayer });
      this.lastStone = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1].slice(0, 2) : null;
    } else {
      const [r, c] = this.moveHistory.pop();
      this.board[r][c] = 0;
      this.setData({ currentPlayer: this.data.currentPlayer === 1 ? 2 : 1 });
      this.lastStone = this.moveHistory.length > 0 ? this.moveHistory[this.moveHistory.length - 1].slice(0, 2) : null;
    }

    // 隐藏提示
    this.setData({ hintVisible: false });
    this.hintPos = null;

    this.updateUI();
    this.draw();
  },

  // 音效开关
  onToggleSound() {
    this.setData({ soundOn: !this.data.soundOn });
  },

  // ====== 棋谱功能 ======
  onShowRecord() {
    const list = this.buildRecordList();
    this.setData({
      showRecord: true,
      recordList: list
    });
  },

  onHideRecord() {
    this.setData({ showRecord: false });
  },

  // 导出棋谱文本
  onExportRecord() {
    const list = this.buildRecordList();
    if (list.length === 0) {
      wx.showToast({ title: '棋谱为空', icon: 'none' });
      return;
    }
    let text = '天天玩*五子棋 棋谱\n';
    text += '模式：' + this.data.modeOptions[this.data.modeIndex].label + '\n';
    text += '时间：' + this.formatTime(new Date()) + '\n\n';
    for (const item of list) {
      text += item.num + '. ' + item.player + ' ' + item.pos + '\n';
    }
    text += '\n结果：' + (this.data.statusText || '进行中');

    wx.setClipboardData({
      data: text,
      success: () => {
        wx.showToast({ title: '棋谱已复制到剪贴板', icon: 'success' });
      }
    });
  },

  formatTime(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const d = date.getDate().toString().padStart(2, '0');
    const h = date.getHours().toString().padStart(2, '0');
    const min = date.getMinutes().toString().padStart(2, '0');
    return y + '-' + m + '-' + d + ' ' + h + ':' + min;
  },

  // ====== 对局统计 ======
  onShowStats() {
    this.setData({ showStats: true });
  },

  onHideStats() {
    this.setData({ showStats: false });
  },

  onClearStats() {
    wx.showModal({
      title: '确认清除',
      content: '确定要清除所有对局统计数据吗？',
      confirmColor: '#e8c170',
      success: (res) => {
        if (res.confirm) {
          this.setData({ stats: { wins: 0, losses: 0, draws: 0, total: 0 } });
          this.saveStats();
          wx.showToast({ title: '统计已清除', icon: 'success' });
        }
      }
    });
  },

  // ====== AI提示 ======
  onHint() {
    if (this.gameOver || this.aiBusy) return;
    if (this.data.mode === 'pvp') {
      wx.showToast({ title: '双人对战无提示', icon: 'none' });
      return;
    }
    if (this.data.currentPlayer !== this.humanPlayer) return;

    // 用中级AI算法找一个推荐位置
    const winMove = this.findWinningMove(this.humanPlayer);
    if (winMove) {
      this.hintPos = winMove;
    } else {
      const blockMove = this.findWinningMove(this.aiPlayer);
      if (blockMove) {
        this.hintPos = blockMove;
      } else {
        const candidates = this.getCandidates(2);
        if (candidates.length === 0) {
          wx.showToast({ title: '无法提供提示', icon: 'none' });
          return;
        }
        let bestScore = -Infinity;
        let bestPos = candidates[0];
        for (const [r, c] of candidates) {
          const score = this.evaluatePoint(r, c, this.humanPlayer) * 1.1 + this.evaluatePoint(r, c, this.aiPlayer);
          if (score > bestScore) {
            bestScore = score;
            bestPos = [r, c];
          }
        }
        this.hintPos = bestPos;
      }
    }

    this.setData({ hintVisible: true });
    this.draw();
  },

  // ====== 分享功能 ======
  onShareAppMessage() {
    return {
      title: '天天玩*五子棋 - 挑战AI',
      path: '/pages/index/index',
      imageUrl: '/images/cover.jpg'
    };
  },

  onShareTimeline() {
    return {
      title: '天天玩*五子棋 - 挑战AI',
      imageUrl: '/images/cover.jpg'
    };
  }
});
