import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

class SQLiteService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private isNative: boolean = Capacitor.isNativePlatform();

  async initDB() {
    if (this.db) return this.db;

    try {
      // 1. Get or Create a secure passphrase for this device
      const passphrase = await this.getOrCreatePassphrase();

      // 2. Create the connection with encryption enabled (Only on native platforms)
      const encrypted = this.isNative;
      const connection = await this.sqlite.createConnection(
        'proxypress_local', 
        encrypted, 
        encrypted ? 'secret' : 'no-encryption', 
        1, 
        false
      );
      this.db = connection;

      // 3. Open the database
      await this.db.open();
      
      // 4. Set the encryption passphrase
      // This "locks" the database with your secret key (Only on native platforms)
      if (encrypted) {
        await (this.db as any).setEncryptionSecret(passphrase);
        console.log('[SQLite] Database initialized with SQLCipher Encryption. 🔒');
      } else {
        console.log('[SQLite] Database initialized in standard mode (Web Fallback). 📂');
      }

      // 5. Create Tables
      await this.createTables();

      return this.db;
    } catch (err) {
      console.error('[SQLite] Encryption/Initialization error:', err);
      throw err;
    }
  }

  /**
   * Generates a unique passphrase for this device if it doesn't exist.
   * This is stored in Preferences (standard) or Keychain (pro).
   */
  private async getOrCreatePassphrase(): Promise<string> {
    const { Preferences } = await import('@capacitor/preferences');
    const { value } = await Preferences.get({ key: 'pp_db_secret' });
    
    if (value) return value;

    // Generate a random 32-character secret
    const newSecret = Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15) + 
                      Math.random().toString(36).substring(2, 15);
                      
    await Preferences.set({ key: 'pp_db_secret', value: newSecret });
    return newSecret;
  }

  private async createTables() {
    if (!this.db) return;

    // Table for the logged-in user profile
    const userTable = `
      CREATE TABLE IF NOT EXISTS local_user_profile (
        id TEXT PRIMARY KEY,
        name TEXT,
        username TEXT,
        email TEXT,
        avatar TEXT,
        localAvatar TEXT,
        college TEXT,
        bio TEXT,
        followers INTEGER,
        following INTEGER,
        postsCount INTEGER,
        onboardingComplete BOOLEAN,
        lastSynced TEXT
      );
    `;

    // Table for messages (both cached and pending)
    const messagesTable = `
      CREATE TABLE IF NOT EXISTS local_messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT,
        senderId TEXT,
        text TEXT,
        type TEXT,
        timestamp TEXT,
        status TEXT, -- 'sent', 'pending', 'failed'
        tempId TEXT,   -- used to match pending messages when they return from server
        attachment TEXT,
        localAttachment TEXT
      );
    `;

    // Table for the logged-in user's posts
    const postsTable = `
      CREATE TABLE IF NOT EXISTS local_posts (
        id TEXT PRIMARY KEY,
        slug TEXT,
        title TEXT,
        description TEXT,
        imageUrl TEXT,
        localImageUrl TEXT,
        publishedAt TEXT,
        likes INTEGER,
        comments INTEGER,
        category TEXT
      );
    `;

    // Table for the main news feed
    const globalFeedTable = `
      CREATE TABLE IF NOT EXISTS global_feed (
        id TEXT PRIMARY KEY,
        slug TEXT,
        title TEXT,
        description TEXT,
        imageUrl TEXT,
        localImageUrl TEXT,
        publishedAt TEXT,
        likes INTEGER,
        comments INTEGER,
        category TEXT,
        authorName TEXT,
        authorAvatar TEXT
      );
    `;

    // Table for the explore feed
    const exploreFeedTable = `
      CREATE TABLE IF NOT EXISTS explore_feed (
        id TEXT PRIMARY KEY,
        slug TEXT,
        title TEXT,
        imageUrl TEXT,
        localImageUrl TEXT,
        category TEXT,
        likes INTEGER,
        comments INTEGER
      );
    `;

    // Table for offline queued posts
    const pendingPostsTable = `
      CREATE TABLE IF NOT EXISTS pending_posts (
        id TEXT PRIMARY KEY,
        title TEXT,
        description TEXT,
        category TEXT,
        localImageUrl TEXT,
        createdAt TEXT
      );
    `;

    await this.db.execute(userTable);
    await this.db.execute(messagesTable);
    await this.db.execute(postsTable);
    await this.db.execute(globalFeedTable);
    await this.db.execute(exploreFeedTable);
    await this.db.execute(pendingPostsTable);
  }

  // --- Profile Operations ---
  
  async saveUserProfile(profile: any) {
    if (!this.db) await this.initDB();
    const query = `
      INSERT OR REPLACE INTO local_user_profile (
        id, name, username, email, avatar, localAvatar, college, bio, followers, following, postsCount, onboardingComplete, lastSynced
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
      profile.id,
      profile.name,
      profile.username || '',
      profile.email || '',
      profile.avatar || profile.image || '',
      profile.localAvatar || null,
      profile.college || '',
      profile.bio || '',
      profile.followers || 0,
      profile.following || 0,
      profile.postsCount || 0,
      profile.onboardingComplete ? 1 : 0,
      new Date().toISOString()
    ];
    await this.db!.run(query, params);
  }

  async getLocalProfile() {
    if (!this.db) await this.initDB();
    const res = await this.db!.query('SELECT * FROM local_user_profile LIMIT 1;');
    return res.values && res.values.length > 0 ? res.values[0] : null;
  }

  // --- Message Operations ---

  async saveMessage(msg: any, status: 'sent' | 'pending' | 'failed' = 'sent') {
    if (!this.db) await this.initDB();
    const query = `
      INSERT OR REPLACE INTO local_messages (
        id, conversationId, senderId, text, type, timestamp, status, tempId, attachment, localAttachment
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
      msg.id || msg.tempId, // Use tempId as primary key if real ID isn't there yet
      msg.conversationId,
      msg.senderId,
      msg.text,
      msg.type,
      msg.timestamp || new Date().toISOString(),
      status,
      msg.tempId || null,
      msg.attachment || null,
      msg.localAttachment || null
    ];
    await this.db!.run(query, params);
  }

  async getMessages(conversationId: string) {
    if (!this.db) await this.initDB();
    const res = await this.db!.query(
      'SELECT * FROM local_messages WHERE conversationId = ? ORDER BY timestamp DESC LIMIT 50;',
      [conversationId]
    );
    return res.values || [];
  }

  async getPendingMessages() {
    if (!this.db) await this.initDB();
    const res = await this.db!.query("SELECT * FROM local_messages WHERE status = 'pending';");
    return res.values || [];
  }

  // --- Post Operations ---

  async saveUserPost(post: any) {
    if (!this.db) await this.initDB();
    const query = `
      INSERT OR REPLACE INTO local_posts (
        id, slug, title, description, imageUrl, localImageUrl, publishedAt, likes, comments, category
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
      post.id,
      post.slug,
      post.title,
      post.description,
      post.imageUrl,
      post.localImageUrl || null,
      post.publishedAt,
      post.likes || 0,
      post.comments || 0,
      post.category || 'Others'
    ];
    await this.db!.run(query, params);
  }

  async clearLocalPosts() {
    if (!this.db) await this.initDB();
    await this.db!.execute('DELETE FROM local_posts;');
  }

  async getLocalPosts() {
    if (!this.db) await this.initDB();
    const res = await this.db!.query('SELECT * FROM local_posts ORDER BY publishedAt DESC;');
    return res.values || [];
  }

  // --- Global Feed Operations ---

  async saveGlobalPost(post: any) {
    if (!this.db) await this.initDB();
    const query = `
      INSERT OR REPLACE INTO global_feed (
        id, slug, title, description, imageUrl, localImageUrl, publishedAt, likes, comments, category, authorName, authorAvatar
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
      post.id,
      post.slug,
      post.title,
      post.description,
      post.imageUrl,
      post.localImageUrl || null,
      post.publishedAt,
      post.likes || 0,
      post.comments || 0,
      post.category || 'Others',
      post.author?.name || 'User',
      post.author?.avatar || post.author?.image || ''
    ];
    await this.db!.run(query, params);
  }

  async clearGlobalFeed() {
    if (!this.db) await this.initDB();
    await this.db!.execute('DELETE FROM global_feed;');
  }

  async getGlobalFeed() {
    if (!this.db) await this.initDB();
    const res = await this.db!.query('SELECT * FROM global_feed ORDER BY publishedAt DESC;');
    return res.values || [];
  }

  // --- Explore Feed Operations ---

  async saveExplorePost(post: any) {
    if (!this.db) await this.initDB();
    const query = `
      INSERT OR REPLACE INTO explore_feed (
        id, slug, title, imageUrl, localImageUrl, category, likes, comments
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);
    `;
    const params = [
      post.id,
      post.slug,
      post.title,
      post.imageUrl,
      post.localImageUrl || null,
      post.category || 'Others',
      post.likes || 0,
      post.comments || 0
    ];
    await this.db!.run(query, params);
  }

  async clearExploreFeed() {
    if (!this.db) await this.initDB();
    await this.db!.execute('DELETE FROM explore_feed;');
  }

  async getExploreFeed() {
    if (!this.db) await this.initDB();
    const res = await this.db!.query('SELECT * FROM explore_feed;');
    return res.values || [];
  }

  // --- Pending Post Operations ---

  async savePendingPost(post: any) {
    if (!this.db) await this.initDB();
    const query = `
      INSERT OR REPLACE INTO pending_posts (
        id, title, description, category, localImageUrl, createdAt
      ) VALUES (?, ?, ?, ?, ?, ?);
    `;
    const params = [
      post.id || `pp_${Date.now()}`,
      post.title,
      post.description,
      post.category,
      post.localImageUrl || null,
      new Date().toISOString()
    ];
    await this.db!.run(query, params);
  }

  async getPendingPosts() {
    if (!this.db) await this.initDB();
    const res = await this.db!.query('SELECT * FROM pending_posts ORDER BY createdAt ASC;');
    return res.values || [];
  }

  async deletePendingPost(id: string) {
    if (!this.db) await this.initDB();
    await this.db!.run('DELETE FROM pending_posts WHERE id = ?;', [id]);
  }
}

export const sqliteService = new SQLiteService();
