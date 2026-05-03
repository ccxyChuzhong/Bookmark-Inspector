class StorageManager {
  constructor() {
    this.cache = new Map();
    this.cacheTimeout = 5 * 60 * 1000;
    this.cacheTimestamps = new Map();
  }

  async get(keys, defaultValue = null) {
    const cacheKey = Array.isArray(keys) ? keys.join(',') : keys;
    
    if (this.isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      const result = await chrome.storage.local.get(keys);
      
      if (Array.isArray(keys)) {
        const data = {};
        keys.forEach(key => {
          data[key] = result[key] ?? defaultValue;
        });
        this.setCache(cacheKey, data);
        return data;
      } else {
        const value = result[keys] ?? defaultValue;
        this.setCache(cacheKey, value);
        return value;
      }
    } catch (error) {
      console.error('Storage get error:', error);
      return defaultValue;
    }
  }

  async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      this.setCache(key, value);
      return true;
    } catch (error) {
      console.error('Storage set error:', error);
      return false;
    }
  }

  async remove(keys) {
    try {
      await chrome.storage.local.remove(keys);
      
      const keyArray = Array.isArray(keys) ? keys : [keys];
      keyArray.forEach(key => {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      });
      
      return true;
    } catch (error) {
      console.error('Storage remove error:', error);
      return false;
    }
  }

  async clear() {
    try {
      await chrome.storage.local.clear();
      this.cache.clear();
      this.cacheTimestamps.clear();
      return true;
    } catch (error) {
      console.error('Storage clear error:', error);
      return false;
    }
  }

  async getBytesInUse(keys) {
    try {
      return await chrome.storage.local.getBytesInUse(keys);
    } catch (error) {
      console.error('Storage getBytesInUse error:', error);
      return 0;
    }
  }

  setCache(key, value) {
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  isCacheValid(key) {
    if (!this.cache.has(key)) return false;
    
    const timestamp = this.cacheTimestamps.get(key);
    if (!timestamp) return false;
    
    return Date.now() - timestamp < this.cacheTimeout;
  }

  invalidateCache(keys) {
    const keyArray = Array.isArray(keys) ? keys : [keys];
    keyArray.forEach(key => {
      this.cache.delete(key);
      this.cacheTimestamps.delete(key);
    });
  }

  clearCache() {
    this.cache.clear();
    this.cacheTimestamps.clear();
  }

  async batchGet(keys) {
    return this.get(keys);
  }

  async batchSet(entries) {
    try {
      const data = {};
      entries.forEach(({ key, value }) => {
        data[key] = value;
        this.setCache(key, value);
      });
      
      await chrome.storage.local.set(data);
      return true;
    } catch (error) {
      console.error('Storage batchSet error:', error);
      return false;
    }
  }
}

const storageManager = new StorageManager();

export { storageManager, StorageManager };
