
class SafeFile {
  constructor() {
    this.INTEGRITY_KEY = '_sf_integrity';
    this.TIMESTAMP_KEY = '_sf_timestamp';
    this.VERSION_KEY = '_sf_version';
  }


  async generateDynamicKey(saveData) {   
    const features = {
      unlocked: Object.keys(saveData.unlocked || {}).sort(),
      missionProgress: (saveData.missions || [])
        .filter(m => m.done)
        .map(m => m.name)
        .sort()
        .join(','),

      stats: {
        unlockedCount: Object.keys(saveData.unlocked || {}).length,
        version: saveData.version || 1
      }
    };


    const seed = JSON.stringify(features);
    
   
    const encoder = new TextEncoder();
    const seedBuffer = encoder.encode(seed);
    
  
    const hashBuffer = await crypto.subtle.digest('SHA-256', seedBuffer);
    const hashArray = new Uint8Array(hashBuffer);

  
    return btoa(String.fromCharCode(...hashArray)).slice(0, 32);
  }


  async generateSignature(saveData, dynamicKey) {

    const normalizedData = JSON.stringify(saveData, Object.keys(saveData).sort());
    
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(normalizedData);
    const keyBuffer = encoder.encode(dynamicKey);
    

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyBuffer,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const signature = await crypto.subtle.sign('HMAC', cryptoKey, dataBuffer);
    return btoa(String.fromCharCode(...new Uint8Array(signature)));
  }


  validateGameLogic(saveData) {
    try {

      if (typeof saveData !== 'object' || saveData === null) {
        return { valid: false, reason: '存檔格式錯誤' };
      }

      const unlocked = saveData.unlocked || {};
      const history = saveData.history || [];
      const missions = saveData.missions || [];

      if (typeof unlocked !== 'object') return { valid: false, reason: '解鎖數據格式錯誤' };
      if (!Array.isArray(history)) return { valid: false, reason: '歷史記錄格式錯誤' };
      if (!Array.isArray(missions)) return { valid: false, reason: '任務數據格式錯誤' };

      return { valid: true };
    } catch (error) {
      return { valid: false, reason: '數據解析錯誤' };
    }
  }

  async secureExport(saveData) {
    try {

      const logicCheck = this.validateGameLogic(saveData);
      if (!logicCheck.valid) {
        throw new Error(`存檔結構錯誤: ${logicCheck.reason}`);
      }

 
      const dynamicKey = await this.generateDynamicKey(saveData);
      const signature = await this.generateSignature(saveData, dynamicKey);
      

      const secureData = {
        ...saveData,
        [this.INTEGRITY_KEY]: signature,
        [this.TIMESTAMP_KEY]: Date.now(),
        [this.VERSION_KEY]: '1.0'
      };

      return {
        success: true,
        data: secureData,
        info: {
          elements: Object.keys(saveData.unlocked || {}).length,
          history: (saveData.history || []).length,
          missions: (saveData.missions || []).length
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }


  async secureImport(importedData) {
    try {

      const {
        [this.INTEGRITY_KEY]: signature,
        [this.TIMESTAMP_KEY]: timestamp,
        [this.VERSION_KEY]: sfVersion,
        ...gameData
      } = importedData;

      if (!signature) {
        return {
          success: false,
          reason: '這不是安全存檔格式'
        };
      }


      if (timestamp) {
        const gameReleaseYear = 2025;
        const releaseTime = new Date(`${gameReleaseYear}-01-01`).getTime();
        const now = Date.now();
        const dayInMs = 24 * 60 * 60 * 1000;
        if (timestamp < releaseTime || timestamp > now + dayInMs) {
          return {
            success: false,
            reason: '存檔時間戳異常'
          };
        }
      }


      const logicCheck = this.validateGameLogic(gameData);
      if (!logicCheck.valid) {
        return {
          success: false,
          reason: `存檔結構錯誤: ${logicCheck.reason}`
        };
      }

      const expectedKey = await this.generateDynamicKey(gameData);
      const expectedSignature = await this.generateSignature(gameData, expectedKey);


      if (signature !== expectedSignature) {
        return {
          success: false,
          reason: '存檔完整性驗證失敗 - 可能已被修改'
        };
      }

      return {
        success: true,
        data: gameData,
        info: {
          importTime: new Date(timestamp || Date.now()).toLocaleString(),
          elements: Object.keys(gameData.unlocked || {}).length,
          verified: true
        }
      };

    } catch (error) {
      return {
        success: false,
        reason: `匯入錯誤: ${error.message}`
      };
    }
  }
};