// TODO Tracking and Completion Workflow Service
// Manages TODO items, tracks completion, and automates workflows

interface MockTODO {
  file: string;
  line: number;
  column: number;
  content: string;
  type: 'bug' | 'feature' | 'improvement' | 'documentation' | 'refactoring' | 'testing' | 'optimization' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
}

interface TODOItem {
  id: string;
  title: string;
  description: string;
  file: string;
  line: number;
  column: number;
  type: 'bug' | 'feature' | 'improvement' | 'documentation' | 'refactoring' | 'testing' | 'optimization' | 'security';
  priority: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'in-progress' | 'blocked' | 'completed' | 'cancelled';
  assignee?: string;
  labels: string[];
  createdAt: number;
  updatedAt: number;
  dueDate?: number;
  estimatedHours?: number;
  actualHours?: number;
  dependencies: string[];
  tags: string[];
  context: string;
  metadata: {
    author: string;
    commit?: string;
    branch?: string;
    pr?: string;
    issue?: string;
  };
}

interface WorkflowStep {
  id: string;
  name: string;
  description: string;
  type: 'manual' | 'automated' | 'approval' | 'review' | 'test' | 'deploy';
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  assignee?: string;
  estimatedHours?: number;
  actualHours?: number;
  dependencies: string[];
  artifacts: string[];
  notes: string[];
  createdAt: number;
  completedAt?: number;
}

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: Omit<WorkflowStep, 'id' | 'status' | 'createdAt' | 'completedAt'>[];
  triggers: string[];
  autoAssign: boolean;
  estimatedDuration: number;
}

interface TODOWorkflow {
  id: string;
  todoId: string;
  templateId: string;
  name: string;
  description: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  steps: WorkflowStep[];
  createdAt: number;
  updatedAt: number;
  startedAt?: number;
  completedAt?: number;
  assignee?: string;
  progress: number;
}

interface TODOStatistics {
  total: number;
  byStatus: { [key: string]: number };
  byType: { [key: string]: number };
  byPriority: { [key: string]: number };
  byAssignee: { [key: string]: number };
  avgCompletionTime: number;
  overdueCount: number;
  completionRate: number;
}

export class TODOTrackingService {
  private todos: Map<string, TODOItem> = new Map();
  private workflows: Map<string, TODOWorkflow> = new Map();
  private templates: Map<string, WorkflowTemplate> = new Map();
  private watchers: Map<string, Function[]> = new Map();
  private autoAssignmentRules: any[] = [];

  constructor() {
    this.initializeTemplates();
    this.setupAutoAssignmentRules();
  }

  // Initialize workflow templates
  private initializeTemplates(): void {
    console.log('📝 Initializing TODO workflow templates...');

    // Bug fix template
    this.templates.set('bug-fix', {
      id: 'bug-fix',
      name: 'Bug Fix Workflow',
      description: 'Standard workflow for fixing bugs',
      category: 'bug',
      steps: [
        {
          name: 'Investigate Bug',
          description: 'Investigate and reproduce the bug',
          type: 'manual',
          assignee: undefined,
          estimatedHours: 2,
          dependencies: [],
          artifacts: ['bug-report', 'reproduction-steps'],
          notes: []
        },
        {
          name: 'Code Analysis',
          description: 'Analyze code to identify root cause',
          type: 'automated',
          assignee: undefined,
          estimatedHours: 1,
          dependencies: ['Investigate Bug'],
          artifacts: ['analysis-report'],
          notes: []
        },
        {
          name: 'Implement Fix',
          description: 'Implement the bug fix',
          type: 'manual',
          assignee: undefined,
          estimatedHours: 4,
          dependencies: ['Code Analysis'],
          artifacts: ['fixed-code'],
          notes: []
        },
        {
          name: 'Code Review',
          description: 'Review the implemented fix',
          type: 'review',
          assignee: undefined,
          estimatedHours: 1,
          dependencies: ['Implement Fix'],
          artifacts: ['review-comments'],
          notes: []
        },
        {
          name: 'Testing',
          description: 'Test the fix thoroughly',
          type: 'test',
          assignee: undefined,
          estimatedHours: 2,
          dependencies: ['Code Review'],
          artifacts: ['test-results'],
          notes: []
        },
        {
          name: 'Deployment',
          description: 'Deploy the fix to production',
          type: 'deploy',
          assignee: undefined,
          estimatedHours: 0.5,
          dependencies: ['Testing'],
          artifacts: ['deployment-log'],
          notes: []
        }
      ],
      triggers: ['bug'],
      autoAssign: true,
      estimatedDuration: 10.5
    });

    // Feature development template
    this.templates.set('feature-development', {
      id: 'feature-development',
      name: 'Feature Development Workflow',
      description: 'Standard workflow for developing new features',
      category: 'feature',
      steps: [
        {
          name: 'Requirements Analysis',
          description: 'Analyze and document requirements',
          type: 'manual',
          assignee: undefined,
          estimatedHours: 4,
          dependencies: [],
          artifacts: ['requirements-doc'],
          notes: []
        },
        {
          name: 'Design',
          description: 'Create technical design',
          type: 'manual',
          assignee: undefined,
          estimatedHours: 6,
          dependencies: ['Requirements Analysis'],
          artifacts: ['design-doc'],
          notes: []
        },
        {
          name: 'Implementation',
          description: 'Implement the feature',
          type: 'manual',
          assignee: undefined,
          estimatedHours: 16,
          dependencies: ['Design'],
          artifacts: ['feature-code'],
          notes: []
        },
        {
          name: 'Unit Testing',
          description: 'Write unit tests',
          type: 'test',
          assignee: undefined,
          estimatedHours: 8,
          dependencies: ['Implementation'],
          artifacts: ['unit-tests'],
          notes: []
        },
        {
          name: 'Integration Testing',
          description: 'Perform integration testing',
          type: 'test',
          assignee: undefined,
          estimatedHours: 4,
          dependencies: ['Unit Testing'],
          artifacts: ['integration-tests'],
          notes: []
        },
        {
          name: 'Code Review',
          description: 'Review the implementation',
          type: 'review',
          assignee: undefined,
          estimatedHours: 2,
          dependencies: ['Integration Testing'],
          artifacts: ['review-feedback'],
          notes: []
        },
        {
          name: 'Documentation',
          description: 'Update documentation',
          type: 'manual',
          assignee: undefined,
          estimatedHours: 3,
          dependencies: ['Code Review'],
          artifacts: ['updated-docs'],
          notes: []
        },
        {
          name: 'Deployment',
          description: 'Deploy to staging',
          type: 'deploy',
          assignee: undefined,
          estimatedHours: 1,
          dependencies: ['Documentation'],
          artifacts: ['staging-deployment'],
          notes: []
        }
      ],
      triggers: ['feature'],
      autoAssign: true,
      estimatedDuration: 44
    });

    // Refactoring template
    this.templates.set('refactoring', {
      id: 'refactoring',
      name: 'Code Refactoring Workflow',
      description: 'Workflow for code refactoring tasks',
      category: 'refactoring',
      steps: [
        {
          name: 'Code Analysis',
          description: 'Analyze code to identify refactoring opportunities',
          type: 'automated',
          assignee: undefined,
          estimatedHours: 2,
          dependencies: [],
          artifacts: ['refactoring-report'],
          notes: []
        },
        {
          name: 'Refactoring Plan',
          description: 'Create detailed refactoring plan',
          type: 'manual',
          assignee: undefined,
          estimatedHours: 3,
          dependencies: ['Code Analysis'],
          artifacts: ['refactoring-plan'],
          notes: []
        },
        {
          name: 'Implementation',
          description: 'Implement refactoring changes',
          type: 'manual',
          assignee: undefined,
          estimatedHours: 8,
          dependencies: ['Refactoring Plan'],
          artifacts: ['refactored-code'],
          notes: []
        },
        {
          name: 'Testing',
          description: 'Test refactored code',
          type: 'test',
          assignee: undefined,
          estimatedHours: 4,
          dependencies: ['Implementation'],
          artifacts: ['test-results'],
          notes: []
        },
        {
          name: 'Code Review',
          description: 'Review refactored code',
          type: 'review',
          assignee: undefined,
          estimatedHours: 2,
          dependencies: ['Testing'],
          artifacts: ['review-comments'],
          notes: []
        }
      ],
      triggers: ['refactoring'],
      autoAssign: true,
      estimatedDuration: 19
    });

    console.log(`✅ Initialized ${this.templates.size} workflow templates`);
  }

  // Setup auto-assignment rules
  private setupAutoAssignmentRules(): void {
    console.log('👥 Setting up auto-assignment rules...');

    this.autoAssignmentRules = [
      {
        condition: (todo: TODOItem) => todo.type === 'bug' && todo.priority === 'critical',
        action: (todo: TODOItem) => {
          // Assign to senior developer
          todo.assignee = 'senior-developer';
        }
      },
      {
        condition: (todo: TODOItem) => todo.type === 'feature' && todo.priority === 'high',
        action: (todo: TODOItem) => {
          // Assign to feature team lead
          todo.assignee = 'feature-lead';
        }
      },
      {
        condition: (todo: TODOItem) => todo.type === 'security',
        action: (todo: TODOItem) => {
          // Assign to security team
          todo.assignee = 'security-team';
        }
      },
      {
        condition: (todo: TODOItem) => todo.labels.includes('frontend'),
        action: (todo: TODOItem) => {
          // Assign to frontend team
          todo.assignee = 'frontend-team';
        }
      },
      {
        condition: (todo: TODOItem) => todo.labels.includes('backend'),
        action: (todo: TODOItem) => {
          // Assign to backend team
          todo.assignee = 'backend-team';
        }
      }
    ];

    console.log(`✅ Set up ${this.autoAssignmentRules.length} auto-assignment rules`);
  }

  // Scan codebase for TODOs
  async scanForTODOs(directory: string): Promise<TODOItem[]> {
    console.log(`🔍 Scanning ${directory} for TODOs...`);
    
    const foundTODOs: TODOItem[] = [];
    
    // In a real implementation, this would scan actual files
    // For now, we'll simulate finding TODOs
    const mockTODOs = [
      {
        file: 'src/components/Dashboard.tsx',
        line: 45,
        column: 8,
        content: '// TODO: Implement real-time data updates',
        type: 'feature',
        priority: 'medium'
      },
      {
        file: 'src/services/AnalysisService.ts',
        line: 123,
        column: 4,
        content: '// TODO: Optimize algorithm performance',
        type: 'optimization',
        priority: 'high'
      },
      {
        file: 'src/utils/helpers.ts',
        line: 67,
        column: 12,
        content: '// TODO: Add input validation',
        type: 'security',
        priority: 'medium'
      }
    ];
    
    mockTODOs.forEach((todo, index) => {
      const todoItem: TODOItem = {
        id: `todo-${Date.now()}-${index}`,
        title: this.extractTitle(todo.content),
        description: todo.content,
        file: todo.file,
        line: todo.line,
        column: todo.column,
        type: todo.type as TODOItem['type'],
        priority: todo.priority as TODOItem['priority'],
        status: 'open',
        labels: this.extractLabels(todo.content),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        dependencies: [],
        tags: this.extractTags(todo.content),
        context: this.extractContext(todo.content),
        metadata: {
          author: 'system',
          branch: 'main'
        }
      };
      
      // Apply auto-assignment rules
      this.applyAutoAssignment(todoItem);
      
      foundTODOs.push(todoItem);
      this.todos.set(todoItem.id, todoItem);
    });
    
    console.log(`✅ Found ${foundTODOs.length} TODOs`);
    
    // Trigger events
    foundTODOs.forEach(todo => {
      this.emitEvent('todo-found', todo);
    });
    
    return foundTODOs;
  }

  // Extract title from TODO content
  private extractTitle(content: string): string {
    const match = content.match(/TODO:\s*(.+)/);
    return match ? match[1] : content;
  }

  // Extract labels from TODO content
  private extractLabels(content: string): string[] {
    const labels: string[] = [];
    
    if (content.includes('urgent')) labels.push('urgent');
    if (content.includes('frontend')) labels.push('frontend');
    if (content.includes('backend')) labels.push('backend');
    if (content.includes('api')) labels.push('api');
    if (content.includes('ui')) labels.push('ui');
    if (content.includes('database')) labels.push('database');
    if (content.includes('security')) labels.push('security');
    if (content.includes('performance')) labels.push('performance');
    
    return labels;
  }

  // Extract tags from TODO content
  private extractTags(content: string): string[] {
    const tags: string[] = [];
    const tagMatches = content.match(/#\w+/g);
    
    if (tagMatches) {
      tags.push(...tagMatches.map(tag => tag.substring(1)));
    }
    
    return tags;
  }

  // Extract context from TODO content
  private extractContext(content: string): string {
    // Extract surrounding context (simplified)
    const lines = content.split('\n');
    return lines.slice(0, 3).join(' ');
  }

  // Apply auto-assignment rules
  private applyAutoAssignment(todo: TODOItem): void {
    for (const rule of this.autoAssignmentRules) {
      if (rule.condition(todo)) {
        rule.action(todo);
        break;
      }
    }
  }

  // Create workflow for TODO
  async createWorkflow(todoId: string, templateId?: string): Promise<TODOWorkflow> {
    const todo = this.todos.get(todoId);
    if (!todo) {
      throw new Error(`TODO with id ${todoId} not found`);
    }
    
    // Select template
    let selectedTemplateId = templateId;
    if (!selectedTemplateId) {
      selectedTemplateId = this.selectTemplate(todo);
    }
    
    const template = this.templates.get(selectedTemplateId);
    if (!template) {
      throw new Error(`Template with id ${selectedTemplateId} not found`);
    }
    
    // Create workflow
    const workflow: TODOWorkflow = {
      id: `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      todoId,
      templateId: selectedTemplateId,
      name: template.name,
      description: template.description,
      status: 'pending',
      steps: template.steps.map((step, index) => ({
        id: `step-${index}`,
        ...step,
        status: 'pending',
        createdAt: Date.now()
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      assignee: todo.assignee,
      progress: 0
    };
    
    this.workflows.set(workflow.id, workflow);
    
    console.log(`✅ Created workflow: ${workflow.name} for TODO: ${todo.title}`);
    
    // Emit event
    this.emitEvent('workflow-created', workflow);
    
    return workflow;
  }

  // Select appropriate template for TODO
  private selectTemplate(todo: TODOItem): string {
    // Check if there's a specific template for the TODO type
    const typeTemplate = Array.from(this.templates.values()).find(
      template => template.category === todo.type
    );
    
    if (typeTemplate) {
      return typeTemplate.id;
    }
    
    // Default to bug fix template
    return 'bug-fix';
  }

  // Start workflow
  async startWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with id ${workflowId} not found`);
    }
    
    if (workflow.status !== 'pending') {
      throw new Error(`Workflow ${workflowId} is not in pending status`);
    }
    
    workflow.status = 'active';
    workflow.startedAt = Date.now();
    workflow.updatedAt = Date.now();
    
    // Start first step
    const firstStep = workflow.steps.find(step => step.dependencies.length === 0);
    if (firstStep) {
      await this.startStep(workflowId, firstStep.id);
    }
    
    console.log(`🚀 Started workflow: ${workflow.name}`);
    
    // Emit event
    this.emitEvent('workflow-started', workflow);
  }

  // Start workflow step
  async startStep(workflowId: string, stepId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with id ${workflowId} not found`);
    }
    
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step with id ${stepId} not found in workflow ${workflowId}`);
    }
    
    if (step.status !== 'pending') {
      throw new Error(`Step ${stepId} is not in pending status`);
    }
    
    // Check dependencies
    const dependenciesMet = step.dependencies.every(depId => {
      const depStep = workflow.steps.find(s => s.id === depId);
      return depStep && depStep.status === 'completed';
    });
    
    if (!dependenciesMet) {
      throw new Error(`Dependencies not met for step ${stepId}`);
    }
    
    step.status = 'in-progress';
    workflow.updatedAt = Date.now();
    
    console.log(`📋 Started step: ${step.name} in workflow ${workflow.name}`);
    
    // Execute step based on type
    if (step.type === 'automated') {
      await this.executeAutomatedStep(workflowId, stepId);
    } else {
      // Emit event for manual steps
      this.emitEvent('step-started', { workflow, step });
    }
  }

  // Execute automated step
  private async executeAutomatedStep(workflowId: string, stepId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) return;
    
    console.log(`🤖 Executing automated step: ${step.name}`);
    
    // Simulate automated execution
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Complete the step
    await this.completeStep(workflowId, stepId, {
      artifacts: [`automated-result-${stepId}`],
      notes: ['Automated execution completed successfully']
    });
  }

  // Complete workflow step
  async completeStep(workflowId: string, stepId: string, result?: {
    artifacts?: string[];
    notes?: string[];
    actualHours?: number;
  }): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow with id ${workflowId} not found`);
    }
    
    const step = workflow.steps.find(s => s.id === stepId);
    if (!step) {
      throw new Error(`Step with id ${stepId} not found in workflow ${workflowId}`);
    }
    
    if (step.status !== 'in-progress') {
      throw new Error(`Step ${stepId} is not in progress`);
    }
    
    step.status = 'completed';
    step.completedAt = Date.now();
    workflow.updatedAt = Date.now();
    
    if (result) {
      if (result.artifacts) step.artifacts.push(...result.artifacts);
      if (result.notes) step.notes.push(...result.notes);
      if (result.actualHours) step.actualHours = result.actualHours;
    }
    
    // Update workflow progress
    workflow.progress = this.calculateWorkflowProgress(workflow);
    
    console.log(`✅ Completed step: ${step.name} in workflow ${workflow.name}`);
    
    // Emit event
    this.emitEvent('step-completed', { workflow, step });
    
    // Start next steps
    const nextSteps = workflow.steps.filter(s => 
      s.status === 'pending' && 
      s.dependencies.includes(stepId)
    );
    
    for (const nextStep of nextSteps) {
      const dependenciesMet = nextStep.dependencies.every(depId => {
        const depStep = workflow.steps.find(s => s.id === depId);
        return depStep && depStep.status === 'completed';
      });
      
      if (dependenciesMet) {
        await this.startStep(workflowId, nextStep.id);
      }
    }
    
    // Check if workflow is complete
    if (workflow.steps.every(s => s.status === 'completed' || s.status === 'skipped')) {
      await this.completeWorkflow(workflowId);
    }
  }

  // Calculate workflow progress
  private calculateWorkflowProgress(workflow: TODOWorkflow): number {
    const completedSteps = workflow.steps.filter(s => s.status === 'completed').length;
    const totalSteps = workflow.steps.length;
    
    return totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  }

  // Complete workflow
  private async completeWorkflow(workflowId: string): Promise<void> {
    const workflow = this.workflows.get(workflowId);
    if (!workflow) return;
    
    workflow.status = 'completed';
    workflow.completedAt = Date.now();
    workflow.updatedAt = Date.now();
    workflow.progress = 100;
    
    // Update TODO status
    const todo = this.todos.get(workflow.todoId);
    if (todo) {
      todo.status = 'completed';
      todo.updatedAt = Date.now();
      
      // Calculate actual hours
      const totalActualHours = workflow.steps.reduce((sum, step) => 
        sum + (step.actualHours || step.estimatedHours || 0), 0
      );
      todo.actualHours = totalActualHours;
    }
    
    console.log(`🎉 Completed workflow: ${workflow.name}`);
    
    // Emit event
    this.emitEvent('workflow-completed', workflow);
  }

  // Get TODO by ID
  getTODO(id: string): TODOItem | undefined {
    return this.todos.get(id);
  }

  // Get all TODOs
  getTODOs(filter?: {
    status?: string;
    type?: string;
    priority?: string;
    assignee?: string;
    labels?: string[];
  }): TODOItem[] {
    let todos = Array.from(this.todos.values());
    
    if (filter) {
      if (filter.status) {
        todos = todos.filter(todo => todo.status === filter.status);
      }
      if (filter.type) {
        todos = todos.filter(todo => todo.type === filter.type);
      }
      if (filter.priority) {
        todos = todos.filter(todo => todo.priority === filter.priority);
      }
      if (filter.assignee) {
        todos = todos.filter(todo => todo.assignee === filter.assignee);
      }
      if (filter.labels && filter.labels.length > 0) {
        todos = todos.filter(todo => 
          filter.labels.some(label => todo.labels.includes(label))
        );
      }
    }
    
    return todos.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Get workflow by ID
  getWorkflow(id: string): TODOWorkflow | undefined {
    return this.workflows.get(id);
  }

  // Get all workflows
  getWorkflows(filter?: {
    status?: string;
    assignee?: string;
    todoId?: string;
  }): TODOWorkflow[] {
    let workflows = Array.from(this.workflows.values());
    
    if (filter) {
      if (filter.status) {
        workflows = workflows.filter(wf => wf.status === filter.status);
      }
      if (filter.assignee) {
        workflows = workflows.filter(wf => wf.assignee === filter.assignee);
      }
      if (filter.todoId) {
        workflows = workflows.filter(wf => wf.todoId === filter.todoId);
      }
    }
    
    return workflows.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Update TODO
  updateTODO(id: string, updates: Partial<TODOItem>): TODOItem | undefined {
    const todo = this.todos.get(id);
    if (!todo) return undefined;
    
    const updatedTodo = { ...todo, ...updates, updatedAt: Date.now() };
    this.todos.set(id, updatedTodo);
    
    // Emit event
    this.emitEvent('todo-updated', updatedTodo);
    
    return updatedTodo;
  }

  // Update workflow
  updateWorkflow(id: string, updates: Partial<TODOWorkflow>): TODOWorkflow | undefined {
    const workflow = this.workflows.get(id);
    if (!workflow) return undefined;
    
    const updatedWorkflow = { ...workflow, ...updates, updatedAt: Date.now() };
    this.workflows.set(id, updatedWorkflow);
    
    // Emit event
    this.emitEvent('workflow-updated', updatedWorkflow);
    
    return updatedWorkflow;
  }

  // Get TODO statistics
  getTODOStatistics(): TODOStatistics {
    const todos = Array.from(this.todos.values());
    
    const stats: TODOStatistics = {
      total: todos.length,
      byStatus: {},
      byType: {},
      byPriority: {},
      byAssignee: {},
      avgCompletionTime: 0,
      overdueCount: 0,
      completionRate: 0
    };
    
    // Count by status
    todos.forEach(todo => {
      stats.byStatus[todo.status] = (stats.byStatus[todo.status] || 0) + 1;
      stats.byType[todo.type] = (stats.byType[todo.type] || 0) + 1;
      stats.byPriority[todo.priority] = (stats.byPriority[todo.priority] || 0) + 1;
      
      if (todo.assignee) {
        stats.byAssignee[todo.assignee] = (stats.byAssignee[todo.assignee] || 0) + 1;
      }
      
      // Check overdue
      if (todo.dueDate && todo.dueDate < Date.now() && todo.status !== 'completed') {
        stats.overdueCount++;
      }
    });
    
    // Calculate average completion time
    const completedTodos = todos.filter(todo => todo.status === 'completed');
    if (completedTodos.length > 0) {
      const totalTime = completedTodos.reduce((sum, todo) => {
        const completionTime = todo.updatedAt - todo.createdAt;
        return sum + completionTime;
      }, 0);
      stats.avgCompletionTime = totalTime / completedTodos.length;
    }
    
    // Calculate completion rate
    stats.completionRate = todos.length > 0 ? (completedTodos.length / todos.length) * 100 : 0;
    
    return stats;
  }

  // Get workflow statistics
  getWorkflowStatistics(): {
    total: number;
    byStatus: { [key: string]: number };
    avgDuration: number;
    completionRate: number;
  } {
    const workflows = Array.from(this.workflows.values());
    
    const stats = {
      total: workflows.length,
      byStatus: {},
      avgDuration: 0,
      completionRate: 0
    };
    
    // Count by status
    workflows.forEach(workflow => {
      stats.byStatus[workflow.status] = (stats.byStatus[workflow.status] || 0) + 1;
    });
    
    // Calculate average duration
    const completedWorkflows = workflows.filter(wf => wf.status === 'completed');
    if (completedWorkflows.length > 0) {
      const totalTime = completedWorkflows.reduce((sum, wf) => {
        const duration = (wf.completedAt || wf.updatedAt) - wf.createdAt;
        return sum + duration;
      }, 0);
      stats.avgDuration = totalTime / completedWorkflows.length;
    }
    
    // Calculate completion rate
    stats.completionRate = workflows.length > 0 ? (completedWorkflows.length / workflows.length) * 100 : 0;
    
    return stats;
  }

  // Get available templates
  getTemplates(): WorkflowTemplate[] {
    return Array.from(this.templates.values());
  }

  // Add event listener
  addEventListener(event: string, callback: Function): void {
    if (!this.watchers.has(event)) {
      this.watchers.set(event, []);
    }
    this.watchers.get(event)!.push(callback);
  }

  // Remove event listener
  removeEventListener(event: string, callback: Function): void {
    const callbacks = this.watchers.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  // Emit event
  private emitEvent(event: string, data: any): void {
    const callbacks = this.watchers.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in event listener for ${event}:`, error);
        }
      });
    }
  }

  // Export data
  exportData(format: 'json' | 'csv' = 'json'): string {
    const data = {
      todos: Array.from(this.todos.values()),
      workflows: Array.from(this.workflows.values()),
      templates: Array.from(this.templates.values()),
      statistics: {
        todos: this.getTODOStatistics(),
        workflows: this.getWorkflowStatistics()
      }
    };
    
    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }
    
    // CSV export (simplified)
    const csvLines = ['id,title,type,priority,status,assignee,createdAt,updatedAt'];
    data.todos.forEach((todo: TODOItem) => {
      csvLines.push(`${todo.id},${todo.title},${todo.type},${todo.priority},${todo.status},${todo.assignee || ''},${todo.createdAt},${todo.updatedAt}`);
    });
    
    return csvLines.join('\n');
  }

  // Clear all data
  clearData(): void {
    this.todos.clear();
    this.workflows.clear();
    console.log('🗑️ TODO tracking data cleared');
  }
}

export default TODOTrackingService;