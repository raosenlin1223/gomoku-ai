"""
五子棋 AI 逻辑测试
覆盖：
1. 胜利判定（四方向、边界）
2. AI 低级模式（能赢就赢、能堵就堵）
3. AI 中级模式（启发式评估、选最优）
4. AI 高级模式（Minimax + Alpha-Beta，不会漏堵）
5. 完整对弈流程（AI vs AI 模拟）
6. 性能测试（高级模式响应时间）
"""
import sys, io, time, copy, random
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

SIZE = 19
HUMAN = 1  # 黑
AI = 2     # 白

passed = 0
failed = 0

def test(desc, cond):
    global passed, failed
    if cond:
        passed += 1
        print(f"  ✅ {desc}")
    else:
        failed += 1
        print(f"  ❌ {desc}")

def new_board():
    return [[0]*SIZE for _ in range(SIZE)]

# ==================== 胜利判定 ====================
def check_win(board, r, c, player):
    dirs = [(0,1),(1,0),(1,1),(1,-1)]
    for dr, dc in dirs:
        line = [(r, c)]
        for i in range(1, 5):
            nr, nc = r+dr*i, c+dc*i
            if 0<=nr<SIZE and 0<=nc<SIZE and board[nr][nc]==player:
                line.append((nr, nc))
            else:
                break
        for i in range(1, 5):
            nr, nc = r-dr*i, c-dc*i
            if 0<=nr<SIZE and 0<=nc<SIZE and board[nr][nc]==player:
                line.insert(0, (nr, nc))
            else:
                break
        if len(line) >= 5:
            return line[:5]
    return None

# ==================== 棋型评估 ====================
def score_shape(count, open_ends, blocks):
    if count >= 5: return 100000
    if count == 4:
        if open_ends >= 2: return 10000
        if open_ends == 1: return 1000
        return 0
    if count == 3:
        if open_ends >= 2: return 1000
        if open_ends == 1: return 100
        return 0
    if count == 2:
        if open_ends >= 2: return 100
        if open_ends == 1: return 10
        return 0
    if count == 1:
        if open_ends >= 2: return 10
        if open_ends == 1: return 1
        return 0
    return 0

def evaluate_line(board, r, c, dr, dc, player):
    count = 1
    blocks = 0
    open_ends = 0
    i = 1
    while True:
        nr, nc = r+dr*i, c+dc*i
        if nr<0 or nr>=SIZE or nc<0 or nc>=SIZE:
            blocks += 1; break
        if board[nr][nc] == player: count += 1; i += 1
        elif board[nr][nc] == 0: open_ends += 1; break
        else: blocks += 1; break
    i = 1
    while True:
        nr, nc = r-dr*i, c-dc*i
        if nr<0 or nr>=SIZE or nc<0 or nc>=SIZE:
            blocks += 1; break
        if board[nr][nc] == player: count += 1; i += 1
        elif board[nr][nc] == 0: open_ends += 1; break
        else: blocks += 1; break
    return score_shape(count, open_ends, blocks)

def evaluate_point(board, r, c, player):
    if board[r][c] != 0: return 0
    board[r][c] = player
    total = 0
    for dr, dc in [(0,1),(1,0),(1,1),(1,-1)]:
        total += evaluate_line(board, r, c, dr, dc, player)
    board[r][c] = 0
    return total

# ==================== 候选位置 ====================
def get_candidates(board, rng=2):
    s = set()
    for r in range(SIZE):
        for c in range(SIZE):
            if board[r][c] != 0:
                for dr in range(-rng, rng+1):
                    for dc in range(-rng, rng+1):
                        nr, nc = r+dr, c+dc
                        if 0<=nr<SIZE and 0<=nc<SIZE and board[nr][nc]==0:
                            s.add(nr*SIZE+nc)
    if not s: return [(9, 9)]
    return [(v//SIZE, v%SIZE) for v in s]

def find_winning_move(board, player):
    for r, c in get_candidates(board, 1):
        board[r][c] = player
        win = check_win(board, r, c, player)
        board[r][c] = 0
        if win:
            return (r, c)
    return None

# ==================== AI 低级 ====================
def ai_easy(board):
    # 能赢就赢
    m = find_winning_move(board, AI)
    if m: return m
    # 70% 堵
    if random.random() < 0.7:
        m = find_winning_move(board, HUMAN)
        if m: return m
    # 50% 堵活三
    if random.random() < 0.5:
        m = find_winning_move(board, HUMAN)  # 简化
        if m: return m
    cands = get_candidates(board, 1)
    return random.choice(cands) if cands else (9, 9)

# ==================== AI 中级 ====================
def ai_medium(board):
    m = find_winning_move(board, AI)
    if m: return m
    m = find_winning_move(board, HUMAN)
    if m: return m
    cands = get_candidates(board, 2)
    if not cands: return (9, 9)
    best_score = -float('inf')
    best_moves = []
    for r, c in cands:
        s = evaluate_point(board, r, c, AI) * 1.1 + evaluate_point(board, r, c, HUMAN)
        if s > best_score:
            best_score = s
            best_moves = [(r, c)]
        elif s == best_score:
            best_moves.append((r, c))
    return random.choice(best_moves)

# ==================== AI 高级 (Minimax) ====================
def evaluate_board(board):
    ai_s = 0
    hu_s = 0
    for r in range(SIZE):
        for c in range(SIZE):
            if board[r][c] == AI:
                for dr, dc in [(0,1),(1,0),(1,1),(1,-1)]:
                    ai_s += evaluate_line(board, r, c, dr, dc, AI)
            elif board[r][c] == HUMAN:
                for dr, dc in [(0,1),(1,0),(1,1),(1,-1)]:
                    hu_s += evaluate_line(board, r, c, dr, dc, HUMAN)
    return ai_s - hu_s * 1.1

def minimax(board, depth, is_max, alpha, beta, move_count):
    if depth == 0:
        return evaluate_board(board)
    cands = get_candidates(board, 1)
    if not cands: return evaluate_board(board)
    scored = []
    player = AI if is_max else HUMAN
    opp = HUMAN if is_max else AI
    for r, c in cands:
        s = evaluate_point(board, r, c, player) + evaluate_point(board, r, c, opp)
        scored.append(((r, c), s))
    scored.sort(key=lambda x: -x[1])
    top = [m for m, _ in scored[:8]]
    if is_max:
        max_eval = -float('inf')
        for r, c in top:
            board[r][c] = AI
            win = check_win(board, r, c, AI)
            if win:
                board[r][c] = 0
                return 100000 + depth
            ev = minimax(board, depth-1, False, alpha, beta, move_count+1)
            board[r][c] = 0
            max_eval = max(max_eval, ev)
            alpha = max(alpha, ev)
            if beta <= alpha: break
        return max_eval
    else:
        min_eval = float('inf')
        for r, c in top:
            board[r][c] = HUMAN
            win = check_win(board, r, c, HUMAN)
            if win:
                board[r][c] = 0
                return -100000 - depth
            ev = minimax(board, depth-1, True, alpha, beta, move_count+1)
            board[r][c] = 0
            min_eval = min(min_eval, ev)
            beta = min(beta, ev)
            if beta <= alpha: break
        return min_eval

def ai_hard(board, move_count):
    m = find_winning_move(board, AI)
    if m: return m
    m = find_winning_move(board, HUMAN)
    if m: return m
    if move_count <= 1:
        if board[9][9] == 0: return (9, 9)
        return (8, 8)
    depth = 4 if move_count < 10 else (3 if move_count < 20 else 2)
    cands = get_candidates(board, 2)
    if not cands: return (9, 9)
    scored = []
    for r, c in cands:
        s = evaluate_point(board, r, c, AI) + evaluate_point(board, r, c, HUMAN)
        scored.append(((r, c), s))
    scored.sort(key=lambda x: -x[1])
    top = [m for m, _ in scored[:12]]
    best_score = -float('inf')
    best_move = top[0]
    for r, c in top:
        board[r][c] = AI
        score = minimax(board, depth-1, False, -float('inf'), float('inf'), move_count+1)
        board[r][c] = 0
        if score > best_score:
            best_score = score
            best_move = (r, c)
    return best_move

# ==================== 测试用例 ====================
print("=" * 60)
print("五子棋 AI 逻辑测试")
print("=" * 60)

# --- 1. 胜利判定 ---
print("\n--- 1. 胜利判定 ---")

# 水平五连
b = new_board()
for i in range(5): b[9][9+i] = 1
test("水平五连判定黑棋胜", check_win(b, 9, 9, 1) is not None)
test("水平五连返回5个点", len(check_win(b, 9, 9, 1)) == 5)

# 垂直五连
b = new_board()
for i in range(5): b[5+i][10] = 2
test("垂直五连判定白棋胜", check_win(b, 5, 10, 2) is not None)

# 正对角线五连
b = new_board()
for i in range(5): b[3+i][3+i] = 1
test("正对角线五连判定黑棋胜", check_win(b, 3, 3, 1) is not None)

# 反对角线五连
b = new_board()
for i in range(5): b[3+i][15-i] = 2
test("反对角线五连判定白棋胜", check_win(b, 3, 15, 2) is not None)

# 四连不赢
b = new_board()
for i in range(4): b[9][9+i] = 1
test("四连不应判定胜利", check_win(b, 9, 9, 1) is None)

# 边界
b = new_board()
for i in range(5): b[0][i] = 1
test("边界水平五连判定胜利", check_win(b, 0, 0, 1) is not None)

b = new_board()
for i in range(5): b[18-i][18] = 2
test("边界垂直五连判定胜利", check_win(b, 18, 18, 2) is not None)

# --- 2. AI 低级模式 ---
print("\n--- 2. AI 低级模式 ---")

# 能赢就赢（四连两端均可）
b = new_board()
for i in range(4): b[9][9+i] = AI
move = ai_easy(b)
test("低级AI: 能赢就赢（落子在第5位）", move in [(9, 8), (9, 13)])

# 能堵就堵（70%概率，测多次确保至少一次）
b = new_board()
for i in range(4): b[5][5+i] = HUMAN
blocked = False
for _ in range(20):
    m = ai_easy(b)
    if m in [(5, 4), (5, 9)]:
        blocked = True; break
test("低级AI: 70%概率堵对手四连", blocked)

# --- 3. AI 中级模式 ---
print("\n--- 3. AI 中级模式 ---")

# 能赢就赢（四连两端均可）
b = new_board()
for i in range(4): b[10][10+i] = AI
move = ai_medium(b)
test("中级AI: 能赢就赢", move in [(10, 9), (10, 14)])

# 能堵就堵（四连两端均可）
b = new_board()
for i in range(4): b[7][7+i] = HUMAN
move = ai_medium(b)
test("中级AI: 100%堵对手四连", move in [(7, 6), (7, 11)])

# 优先选择高分位置
b = new_board()
b[9][9] = HUMAN
b[9][10] = AI
b[10][10] = HUMAN
move = ai_medium(b)
test("中级AI: 在有棋子附近落子", 7 <= move[0] <= 12 and 7 <= move[1] <= 12)

# --- 4. AI 高级模式 ---
print("\n--- 4. AI 高级模式 ---")

# 能赢就赢（四连两端均可）
b = new_board()
for i in range(4): b[9][9+i] = AI
move = ai_hard(b, 5)
test("高级AI: 能赢就赢", move in [(9, 8), (9, 13)])

# 能堵就堵（四连两端均可）
b = new_board()
for i in range(4): b[6][6+i] = HUMAN
move = ai_hard(b, 5)
test("高级AI: 必堵对手四连", move in [(6, 5), (6, 10)])

# 堵活四（两端都空）
b = new_board()
b[9][7] = HUMAN; b[9][8] = HUMAN; b[9][9] = HUMAN; b[9][10] = HUMAN
b[9][6] = 0; b[9][11] = 0
move = ai_hard(b, 5)
test("高级AI: 堵活四（选一端）", move in [(9, 6), (9, 11)])

# 不漏堵双重威胁
b = new_board()
# 水平活三
b[10][8] = HUMAN; b[10][9] = HUMAN; b[10][10] = HUMAN
move = ai_hard(b, 4)
test("高级AI: 对活三有反应（落子附近）", abs(move[0]-10) <= 1 and 6 <= move[1] <= 12)

# --- 5. 完整对弈模拟 ---
print("\n--- 5. 完整对弈模拟 ---")

def play_game(ai_black_fn, ai_white_fn, max_moves=361):
    """模拟 AI vs AI 完整对局"""
    b = new_board()
    moves = 0
    for i in range(max_moves):
        player = 1 if i % 2 == 0 else 2
        if player == 1:
            move = ai_black_fn(b, i+1)
        else:
            move = ai_white_fn(b, i+1)
        if move is None:
            return "draw", i
        r, c = move
        if b[r][c] != 0:
            return "error_invalid_move", i
        b[r][c] = player
        win = check_win(b, r, c, player)
        if win:
            return ("black_win" if player == 1 else "white_win"), i+1
    return "draw", max_moves

# 中级 vs 低级
random.seed(42)
result, moves = play_game(
    lambda b, mc: ai_medium(b) if mc % 2 == 1 else None,
    lambda b, mc: ai_easy(b),
    max_moves=80
)
test("中级AI vs 低级AI: 对弈完成无异常", result in ("black_win", "white_win", "draw"))
print(f"    结果: {result}, 用时 {moves} 手")

# 高级 vs 低级
random.seed(123)
result2, moves2 = play_game(
    lambda b, mc: ai_hard(b, mc),
    lambda b, mc: ai_easy(b),
    max_moves=80
)
test("高级AI vs 低级AI: 对弈完成无异常", result2 in ("black_win", "white_win", "draw"))
print(f"    结果: {result2}, 用时 {moves2} 手")

# 高级 vs 中级
random.seed(999)
result3, moves3 = play_game(
    lambda b, mc: ai_hard(b, mc),
    lambda b, mc: ai_medium(b),
    max_moves=100
)
test("高级AI vs 中级AI: 对弈完成无异常", result3 in ("black_win", "white_win", "draw"))
print(f"    结果: {result3}, 用时 {moves3} 手")

# --- 6. 性能测试 ---
print("\n--- 6. 性能测试 ---")

b = new_board()
b[9][9] = HUMAN
b[9][10] = AI
b[10][10] = HUMAN
b[10][11] = AI
b[8][8] = HUMAN

t0 = time.time()
move = ai_hard(b, 6)
t1 = time.time()
elapsed = t1 - t0
test(f"高级AI 第6手响应时间 < 3秒 (实际 {elapsed:.2f}s)", elapsed < 3.0)
print(f"    落子: {move}, 耗时: {elapsed:.2f}s")

# 更多棋子
b2 = new_board()
moves_list = [(9,9),(8,8),(10,10),(7,7),(11,11),(9,10),(8,9),(10,9)]
for i, (r, c) in enumerate(moves_list):
    b2[r][c] = 1 if i % 2 == 0 else 2

t0 = time.time()
move2 = ai_hard(b2, 9)
t1 = time.time()
elapsed2 = t1 - t0
test(f"高级AI 第9手响应时间 < 5秒 (实际 {elapsed2:.2f}s)", elapsed2 < 5.0)
print(f"    落子: {move2}, 耗时: {elapsed2:.2f}s")

# --- 7. 防守关键测试 ---
print("\n--- 7. 防守关键测试 ---")

# 对手有活三，AI必须堵
b = new_board()
b[9][8] = HUMAN; b[9][9] = HUMAN; b[9][10] = HUMAN
b[9][7] = 0; b[9][11] = 0

# 中级
m = ai_medium(b)
test("中级AI: 堵活三（选一端）", m in [(9, 7), (9, 11)])

# 高级
m = ai_hard(b, 4)
test("高级AI: 堵活三（选一端）", m in [(9, 7), (9, 11)])

# 对手有冲四（一端被堵），AI必须堵另一端
b = new_board()
b[9][8] = HUMAN; b[9][9] = HUMAN; b[9][10] = HUMAN; b[9][11] = HUMAN
b[9][7] = AI  # 一端被堵
m = ai_medium(b)
test("中级AI: 堵冲四（唯一位）", m == (9, 12))

m = ai_hard(b, 5)
test("高级AI: 堵冲四（唯一位）", m == (9, 12))

# AI自己有活三，应该扩展为活四而非防守
b = new_board()
b[5][8] = AI; b[5][9] = AI; b[5][10] = AI
b[5][7] = 0; b[5][11] = 0
b[3][3] = HUMAN; b[3][4] = HUMAN  # 对手只有二连，威胁不大
m = ai_medium(b)
test("中级AI: 自己活三扩展为活四", m in [(5, 7), (5, 11)])

# --- 8. 随机落子合法性 ---
print("\n--- 8. 随机落子合法性 ---")
random.seed(777)
for _ in range(50):
    b = new_board()
    b[9][9] = HUMAN
    m = ai_easy(b)
    if not (0 <= m[0] < SIZE and 0 <= m[1] < SIZE and b[m[0]][m[1]] == 0):
        test("低级AI: 落子合法", False)
        break
else:
    test("低级AI: 50次随机落子全部合法", True)

random.seed(888)
for _ in range(50):
    b = new_board()
    b[9][9] = HUMAN
    b[9][10] = AI
    m = ai_medium(b)
    if not (0 <= m[0] < SIZE and 0 <= m[1] < SIZE and b[m[0]][m[1]] == 0):
        test("中级AI: 落子合法", False)
        break
else:
    test("中级AI: 50次落子全部合法", True)

# ==================== 汇总 ====================
print("\n" + "=" * 60)
print(f"测试结果: {passed} 通过, {failed} 失败, 共 {passed+failed} 项")
if failed == 0:
    print("🎉 全部通过！")
else:
    print(f"⚠️ 有 {failed} 项未通过，需要修复。")
print("=" * 60)
