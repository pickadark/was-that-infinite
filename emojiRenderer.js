// emojiRenderer.js - 跨平台 Emoji 渲染引擎

class EmojiRenderer {
  constructor() {
    // Emoji 快取系統
    this.emojiImgCache = new Map();

    // 元素顯示配置
    this.elementDisplay = {
      // 範例：控制圖片 or emoji
      '龍之心': {
        showEmoji: false,
        showImage: true,
        image: 'images/dragon_heart.png'
      },
    };
  }

  // ========== 平台檢測 ==========
  isApplePlatform() {
    return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  // ========== 顯示模式管理 ==========

  /**
   * 動態調整元素顯示模式
   * @param {string} elementName - 元素名稱
   * @param {string} mode - 模式：'emoji-only', 'image-only', 'mixed', 'auto'
   */
  setDisplayMode(elementName, mode) {
    const modes = {
      'emoji-only': { showEmoji: true, showImage: false },
      'image-only': { showEmoji: false, showImage: true },
      'mixed': { showEmoji: true, showImage: true },
      'auto': { showEmoji: true, showImage: true }
    };

    if (modes[mode]) {
      if (!this.elementDisplay[elementName]) {
        this.elementDisplay[elementName] = {};
      }
      Object.assign(this.elementDisplay[elementName], modes[mode]);
    }
  }

  /**
   * 調試用：顯示元素配置
   * @param {string} elementName - 元素名稱
   */
  debugElementDisplay(elementName) {
    const config = this.getElementDisplayConfig(elementName);
    console.log(`${elementName} 顯示配置:`, config);
  }

  /**
   * 設置 emoji 備用函數（用於動態生成 emoji）
   * @param {Function} pickEmojiByNameFn - 根據名稱選擇 emoji 的函數
   * @param {Object} resultEmojiMap - 預定義的 emoji 映射表
   */
  setEmojiHelpers(pickEmojiByNameFn, resultEmojiMap) {
    this.pickEmojiByName = pickEmojiByNameFn;
    this.resultEmojiMap = resultEmojiMap;
  }

  /**
   * 獲取元素顯示配置
   * @param {string} name - 元素名稱
   * @param {Array} fallbackEmoji - 備用 emoji（當沒有配置時）
   * @returns {Object} 顯示配置
   */
  getElementDisplayConfig(name, fallbackEmoji = null) {
    const config = this.elementDisplay[name];

    // 生成默認 emoji
    let defaultEmoji = fallbackEmoji;
    if (!defaultEmoji && this.resultEmojiMap && this.pickEmojiByName) {
      defaultEmoji = this.resultEmojiMap[name] || this.pickEmojiByName(name);
    }

    if (!config) {
      return {
        showEmoji: true,
        showImage: false,
        emoji: defaultEmoji
      };
    }
    return {
      ...config,
      emoji: config.customEmoji || defaultEmoji
    };
  }

  // ========== 圖片預載入 ==========

  /**
   * 預載入所有配置的圖片
   * @returns {Promise<Object>} 載入結果統計
   */
  async preloadElementImages() {
    const imagesToLoad = new Set();

    Object.values(this.elementDisplay).forEach(config => {
      if (config.image) imagesToLoad.add(config.image);
      if (config.images) config.images.forEach(img => imagesToLoad.add(img));
    });

    console.log(`開始預載入 ${imagesToLoad.size} 張圖片...`);

    const loadPromises = [...imagesToLoad].map(src => {
      return new Promise(resolve => {
        const img = new Image();
        img.onload = () => resolve({ src, success: true });
        img.onerror = () => resolve({ src, success: false });
        img.src = src;
      });
    });

    const results = await Promise.all(loadPromises);
    const successful = results.filter(r => r.success).length;

    console.log(`預載入完成: ${successful}/${results.length} 張圖片成功`);
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.warn('載入失敗的圖片:', failed.map(f => f.src));
    }

    return { total: results.length, successful, failed: failed.length };
  }

  // ========== Emoji 元素創建 ==========

  /**
   * 創建單個 Emoji 元素
   * @param {string} emoji - Emoji 字符
   * @returns {HTMLElement} Emoji DOM 元素
   */
  createSingleEmojiElement(emoji) {
    const emojiEl = document.createElement('div');
    emojiEl.className = 'emoji';

    if (this.isApplePlatform()) {
      // Apple 平台使用原生渲染
      emojiEl.textContent = emoji;
    } else {
      // 其他平台使用 CDN 圖片
      let imgNode;
      if (this.emojiImgCache.has(emoji)) {
        imgNode = this.emojiImgCache.get(emoji).cloneNode(true);
      } else {
        const img = document.createElement('img');
        img.src = `https://emojicdn.elk.sh/${encodeURIComponent(emoji)}?style=apple&size=64`;
        img.alt = emoji;
        img.width = 28;
        img.height = 28;
        this.emojiImgCache.set(emoji, img);
        imgNode = img.cloneNode(true);
      }
      emojiEl.appendChild(imgNode);
    }

    return emojiEl;
  }

  /**
   * 批量創建 Emoji 元素並添加到容器
   * @param {HTMLElement} container - 容器元素
   * @param {Array|string} emojiList - Emoji 列表或單個 emoji
   */
  createEmojiElements(container, emojiList) {
    const list = Array.isArray(emojiList) ? emojiList : [emojiList];

    list.forEach(emoji => {
      const emojiEl = this.createSingleEmojiElement(emoji);
      container.appendChild(emojiEl);
    });
  }

  // ========== 自定義圖片元素創建 ==========

  /**
   * 創建自定義圖片元素（帶 fallback）
   * @param {HTMLElement} container - 容器元素
   * @param {string} imageSrc - 圖片源路徑
   * @param {string} name - 元素名稱
   * @param {Object} config - 配置對象
   * @returns {HTMLElement} 圖片包裝元素
   */
  createImageElement(container, imageSrc, name, config) {
    const wrapper = document.createElement('div');
    wrapper.className = 'emoji custom-image';

    const img = document.createElement('img');
    img.src = imageSrc;
    img.alt = name;
    img.width = 28;
    img.height = 28;

    img.onerror = () => {
      console.warn(`Image failed to load: ${imageSrc}`);

      if (config.fallbackEmoji) {
        // 切換到備用 emoji
        wrapper.innerHTML = '';
        wrapper.className = 'emoji';

        config.fallbackEmoji.forEach(emoji => {
          const emojiEl = this.createSingleEmojiElement(emoji);
          wrapper.appendChild(emojiEl);
        });
      } else {
        // 直接移除失敗的圖片
        wrapper.remove();
      }
    };

    wrapper.appendChild(img);
    container.appendChild(wrapper);
    return wrapper;
  }

  // ========== 混合渲染（圖片 + Emoji） ==========

  /**
   * 渲染元素的視覺表示（圖片和/或 emoji）
   * @param {HTMLElement} container - 容器元素
   * @param {string} name - 元素名稱
   * @param {Array} emojiList - Emoji 列表
   */
  renderElementVisual(container, name, emojiList) {
    const displayConfig = this.getElementDisplayConfig(name, emojiList);

    // 渲染自定義圖片
    if (displayConfig.showImage && displayConfig.image) {
      this.createImageElement(container, displayConfig.image, name, displayConfig);
    }

    // 渲染 Emoji
    if (displayConfig.showEmoji) {
      const emojiToShow = (emojiList && emojiList.length > 0)
        ? emojiList
        : (displayConfig.emoji || emojiList || []);

      if (emojiToShow && emojiToShow.length > 0) {
        this.createEmojiElements(container, emojiToShow);
      }
    }
  }

  // ========== 初始化 ==========

  /**
   * 初始化渲染器（預載入圖片等）
   * @returns {Promise<Object>} 初始化結果
   */
  async initialize() {
    return await this.preloadElementImages();
  }
}
