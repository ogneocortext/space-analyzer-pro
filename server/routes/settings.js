/**
 * Settings Routes
 * API endpoints for user settings management
 */

const express = require("express");

class SettingsRoutes {
  constructor(server) {
    this.server = server;
    this.router = express.Router();
    this.setupRoutes();
  }

  setupRoutes() {
    // Get all settings
    this.router.get("/api/settings", async (req, res) => {
      try {
        const settings = await this.server.knowledge.getAllUserSettings();
        // Cache for 5 minutes since settings don't change often
        res.setHeader("Cache-Control", "max-age=300");
        res.json({
          success: true,
          settings,
        });
      } catch (error) {
        console.error("Error fetching settings:", error);
        res.status(500).json({
          success: false,
          error: "Failed to fetch settings",
        });
      }
    });

    // Get specific setting
    this.router.get("/api/settings/:key", async (req, res) => {
      try {
        const { key } = req.params;
        const value = await this.server.knowledge.getUserSetting(key);
        // Cache for 5 minutes since settings don't change often
        res.setHeader("Cache-Control", "max-age=300");
        res.json({
          success: true,
          key,
          value,
        });
      } catch (error) {
        console.error("Error fetching setting:", error);
        res.status(500).json({
          success: false,
          error: "Failed to fetch setting",
        });
      }
    });

    // Set specific setting
    this.router.post("/api/settings/:key", async (req, res) => {
      try {
        const { key } = req.params;
        const { value } = req.body;

        if (value === undefined) {
          return res.status(400).json({
            success: false,
            error: "Value is required",
          });
        }

        await this.server.knowledge.setUserSetting(key, value);
        res.json({
          success: true,
          key,
          message: "Setting saved successfully",
        });
      } catch (error) {
        console.error("Error saving setting:", error);
        res.status(500).json({
          success: false,
          error: "Failed to save setting",
        });
      }
    });

    // Set multiple settings at once
    this.router.post("/api/settings", async (req, res) => {
      try {
        const { settings } = req.body;

        if (!settings || typeof settings !== "object") {
          return res.status(400).json({
            success: false,
            error: "Settings object is required",
          });
        }

        const results = [];
        for (const [key, value] of Object.entries(settings)) {
          await this.server.knowledge.setUserSetting(key, value);
          results.push(key);
        }

        res.json({
          success: true,
          message: `${results.length} settings saved successfully`,
          keys: results,
        });
      } catch (error) {
        console.error("Error saving settings:", error);
        res.status(500).json({
          success: false,
          error: "Failed to save settings",
        });
      }
    });

    // Delete specific setting
    this.router.delete("/api/settings/:key", async (req, res) => {
      try {
        const { key } = req.params;
        await this.server.knowledge.deleteUserSetting(key);
        res.json({
          success: true,
          key,
          message: "Setting deleted successfully",
        });
      } catch (error) {
        console.error("Error deleting setting:", error);
        res.status(500).json({
          success: false,
          error: "Failed to delete setting",
        });
      }
    });

    // Get notification settings (convenience endpoint)
    this.router.get("/api/settings/notifications", async (req, res) => {
      try {
        const settings = await this.server.knowledge.getUserSetting("notifications");
        // Cache for 1 minute since settings can change during user session
        res.setHeader("Cache-Control", "max-age=60");
        res.json({
          success: true,
          settings: settings || this.getDefaultNotificationSettings(),
        });
      } catch (error) {
        console.error("Error fetching notification settings:", error);
        res.status(500).json({
          success: false,
          error: "Failed to fetch notification settings",
        });
      }
    });

    // Save notification settings (convenience endpoint)
    this.router.post("/api/settings/notifications", async (req, res) => {
      try {
        const settings = req.body;
        await this.server.knowledge.setUserSetting("notifications", settings);
        res.json({
          success: true,
          message: "Notification settings saved successfully",
        });
      } catch (error) {
        console.error("Error saving notification settings:", error);
        res.status(500).json({
          success: false,
          error: "Failed to save notification settings",
        });
      }
    });
  }

  getDefaultNotificationSettings() {
    return {
      enabled: true,
      position: "top-right",
      duration: 5000,
      sounds: false,
      showProgress: true,
      maxVisible: 5,
      types: {
        success: { enabled: true, duration: 3000, persistent: false },
        error: { enabled: true, duration: 0, persistent: true },
        warning: { enabled: true, duration: 5000, persistent: false },
        info: { enabled: true, duration: 3000, persistent: false },
        progress: { enabled: true, duration: 0, persistent: true },
      },
    };
  }

  getRouter() {
    return this.router;
  }
}

module.exports = SettingsRoutes;
