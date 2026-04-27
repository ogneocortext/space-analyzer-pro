/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable no-console */
/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-floating-promises */
/* eslint-disable preserve-caught-error */

// @ts-ignore - puppeteer may not be installed
import puppeteer from "puppeteer";
import { useErrorStore } from "../store";

interface BrowserConfig {
  headless?: boolean;
  devtools?: boolean;
  userDataDir?: string;
  executablePath?: string;
  args?: string[];
  timeout?: number;
}

interface ScreenshotOptions {
  fullPage?: boolean;
  clip?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  quality?: number;
  type?: "png" | "jpeg";
}

class BrowserAutomation {
  private browser: any = null;
  private page: any = null;
  private config: BrowserConfig;
  private isConnectedToExisting: boolean = false;

  constructor(config: BrowserConfig = {}) {
    this.config = {
      headless: false,
      devtools: false,
      timeout: 30000,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--remote-debugging-port=9222",
        "--remote-debugging-address=0.0.0.0",
      ],
      ...config,
    };
  }

  /**
   * Connect to an existing Chrome browser instance
   */
  async connectToExistingBrowser(debugUrl: string = "http://localhost:9222"): Promise<void> {
    try {
      console.warn(`Connecting to Chrome browser at: ${debugUrl}`);

      // Try to connect to existing browser
      this.browser = await puppeteer.connect({
        browserURL: debugUrl,
        defaultViewport: { width: 1280, height: 720 },
      });

      this.isConnectedToExisting = true;
      console.warn("Successfully connected to existing Chrome browser instance");

      // Create a new page
      this.page = await this.browser.newPage();

      // Configure page settings
      await this.configurePage();
    } catch (error) {
      console.error("Failed to connect to existing browser:", error);
      throw new Error(`Failed to connect to Chrome browser at ${debugUrl}: ${error.message}`);
    }
  }

  /**
   * Launch a new browser instance
   */
  async launchBrowser(): Promise<void> {
    try {
      console.warn("Launching new Chrome browser instance...");

      this.browser = await puppeteer.launch({
        headless: this.config.headless,
        devtools: this.config.devtools,
        executablePath: this.config.executablePath,
        userDataDir: this.config.userDataDir,
        args: this.config.args,
        timeout: this.config.timeout,
      });

      this.isConnectedToExisting = false;
      console.warn("Successfully launched new browser instance");

      // Create a new page
      this.page = await this.browser.newPage();

      // Configure page settings
      await this.configurePage();
    } catch (error) {
      console.error("Failed to launch browser:", error);
      throw new Error(`Failed to launch browser: ${error.message}`);
    }
  }

  /**
   * Configure page settings for optimal automation
   */
  private async configurePage(): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      // Set viewport
      await this.page.setViewport({ width: 1280, height: 720 });

      // Configure request interception
      await this.page.setRequestInterception(true);
      this.page.on("request", (request) => {
        // Block unnecessary requests to improve performance
        const resourceType = request.resourceType();
        if (["image", "stylesheet", "font"].includes(resourceType)) {
          request.abort();
        } else {
          request.continue();
        }
      });

      // Handle console logs
      this.page.on("console", (msg) => {
        if (msg.type() === "error") {
          console.error("Page console error:", msg.text());
        } else {
          console.warn("Page console:", msg.text());
        }
      });

      // Handle page errors
      this.page.on("pageerror", (error) => {
        console.error("Page error:", error.message);
        useErrorStore.getState().addError({
          message: `Page error: ${error.message}`,
          type: "error",
        });
      });

      // Handle dialog boxes
      this.page.on("dialog", async (dialog) => {
        console.warn("Dialog detected:", dialog.message());
        await dialog.accept();
      });
    } catch (error) {
      console.error("Failed to configure page:", error);
      throw error;
    }
  }

  /**
   * Navigate to a URL
   */
  async navigate(url: string, options?: any): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      console.warn(`Navigating to: ${url}`);
      await this.page.goto(url, {
        waitUntil: "networkidle2",
        timeout: this.config.timeout,
        ...options,
      });
      console.warn("Navigation completed successfully");
    } catch (error) {
      console.error("Navigation failed:", error);
      throw new Error(`Navigation to ${url} failed: ${error.message}`);
    }
  }

  /**
   * Take a screenshot of the page
   */
  async takeScreenshot(options: ScreenshotOptions = {}): Promise<Buffer> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      const screenshotOptions: any = {
        fullPage: options.fullPage || false,
        type: options.type || "png",
        quality: options.quality,
        clip: options.clip,
      };

      const screenshot = await this.page.screenshot(screenshotOptions);
      console.warn("Screenshot taken successfully");
      return screenshot;
    } catch (error) {
      console.error("Screenshot failed:", error);
      throw new Error(`Screenshot failed: ${error.message}`);
    }
  }

  /**
   * Execute JavaScript in the page context
   */
  async executeScript<T = any>(script: string): Promise<T> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      const result = await this.page.evaluate(script);
      return result;
    } catch (error) {
      console.error("Script execution failed:", error);
      throw new Error(`Script execution failed: ${error.message}`);
    }
  }

  /**
   * Wait for an element to be present
   */
  async waitForElement(selector: string, timeout?: number): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      await this.page.waitForSelector(selector, { timeout: timeout || this.config.timeout });
    } catch (error) {
      console.error("Element wait failed:", error);
      throw new Error(`Element ${selector} not found: ${error.message}`);
    }
  }

  /**
   * Click an element
   */
  async click(selector: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      await this.page.click(selector);
    } catch (error) {
      console.error("Click failed:", error);
      throw new Error(`Click on ${selector} failed: ${error.message}`);
    }
  }

  /**
   * Type text into an element
   */
  async type(selector: string, text: string): Promise<void> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      await this.page.type(selector, text);
    } catch (error) {
      console.error("Type failed:", error);
      throw new Error(`Type into ${selector} failed: ${error.message}`);
    }
  }

  /**
   * Get page content
   */
  async getPageContent(): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");

    try {
      return await this.page.content();
    } catch (error) {
      console.error("Get page content failed:", error);
      throw new Error(`Get page content failed: ${error.message}`);
    }
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }

      if (this.browser) {
        if (this.isConnectedToExisting) {
          // For existing browser connections, we don't close the browser
          // as it might be used by other processes
          console.warn("Disconnecting from existing browser (not closing)");
        } else {
          await this.browser.close();
          console.warn("Browser closed successfully");
        }
        this.browser = null;
      }
    } catch (error) {
      console.error("Failed to close browser:", error);
      throw new Error(`Failed to close browser: ${error.message}`);
    }
  }

  /**
   * Check if browser is connected
   */
  isConnected(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Get browser version
   */
  async getBrowserVersion(): Promise<string> {
    if (!this.browser) throw new Error("Browser not initialized");

    return await this.browser.version();
  }

  /**
   * Get page title
   */
  async getPageTitle(): Promise<string> {
    if (!this.page) throw new Error("Page not initialized");

    return await this.page.title();
  }
}

// Export a singleton instance with default configuration
export const browserAutomation = new BrowserAutomation({
  // Default configuration - will be overridden by connectToExistingBrowser
  headless: false,
  args: [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-accelerated-2d-canvas",
    "--no-first-run",
    "--no-zygote",
    "--disable-gpu",
    "--remote-debugging-port=9222",
    "--remote-debugging-address=0.0.0.0",
  ],
});

// Utility function to initialize browser automation with Chrome connection
export const initializeBrowserAutomation = async (
  debugUrl: string = "http://localhost:9222"
): Promise<void> => {
  try {
    await browserAutomation.connectToExistingBrowser(debugUrl);
    console.warn("Browser automation initialized successfully");
  } catch (error) {
    console.error("Failed to initialize browser automation:", error);
    throw error;
  }
};

// Utility function to take a screenshot of the current dashboard
export const captureDashboardScreenshot = async (outputPath: string): Promise<void> => {
  try {
    if (!browserAutomation.isConnected()) {
      await initializeBrowserAutomation();
    }

    // Navigate to the dashboard
    await browserAutomation.navigate("http://localhost:5173");

    // Wait for the dashboard to load
    await browserAutomation.waitForElement(".dashboard", 10000);

    // Take a full-page screenshot
    const screenshot = await browserAutomation.takeScreenshot({
      fullPage: true,
      type: "png",
    });

    // Save the screenshot (you'll need to implement file saving)
    console.warn("Dashboard screenshot captured successfully");
  } catch (error) {
    console.error("Failed to capture dashboard screenshot:", error);
    throw error;
  }
};

export default BrowserAutomation;
