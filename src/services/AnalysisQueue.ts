export interface AnalysisJob {
  id: string
  type: 'file' | 'code' | 'dependency' | 'security'
  priority: 'low' | 'medium' | 'high' | 'critical'
  path: string
  options: Record<string, any>
  createdAt: Date
  startedAt?: Date
  completedAt?: Date
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress?: number
  result?: any
  error?: Error
  retryCount?: number
  maxRetries?: number
}

export interface QueueStats {
  total: number
  queued: number
  running: number
  completed: number
  failed: number
  cancelled: number
  averageWaitTime: number
  averageProcessingTime: number
}

export class AnalysisQueue {
  private static instance: AnalysisQueue
  private queue: AnalysisJob[] = []
  private running = new Set<string>()
  private completed = new Map<string, AnalysisJob>()
  private mutex = new Map<string, Promise<any>>()
  private processing = false
  private maxConcurrent = 3
  private listeners: Array<(job: AnalysisJob) => void> = []

  static getInstance(): AnalysisQueue {
    if (!AnalysisQueue.instance) {
      AnalysisQueue.instance = new AnalysisQueue()
    }
    return AnalysisQueue.instance
  }

  async enqueue(job: Omit<AnalysisJob, 'id' | 'createdAt' | 'status'>): Promise<string> {
    const fullJob: AnalysisJob = {
      ...job,
      id: this.generateJobId(),
      createdAt: new Date(),
      status: 'queued',
      retryCount: 0,
      maxRetries: 3
    }

    // Check for duplicate jobs
    const duplicate = this.queue.find(j => 
      j.path === fullJob.path && 
      j.type === fullJob.type &&
      j.status !== 'completed' &&
      j.status !== 'failed'
    )

    if (duplicate) {
      console.log(`Duplicate job found, returning existing ID: ${duplicate.id}`)
      return duplicate.id
    }

    // Add to queue with priority ordering
    this.insertJobByPriority(fullJob)
    
    console.log(`Job enqueued: ${fullJob.id} (${fullJob.type} - ${fullJob.priority})`)
    
    // Start processing if not already running
    if (!this.processing) {
      this.startProcessing()
    }

    // Notify listeners
    this.notifyListeners(fullJob)

    return fullJob.id
  }

  private insertJobByPriority(job: AnalysisJob): void {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
    const jobPriority = priorityOrder[job.priority]
    
    let insertIndex = this.queue.length
    
    for (let i = 0; i < this.queue.length; i++) {
      const existingPriority = priorityOrder[this.queue[i].priority]
      if (jobPriority < existingPriority) {
        insertIndex = i
        break
      }
    }
    
    this.queue.splice(insertIndex, 0, job)
  }

  private async startProcessing(): Promise<void> {
    if (this.processing) return
    
    this.processing = true
    
    while (this.queue.length > 0 && this.running.size < this.maxConcurrent) {
      const job = this.queue.shift()
      if (!job) break
      
      this.running.add(job.id)
      job.status = 'running'
      job.startedAt = new Date()
      
      // Process job in background
      this.processJob(job).catch(error => {
        console.error(`Job processing failed: ${job.id}`, error)
      })
    }
    
    this.processing = false
  }

  private async processJob(job: AnalysisJob): Promise<void> {
    console.log(`Processing job: ${job.id}`)
    
    try {
      // Acquire mutex for the path to prevent conflicts
      await this.acquireMutex(job.path)
      
      try {
        // Execute the analysis
        const result = await this.executeAnalysis(job)
        
        job.result = result
        job.status = 'completed'
        job.completedAt = new Date()
        job.progress = 100
        
        console.log(`Job completed: ${job.id}`)
      } catch (error) {
        job.error = error as Error
        job.status = 'failed'
        job.completedAt = new Date()
        
        // Retry logic
        if (job.retryCount! < job.maxRetries!) {
          console.log(`Retrying job: ${job.id} (attempt ${job.retryCount! + 1})`)
          job.retryCount!++
          job.status = 'queued'
          job.error = undefined
          
          // Add delay before retry
          setTimeout(() => {
            this.insertJobByPriority(job)
            this.startProcessing()
          }, 2000 * job.retryCount!)
          
          return
        }
        
        console.error(`Job failed permanently: ${job.id}`, error)
      }
    } finally {
      // Release mutex
      this.releaseMutex(job.path)
      
      // Update running set
      this.running.delete(job.id)
      
      // Store completed job
      this.completed.set(job.id, job)
      
      // Notify listeners
      this.notifyListeners(job)
      
      // Continue processing
      this.startProcessing()
    }
  }

  private async acquireMutex(path: string): Promise<void> {
    // If no mutex exists for this path, create one
    if (!this.mutex.has(path)) {
      this.mutex.set(path, Promise.resolve())
    }
    
    // Wait for existing mutex to resolve
    const existingMutex = this.mutex.get(path)!
    await existingMutex
    
    // Create new mutex for this acquisition
    let resolveMutex: () => void
    const newMutex = new Promise<void>(resolve => {
      resolveMutex = resolve
    })
    
    this.mutex.set(path, newMutex)
  }

  private releaseMutex(path: string): void {
    const mutex = this.mutex.get(path)
    if (mutex) {
      // Resolve the current mutex
      this.mutex.delete(path)
    }
  }

  private async executeAnalysis(job: AnalysisJob): Promise<any> {
    switch (job.type) {
      case 'file':
        return await this.executeFileAnalysis(job)
      case 'code':
        return await this.executeCodeAnalysis(job)
      case 'dependency':
        return await this.executeDependencyAnalysis(job)
      case 'security':
        return await this.executeSecurityAnalysis(job)
      default:
        throw new Error(`Unknown analysis type: ${job.type}`)
    }
  }

  private async executeFileAnalysis(job: AnalysisJob): Promise<any> {
    // Simulate file analysis
    await this.simulateWork(job, 5000, 15000)
    
    return {
      type: 'file-analysis',
      path: job.path,
      size: Math.random() * 1000000,
      files: Math.floor(Math.random() * 1000),
      directories: Math.floor(Math.random() * 100)
    }
  }

  private async executeCodeAnalysis(job: AnalysisJob): Promise<any> {
    // Simulate code analysis
    await this.simulateWork(job, 8000, 25000)
    
    return {
      type: 'code-analysis',
      path: job.path,
      complexity: Math.random() * 100,
      maintainability: Math.random() * 100,
      technicalDebt: Math.random() * 50
    }
  }

  private async executeDependencyAnalysis(job: AnalysisJob): Promise<any> {
    // Simulate dependency analysis
    await this.simulateWork(job, 10000, 30000)
    
    return {
      type: 'dependency-analysis',
      path: job.path,
      dependencies: Math.floor(Math.random() * 50),
      circularDependencies: Math.floor(Math.random() * 5),
      depth: Math.floor(Math.random() * 10)
    }
  }

  private async executeSecurityAnalysis(job: AnalysisJob): Promise<any> {
    // Simulate security analysis
    await this.simulateWork(job, 3000, 10000)
    
    return {
      type: 'security-analysis',
      path: job.path,
      vulnerabilities: Math.floor(Math.random() * 10),
      riskScore: Math.random() * 100,
      recommendations: [
        'Update dependencies',
        'Implement input validation',
        'Add authentication'
      ]
    }
  }

  private async simulateWork(job: AnalysisJob, minTime: number, maxTime: number): Promise<void> {
    const duration = minTime + Math.random() * (maxTime - minTime)
    const steps = 20
    const stepDuration = duration / steps

    for (let i = 0; i < steps; i++) {
      if (job.status === 'cancelled') {
        throw new Error('Job was cancelled')
      }
      
      job.progress = (i / steps) * 100
      await new Promise(resolve => setTimeout(resolve, stepDuration))
    }
  }

  getJob(id: string): AnalysisJob | undefined {
    // Check queue first
    const queuedJob = this.queue.find(job => job.id === id)
    if (queuedJob) return queuedJob

    // Check running jobs
    if (this.running.has(id)) {
      return this.queue.find(job => job.id === id)
    }

    // Check completed jobs
    return this.completed.get(id)
  }

  cancelJob(id: string): boolean {
    // Check queue
    const queueIndex = this.queue.findIndex(job => job.id === id)
    if (queueIndex !== -1) {
      const job = this.queue.splice(queueIndex, 1)[0]
      job.status = 'cancelled'
      job.completedAt = new Date()
      this.completed.set(id, job)
      this.notifyListeners(job)
      return true
    }

    // Check if running
    if (this.running.has(id)) {
      const job = this.queue.find(job => job.id === id)
      if (job) {
        job.status = 'cancelled'
        return true
      }
    }

    return false
  }

  getQueueStats(): QueueStats {
    const total = this.queue.length + this.running.size + this.completed.size
    const completedJobs = Array.from(this.completed.values())
    
    const now = new Date().getTime()
    const waitTimes = completedJobs
      .filter(job => job.startedAt)
      .map(job => job.startedAt!.getTime() - job.createdAt.getTime())
    
    const processingTimes = completedJobs
      .filter(job => job.completedAt && job.startedAt)
      .map(job => job.completedAt!.getTime() - job.startedAt!.getTime())

    return {
      total,
      queued: this.queue.length,
      running: this.running.size,
      completed: completedJobs.filter(job => job.status === 'completed').length,
      failed: completedJobs.filter(job => job.status === 'failed').length,
      cancelled: completedJobs.filter(job => job.status === 'cancelled').length,
      averageWaitTime: waitTimes.length > 0 ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0,
      averageProcessingTime: processingTimes.length > 0 ? processingTimes.reduce((a, b) => a + b, 0) / processingTimes.length : 0
    }
  }

  getJobs(status?: AnalysisJob['status']): AnalysisJob[] {
    let jobs: AnalysisJob[] = []

    // Add queued jobs
    jobs = jobs.concat(this.queue)

    // Add running jobs
    jobs = jobs.concat(Array.from(this.completed.values()).filter(job => this.running.has(job.id)))

    // Add completed jobs
    jobs = jobs.concat(Array.from(this.completed.values()))

    // Filter by status if specified
    if (status) {
      jobs = jobs.filter(job => job.status === status)
    }

    return jobs
  }

  clearCompleted(olderThan?: Date): number {
    const cutoff = olderThan || new Date(Date.now() - 24 * 60 * 60 * 1000) // 24 hours ago
    let cleared = 0

    for (const [id, job] of this.completed) {
      if (job.completedAt && job.completedAt < cutoff) {
        this.completed.delete(id)
        cleared++
      }
    }

    console.log(`Cleared ${cleared} completed jobs`)
    return cleared
  }

  setMaxConcurrent(max: number): void {
    this.maxConcurrent = Math.max(1, Math.min(max, 10))
    console.log(`Max concurrent jobs set to: ${this.maxConcurrent}`)
    
    // Start processing if there's capacity
    if (!this.processing && this.queue.length > 0) {
      this.startProcessing()
    }
  }

  onJobUpdate(listener: (job: AnalysisJob) => void): () => void {
    this.listeners.push(listener)
    return () => {
      const index = this.listeners.indexOf(listener)
      if (index > -1) {
        this.listeners.splice(index, 1)
      }
    }
  }

  private notifyListeners(job: AnalysisJob): void {
    this.listeners.forEach(listener => {
      try {
        listener(job)
      } catch (error) {
        console.error('Job update listener error:', error)
      }
    })
  }

  private generateJobId(): string {
    return `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  pauseProcessing(): void {
    this.processing = false
    console.log('Analysis queue processing paused')
  }

  resumeProcessing(): void {
    if (!this.processing && this.queue.length > 0) {
      this.startProcessing()
    }
    console.log('Analysis queue processing resumed')
  }

  destroy(): void {
    this.pauseProcessing()
    this.queue.length = 0
    this.running.clear()
    this.completed.clear()
    this.mutex.clear()
    this.listeners.length = 0
    console.log('Analysis queue destroyed')
  }
}