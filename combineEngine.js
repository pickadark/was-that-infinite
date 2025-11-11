// combineEngine.js - 元素合成引擎

class CombineEngine {
  constructor(dependencies) {
    this.state = dependencies.state;
    this.seedMap = dependencies.seedMap;
    this.workspace = dependencies.workspace;
    this.dropzone = dependencies.dropzone;
    this.searchEl = dependencies.searchEl;

    // 外部函數依賴
    this.makeCard = dependencies.makeCard;
    this.generateName = dependencies.generateName;
    this.pickEmojiByName = dependencies.pickEmojiByName;
    this.safeParseJSON = dependencies.safeParseJSON;
    this.createEnergyRipple = dependencies.createEnergyRipple;
    this.spark = dependencies.spark;
    this.saveState = dependencies.saveState;
    this.renderBook = dependencies.renderBook;
    this.renderHistory = dependencies.renderHistory;
    this.renderCatalog = dependencies.renderCatalog;
    this.renderMissions = dependencies.renderMissions;
    this.audioPool = dependencies.audioPool;
    this.toast = dependencies.toast;
    this.regenMissions = dependencies.regenMissions;

    this.pending = [];
  }

  // 標準化配對鍵
  normPair(a, b) {
    return [a, b].sort().join('+');
  }

  // 生成 Token
  spawnToken(name, emoji, x, y) {
    const t = document.createElement('div');
    t.className = 'token';
    t.style.left = x + 'px';
    t.style.top = y + 'px';
    t.appendChild(this.makeCard(name, emoji));
    this.workspace.appendChild(t);
    return t;
  }

  // 合成邏輯
  combine(a, b, x, y) {
    // 清空所有 token
    document.querySelectorAll('.token').forEach(el => el.remove());

    // 確保 emoji 是陣列
    if (!Array.isArray(a.emoji)) a.emoji = [a.emoji];
    if (!Array.isArray(b.emoji)) b.emoji = [b.emoji];

    const key = this.normPair(a.name, b.name);
    let res = this.state.known[key];
    let isNew = false;

    // 檢查是否有預定義的種子配方
    if (!res) {
      const seed = this.seedMap[key];
      if (seed) {
        const [name, emoji] = seed;
        res = { name, emoji };
      }
    }

    // 如果沒有配方，動態生成
    if (!res) {
      const name = this.generateName(a.name, b.name);
      const emoji = this.pickEmojiByName(name);
      res = { name, emoji };
    }

    // 隨機偏移產物位置
    const productX = x + (Math.random() * 40 - 20);
    const productY = y + (Math.random() * 20 - 10);

    // 紀錄 & 解鎖
    this.state.known[key] = res;
    if (!this.state.unlocked[res.name]) {
      this.state.unlocked[res.name] = res.emoji;
      isNew = true;
    }

    // 生成產物 Token
    const productToken = this.spawnToken(res.name, res.emoji, productX, productY);

    // 視覺效果
    this.createEnergyRipple(productX, productY, this.workspace);
    this.spark(productX, productY, this.workspace);

    // Token 淡出動畫
    setTimeout(() => {
      if (productToken) productToken.classList.add('fade-out');
    }, 1210);
    setTimeout(() => {
      if (productToken) productToken.remove();
    }, 1700);

    // 記錄歷史
    this.state.history.push({ a, b, res });
    if (this.state.history.length > 35) {
      this.state.history.splice(0, 10);
    }

    // 檢查任務完成
    for (const m of this.state.missions) {
      if (!m.done && m.name === res.name) {
        m.done = true;
        this.toast(`任務完成：${m.name} ${m.emoji.join('')}`);
      }
    }

    // 全組完成才自動重擲
    const allDone = this.state.missions.length > 0 && this.state.missions.every(m => m.done);
    if (allDone) {
      this.regenMissions();
    }

    // 保存狀態
    this.saveState();

    // 更新所有 UI
    this.renderBook();
    this.renderHistory();
    this.renderCatalog(this.searchEl.value.trim());
    this.renderMissions();

    // 播放音效和提示
    this.audioPool.play('combine');
    this.toast(
      isNew
        ? `New Discover：${res.name} ${res.emoji.join('')}`
        : `合成成功：${res.name} ${res.emoji.join('')}`
    );
  }

  // 處理拖放數據並添加到 pending
  handleDrop(data, x, y) {
    const parsed = this.safeParseJSON(data);
    if (!parsed.ok || !parsed.val) {
      this.toast('拖放資料格式錯誤');
      return false;
    }

    const dropData = parsed.val;
    if (typeof dropData.name !== 'string' || !Array.isArray(dropData.emoji)) {
      this.toast('拖放資料缺少欄位');
      return false;
    }

    this.spawnToken(dropData.name, dropData.emoji, x, y);
    this.pending.push(dropData);

    if (this.pending.length >= 2) {
      const [a, b] = this.pending.splice(0, 2);
      this.combine(a, b, x, y);
    }

    return true;
  }

  // 初始化拖放事件監聽
  initializeDragAndDrop() {
    // Dropzone 事件
    this.dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      this.dropzone.style.borderColor = '#3b82f6';
    });

    this.dropzone.addEventListener('dragleave', () => {
      this.dropzone.style.borderColor = '#2a3250';
    });

    this.dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      this.dropzone.style.borderColor = '#2a3250';

      const raw = e.dataTransfer.getData('text/plain');
      const rect = this.workspace.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.handleDrop(raw, x, y);
    });

    // Board 事件（允許在卡片上拖放）
    const board = document.querySelector('.board');

    board.addEventListener('dragover', (e) => {
      if (this.dropzone.contains(e.target)) return;
      e.preventDefault();
    }, { capture: true });

    board.addEventListener('drop', (e) => {
      if (this.dropzone.contains(e.target)) return;
      e.preventDefault();
      this.dropzone.style.borderColor = '#2a3250';

      const raw = e.dataTransfer.getData('text/plain');
      const rect = this.workspace.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      this.handleDrop(raw, x, y);
    }, { capture: true });
  }
}
