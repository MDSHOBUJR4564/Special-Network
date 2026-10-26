import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import axios from "axios";

import { RouterOSClient } from "routeros-client";

const db = new Database("isp_management.db");

// Helper to get setting
const getSetting = (key: string, defaultValue: string = ''): string => {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as any;
  return row ? row.value : (process.env[key] || defaultValue);
};

// bKash Service
class BKashService {
  private get baseUrl() { return getSetting('BKASH_BASE_URL', 'https://tokenized.sandbox.bka.sh/v1.2.0-beta'); }
  private get appKey() { return getSetting('BKASH_APP_KEY'); }
  private get appSecret() { return getSetting('BKASH_APP_SECRET'); }
  private get username() { return getSetting('BKASH_USERNAME'); }
  private get password() { return getSetting('BKASH_PASSWORD'); }

  private async getToken() {
    try {
      const { data } = await axios.post(`${this.baseUrl}/checkout/token/grant`, {
        app_key: this.appKey,
        app_secret: this.appSecret
      }, {
        headers: {
          username: this.username,
          password: this.password
        }
      });
      return data.id_token;
    } catch (e) {
      console.error("bKash Token Error:", e);
      throw new Error("Failed to get bKash token");
    }
  }

  async createPayment(amount: number, invoiceId: string) {
    const token = await this.getToken();
    const callbackUrl = `${process.env.APP_URL}/api/bkash/callback`;
    
    try {
      const { data } = await axios.post(`${this.baseUrl}/checkout/create`, {
        mode: '0011',
        payerReference: invoiceId,
        callbackURL: callbackUrl,
        amount: amount.toString(),
        currency: 'BDT',
        intent: 'sale',
        merchantInvoiceNumber: invoiceId
      }, {
        headers: {
          Authorization: token,
          'X-APP-Key': this.appKey
        }
      });
      return data;
    } catch (e) {
      console.error("bKash Create Payment Error:", e);
      throw new Error("Failed to create bKash payment");
    }
  }

  async executePayment(paymentID: string) {
    const token = await this.getToken();
    try {
      const { data } = await axios.post(`${this.baseUrl}/checkout/execute`, {
        paymentID
      }, {
        headers: {
          Authorization: token,
          'X-APP-Key': this.appKey
        }
      });
      return data;
    } catch (e) {
      console.error("bKash Execute Payment Error:", e);
      throw new Error("Failed to execute bKash payment");
    }
  }
}

const bkash = new BKashService();

// SMS Service
class SMSService {
  private get apiKey() { return getSetting('SMS_API_KEY'); }
  private get senderId() { return getSetting('SMS_SENDER_ID'); }
  private get apiUrl() { return getSetting('SMS_API_URL'); } // e.g., https://api.bulksmsbd.com/api/sendsms
  private get enabled() { return getSetting('SMS_ENABLED', 'false') === 'true'; }

  async sendSMS(to: string, message: string) {
    if (!this.enabled || !this.apiKey || !this.apiUrl) {
      console.log("SMS disabled or not configured. Message to", to, ":", message);
      return false;
    }

    try {
      // Generic implementation for many BD providers (GET request)
      // Adjusting to a common pattern: url?api_key=...&senderid=...&number=...&message=...
      await axios.get(this.apiUrl, {
        params: {
          api_key: this.apiKey,
          senderid: this.senderId,
          number: to,
          message: message
        }
      });
      console.log("SMS sent successfully to", to);
      return true;
    } catch (e) {
      console.error("SMS Send Error:", e);
      return false;
    }
  }
}

const sms = new SMSService();

// MikroTik Service
class MikroTikService {
  private client: RouterOSClient | null = null;

  async test(host: string, user: string, pass: string, port: number) {
    try {
      const testClient = new RouterOSClient({
        host,
        user,
        password: pass,
        port,
      });
      await testClient.connect();
      await testClient.close();
      return { success: true };
    } catch (e: any) {
      console.error("MikroTik Test Error:", e);
      return { success: false, message: e.message };
    }
  }

  async connect() {
    try {
      this.client = new RouterOSClient({
        host: getSetting('MIKROTIK_HOST', '192.168.88.1'),
        user: getSetting('MIKROTIK_USER', 'admin'),
        password: getSetting('MIKROTIK_PASS', ''),
        port: parseInt(getSetting('MIKROTIK_PORT', '8728')),
      });
      return await this.client.connect();
    } catch (e) {
      console.error("MikroTik Connection Error:", e);
      return null;
    }
  }

  async addPPPoESecret(username: string, password: string, profile: string) {
    const api = await this.connect() as any;
    if (!api) return false;
    try {
      await api.menu('/ppp/secret').add({
        name: username,
        password: password,
        profile: profile,
        service: 'pppoe'
      });
      return true;
    } catch (e) {
      console.error("MikroTik Add Secret Error:", e);
      return false;
    } finally {
      api.close();
    }
  }

  async updatePPPoEStatus(username: string, disabled: boolean) {
    const api = await this.connect() as any;
    if (!api) return false;
    try {
      const secretMenu = api.menu('/ppp/secret');
      const secrets = await secretMenu.print({ name: username });
      
      if (secrets.length > 0) {
        const id = secrets[0]['.id'];
        await secretMenu.set(id, { disabled: disabled ? 'yes' : 'no' });
        
        if (disabled) {
          const activeMenu = api.menu('/ppp/active');
          const active = await activeMenu.print({ name: username });
          if (active.length > 0) {
            await activeMenu.remove(active[0]['.id']);
          }
        }
        return true;
      }
      return false;
    } catch (e) {
      console.error("MikroTik Update Status Error:", e);
      return false;
    } finally {
      api.close();
    }
  }

  async syncProfile(name: string, localAddress: string, remoteAddress: string, rateLimit: string) {
    const api = await this.connect() as any;
    if (!api) return false;
    try {
      const profileMenu = api.menu('/ppp/profile');
      const profiles = await profileMenu.print({ name });
      
      const profileData = {
        name,
        'local-address': localAddress,
        'remote-address': remoteAddress,
        'rate-limit': rateLimit
      };

      if (profiles.length > 0) {
        await profileMenu.set(profiles[0]['.id'], profileData);
      } else {
        await profileMenu.add(profileData);
      }
      return true;
    } catch (e) {
      console.error("MikroTik Profile Sync Error:", e);
      return false;
    } finally {
      api.close();
    }
  }

  async deleteProfile(name: string) {
    const api = await this.connect() as any;
    if (!api) return false;
    try {
      const profileMenu = api.menu('/ppp/profile');
      const profiles = await profileMenu.print({ name });
      if (profiles.length > 0) {
        await profileMenu.remove(profiles[0]['.id']);
      }
      return true;
    } catch (e) {
      console.error("MikroTik Profile Delete Error:", e);
      return false;
    } finally {
      api.close();
    }
  }
}

const mikrotik = new MikroTikService();

// Initialize Database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    password TEXT,
    full_name TEXT,
    address TEXT,
    phone TEXT,
    package_name TEXT,
    price REAL,
    mikrotik_id TEXT,
    status TEXT DEFAULT 'active',
    expiry_date TEXT,
    role TEXT DEFAULT 'customer',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    amount REAL,
    month TEXT,
    status TEXT DEFAULT 'unpaid',
    payment_method TEXT,
    transaction_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    subject TEXT,
    message TEXT,
    status TEXT DEFAULT 'open',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS packages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE,
    price REAL,
    local_address TEXT,
    remote_address TEXT,
    rate_limit TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed Admin if not exists
const admin = db.prepare("SELECT * FROM users WHERE role = 'admin'").get();
if (!admin) {
  db.prepare("INSERT INTO users (username, password, full_name, role) VALUES (?, ?, ?, ?)").run(
    "admin",
    "admin123",
    "System Administrator",
    "admin"
  );
  console.log("Default admin user created: admin / admin123");
  
  // Seed initial packages
  const initialPackages = [
    ["Standard 10Mbps", 500, "10.0.0.1", "pppoe-pool", "10M/10M"],
    ["Premium 20Mbps", 800, "10.0.0.1", "pppoe-pool", "20M/20M"],
    ["Ultra 50Mbps", 1500, "10.0.0.1", "pppoe-pool", "50M/50M"]
  ];
  const insertPkg = db.prepare("INSERT INTO packages (name, price, local_address, remote_address, rate_limit) VALUES (?, ?, ?, ?, ?)");
  initialPackages.forEach(p => insertPkg.run(...p));
  
  // Seed some customers
  const customers = [
    ["user1", "pass123", "John Doe", "Dhaka, Bangladesh", "01711111111", "Standard 10Mbps", 500],
    ["user2", "pass123", "Jane Smith", "Chittagong, Bangladesh", "01822222222", "Premium 20Mbps", 800],
    ["user3", "pass123", "Robert Brown", "Sylhet, Bangladesh", "01933333333", "Ultra 50Mbps", 1500]
  ];
  
  const insertUser = db.prepare(`
    INSERT INTO users (username, password, full_name, address, phone, package_name, price, expiry_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const expiry = new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString();
  
  customers.forEach(c => insertUser.run(...c, expiry));

  // Seed some invoices
  const usersList = db.prepare("SELECT id FROM users WHERE role = 'customer'").all() as any[];
  const insertInvoice = db.prepare("INSERT INTO invoices (user_id, amount, month, status) VALUES (?, ?, ?, ?)");
  const currentMonth = new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  
  usersList.forEach((u, i) => {
    insertInvoice.run(u.id, i === 0 ? 500 : (i === 1 ? 800 : 1500), currentMonth, i === 0 ? 'paid' : 'unpaid');
  });

  // Seed some tickets
  db.prepare("INSERT INTO tickets (user_id, subject, message) VALUES (?, ?, ?)").run(
    usersList[1].id,
    "Internet Slow",
    "My internet speed is very slow since this morning. Please check."
  );
}

async function startServer() {
  const app = express();
  
  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  app.use(express.json());
  const PORT = 3000;

  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as any;
  console.log(`Database initialized with ${userCount.count} users.`);

  // --- API Routes ---

  // Auth
  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE username = ? AND password = ?").get(username, password);
    if (user) {
      res.json({ success: true, user });
    } else {
      res.status(401).json({ success: false, message: "Invalid credentials" });
    }
  });

  // Users
  app.get("/api/users", (req, res) => {
    const users = db.prepare("SELECT * FROM users WHERE role = 'customer'").all();
    res.json(users);
  });

  app.post("/api/users", async (req, res) => {
    const { username, password, full_name, address, phone, package_name, price, expiry_date } = req.body;
    try {
      // 1. Sync with MikroTik
      const mtSync = await mikrotik.addPPPoESecret(username, password, package_name);
      
      // 2. Save to Database
      const result = db.prepare(`
        INSERT INTO users (username, password, full_name, address, phone, package_name, price, expiry_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(username, password, full_name, address, phone, package_name, price, expiry_date);
      
      // 3. Send Welcome SMS
      if (phone) {
        sms.sendSMS(phone, `Welcome to NetPulse! Your username: ${username}, password: ${password}. Package: ${package_name}. Expiry: ${expiry_date}`);
      }

      res.json({ success: true, id: result.lastInsertRowid, mikrotik_synced: mtSync });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    const { status, expiry_date, full_name, phone, address, package_name, price } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id) as any;
    
    if (!user) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    // Sync status with MikroTik if it changed
    let mtSync = true;
    if (status && status !== user.status) {
      mtSync = await mikrotik.updatePPPoEStatus(user.username, status === 'inactive');
    }

    db.prepare(`
      UPDATE users 
      SET status = ?, expiry_date = ?, full_name = ?, phone = ?, address = ?, package_name = ?, price = ?
      WHERE id = ?
    `).run(
      status ?? user.status, 
      expiry_date ?? user.expiry_date, 
      full_name ?? user.full_name, 
      phone ?? user.phone, 
      address ?? user.address, 
      package_name ?? user.package_name, 
      price ?? user.price, 
      req.params.id
    );
    res.json({ success: true, mikrotik_synced: mtSync });
  });

  // Invoices
  app.get("/api/invoices", (req, res) => {
    const invoices = db.prepare(`
      SELECT invoices.*, users.full_name as user_name 
      FROM invoices 
      JOIN users ON invoices.user_id = users.id
      ORDER BY invoices.created_at DESC
    `).all();
    res.json(invoices);
  });

  app.get("/api/invoices/user/:userId", (req, res) => {
    const invoices = db.prepare("SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC").all(req.params.userId);
    res.json(invoices);
  });

  app.post("/api/invoices/pay", (req, res) => {
    const { invoiceId, paymentMethod, transactionId } = req.body;
    db.prepare("UPDATE invoices SET status = 'paid', payment_method = ?, transaction_id = ? WHERE id = ?")
      .run(paymentMethod, transactionId, invoiceId);
    
    // Send SMS notification
    const invoice = db.prepare("SELECT invoices.*, users.phone, users.full_name FROM invoices JOIN users ON invoices.user_id = users.id WHERE invoices.id = ?").get(invoiceId) as any;
    if (invoice && invoice.phone) {
      sms.sendSMS(invoice.phone, `Dear ${invoice.full_name}, your payment of BDT ${invoice.amount} for ${invoice.month} has been received. Thank you!`);
    }

    res.json({ success: true });
  });

  app.post("/api/mikrotik/test", async (req, res) => {
    const { host, user, pass, port } = req.body;
    const result = await mikrotik.test(host, user, pass, parseInt(port));
    res.json(result);
  });

  // Tickets
  app.get("/api/tickets", (req, res) => {
    const tickets = db.prepare(`
      SELECT tickets.*, users.full_name as user_name 
      FROM tickets 
      JOIN users ON tickets.user_id = users.id
      ORDER BY tickets.created_at DESC
    `).all();
    res.json(tickets);
  });

  app.post("/api/tickets", (req, res) => {
    const { user_id, subject, message } = req.body;
    db.prepare("INSERT INTO tickets (user_id, subject, message) VALUES (?, ?, ?)")
      .run(user_id, subject, message);
    res.json({ success: true });
  });

  // Packages
  app.get("/api/packages", (req, res) => {
    const packages = db.prepare("SELECT * FROM packages ORDER BY price ASC").all();
    res.json(packages);
  });

  app.post("/api/packages", async (req, res) => {
    const { name, price, local_address, remote_address, rate_limit } = req.body;
    try {
      // 1. Sync with MikroTik
      const mtSync = await mikrotik.syncProfile(name, local_address, remote_address, rate_limit);
      
      // 2. Save to DB
      const result = db.prepare(`
        INSERT INTO packages (name, price, local_address, remote_address, rate_limit)
        VALUES (?, ?, ?, ?, ?)
      `).run(name, price, local_address, remote_address, rate_limit);
      
      res.json({ success: true, id: result.lastInsertRowid, mikrotik_synced: mtSync });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  });

  app.patch("/api/packages/:id", async (req, res) => {
    const { name, price, local_address, remote_address, rate_limit } = req.body;
    const pkg = db.prepare("SELECT * FROM packages WHERE id = ?").get(req.params.id) as any;
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });

    try {
      // 1. Sync with MikroTik
      const mtSync = await mikrotik.syncProfile(name || pkg.name, local_address || pkg.local_address, remote_address || pkg.remote_address, rate_limit || pkg.rate_limit);
      
      // 2. Update DB
      db.prepare(`
        UPDATE packages 
        SET name = ?, price = ?, local_address = ?, remote_address = ?, rate_limit = ?
        WHERE id = ?
      `).run(
        name ?? pkg.name,
        price ?? pkg.price,
        local_address ?? pkg.local_address,
        remote_address ?? pkg.remote_address,
        rate_limit ?? pkg.rate_limit,
        req.params.id
      );
      
      res.json({ success: true, mikrotik_synced: mtSync });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  });

  app.delete("/api/packages/:id", async (req, res) => {
    const pkg = db.prepare("SELECT * FROM packages WHERE id = ?").get(req.params.id) as any;
    if (!pkg) return res.status(404).json({ success: false, message: "Package not found" });

    try {
      // 1. Delete from MikroTik
      const mtSync = await mikrotik.deleteProfile(pkg.name);
      
      // 2. Delete from DB
      db.prepare("DELETE FROM packages WHERE id = ?").run(req.params.id);
      
      res.json({ success: true, mikrotik_synced: mtSync });
    } catch (e: any) {
      res.status(400).json({ success: false, message: e.message });
    }
  });

  // bKash Payments
  app.post("/api/bkash/create", async (req, res) => {
    const { invoiceId, amount } = req.body;
    try {
      const payment = await bkash.createPayment(amount, invoiceId);
      res.json(payment);
    } catch (e: any) {
      res.status(500).json({ success: false, message: e.message });
    }
  });

  app.get("/api/bkash/callback", async (req, res) => {
    const { paymentID, status } = req.query;

    if (status === 'success') {
      try {
        const result = await bkash.executePayment(paymentID as string);
        if (result.statusCode === '0000') {
          // Update invoice status
          const invoiceId = result.merchantInvoiceNumber;
          const trxID = result.trxID;
          db.prepare("UPDATE invoices SET status = 'paid', payment_method = 'bKash', transaction_id = ? WHERE id = ?")
            .run(trxID, invoiceId);
          
          // Send SMS notification
          const invoice = db.prepare("SELECT invoices.*, users.phone, users.full_name FROM invoices JOIN users ON invoices.user_id = users.id WHERE invoices.id = ?").get(invoiceId) as any;
          if (invoice && invoice.phone) {
            sms.sendSMS(invoice.phone, `Dear ${invoice.full_name}, your bKash payment of BDT ${invoice.amount} for ${invoice.month} was successful. TrxID: ${trxID}. Thank you!`);
          }
          
          // Redirect to success page or close window
          res.send(`
            <html>
              <head><title>Payment Successful</title></head>
              <body style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif;">
                <h1 style="color: #059669;">Payment Successful!</h1>
                <p>Transaction ID: ${result.trxID}</p>
                <p>You can close this window now.</p>
                <script>
                  setTimeout(() => {
                    if (window.opener) {
                      window.opener.postMessage({ type: 'BKASH_PAYMENT_SUCCESS', invoiceId: '${invoiceId}' }, '*');
                      window.close();
                    }
                  }, 3000);
                </script>
              </body>
            </html>
          `);
        } else {
          res.status(400).send(`Payment failed: ${result.statusMessage}`);
        }
      } catch (e: any) {
        res.status(500).send(`Error executing payment: ${e.message}`);
      }
    } else {
      res.status(400).send(`Payment status: ${status}`);
    }
  });

  // Settings
  app.get("/api/settings", (req, res) => {
    const settings = db.prepare("SELECT * FROM settings").all() as any[];
    const settingsObj: Record<string, string> = {};
    settings.forEach(s => settingsObj[s.key] = s.value);
    
    // Include env vars as defaults if not in DB
    const keys = [
      'MIKROTIK_HOST', 'MIKROTIK_USER', 'MIKROTIK_PASS', 'MIKROTIK_PORT',
      'BKASH_APP_KEY', 'BKASH_APP_SECRET', 'BKASH_USERNAME', 'BKASH_PASSWORD', 'BKASH_BASE_URL',
      'SMS_API_KEY', 'SMS_SENDER_ID', 'SMS_API_URL', 'SMS_ENABLED'
    ];
    keys.forEach(k => {
      if (!settingsObj[k]) settingsObj[k] = process.env[k] || '';
    });

    res.json(settingsObj);
  });

  app.post("/api/settings", (req, res) => {
    const settings = req.body;
    const upsert = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)");
    
    db.transaction(() => {
      for (const [key, value] of Object.entries(settings)) {
        upsert.run(key, value as string);
      }
    })();
    
    res.json({ success: true });
  });

  // Manual SMS
  app.post("/api/sms/send", (req, res) => {
    const { to, message } = req.body;
    sms.sendSMS(to, message);
    res.json({ success: true });
  });

  // Dashboard Stats
  app.get("/api/stats", (req, res) => {
    try {
      const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE role = 'customer'").get() as any;
      const activeUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active' AND role = 'customer'").get() as any;
      const dueBills = db.prepare("SELECT SUM(amount) as total FROM invoices WHERE status = 'unpaid'").get() as any;
      const monthlyRevenue = db.prepare("SELECT SUM(amount) as total FROM invoices WHERE status = 'paid' AND month = ?").get(new Date().toLocaleString('default', { month: 'long', year: 'numeric' })) as any;

      res.json({
        totalUsers: totalUsers.count,
        activeUsers: activeUsers.count,
        dueBills: dueBills.total || 0,
        monthlyRevenue: monthlyRevenue?.total || 0
      });
    } catch (e) {
      console.error("Stats Error:", e);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Error handling middleware
  app.use((err: any, req: any, res: any, next: any) => {
    console.error("Unhandled Error:", err);
    res.status(500).json({ success: false, message: "Internal server error" });
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
