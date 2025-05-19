// cyre-hooks-example.ts
// A simple task manager demonstrating Cyre 4.0 hooks in Node.js

import {cyre, useCyre} from '../src'

// Define task types
interface Task {
  id: string
  title: string
  completed: boolean
  priority: 'low' | 'medium' | 'high'
}

type TaskState = {
  tasks: Task[]
  loading: boolean
  lastUpdated?: number
  error?: string
}

// Simple logging middleware
const loggingMiddleware = async (
  payload: TaskState,
  next: (payload: TaskState) => Promise<any>
) => {
  console.log(
    `[${new Date().toISOString()}] Processing state update:`,
    `${payload.tasks.length} tasks, loading: ${payload.loading}`
  )
  const result = await next(payload)
  console.log(`[${new Date().toISOString()}] State update completed`)
  return result
}

// Error handling middleware
const errorHandlingMiddleware = async (
  payload: TaskState,
  next: (payload: TaskState) => Promise<any>
) => {
  try {
    return await next(payload)
  } catch (error) {
    console.error('Error in task operation:', error)
    // Return modified payload with error information
    return {
      ok: false,
      payload: {
        ...payload,
        error: error instanceof Error ? error.message : String(error)
      },
      message: 'Operation failed'
    }
  }
}

// Create task manager
async function runTaskManager() {
  console.log('Starting Task Manager with Cyre 4.0 Hooks...')

  // Initialize Cyre (though this happens automatically in most cases)
  cyre.initialize()

  // Create task manager using Cyre hooks
  const taskManager = useCyre<TaskState>(
    {
      protection: {
        debounce: 100, // Collapse rapid updates
        detectChanges: true, // Only update when state actually changes
        throttle: 200 // Minimum time between executions
      },
      priority: {level: 'high'}, // Use high priority for responsiveness
      initialPayload: {
        // Initial state
        tasks: [],
        loading: false
      },
      debug: true // Enable debug logging
    },
    'task-manager'
  ) // Channel prefix

  // Add middleware
  taskManager.middleware(loggingMiddleware)
  taskManager.middleware(errorHandlingMiddleware)

  // Subscribe to updates
  const subscription = taskManager.on(payload => {
    if (payload) {
      const state = payload as TaskState
      console.log('\n📋 Current Tasks:')
      if (state.tasks.length === 0) {
        console.log('  No tasks yet')
      } else {
        state.tasks.forEach(task => {
          console.log(
            `  [${task.completed ? '✓' : ' '}] ${task.title} (${task.priority})`
          )
        })
      }

      if (state.error) {
        console.log(`\n❌ Error: ${state.error}`)
      }

      if (state.lastUpdated) {
        console.log(
          `\nLast updated: ${new Date(state.lastUpdated).toLocaleTimeString()}`
        )
      }
    }
    return {executed: true}
  })

  // Helper functions for task operations
  async function addTask(
    title: string,
    priority: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<void> {
    console.log(`\nAdding task: "${title}" with priority ${priority}`)

    // Get current state
    const currentState = (taskManager.get()?.payload as TaskState) || {
      tasks: [],
      loading: false
    }

    // Add loading indicator
    await taskManager.call({
      ...currentState,
      loading: true
    })

    // Simulate some processing time
    await new Promise(resolve => setTimeout(resolve, 300))

    // Create new task
    const newTask: Task = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      priority
    }

    // Update state with new task
    const result = await taskManager.call({
      tasks: [...currentState.tasks, newTask],
      loading: false,
      lastUpdated: Date.now()
    })

    if (result.ok) {
      console.log(`Added task: ${newTask.id}`)
    } else {
      console.error(`Failed to add task: ${result.message}`)
    }
  }

  async function toggleTask(id: string): Promise<void> {
    console.log(`\nToggling completion for task: ${id}`)

    // Get current state
    const currentState = taskManager.get()?.payload as TaskState
    if (!currentState) return

    // Find task
    const taskIndex = currentState.tasks.findIndex(t => t.id === id)
    if (taskIndex === -1) {
      console.error(`Task not found: ${id}`)
      return
    }

    // Create updated task list
    const updatedTasks = [...currentState.tasks]
    updatedTasks[taskIndex] = {
      ...updatedTasks[taskIndex],
      completed: !updatedTasks[taskIndex].completed
    }

    // Update state
    await taskManager.call({
      ...currentState,
      tasks: updatedTasks,
      lastUpdated: Date.now()
    })
  }

  async function deleteTask(id: string): Promise<void> {
    console.log(`\nDeleting task: ${id}`)

    // Get current state
    const currentState = taskManager.get()?.payload as TaskState
    if (!currentState) return

    // Use safeCall for better error handling
    const result = await taskManager.safeCall({
      ...currentState,
      tasks: currentState.tasks.filter(task => task.id !== id),
      lastUpdated: Date.now()
    })

    if (!result.success) {
      console.error(`Failed to delete task: ${result.error.message}`)
    }
  }

  // Monitor breathing state (system health)
  function monitorSystemHealth() {
    const breathingState = taskManager.getBreathingState()
    console.log(`\nSystem Health:`)
    console.log(`  Stress level: ${(breathingState.stress * 100).toFixed(1)}%`)
    console.log(`  Breathing rate: ${breathingState.currentRate}ms`)
    console.log(`  Pattern: ${breathingState.pattern}`)
    console.log(
      `  Recuperation: ${breathingState.isRecuperating ? 'Active' : 'Inactive'}`
    )
  }

  // Demo operations
  try {
    // Add some initial tasks
    await addTask('Learn Cyre 4.0 Hooks', 'high')
    await addTask('Create task manager example', 'medium')
    await addTask('Test middleware functionality', 'low')

    // Show system health
    monitorSystemHealth()

    // Mark a task as completed
    const state = taskManager.get()?.payload as TaskState
    if (state && state.tasks.length > 0) {
      await toggleTask(state.tasks[0].id)
    }

    // Delete a task
    if (state && state.tasks.length > 0) {
      await deleteTask(state.tasks[state.tasks.length - 1].id)
    }

    // Add one more task
    await addTask('Deploy to production', 'high')

    // Show metrics
    const metrics = taskManager.metrics()
    console.log('\nChannel Metrics:')
    console.log(`  Active formations: ${metrics.activeFormations}`)
    console.log(
      `  Breathing stress: ${(metrics.breathing.stress * 100).toFixed(1)}%`
    )

    // Show execution history
    const history = taskManager.getHistory()
    console.log('\nRecent Operations:')
    history.forEach((entry, i) => {
      console.log(
        `  ${i + 1}. ${new Date(entry.timestamp).toLocaleTimeString()} - ${
          entry.response.ok ? 'Success' : 'Failed'
        }`
      )
    })

    // Cleanup
    console.log('\nCleaning up...')
    subscription.unsubscribe()
    taskManager.forget()
    console.log('Task manager shutdown complete.')
  } catch (error) {
    console.error('Error in task manager demo:', error)
  }
}

// Run the example
runTaskManager().catch(console.error)
