/**
 * WebDAV 客户端
 * 支持标准 WebDAV 协议的 PROPFIND / MKCOL / PUT / GET 操作。
 */
class WebDAVClient {
  constructor(config) {
    this.baseUrl = config.url.replace(/\/+$/, '');
    this.username = config.username;
    this.password = config.password;
    this.remotePath = config.remotePath || '/bookmarks/';

    if (!this.remotePath.endsWith('/')) {
      this.remotePath += '/';
    }
  }

  _authHeader() {
    return 'Basic ' + btoa(this.username + ':' + this.password);
  }

  _buildUrl(filename = '') {
    return this.baseUrl + this.remotePath + filename;
  }

  _buildDirUrl() {
    return this.baseUrl + this.remotePath;
  }

  async _fetch(url, options = {}, timeout = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(url, {
        ...options,
        signal: controller.signal,
        mode: 'cors',
        headers: {
          Authorization: this._authHeader(),
          ...(options.headers || {})
        }
      });
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection() {
    try {
      const response = await this._fetch(this._buildDirUrl(), {
        method: 'PROPFIND',
        headers: { Depth: '0' }
      });

      if (response.status === 200 || response.status === 207) {
        return { success: true, message: '连接成功' };
      }
      if (response.status === 401) {
        return { success: false, message: '认证失败，请检查用户名和密码' };
      }
      if (response.status === 404) {
        return { success: false, message: '路径不存在，请检查服务器地址和远程路径' };
      }

      return { success: false, message: '连接失败，服务器返回 ' + response.status };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, message: '连接超时，请检查网络和服务器地址' };
      }
      return { success: false, message: '连接失败: ' + error.message };
    }
  }

  async ensureDirectory() {
    try {
      const check = await this._fetch(this._buildDirUrl(), {
        method: 'PROPFIND',
        headers: { Depth: '0' }
      });

      if (check.status === 200 || check.status === 207) {
        return { success: true };
      }

      const mkcol = await this._fetch(this._buildDirUrl(), {
        method: 'MKCOL'
      });

      if ([200, 201, 204, 405].includes(mkcol.status)) {
        return { success: true };
      }

      return { success: false, message: '无法创建远程目录，服务器返回 ' + mkcol.status };
    } catch (error) {
      return { success: false, message: '创建目录失败: ' + error.message };
    }
  }

  async put(filename, data) {
    try {
      const response = await this._fetch(this._buildUrl(filename), {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(data, null, 2)
      });

      if ([200, 201, 204].includes(response.status)) {
        return { success: true, message: '上传成功' };
      }

      return { success: false, message: '上传失败，服务器返回 ' + response.status };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, message: '上传超时' };
      }
      return { success: false, message: '上传失败: ' + error.message };
    }
  }

  async get(filename) {
    try {
      const response = await this._fetch(this._buildUrl(filename), {
        method: 'GET'
      });

      if (response.status === 404) {
        return { success: false, message: '远端备份文件不存在，请先执行备份' };
      }
      if (![200, 207].includes(response.status)) {
        return { success: false, message: '下载失败，服务器返回 ' + response.status };
      }

      const text = await response.text();
      try {
        return { success: true, data: JSON.parse(text) };
      } catch (error) {
        return { success: false, message: '远端文件不是有效的 JSON 备份' };
      }
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, message: '下载超时' };
      }
      return { success: false, message: '下载失败: ' + error.message };
    }
  }

  async getBackupInfo(filename) {
    const result = await this.get(filename);
    if (!result.success) {
      return result;
    }

    return {
      success: true,
      timestamp: result.data && result.data.timestamp ? result.data.timestamp : '',
      data: result.data
    };
  }
}
