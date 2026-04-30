#!/usr/bin/env node

/**
 * Multi-Agent Orchestrator v2.0
 * Efficient task distribution with worker pools, circuit breakers, and intelligent routing
 */

const { Worker } = require('worker_threads');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');

// Task priority levels
const PRIORITY = {
  CRITICAL: 0,
  HIGH: 1,
  NORMAL: 2,
  LOW: 3,
  BACKGROUND: 4
};

// Agent states
const AGENT_STATE = {
  IDLE: 'idle',
  BUSY: 'busy',
  UNHEALTHY: 'unhealthy',
  OFFLINE: 'offline'
};

/**
 * Circuit Breaker - Prevents cascade failures
 */
class CircuitBreaker {
  constructor(threshold = 5, timeout = 30000) {
    this.failureThreshold = threshold;
    this.recoveryTimeout = timeout;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.metrics = { successes: 0, failures: 0, lastSuccess: null };
  }

  async execute(operation, context = '') {
    if (this.state === 'OPEN') {
      if (Date.now() - this.lastFailureTime > this.recoveryTimeout) {
        this.state = 'HALF_OPEN';
        console.log(`🔧 Circuit breaker entering HALF_OPEN state${context ? ` for ${context}` : ''}`);
      } else {
        throw new Error(`Circuit breaker OPEN${context ? ` for ${context}` : ''} - preventing cascade failure`);
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    this.metrics.successes++;
    this.metrics.lastSuccess = Date.now();
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log('✅ Circuit breaker CLOSED - service recovered');
    }
  }

  onFailure() {
    this.failureCount++;
    this.metrics.failures++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      console.error(`🚨 Circuit breaker OPENED after ${this.failureThreshold} failures`);
    }
  }

  getHealth() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      failureRate: this.metrics.failures / (this.metrics.successes + this.metrics.failures) || 0,
      lastFailure: this.lastFailureTime,
      lastSuccess: this.metrics.lastSuccess
    };
  }
}

/**
 * Smart Cache with TTL and LRU eviction
 */
class SmartCache {
  constructor(options = {}) {
    this.maxSize = options.maxSize || 100;
    this.defaultTTL = options.defaultTTL || 300000; // 5 minutes
    this.cache = new Map();
    this.accessOrder = [];
    this.metrics = { hits: 0, misses: 0, evictions: 0 };
  }

  generateKey(data) {
    const crypto = require('crypto');
    return crypto.createHash('md5').update(JSON.stringify(data)).digest('hex');
  }

  get(key) {
    const entry = this.cache.get(key);

    if (!entry) {
      this.metrics.misses++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
      this.metrics.misses++;
      return null;
    }

    // Update LRU
    this.accessOrder = this.accessOrder.filter(k => k !== key);
    this.accessOrder.push(key);
    this.metrics.hits++;

    return entry.value;
  }

  set(key, value, ttl = this.defaultTTL) {
    // Evict oldest if at capacity
    while (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const oldest = this.accessOrder.shift();
      this.cache.delete(oldest);
      this.metrics.evictions++;
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttl,
      createdAt: Date.now()
    });
    this.accessOrder.push(key);
  }

  invalidate(pattern) {
    const keysToDelete = [];
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        keysToDelete.push(key);
      }
    }
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      this.accessOrder = this.accessOrder.filter(k => k !== key);
    });
    return keysToDelete.length;
  }

  getMetrics() {
    return {
      ...this.metrics,
      size: this.cache.size,
      hitRate: this.metrics.hits / (this.metrics.hits + this.metrics.misses) || 0
    };
  }

  clear() {
    this.cache.clear();
    this.accessOrder = [];
  }
}

/**
 * Priority Task Queue
 */
class PriorityTaskQueue {
  constructor() {
    this.queues = new Map(Object.values(PRIORITY).map(p => [p, []]));
    this.metrics = { enqueued: 0, dequeued: 0, peeked: 0 };
  }

  enqueue(task, priority = PRIORITY.NORMAL) {
    const queue = this.queues.get(priority);
    task.priority = priority;
    task.enqueuedAt = Date.now();
    queue.push(task);
    this.metrics.enqueued++;
    return task.id;
  }

  dequeue() {
    for (const priority of Object.values(PRIORITY).sort((a, b) => a - b)) {
      const queue = this.queues.get(priority);
      if (queue.length > 0) {
        this.metrics.dequeued++;
        return queue.shift();
      }
    }
    return null;
  }

  peek() {
    for (const priority of Object.values(PRIORITY).sort((a, b) => a - b)) {
      const queue = this.queues.get(priority);
      if (queue.length > 0) {
        this.metrics.peeked++;
        return queue[0];
      }
    }
    return null;
  }

  get length() {
    return Array.from(this.queues.values()).reduce((sum, q) => sum + q.length, 0);
  }

  getMetrics() {
    const byPriority = {};
    for (const [key, value] of this.queues.entries()) {
      byPriority[key] = value.length;
    }
    return { ...this.metrics, byPriority, total: this.length };
  }
}

/**
 * Agent - Represents a single worker/tool
 */
class Agent extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.name = config.name;
    this.type = config.type; // 'rust', 'cpp', 'node', 'worker_thread'
    this.executable = config.executable;
    this.strengths = config.strengths || [];
    this.maxMemoryMB = config.maxMemoryMB || 2048;
    this.timeout = config.timeout || 300000;

    this.state = AGENT_STATE.IDLE;
    this.metrics = {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      lastUsed: null
    };

    this.circuitBreaker = new CircuitBreaker(3, 60000);
    this.currentTask = null;
    this.worker = null;
  }

  async execute(task) {
    if (this.state === AGENT_STATE.UNHEALTHY || this.state === AGENT_STATE.OFFLINE) {
      throw new Error(`Agent ${this.id} is ${this.state}`);
    }

    return this.circuitBreaker.execute(async () => {
      this.state = AGENT_STATE.BUSY;
      this.currentTask = task;
      const startTime = Date.now();

      try {
        let result;

        if (this.type === 'worker_thread') {
          result = await this.executeWorkerThread(task);
        } else {
          result = await this.executeProcess(task);
        }

        const duration = Date.now() - startTime;
        this.metrics.tasksCompleted++;
        this.metrics.totalExecutionTime += duration;
        this.metrics.averageExecutionTime = this.metrics.totalExecutionTime / this.metrics.tasksCompleted;
        this.metrics.lastUsed = Date.now();

        this.emit('taskCompleted', { task, result, duration });
        return result;

      } catch (error) {
        this.metrics.tasksFailed++;
        this.emit('taskFailed', { task, error });
        throw error;
      } finally {
        this.state = AGENT_STATE.IDLE;
        this.currentTask = null;
      }
    }, this.name);
  }

  executeWorkerThread(task) {
    return new Promise((resolve, reject) => {
      const workerScript = `
        const { parentPort, workerData } = require('worker_threads');

        // Simulate work
        const result = {
          taskId: workerData.taskId,
          completed: true,
          timestamp: Date.now()
        };

        parentPort.postMessage(result);
      `;

      this.worker = new Worker(workerScript, {
        eval: true,
        workerData: { taskId: task.id, ...task.data },
        resourceLimits: { maxOldGenerationSizeMb: this.maxMemoryMB }
      });

      const timeout = setTimeout(() => {
        this.worker.terminate();
        reject(new Error('Worker timeout'));
      }, this.timeout);

      this.worker.on('message', (result) => {
        clearTimeout(timeout);
        this.worker.terminate();
        resolve(result);
      });

      this.worker.on('error', (error) => {
        clearTimeout(timeout);
        this.worker.terminate();
        reject(error);
      });
    });
  }

  executeProcess(task) {
    return new Promise((resolve, reject) => {
      // Wrap directory path in quotes to handle spaces
      const directoryPath = `"${task.data.directory}"`;
      const args = [directoryPath];

      if (task.data.json) {
        args.push('--format', 'json');
      }
      if (task.data.parallel) {
        args.push('--parallel');
      }

      console.log(`🎬 Spawning ${this.name}: ${this.executable} ${args.join(' ')}`);

      const proc = spawn(this.executable, args, {
        maxBuffer: 1024 * 1024 * 100, // 100MB buffer
        windowsVerbatimArguments: true // Important for paths with spaces on Windows
      });

      let stdout = '';
      let stderr = '';

      const timeout = setTimeout(() => {
        proc.kill('SIGTERM');
        reject(new Error('Process timeout'));
      }, this.timeout);

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        clearTimeout(timeout);

        if (code === 0) {
          try {
            const result = stdout.trim() ? JSON.parse(stdout) : { success: true };
            resolve(result);
          } catch {
            resolve({ success: true, output: stdout });
          }
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  getHealth() {
    return {
      id: this.id,
      name: this.name,
      type: this.type,
      state: this.state,
      circuitBreaker: this.circuitBreaker.getHealth(),
      metrics: this.metrics,
      isAvailable: this.state === AGENT_STATE.IDLE && this.circuitBreaker.state !== 'OPEN'
    };
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
    }
    this.state = AGENT_STATE.OFFLINE;
  }
}

/**
 * Multi-Agent Orchestrator - Main class
 */
class MultiAgentOrchestrator extends EventEmitter {
  constructor(options = {}) {
    super();

    this.agents = new Map();
    this.taskQueue = new PriorityTaskQueue();
    this.cache = new SmartCache({
      maxSize: options.cacheSize || 50,
      defaultTTL: options.cacheTTL || 600000 // 10 minutes
    });

    this.maxConcurrentTasks = options.maxConcurrentTasks || 10;
    this.activeTasks = new Map();
    this.isRunning = false;
    this.processingInterval = null;

    // Metrics
    this.metrics = {
      totalTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageLatency: 0,
      startTime: Date.now()
    };

    this.initializeDefaultAgents();
  }

  initializeDefaultAgents() {
    const serverDir = path.join(__dirname, '../../server');

    // Rust agent (primary for file scanning)
    // Timeout: 10 minutes (600,000ms) for very large directories
    this.registerAgent(new Agent({
      name: 'rust-scanner',
      type: 'process',
      executable: path.join(serverDir, 'scanner/space-analyzer.exe'),
      strengths: ['speed', 'large-directories', 'parallel-processing'],
      maxMemoryMB: 4096,
      timeout: 600000 // 10 minutes for huge directories
    }));

    // Node.js agent (for AI-enhanced analysis)
    this.registerAgent(new Agent({
      name: 'node-ai',
      type: 'worker_thread',
      strengths: ['ai-insights', 'predictions', 'recommendations'],
      maxMemoryMB: 2048,
      timeout: 120000
    }));
  }

  registerAgent(agent) {
    this.agents.set(agent.id, agent);

    agent.on('taskCompleted', ({ task, result, duration }) => {
      this.activeTasks.delete(task.id);
      this.cache.set(task.cacheKey, result);
      this.emit('taskCompleted', { task, result, duration });
      this.processQueue();
    });

    agent.on('taskFailed', ({ task, error }) => {
      this.activeTasks.delete(task.id);
      this.metrics.failedTasks++;
      this.emit('taskFailed', { task, error });
      this.processQueue();
    });
  }

  async submitTask(taskData, options = {}) {
    const taskId = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const cacheKey = this.cache.generateKey(taskData);

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && !options.skipCache) {
      console.log(`📋 Cache hit for task ${taskId}`);
      return { taskId, result: cached, fromCache: true };
    }

    const task = {
      id: taskId,
      cacheKey,
      data: taskData,
      priority: options.priority || PRIORITY.NORMAL,
      submittedAt: Date.now(),
      maxRetries: options.maxRetries || 2,
      retries: 0
    };

    this.taskQueue.enqueue(task, task.priority);
    this.metrics.totalTasks++;

    if (!this.isRunning) {
      this.start();
    }

    return new Promise((resolve, reject) => {
      const onComplete = ({ task: completedTask, result }) => {
        if (completedTask.id === taskId) {
          this.off('taskCompleted', onComplete);
          this.off('taskFailed', onFailed);
          resolve({ taskId, result, fromCache: false });
        }
      };

      const onFailed = ({ task: failedTask, error }) => {
        if (failedTask.id === taskId) {
          this.off('taskCompleted', onComplete);
          this.off('taskFailed', onFailed);
          reject(error);
        }
      };

      this.on('taskCompleted', onComplete);
      this.on('taskFailed', onFailed);
    });
  }

  start() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.processingInterval = setInterval(() => this.processQueue(), 100);
    console.log('🚀 Multi-Agent Orchestrator started');
  }

  stop() {
    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }

    // Terminate all agents
    for (const agent of this.agents.values()) {
      agent.terminate();
    }

    console.log('🛑 Multi-Agent Orchestrator stopped');
  }

  processQueue() {
    if (!this.isRunning) return;
    if (this.activeTasks.size >= this.maxConcurrentTasks) return;

    const task = this.taskQueue.dequeue();
    if (!task) return;

    // Select best agent for this task
    const agent = this.selectAgent(task);
    if (!agent) {
      // Re-queue if no agent available
      if (task.retries < task.maxRetries) {
        task.retries++;
        this.taskQueue.enqueue(task, task.priority);
      } else {
        this.emit('taskFailed', { task, error: new Error('No available agents') });
      }
      return;
    }

    this.activeTasks.set(task.id, { task, agent, startedAt: Date.now() });

    agent.execute(task).catch(error => {
      console.error(`Task ${task.id} failed:`, error.message);
    });
  }

  selectAgent(task) {
    const availableAgents = Array.from(this.agents.values())
      .filter(agent => agent.getHealth().isAvailable);

    if (availableAgents.length === 0) return null;

    // Score agents based on task requirements and agent strengths
    const scoredAgents = availableAgents.map(agent => {
      let score = 0;

      // Prefer agents with matching strengths
      if (task.data.requirements) {
        for (const req of task.data.requirements) {
          if (agent.strengths.includes(req)) score += 10;
        }
      }

      // Prefer agents with better health
      const health = agent.circuitBreaker.getHealth();
      score += (1 - health.failureRate) * 5;

      // Prefer recently used agents (warm cache)
      if (agent.metrics.lastUsed && Date.now() - agent.metrics.lastUsed < 60000) {
        score += 3;
      }

      // Prefer less loaded agents
      score += Math.max(0, 100 - agent.metrics.tasksCompleted * 0.1);

      return { agent, score };
    });

    scoredAgents.sort((a, b) => b.score - a.score);
    return scoredAgents[0]?.agent;
  }

  async analyzeDirectory(directory, options = {}) {
    const taskData = {
      directory,
      json: true,
      parallel: options.parallel !== false,
      requirements: options.ai ? ['ai-insights'] : ['speed', 'large-directories']
    };

    const priority = options.priority || (options.ai ? PRIORITY.HIGH : PRIORITY.NORMAL);

    console.log(`🎯 Submitting analysis task for: ${directory}`);
    const startTime = Date.now();

    const { result, fromCache } = await this.submitTask(taskData, { priority });

    const duration = Date.now() - startTime;
    console.log(`✅ Analysis complete in ${duration}ms${fromCache ? ' (cached)' : ''}`);

    return {
      ...result,
      meta: {
        duration,
        fromCache,
        timestamp: new Date().toISOString()
      }
    };
  }

  getHealth() {
    const agentHealth = Array.from(this.agents.values()).map(a => a.getHealth());

    return {
      status: this.isRunning ? 'running' : 'stopped',
      agents: {
        total: this.agents.size,
        available: agentHealth.filter(a => a.isAvailable).length,
        busy: agentHealth.filter(a => a.state === AGENT_STATE.BUSY).length,
        unhealthy: agentHealth.filter(a => a.state === AGENT_STATE.UNHEALTHY).length
      },
      tasks: {
        queued: this.taskQueue.length,
        active: this.activeTasks.size,
        total: this.metrics.totalTasks,
        completed: this.metrics.completedTasks,
        failed: this.metrics.failedTasks
      },
      cache: this.cache.getMetrics(),
      uptime: Date.now() - this.metrics.startTime
    };
  }
}

// Export for use as module
module.exports = { MultiAgentOrchestrator, Agent, CircuitBreaker, SmartCache, PriorityTaskQueue, PRIORITY };

// CLI interface
if (require.main === module) {
  const orchestrator = new MultiAgentOrchestrator();

  const command = process.argv[2];

  if (command === 'analyze') {
    const directory = process.argv[3];
    if (!directory) {
      console.error('Usage: node multi-agent-orchestrator.cjs analyze <directory>');
      process.exit(1);
    }

    orchestrator.analyzeDirectory(directory, { ai: process.argv.includes('--ai') })
      .then(result => {
        console.log(JSON.stringify(result, null, 2));
        orchestrator.stop();
        process.exit(0);
      })
      .catch(error => {
        console.error('Analysis failed:', error.message);
        orchestrator.stop();
        process.exit(1);
      });
  } else if (command === 'status') {
    orchestrator.start();
    setTimeout(() => {
      console.log(JSON.stringify(orchestrator.getHealth(), null, 2));
      orchestrator.stop();
      process.exit(0);
    }, 1000);
  } else {
    console.log('Commands: analyze <directory> [--ai], status');
    process.exit(1);
  }
}
