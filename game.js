/* ================================================================
 * 五子棋 Gomoku
 * 棋盘：15x15 标准
 * 两种模式：人机 / 双人
 * 人机三种难度：初出茅庐 / 登堂入室 / 炉火纯青
 * 落子需二次确认：先显示虚影 → 再次点击同位置确认
 * 兼容：iOS Safari/Chrome、Android、Desktop
 * ================================================================ */
(function(){
  'use strict';

  /* ========== 常量 ========== */
  var BOARD_SIZE = 15;
  var EMPTY = 0, BLACK = 1, WHITE = 2;
  var STAR_POINTS = [
    [3,3],[3,11],[11,3],[11,11],[7,7],
    [3,7],[7,3],[11,7],[7,11]
  ];

  /* ========== 状态 ========== */
  var state = {
    board: null,          // 15x15 二维数组
    history: [],          // 历史记录 [{r,c,color}]
    currentColor: BLACK,  // 当前轮到谁
    mode: 'pve',          // pve / pvp
    difficulty: 'easy',   // easy / medium / hard
    playerOrder: 'first', // first / second  (人机模式下玩家是否先手)
    playerColor: BLACK,   // 玩家执子颜色
    aiColor: WHITE,
    preview: null,        // 预览位置 {r,c}
    gameOver: false,
    aiThinking: false,
    started: false
  };

  /* ========== 绘制 ========== */
  var canvas, ctx;
  var cellSize = 0, padding = 0, displaySize = 0;
  var dpr = 1;

  function initCanvas(){
    canvas = document.getElementById('board');
    ctx = canvas.getContext('2d');
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    // iOS Safari 旋转/地址栏变化
    window.addEventListener('orientationchange', function(){
      setTimeout(resizeCanvas, 200);
    });
  }

  function resizeCanvas(){
    var wrap = canvas.parentElement;
    var size = Math.min(wrap.clientWidth, wrap.clientHeight);
    if (size <= 0) return;
    displaySize = size;
    dpr = window.devicePixelRatio || 1;
    // 限制 DPR 避免 iOS 内存问题
    if (dpr > 2) dpr = 2;
    canvas.width = Math.floor(size * dpr);
    canvas.height = Math.floor(size * dpr);
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    // 计算格子：棋盘留边 cellSize/2
    // 总格子数(线数)=15, 间隔数=14
    // size = padding*2 + cellSize*14
    // 取 padding = cellSize*0.7 左右使边缘美观
    cellSize = size / 15.4;
    padding = (size - cellSize * 14) / 2;
    draw();
  }

  function draw(){
    if (!ctx) return;
    var w = canvas.width;
    var h = canvas.height;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displaySize, displaySize);

    // 棋盘底色（木纹）
    var grad = ctx.createLinearGradient(0, 0, displaySize, displaySize);
    grad.addColorStop(0, '#f3d79a');
    grad.addColorStop(1, '#d9a760');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, displaySize, displaySize);

    // 绘制格线
    ctx.strokeStyle = 'rgba(74,44,26,0.75)';
    ctx.lineWidth = 1;
    for (var i = 0; i < BOARD_SIZE; i++){
      var pos = padding + i * cellSize;
      // 横线
      ctx.beginPath();
      ctx.moveTo(padding, pos);
      ctx.lineTo(padding + cellSize * 14, pos);
      ctx.stroke();
      // 竖线
      ctx.beginPath();
      ctx.moveTo(pos, padding);
      ctx.lineTo(pos, padding + cellSize * 14);
      ctx.stroke();
    }

    // 外框加粗
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(74,44,26,0.9)';
    ctx.strokeRect(padding, padding, cellSize * 14, cellSize * 14);

    // 星位
    ctx.fillStyle = 'rgba(74,44,26,0.85)';
    var starR = Math.max(3, cellSize * 0.12);
    var stars = [[3,3],[3,11],[11,3],[11,11],[7,7]];
    for (var s = 0; s < stars.length; s++){
      var sx = padding + stars[s][1] * cellSize;
      var sy = padding + stars[s][0] * cellSize;
      ctx.beginPath();
      ctx.arc(sx, sy, starR, 0, Math.PI * 2);
      ctx.fill();
    }

    // 绘制棋子
    for (var r = 0; r < BOARD_SIZE; r++){
      for (var c = 0; c < BOARD_SIZE; c++){
        var v = state.board[r][c];
        if (v !== EMPTY){
          drawStone(r, c, v, 1);
        }
      }
    }

    // 绘制最后一手标记
    if (state.history.length > 0){
      var last = state.history[state.history.length - 1];
      var lx = padding + last.c * cellSize;
      var ly = padding + last.r * cellSize;
      ctx.strokeStyle = last.color === BLACK ? '#ff3030' : '#ff3030';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(lx, ly, cellSize * 0.18, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 绘制预览
    if (state.preview){
      drawStone(state.preview.r, state.preview.c, state.currentColor, 0.45);
      // 虚线圈
      var px = padding + state.preview.c * cellSize;
      var py = padding + state.preview.r * cellSize;
      ctx.save();
      try { ctx.setLineDash([4, 3]); } catch(e){}
      ctx.strokeStyle = '#d9534f';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(px, py, cellSize * 0.48, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    ctx.restore();
  }

  function drawStone(r, c, color, alpha){
    var x = padding + c * cellSize;
    var y = padding + r * cellSize;
    var radius = cellSize * 0.43;
    ctx.save();
    ctx.globalAlpha = alpha;

    // 阴影
    ctx.beginPath();
    ctx.arc(x + 1.5, y + 1.5, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fill();

    // 主体
    var g;
    if (color === BLACK){
      g = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.15,
                                    x, y, radius);
      g.addColorStop(0, '#666');
      g.addColorStop(0.4, '#222');
      g.addColorStop(1, '#000');
    } else {
      g = ctx.createRadialGradient(x - radius*0.3, y - radius*0.3, radius*0.15,
                                    x, y, radius);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.7, '#e8e8e8');
      g.addColorStop(1, '#b8b8b8');
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();

    // 高光
    ctx.beginPath();
    ctx.arc(x - radius*0.35, y - radius*0.35, radius*0.25, 0, Math.PI * 2);
    ctx.fillStyle = color === BLACK ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.7)';
    ctx.fill();

    ctx.restore();
  }

  /* ========== 坐标转换 ========== */
  function getEventPos(e){
    var rect = canvas.getBoundingClientRect();
    var cx, cy;
    if (e.touches && e.touches.length > 0){
      cx = e.touches[0].clientX;
      cy = e.touches[0].clientY;
    } else if (e.changedTouches && e.changedTouches.length > 0){
      cx = e.changedTouches[0].clientX;
      cy = e.changedTouches[0].clientY;
    } else {
      cx = e.clientX;
      cy = e.clientY;
    }
    return { x: cx - rect.left, y: cy - rect.top };
  }

  function posToCell(x, y){
    var c = Math.round((x - padding) / cellSize);
    var r = Math.round((y - padding) / cellSize);
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return null;
    // 宽容度：点击距离交叉点需在半格以内
    var cx = padding + c * cellSize;
    var cy = padding + r * cellSize;
    var dist = Math.sqrt((x - cx) * (x - cx) + (y - cy) * (y - cy));
    if (dist > cellSize * 0.5) return null;
    return { r: r, c: c };
  }

  /* ========== 事件处理 ========== */
  function onBoardTap(e){
    e.preventDefault();
    if (state.gameOver || state.aiThinking || !state.started) return;

    // 人机模式下，只有玩家轮次才可点
    if (state.mode === 'pve' && state.currentColor !== state.playerColor) return;

    var pos = getEventPos(e);
    var cell = posToCell(pos.x, pos.y);
    if (!cell) return;
    if (state.board[cell.r][cell.c] !== EMPTY) return;

    // 预览/确认机制
    if (state.preview && state.preview.r === cell.r && state.preview.c === cell.c){
      // 确认落子
      var color = state.currentColor;
      state.preview = null;
      placeStone(cell.r, cell.c, color);
      draw();
      afterMove(cell.r, cell.c, color);
    } else {
      state.preview = { r: cell.r, c: cell.c };
      draw();
    }
  }

  /* ========== 落子/胜负 ========== */
  function placeStone(r, c, color){
    state.board[r][c] = color;
    state.history.push({ r: r, c: c, color: color });
  }

  function afterMove(r, c, color){
    if (checkWin(r, c, color)){
      state.gameOver = true;
      updateTurnIndicator();
      setTimeout(function(){ showResult(color); }, 150);
      return;
    }
    if (state.history.length >= BOARD_SIZE * BOARD_SIZE){
      state.gameOver = true;
      updateTurnIndicator();
      setTimeout(function(){ showResult(0); }, 150);
      return;
    }
    state.currentColor = color === BLACK ? WHITE : BLACK;
    updateTurnIndicator();

    // 如果是人机 & 现在轮到 AI
    if (!state.gameOver && state.mode === 'pve' && state.currentColor === state.aiColor){
      state.aiThinking = true;
      updateTurnIndicator();
      setTimeout(aiMove, 280); // 短延迟让用户看到
    }
  }

  function checkWin(r, c, color){
    var dirs = [[0,1],[1,0],[1,1],[1,-1]];
    for (var d = 0; d < 4; d++){
      var dr = dirs[d][0], dc = dirs[d][1];
      var count = 1;
      var i;
      for (i = 1; i < 5; i++){
        var nr = r + dr*i, nc = c + dc*i;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) break;
        if (state.board[nr][nc] !== color) break;
        count++;
      }
      for (i = 1; i < 5; i++){
        var nr2 = r - dr*i, nc2 = c - dc*i;
        if (nr2 < 0 || nr2 >= BOARD_SIZE || nc2 < 0 || nc2 >= BOARD_SIZE) break;
        if (state.board[nr2][nc2] !== color) break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  /* ========== AI ========== */
  /* 棋型打分表：针对某位置若落子，查其在四方向上的连子情况 */
  // 棋型：
  // 活五（连五）  100000
  // 活四（两端开）10000
  // 冲四（一端堵）1000
  // 活三          1000
  // 眠三          100
  // 活二          100
  // 眠二          10
  // 活一          10
  // 眠一          1
  var SCORES = {
    FIVE: 1000000,
    LIVE_FOUR: 100000,
    RUSH_FOUR: 10000,
    LIVE_THREE: 10000,
    SLEEP_THREE: 1000,
    LIVE_TWO: 1000,
    SLEEP_TWO: 100,
    LIVE_ONE: 100,
    SLEEP_ONE: 10
  };

  /* 获取一条线（含空位）上的棋型，返回分数
   * 方向 dr,dc，以(r,c)为中心向两边延伸各 4 位
   * 假设 (r,c) 已经是待评估的位置，假设其为 color
   */
  function evaluatePoint(board, r, c, color){
    var dirs = [[0,1],[1,0],[1,1],[1,-1]];
    var total = 0;
    var opponent = color === BLACK ? WHITE : BLACK;
    for (var d = 0; d < 4; d++){
      total += evaluateLine(board, r, c, dirs[d][0], dirs[d][1], color, opponent);
    }
    return total;
  }

  /* 沿一个方向抽取 9 格形成模式串，中心为 4 */
  function evaluateLine(board, r, c, dr, dc, color, opponent){
    // 构造长度 9 的字符串：c=己方，o=对手，_=空，x=越界
    var line = '';
    for (var i = -4; i <= 4; i++){
      var nr = r + dr * i;
      var nc = c + dc * i;
      if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE){
        line += 'x';
      } else if (i === 0){
        line += 'c'; // 假设这里是自己
      } else {
        var v = board[nr][nc];
        if (v === color) line += 'c';
        else if (v === opponent) line += 'o';
        else line += '_';
      }
    }
    return scoreLine(line);
  }

  /* 对一条 9 字符线进行打分
   * 这里用模式匹配，x 视作墙（与 o 等价于阻塞）
   */
  function scoreLine(line){
    // 将 x 视为 o（阻塞）
    var L = line.replace(/x/g, 'o');
    var best = 0;

    // 连五
    if (L.indexOf('ccccc') !== -1) return SCORES.FIVE;

    // 活四 _cccc_
    if (L.indexOf('_cccc_') !== -1) best = Math.max(best, SCORES.LIVE_FOUR);

    // 冲四 ocZcc_ 的各种 / _cccco / ccc_c / cc_cc / c_ccc
    if (/occcc_|_cccco|cccc[^c_]|[^c_]cccc/.test(L) ||
        L.indexOf('c_ccc') !== -1 || L.indexOf('ccc_c') !== -1 ||
        L.indexOf('cc_cc') !== -1){
      // 如果两端都是己方则忽略，这里仅启发式
      best = Math.max(best, SCORES.RUSH_FOUR);
    }

    // 活三 _ccc_ (两端均空，且扩展至少一端可成活四)
    if (/_ccc_/.test(L) || /_c_cc_/.test(L) || /_cc_c_/.test(L)){
      best = Math.max(best, SCORES.LIVE_THREE);
    }

    // 眠三
    if (/occc__|__ccco|oc_cc_|_cc_co|oc_cc|cc_co|occ_c_|_c_cco/.test(L)){
      best = Math.max(best, SCORES.SLEEP_THREE);
    }

    // 活二 _cc_ / _c_c_
    if (/__cc__|_c_c_|_cc__|__cc_/.test(L)){
      best = Math.max(best, SCORES.LIVE_TWO);
    }

    // 眠二
    if (/occ__|__cco|o_cc_|_cc_o/.test(L)){
      best = Math.max(best, SCORES.SLEEP_TWO);
    }

    // 活一
    if (/__c__/.test(L)){
      best = Math.max(best, SCORES.LIVE_ONE);
    }

    // 眠一
    if (/oc__|__co|o_c_|_c_o/.test(L)){
      best = Math.max(best, SCORES.SLEEP_ONE);
    }

    return best;
  }

  /* 候选点：只考虑已有棋子周围 2 格内的空位 */
  function getCandidates(board){
    var set = {};
    var cands = [];
    var hasAny = false;
    for (var r = 0; r < BOARD_SIZE; r++){
      for (var c = 0; c < BOARD_SIZE; c++){
        if (board[r][c] !== EMPTY){
          hasAny = true;
          for (var dr = -2; dr <= 2; dr++){
            for (var dc = -2; dc <= 2; dc++){
              var nr = r + dr, nc = c + dc;
              if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE) continue;
              if (board[nr][nc] !== EMPTY) continue;
              var key = nr * 100 + nc;
              if (!set[key]){
                set[key] = true;
                cands.push({ r: nr, c: nc });
              }
            }
          }
        }
      }
    }
    if (!hasAny){
      cands.push({ r: 7, c: 7 });
    }
    return cands;
  }

  /* 评估整局对 AI 的分数：遍历所有空位，对 AI 打分减去对 Player 打分 */
  function evaluateBoard(board, aiColor, playerColor){
    var aiScore = 0, plScore = 0;
    // 对每个非空位置评估它现有的连子价值
    // 简化方法：对每个 AI 棋子，在其 4 方向上打分
    // 这里采用“对所有可能落点评估并求和”的近似
    for (var r = 0; r < BOARD_SIZE; r++){
      for (var c = 0; c < BOARD_SIZE; c++){
        if (board[r][c] === aiColor){
          aiScore += evaluatePointExisting(board, r, c, aiColor);
        } else if (board[r][c] === playerColor){
          plScore += evaluatePointExisting(board, r, c, playerColor);
        }
      }
    }
    return aiScore - plScore;
  }

  function evaluatePointExisting(board, r, c, color){
    // 已存在棋子，评估其 4 方向的连子延展
    var opponent = color === BLACK ? WHITE : BLACK;
    var dirs = [[0,1],[1,0],[1,1],[1,-1]];
    var total = 0;
    for (var d = 0; d < 4; d++){
      var line = '';
      for (var i = -4; i <= 4; i++){
        var nr = r + dirs[d][0] * i;
        var nc = c + dirs[d][1] * i;
        if (nr < 0 || nr >= BOARD_SIZE || nc < 0 || nc >= BOARD_SIZE){
          line += 'x';
        } else {
          var v = board[nr][nc];
          if (v === color) line += 'c';
          else if (v === opponent) line += 'o';
          else line += '_';
        }
      }
      total += scoreLine(line);
    }
    // 每颗子被 4 次重复计算，除一下
    return total / 4;
  }

  /* ===== 难度：easy ===== */
  /* 对每个候选点评估"我下+对手下"的分数，取最大 */
  function aiMoveEasy(){
    var board = state.board;
    var aiColor = state.aiColor;
    var plColor = state.playerColor;
    var cands = getCandidates(board);
    var best = cands[0];
    var bestScore = -Infinity;

    // easy 只看自己能获得的分数，稍带一点防御
    for (var i = 0; i < cands.length; i++){
      var p = cands[i];
      var myS = evaluatePoint(board, p.r, p.c, aiColor);
      var oppS = evaluatePoint(board, p.r, p.c, plColor) * 0.8;
      var s = myS + oppS;
      // 随机扰动
      s += Math.random() * 20;
      if (s > bestScore){
        bestScore = s;
        best = p;
      }
    }
    return best;
  }

  /* ===== 难度：medium ===== */
  /* 更严谨的攻防分，优先封堵对方关键点 */
  function aiMoveMedium(){
    var board = state.board;
    var aiColor = state.aiColor;
    var plColor = state.playerColor;
    var cands = getCandidates(board);
    var best = cands[0];
    var bestScore = -Infinity;

    for (var i = 0; i < cands.length; i++){
      var p = cands[i];
      var myS = evaluatePoint(board, p.r, p.c, aiColor);
      var oppS = evaluatePoint(board, p.r, p.c, plColor);

      // 若对方在此处能成五，必堵
      if (oppS >= SCORES.FIVE) return p;
      // 若自己在此处能成五，必下
      if (myS >= SCORES.FIVE) return p;

      // 攻击权重 > 防御权重时更激进
      var s = myS * 1.1 + oppS * 1.0;
      s += Math.random() * 5;
      if (s > bestScore){
        bestScore = s;
        best = p;
      }
    }
    return best;
  }

  /* ===== 难度：hard ===== */
  /* 使用 Minimax + Alpha-Beta 剪枝，深度 2 */
  function aiMoveHard(){
    var board = state.board;
    var aiColor = state.aiColor;
    var plColor = state.playerColor;

    // 先做必胜/必堵检查，加速
    var cands = getCandidates(board);

    // 1. 自己能成五
    for (var i = 0; i < cands.length; i++){
      var p = cands[i];
      if (evaluatePoint(board, p.r, p.c, aiColor) >= SCORES.FIVE) return p;
    }
    // 2. 对方能成五，必堵
    for (var j = 0; j < cands.length; j++){
      var p2 = cands[j];
      if (evaluatePoint(board, p2.r, p2.c, plColor) >= SCORES.FIVE) return p2;
    }
    // 3. 自己能活四
    for (var k = 0; k < cands.length; k++){
      var p3 = cands[k];
      if (evaluatePoint(board, p3.r, p3.c, aiColor) >= SCORES.LIVE_FOUR) return p3;
    }
    // 4. 对方活四/冲四，必堵
    for (var l = 0; l < cands.length; l++){
      var p4 = cands[l];
      if (evaluatePoint(board, p4.r, p4.c, plColor) >= SCORES.LIVE_FOUR) return p4;
    }

    // 按初评排序候选
    var ranked = [];
    for (var m = 0; m < cands.length; m++){
      var p5 = cands[m];
      var s5 = evaluatePoint(board, p5.r, p5.c, aiColor) +
               evaluatePoint(board, p5.r, p5.c, plColor) * 0.9;
      ranked.push({ p: p5, s: s5 });
    }
    ranked.sort(function(a, b){ return b.s - a.s; });
    // 只取前 10 个，深度 2 搜索
    var topN = Math.min(10, ranked.length);

    var best = ranked[0].p;
    var bestVal = -Infinity;
    var alpha = -Infinity, beta = Infinity;

    for (var t = 0; t < topN; t++){
      var mv = ranked[t].p;
      board[mv.r][mv.c] = aiColor;
      var val = minimax(board, 1, false, alpha, beta, aiColor, plColor);
      board[mv.r][mv.c] = EMPTY;
      // 加一点候选本身的即时评分作为稳定项
      val += ranked[t].s * 0.1;
      if (val > bestVal){
        bestVal = val;
        best = mv;
      }
      if (val > alpha) alpha = val;
    }
    return best;
  }

  function minimax(board, depth, isMax, alpha, beta, aiColor, plColor){
    if (depth === 0){
      return evaluateBoard(board, aiColor, plColor);
    }
    var color = isMax ? aiColor : plColor;
    var cands = getCandidates(board);
    // 对候选排序 top 8
    var ranked = [];
    for (var i = 0; i < cands.length; i++){
      var p = cands[i];
      var s = evaluatePoint(board, p.r, p.c, aiColor) +
              evaluatePoint(board, p.r, p.c, plColor) * 0.9;
      ranked.push({ p: p, s: s });
    }
    ranked.sort(function(a, b){ return b.s - a.s; });
    var topN = Math.min(8, ranked.length);

    if (isMax){
      var best = -Infinity;
      for (var j = 0; j < topN; j++){
        var mv = ranked[j].p;
        board[mv.r][mv.c] = color;
        // 立即检查是否获胜（大幅剪枝）
        if (evaluatePoint(board, mv.r, mv.c, color) >= SCORES.FIVE){
          board[mv.r][mv.c] = EMPTY;
          return SCORES.FIVE;
        }
        var v = minimax(board, depth - 1, false, alpha, beta, aiColor, plColor);
        board[mv.r][mv.c] = EMPTY;
        if (v > best) best = v;
        if (v > alpha) alpha = v;
        if (beta <= alpha) break;
      }
      return best;
    } else {
      var worst = Infinity;
      for (var k = 0; k < topN; k++){
        var mv2 = ranked[k].p;
        board[mv2.r][mv2.c] = color;
        if (evaluatePoint(board, mv2.r, mv2.c, color) >= SCORES.FIVE){
          board[mv2.r][mv2.c] = EMPTY;
          return -SCORES.FIVE;
        }
        var v2 = minimax(board, depth - 1, true, alpha, beta, aiColor, plColor);
        board[mv2.r][mv2.c] = EMPTY;
        if (v2 < worst) worst = v2;
        if (v2 < beta) beta = v2;
        if (beta <= alpha) break;
      }
      return worst;
    }
  }

  function aiMove(){
    var mv;
    try {
      if (state.difficulty === 'easy') mv = aiMoveEasy();
      else if (state.difficulty === 'medium') mv = aiMoveMedium();
      else mv = aiMoveHard();
    } catch(err){
      console.error('AI error:', err);
      mv = aiMoveEasy();
    }

    if (!mv){
      state.aiThinking = false;
      updateTurnIndicator();
      return;
    }
    placeStone(mv.r, mv.c, state.aiColor);
    state.aiThinking = false;
    draw();
    afterMove(mv.r, mv.c, state.aiColor);
  }

  /* ========== UI 控制 ========== */
  function updateTurnIndicator(){
    var stone = document.getElementById('turnStone');
    var aL = document.getElementById('arrowLeft');
    var aR = document.getElementById('arrowRight');
    stone.className = 'turn-stone ' + (state.currentColor === BLACK ? 'black' : 'white');

    // 在人机模式下：左=玩家、右=电脑
    // 在双人模式下：左=黑、右=白
    var leftActive;
    if (state.mode === 'pve'){
      leftActive = state.currentColor === state.playerColor;
    } else {
      leftActive = state.currentColor === BLACK;
    }
    aL.style.display = leftActive ? 'inline' : 'none';
    aR.style.display = leftActive ? 'none' : 'inline';

    // 更新 avatar/name
    var lName = document.getElementById('leftName');
    var rName = document.getElementById('rightName');
    var lAv = document.getElementById('leftAvatar');
    var rAv = document.getElementById('rightAvatar');
    if (state.mode === 'pve'){
      lName.textContent = '玩家';
      lAv.textContent = '🙂';
      rName.textContent = difficultyName(state.difficulty);
      rAv.textContent = '🤖';
    } else {
      lName.textContent = '黑方';
      lAv.textContent = '⚫';
      rName.textContent = '白方';
      rAv.textContent = '⚪';
    }
  }

  function difficultyName(d){
    if (d === 'easy') return '初出茅庐';
    if (d === 'medium') return '登堂入室';
    return '炉火纯青';
  }

  function newGame(){
    state.board = [];
    for (var i = 0; i < BOARD_SIZE; i++){
      var row = [];
      for (var j = 0; j < BOARD_SIZE; j++) row.push(EMPTY);
      state.board.push(row);
    }
    state.history = [];
    state.currentColor = BLACK; // 黑先
    state.preview = null;
    state.gameOver = false;
    state.aiThinking = false;
    state.started = true;

    // 人机模式确定颜色
    if (state.mode === 'pve'){
      if (state.playerOrder === 'first'){
        state.playerColor = BLACK;
        state.aiColor = WHITE;
      } else {
        state.playerColor = WHITE;
        state.aiColor = BLACK;
      }
    }

    updateTurnIndicator();
    draw();

    // 若玩家后手，AI 先下
    if (state.mode === 'pve' && state.currentColor === state.aiColor){
      state.aiThinking = true;
      updateTurnIndicator();
      setTimeout(aiMove, 400);
    }
  }

  function undo(){
    if (state.gameOver){
      toast('游戏已结束，请点重玩');
      return;
    }
    if (state.aiThinking){
      toast('AI 思考中…');
      return;
    }
    if (state.history.length === 0){
      toast('还没有落子');
      return;
    }
    if (state.mode === 'pve'){
      // 至少撤回两步（AI + 玩家），回到玩家需要再下的状态
      // 如果最后一步是玩家下的，但 AI 还没动：撤回玩家那步即可
      var last = state.history[state.history.length - 1];
      if (last.color === state.aiColor){
        // AI 刚下过，撤 2 步
        popStone();
        if (state.history.length > 0) popStone();
        state.currentColor = state.playerColor;
      } else {
        // 最后一步是玩家
        popStone();
        state.currentColor = state.playerColor;
      }
    } else {
      popStone();
      state.currentColor = state.currentColor === BLACK ? WHITE : BLACK;
    }
    state.preview = null;
    state.gameOver = false;
    updateTurnIndicator();
    draw();
  }

  function popStone(){
    if (state.history.length === 0) return;
    var last = state.history.pop();
    state.board[last.r][last.c] = EMPTY;
  }

  function showResult(winnerColor){
    var overlay = document.getElementById('resultOverlay');
    var txt = document.getElementById('resultText');
    var sub = document.getElementById('resultSub');

    if (winnerColor === 0){
      txt.textContent = '平局';
      sub.textContent = '棋盘已满';
    } else if (state.mode === 'pve'){
      if (winnerColor === state.playerColor){
        txt.textContent = '🎉 你赢了！';
        sub.textContent = '击败了 ' + difficultyName(state.difficulty);
      } else {
        txt.textContent = '😥 你输了';
        sub.textContent = '再接再厉！';
      }
    } else {
      txt.textContent = winnerColor === BLACK ? '⚫ 黑方获胜' : '⚪ 白方获胜';
      sub.textContent = '';
    }
    overlay.classList.add('show');
  }

  function toast(msg){
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function(){ t.classList.remove('show'); }, 1500);
  }

  /* ========== 设置弹窗 ========== */
  function initSetupUI(){
    var overlay = document.getElementById('setupOverlay');
    var pveOptions = document.getElementById('pveOptions');

    // 模式切换
    var modeBtns = document.querySelectorAll('.mode-btn');
    for (var i = 0; i < modeBtns.length; i++){
      modeBtns[i].addEventListener('click', function(){
        for (var j = 0; j < modeBtns.length; j++){
          modeBtns[j].classList.remove('active');
        }
        this.classList.add('active');
        state.mode = this.getAttribute('data-mode');
        pveOptions.style.display = state.mode === 'pve' ? 'block' : 'none';
      });
    }

    // 难度选择
    var diffRows = document.querySelectorAll('[data-diff]');
    for (var a = 0; a < diffRows.length; a++){
      diffRows[a].addEventListener('click', function(){
        for (var b = 0; b < diffRows.length; b++){
          diffRows[b].classList.remove('selected');
        }
        this.classList.add('selected');
        state.difficulty = this.getAttribute('data-diff');
      });
    }

    // 先后手
    var orderRows = document.querySelectorAll('[data-order]');
    for (var x = 0; x < orderRows.length; x++){
      orderRows[x].addEventListener('click', function(){
        for (var y = 0; y < orderRows.length; y++){
          orderRows[y].classList.remove('selected');
        }
        this.classList.add('selected');
        state.playerOrder = this.getAttribute('data-order');
      });
    }

    // 开始
    document.getElementById('btnStart').addEventListener('click', function(){
      overlay.classList.remove('show');
      newGame();
    });

    // 关闭按钮（首次无法关闭）
    document.getElementById('setupClose').addEventListener('click', function(){
      if (state.started){
        overlay.classList.remove('show');
      } else {
        toast('请先开始游戏');
      }
    });
  }

  /* ========== 事件绑定 ========== */
  function bindEvents(){
    // 棋盘：iOS 推荐 touchend 处理避免双击缩放
    var handled = false;
    canvas.addEventListener('touchstart', function(e){
      handled = false;
    }, { passive: false });
    canvas.addEventListener('touchend', function(e){
      if (handled) return;
      handled = true;
      onBoardTap(e);
    }, { passive: false });
    canvas.addEventListener('mousedown', function(e){
      if (handled) return;
      onBoardTap(e);
    });
    // 防止移动端长按菜单
    canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });

    document.getElementById('btnUndo').addEventListener('click', undo);
    document.getElementById('btnRestart').addEventListener('click', function(){
      if (confirm('确定重新开始？')){
        newGame();
      }
    });
    document.getElementById('btnSettings').addEventListener('click', function(){
      document.getElementById('setupOverlay').classList.add('show');
    });
    document.getElementById('btnExit').addEventListener('click', function(){
      if (confirm('退出当前对局并返回设置？')){
        state.started = false;
        document.getElementById('setupOverlay').classList.add('show');
      }
    });

    document.getElementById('btnResultSettings').addEventListener('click', function(){
      document.getElementById('resultOverlay').classList.remove('show');
      document.getElementById('setupOverlay').classList.add('show');
    });
    document.getElementById('btnResultRestart').addEventListener('click', function(){
      document.getElementById('resultOverlay').classList.remove('show');
      newGame();
    });
  }

  /* ========== 启动 ========== */
  function init(){
    state.board = [];
    for (var i = 0; i < BOARD_SIZE; i++){
      var row = [];
      for (var j = 0; j < BOARD_SIZE; j++) row.push(EMPTY);
      state.board.push(row);
    }
    initCanvas();
    initSetupUI();
    bindEvents();
    // 首次显示设置
    document.getElementById('setupOverlay').classList.add('show');
  }

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 导出供测试
  window.__GOMOKU__ = {
    state: state,
    checkWin: checkWin,
    evaluatePoint: evaluatePoint,
    scoreLine: scoreLine,
    getCandidates: getCandidates,
    newGame: newGame
  };
})();
