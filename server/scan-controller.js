const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class ScanController {
  constructor() {
    this.activeScans = new Map(); // Map of scanId -> scan state
    this.pausedScans = new Map(); // Map of scanId -> paused scan state
    this.resumableScans = new Map(); // Map of scanId -> resumable scan data
    this.scanHistory = new Map(); // Map of scanId -> scan history
  }

  generateScanId() {
    return `scan_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  async createScan(analysisId, directoryPath, options = {}) {
    const scanId = this.generateScanId();
    
    const scanState = {
      scanId,
      analysisId,
      directoryPath,
      options,
      status: 'created',
      createdAt: Date.now(),
      startedAt: null,
      pausedAt: null,
      resumedAt: null,
      completedAt: null,
      progress: {
        filesProcessed: 0,
        totalFiles: 0,
        percentage: 0,
        currentFile: null,
        scanSpeed: 0,
        timeRemaining: 0
      },
      process: null,
      tempFile: null,
      checkpointData: null
    };

    this.activeScans.set(scanId, scanState);
    return scanId;
  }

  async startScan(scanId, process, tempFile) {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    scan.status = 'running';
    scan.startedAt = Date.now();
    scan.process = process;
    scan.tempFile = tempFile;

    return scan;
  }

  async pauseScan(scanId) {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    if (scan.status !== 'running') {
      throw new Error(`Cannot pause scan ${scanId}: current status is ${scan.status}`);
    }

    // Create checkpoint data
    const checkpointData = await this.createCheckpoint(scan);
    
    // Pause the process
    if (scan.process && !scan.process.killed) {
      try {
        // On Windows, we can't easily pause a process, so we'll terminate it
        // and save the state for resumption
        scan.process.kill('SIGTERM');
        
        // Wait a bit for graceful termination
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!scan.process.killed) {
          scan.process.kill('SIGKILL');
        }
      } catch (error) {
        console.warn(`Error pausing scan process: ${error.message}`);
      }
    }

    // Update scan state
    scan.status = 'paused';
    scan.pausedAt = Date.now();
    scan.checkpointData = checkpointData;

    // Move to paused scans
    this.pausedScans.set(scanId, scan);
    this.activeScans.delete(scanId);

    // Save checkpoint to disk
    await this.saveCheckpoint(scanId, checkpointData);

    return scan;
  }

  async resumeScan(scanId) {
    const pausedScan = this.pausedScans.get(scanId);
    if (!pausedScan) {
      throw new Error(`Paused scan ${scanId} not found`);
    }

    // Load checkpoint data
    const checkpointData = await this.loadCheckpoint(scanId);
    
    // Create new scan state
    const resumedScan = {
      ...pausedScan,
      status: 'resuming',
      resumedAt: Date.now(),
      process: null,
      tempFile: path.join(__dirname, `output_${pausedScan.analysisId}_resumed.json`),
      checkpointData
    };

    // Move back to active scans
    this.activeScans.set(scanId, resumedScan);
    this.pausedScans.delete(scanId);

    return resumedScan;
  }

  async stopScan(scanId) {
    const scan = this.activeScans.get(scanId) || this.pausedScans.get(scanId);
    if (!scan) {
      throw new Error(`Scan ${scanId} not found`);
    }

    // Terminate process if running
    if (scan.process && !scan.process.killed) {
      try {
        scan.process.kill('SIGTERM');
        
        // Wait for graceful termination
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        if (!scan.process.killed) {
          scan.process.kill('SIGKILL');
        }
      } catch (error) {
        console.warn(`Error stopping scan process: ${error.message}`);
      }
    }

    // Update scan state
    scan.status = 'stopped';
    scan.completedAt = Date.now();

    // Move to history
    this.scanHistory.set(scanId, scan);
    this.activeScans.delete(scanId);
    this.pausedScans.delete(scanId);

    // Clean up checkpoint
    await this.deleteCheckpoint(scanId);

    return scan;
  }

  async completeScan(scanId, result) {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      throw new Error(`Active scan ${scanId} not found`);
    }

    // Update scan state
    scan.status = 'completed';
    scan.completedAt = Date.now();
    scan.result = result;

    // Move to history
    this.scanHistory.set(scanId, scan);
    this.activeScans.delete(scanId);

    // Clean up checkpoint
    await this.deleteCheckpoint(scanId);

    return scan;
  }

  async updateProgress(scanId, progressData) {
    const scan = this.activeScans.get(scanId);
    if (!scan) {
      return; // Scan might have been paused or stopped
    }

    // Update progress
    scan.progress = {
      ...scan.progress,
      ...progressData
    };

    // Create periodic checkpoints for long-running scans
    if (scan.status === 'running' && Date.now() - (scan.lastCheckpoint || 0) > 30000) { // Every 30 seconds
      const checkpointData = await this.createCheckpoint(scan);
      scan.checkpointData = checkpointData;
      scan.lastCheckpoint = Date.now();
      await this.saveCheckpoint(scanId, checkpointData);
    }

    return scan;
  }

  async createCheckpoint(scan) {
    const checkpoint = {
      scanId: scan.scanId,
      analysisId: scan.analysisId,
      directoryPath: scan.directoryPath,
      options: scan.options,
      progress: scan.progress,
      status: scan.status,
      createdAt: scan.createdAt,
      startedAt: scan.startedAt,
      pausedAt: Date.now(),
      tempFile: scan.tempFile,
      // Save partial results if available
      partialResults: null
    };

    // Try to read partial results from temp file
    if (scan.tempFile) {
      try {
        const exists = await fs.access(scan.tempFile).then(() => true).catch(() => false);
        if (exists) {
          const content = await fs.readFile(scan.tempFile, 'utf8');
          checkpoint.partialResults = JSON.parse(content);
        }
      } catch (error) {
        console.warn(`Could not read partial results for checkpoint: ${error.message}`);
      }
    }

    return checkpoint;
  }

  async saveCheckpoint(scanId, checkpointData) {
    try {
      const checkpointDir = path.join(__dirname, '.checkpoints');
      await fs.mkdir(checkpointDir, { recursive: true });
      
      const checkpointFile = path.join(checkpointDir, `${scanId}.json`);
      await fs.writeFile(checkpointFile, JSON.stringify(checkpointData, null, 2));
      
      console.log(`💾 Saved checkpoint for scan ${scanId}`);
    } catch (error) {
      console.error(`Failed to save checkpoint for scan ${scanId}:`, error);
    }
  }

  async loadCheckpoint(scanId) {
    try {
      const checkpointFile = path.join(__dirname, '.checkpoints', `${scanId}.json`);
      const content = await fs.readFile(checkpointFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load checkpoint for scan ${scanId}:`, error);
      return null;
    }
  }

  async deleteCheckpoint(scanId) {
    try {
      const checkpointFile = path.join(__dirname, '.checkpoints', `${scanId}.json`);
      await fs.unlink(checkpointFile);
    } catch (error) {
      // Checkpoint might not exist, ignore
    }
  }

  getScan(scanId) {
    return this.activeScans.get(scanId) || 
           this.pausedScans.get(scanId) || 
           this.scanHistory.get(scanId);
  }

  getActiveScans() {
    return Array.from(this.activeScans.values());
  }

  getPausedScans() {
    return Array.from(this.pausedScans.values());
  }

  getScanHistory() {
    return Array.from(this.scanHistory.values());
  }

  getScanMetrics() {
    const now = Date.now();
    
    return {
      active: this.activeScans.size,
      paused: this.pausedScans.size,
      completed: this.scanHistory.size,
      total: this.activeScans.size + this.pausedScans.size + this.scanHistory.size,
      uptime: now - (this.startTime || now)
    };
  }

  async cleanup() {
    // Clean up old checkpoints
    try {
      const checkpointDir = path.join(__dirname, '.checkpoints');
      const exists = await fs.access(checkpointDir).then(() => true).catch(() => false);
      
      if (exists) {
        const files = await fs.readdir(checkpointDir);
        const now = Date.now();
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const filePath = path.join(checkpointDir, file);
            const stats = await fs.stat(filePath);
            
            // Delete checkpoints older than 24 hours
            if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
              await fs.unlink(filePath);
              console.log(`🗑️ Cleaned up old checkpoint: ${file}`);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error cleaning up checkpoints:', error);
    }

    // Clean up old scan history (keep last 100 scans)
    if (this.scanHistory.size > 100) {
      const scans = Array.from(this.scanHistory.entries());
      scans.sort((a, b) => b[1].completedAt - a[1].completedAt);
      
      const toDelete = scans.slice(100);
      for (const [scanId] of toDelete) {
        this.scanHistory.delete(scanId);
      }
    }
  }

  async clearAll() {
    // Stop all active scans
    for (const [scanId] of this.activeScans) {
      try {
        await this.stopScan(scanId);
      } catch (error) {
        console.warn(`Error stopping scan ${scanId}:`, error.message);
      }
    }

    // Clear all paused scans
    this.pausedScans.clear();

    // Clear history
    this.scanHistory.clear();

    // Clean up checkpoints
    try {
      const checkpointDir = path.join(__dirname, '.checkpoints');
      const exists = await fs.access(checkpointDir).then(() => true).catch(() => false);
      
      if (exists) {
        const files = await fs.readdir(checkpointDir);
        for (const file of files) {
          if (file.endsWith('.json')) {
            await fs.unlink(path.join(checkpointDir, file));
          }
        }
      }
    } catch (error) {
      console.error('Error clearing checkpoints:', error);
    }
  }
}

module.exports = ScanController;
