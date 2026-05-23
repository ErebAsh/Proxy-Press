import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';

class SQLiteService {
  private sqlite: SQLiteConnection = new SQLiteConnection(CapacitorSQLite);
  private db: SQLiteDBConnection | null = null;
  private isNative: boolean = Capacitor.isNativePlatform();

  async initDB() {
    if (this.db) return this.db;

    try {
      const encrypted = false; // Disable native SQLCipher encryption to prevent startup native dependency crash
      let connection: SQLiteDBConnection;

      // Check if connection already exists in the native registry to avoid connection conflict on React re-mounts
      const isConnResult = await this.sqlite.isConnection('proxypress_local', encrypted);
      const isConn = typeof isConnResult === 'boolean' ? isConnResult : !!(isConnResult as any)?.result;
      
      if (isConn) {
        try {
          connection = await this.sqlite.retrieveConnection('proxypress_local', encrypted);
          console.log('[SQLite] Retrieved existing connection. 📂');
        } catch (retrieveErr) {
          console.warn('[SQLite] isConnection was true but retrieveConnection failed. Creating new...', retrieveErr);
          try {
            connection = await this.sqlite.createConnection(
              'proxypress_local', 
              encrypted, 
              'no-encryption', 
              1, 
              false
            );
            console.log('[SQLite] Successfully created new connection after retrieve failed. 📂');
          } catch (createErr) {
            console.error('[SQLite] Failed to create connection after retrieve fallback:', createErr);
            // Try retrieve one last time as a desperate measure
            connection = await this.sqlite.retrieveConnection('proxypress_local', encrypted);
          }
        }
      } else {
        try {
          connection = await this.sqlite.createConnection(
            'proxypress_local', 
            encrypted, 
            'no-encryption', 
            1, 
            false
          );
          console.log('[SQLite] Created new connection. 📂');
        } catch (createErr: any) {
          console.warn('[SQLite] createConnection failed, attempting retrieveConnection fallback:', createErr);
          const errMsg = createErr?.message || String(createErr);
          if (errMsg.includes('already exists') || errMsg.includes('Connection') || errMsg.includes('exist')) {
            connection = await this.sqlite.retrieveConnection('proxypress_local', encrypted);
            console.log('[SQLite] Successfully recovered and retrieved existing connection. 📂');
          } else {
            throw createErr;
          }
        }
      }
      
      this.db = connection;

      // Open the database if not already open
      try {
        const isOpen = await this.db.isDBOpen();
        const isOpenBool = typeof isOpen === 'boolean' ? isOpen : !!(isOpen as any)?.result;
        if (!isOpenBool) {
          await this.db.open();
        }
      } catch (openErr) {
        console.warn('[SQLite] DB open check or open failed, trying open directly:', openErr);
        await this.db.open();
      }
      
      console.log('[SQLite] Database initialized in standard mode. 📂');

      // Create Tables
      await this.createTables();

      return this.db;
    } catch (err) {
      console.error('[SQLite] Initialization error:', err);
      throw err;
    }
  }

  /**
   * Generates a unique passphrase for this device if it doesn't exist.
   * This is stored in Preferences (standard) or Keychain (pro).
   */
  private async getOrCreatePassphrase(): Promise<string> {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key: 'pp_db_secret' });
      
      if (value) return value;

      // Generate a random 32-character secret
      const newSecret = Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15) + 
                        Math.random().toString(36).substring(2, 15);
                        
      await Preferences.set({ key: 'pp_db_secret', value: newSecret });
      return newSecret;
    } catch (e) {
      return 'pp_fallback_secret';
    }
  }

  private async createTables() {
    if (!this.db) return;

    try {
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
    } catch (err) {
      console.error('[SQLite] createTables error:', err);
    }
  }

  // --- Profile Operations ---
  
  async saveUserProfile(profile: any) {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
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
      await this.db.run(query, params);
    } catch (err) {
      console.error('[SQLite] saveUserProfile error:', err);
    }
  }

  async getLocalProfile() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return null;
      const res = await this.db.query('SELECT * FROM local_user_profile LIMIT 1;');
      return res.values && res.values.length > 0 ? res.values[0] : null;
    } catch (err) {
      console.error('[SQLite] getLocalProfile error:', err);
      return null;
    }
  }

  // --- Message Operations ---

  async saveMessage(msg: any, status: 'sent' | 'pending' | 'failed' = 'sent') {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
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
      await this.db.run(query, params);
    } catch (err) {
      console.error('[SQLite] saveMessage error:', err);
    }
  }

  async getMessages(conversationId: string) {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return [];
      const res = await this.db.query(
        'SELECT * FROM local_messages WHERE conversationId = ? ORDER BY timestamp DESC LIMIT 50;',
        [conversationId]
      );
      return res.values || [];
    } catch (err) {
      console.error('[SQLite] getMessages error:', err);
      return [];
    }
  }

  async getPendingMessages() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return [];
      const res = await this.db.query("SELECT * FROM local_messages WHERE status = 'pending';");
      return res.values || [];
    } catch (err) {
      console.error('[SQLite] getPendingMessages error:', err);
      return [];
    }
  }

  // --- Post Operations ---

  async saveUserPost(post: any) {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
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
      await this.db.run(query, params);
    } catch (err) {
      console.error('[SQLite] saveUserPost error:', err);
    }
  }

  async clearLocalPosts() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
      await this.db.execute('DELETE FROM local_posts;');
    } catch (err) {
      console.error('[SQLite] clearLocalPosts error:', err);
    }
  }

  async getLocalPosts() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return [];
      const res = await this.db.query('SELECT * FROM local_posts ORDER BY publishedAt DESC;');
      return res.values || [];
    } catch (err) {
      console.error('[SQLite] getLocalPosts error:', err);
      return [];
    }
  }

  // --- Global Feed Operations ---

  async saveGlobalPost(post: any) {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
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
      await this.db.run(query, params);
    } catch (err) {
      console.error('[SQLite] saveGlobalPost error:', err);
    }
  }

  async clearGlobalFeed() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
      await this.db.execute('DELETE FROM global_feed;');
    } catch (err) {
      console.error('[SQLite] clearGlobalFeed error:', err);
    }
  }

  async getGlobalFeed() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return [];
      const res = await this.db.query('SELECT * FROM global_feed ORDER BY publishedAt DESC;');
      return res.values || [];
    } catch (err) {
      console.error('[SQLite] getGlobalFeed error:', err);
      return [];
    }
  }

  // --- Explore Feed Operations ---

  async saveExplorePost(post: any) {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
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
      await this.db.run(query, params);
    } catch (err) {
      console.error('[SQLite] saveExplorePost error:', err);
    }
  }

  async clearExploreFeed() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
      await this.db.execute('DELETE FROM explore_feed;');
    } catch (err) {
      console.error('[SQLite] clearExploreFeed error:', err);
    }
  }

  async getExploreFeed() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return [];
      const res = await this.db.query('SELECT * FROM explore_feed;');
      return res.values || [];
    } catch (err) {
      console.error('[SQLite] getExploreFeed error:', err);
      return [];
    }
  }

  // --- Pending Post Operations ---

  async savePendingPost(post: any) {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
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
      await this.db.run(query, params);
    } catch (err) {
      console.error('[SQLite] savePendingPost error:', err);
    }
  }

  async getPendingPosts() {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return [];
      const res = await this.db.query('SELECT * FROM pending_posts ORDER BY createdAt ASC;');
      return res.values || [];
    } catch (err) {
      console.error('[SQLite] getPendingPosts error:', err);
      return [];
    }
  }

  async deletePendingPost(id: string) {
    try {
      if (!this.db) await this.initDB();
      if (!this.db) return;
      await this.db.run('DELETE FROM pending_posts WHERE id = ?;', [id]);
    } catch (err) {
      console.error('[SQLite] deletePendingPost error:', err);
    }
  }
}

export const sqliteService = new SQLiteService();
