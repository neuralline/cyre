/**
 * src/hooks/use-collective.ts
 * Full implementation of Cyre Collective Intelligence
 * Enables multi-participant coordination and shared decision making
 */

import {cyre, log} from '../'

// Collective configuration types
export interface CollectiveConfig {
  // Basic settings
  id: string
  type?: 'chat' | 'collaboration' | 'computing' | 'gaming' | 'custom'
  maxParticipants?: number
  minParticipants?: number

  // State management
  sharedState?: string[] | 'all' | 'none'
  stateSync?: 'immediate' | 'batched' | 'manual'
  conflictResolution?:
    | 'last-write-wins'
    | 'first-write-wins'
    | 'merge'
    | 'vote'
    | 'custom'

  // Permissions
  joinPermission?: 'open' | 'invite-only' | 'admin-approval' | 'custom'
  readPermission?: 'member' | 'moderator' | 'admin' | 'custom'
  writePermission?: 'member' | 'moderator' | 'admin' | 'custom'

  // Load balancing & distribution
  loadBalancing?:
    | 'round-robin'
    | 'least-busy'
    | 'random'
    | 'weighted'
    | 'custom'
  workDistribution?: 'auto' | 'manual' | 'skill-based' | 'load-based'

  // Decision making
  consensus?: 'majority' | 'unanimous' | 'weighted' | 'admin-decides' | 'custom'
  voting?: {
    type: 'simple' | 'weighted' | 'ranked-choice'
    quorum?: number
    timeout?: number
  }

  // Lifecycle
  autoDestroy?: boolean | 'when-empty' | 'timeout'
  timeout?: number // milliseconds
  duration?: number // milliseconds

  // Communication
  broadcasting?: 'all' | 'selective' | 'hierarchical'
  notifications?: 'all' | 'important-only' | 'none'
  messageHistory?: number

  // Advanced features
  healthCheck?: boolean
  autoScaling?: boolean
  failover?: 'immediate' | 'graceful' | 'none'
  encryption?: boolean
  audit?: boolean
}

export interface Participant {
  id: string
  role: 'member' | 'moderator' | 'admin' | 'owner'
  weight?: number // For weighted voting/decisions
  capabilities?: string[] // For skill-based distribution
  status: 'active' | 'idle' | 'disconnected'
  joinedAt: number
  lastActivity: number
  metadata?: Record<string, any>
}

export interface CollectiveState {
  id: string
  participants: Map<string, Participant>
  sharedData: Record<string, any>
  messageHistory: any[]
  metrics: {
    totalCalls: number
    activeParticipants: number
    messagesExchanged: number
    consensusReached: number
    conflictsResolved: number
    uptime: number
  }
  status: 'active' | 'paused' | 'destroyed'
  createdAt: number
  lastActivity: number
}

export interface CollectiveResult {
  success: boolean
  data?: any
  participants?: string[]
  consensus?: {
    achieved: boolean
    votes: Record<string, any>
    result: any
  }
  distribution?: {
    assigned: Record<string, any>
    completed: number
    pending: number
  }
  error?: string
  metadata?: Record<string, any>
}

export interface CollectiveInstance {
  id: string
  config: CollectiveConfig

  // Core operations
  join: (
    participantId: string,
    role?: string,
    metadata?: any
  ) => Promise<CollectiveResult>
  leave: (participantId: string) => Promise<CollectiveResult>
  call: (
    operation: string,
    data?: any,
    options?: any
  ) => Promise<CollectiveResult>
  broadcast: (
    message: any,
    filter?: (p: Participant) => boolean
  ) => Promise<CollectiveResult>

  // State management
  getState: () => CollectiveState
  updateSharedState: (key: string, value: any) => Promise<CollectiveResult>
  getSharedState: (key?: string) => any

  // Decision making
  propose: (proposal: any, options?: any) => Promise<CollectiveResult>
  vote: (
    proposalId: string,
    vote: any,
    participantId: string
  ) => Promise<CollectiveResult>
  getConsensus: (proposalId: string) => Promise<CollectiveResult>

  // Work distribution
  distributeWork: (work: any[], strategy?: string) => Promise<CollectiveResult>
  assignTask: (participantId: string, task: any) => Promise<CollectiveResult>
  completeTask: (taskId: string, result: any) => Promise<CollectiveResult>

  // Participant management
  getParticipants: () => Participant[]
  getParticipant: (id: string) => Participant | undefined
  updateParticipant: (
    id: string,
    updates: Partial<Participant>
  ) => Promise<CollectiveResult>
  kickParticipant: (id: string, reason?: string) => Promise<CollectiveResult>

  // Lifecycle
  pause: () => Promise<CollectiveResult>
  resume: () => Promise<CollectiveResult>
  destroy: () => Promise<CollectiveResult>

  // Metrics & monitoring
  getMetrics: () => any
  getHealth: () => {status: string; issues: string[]}
}

// Global collective registry
const collectives = new Map<string, CollectiveState>()
const activeProposals = new Map<string, any>()
const activeTasks = new Map<string, any>()

/**
 * Create or join a collective intelligence system
 */
export const useCollective = (
  collectiveId: string,
  config: Partial<CollectiveConfig> = {}
): CollectiveInstance => {
  const fullConfig: CollectiveConfig = {
    id: collectiveId,
    type: 'custom',
    maxParticipants: 1000,
    minParticipants: 1,
    sharedState: 'all',
    stateSync: 'immediate',
    conflictResolution: 'last-write-wins',
    joinPermission: 'open',
    readPermission: 'member',
    writePermission: 'member',
    loadBalancing: 'round-robin',
    workDistribution: 'auto',
    consensus: 'majority',
    autoDestroy: false,
    broadcasting: 'all',
    notifications: 'all',
    messageHistory: 100,
    healthCheck: true,
    autoScaling: false,
    failover: 'graceful',
    encryption: false,
    audit: false,
    ...config
  }

  // Initialize collective if it doesn't exist
  if (!collectives.has(collectiveId)) {
    const initialState: CollectiveState = {
      id: collectiveId,
      participants: new Map(),
      sharedData: {},
      messageHistory: [],
      metrics: {
        totalCalls: 0,
        activeParticipants: 0,
        messagesExchanged: 0,
        consensusReached: 0,
        conflictsResolved: 0,
        uptime: 0
      },
      status: 'active',
      createdAt: Date.now(),
      lastActivity: Date.now()
    }

    collectives.set(collectiveId, initialState)
    // Set up collective coordination channel
    cyre.action({
      id: `collective://${collectiveId}`,
      payload: {collectiveId, status: 'active'}
    })

    // Set up collective message handler
    cyre.on(`collective://${collectiveId}`, async (data: any) => {
      return await handleCollectiveOperation(collectiveId, data)
    })
    log.sys(collectiveId)

    log.info(`Collective created: ${collectiveId}`)
  }

  const collective = collectives.get(collectiveId)!

  // Implementation of collective operations
  const instance: CollectiveInstance = {
    id: collectiveId,
    config: fullConfig,

    // Core operations
    join: async (participantId: string, role = 'member', metadata = {}) => {
      try {
        // Check permissions
        if (fullConfig.joinPermission === 'invite-only') {
          // Would check invite list
        }

        // Check max participants
        if (collective.participants.size >= fullConfig.maxParticipants!) {
          return {success: false, error: 'Collective at maximum capacity'}
        }

        const participant: Participant = {
          id: participantId,
          role: role as any,
          weight: metadata.weight || 1,
          capabilities: metadata.capabilities || [],
          status: 'active',
          joinedAt: Date.now(),
          lastActivity: Date.now(),
          metadata
        }

        collective.participants.set(participantId, participant)
        collective.metrics.activeParticipants = collective.participants.size
        collective.lastActivity = Date.now()

        // Broadcast join notification
        if (fullConfig.notifications !== 'none') {
          await instance.broadcast({
            type: 'participant-joined',
            participantId,
            role,
            timestamp: Date.now()
          })
        }

        log.info(
          `Participant ${participantId} joined collective ${collectiveId}`
        )

        return {
          success: true,
          data: participant,
          participants: Array.from(collective.participants.keys())
        }
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    leave: async (participantId: string) => {
      try {
        if (!collective.participants.has(participantId)) {
          return {success: false, error: 'Participant not found'}
        }

        collective.participants.delete(participantId)
        collective.metrics.activeParticipants = collective.participants.size
        collective.lastActivity = Date.now()

        // Broadcast leave notification
        if (fullConfig.notifications !== 'none') {
          await instance.broadcast({
            type: 'participant-left',
            participantId,
            timestamp: Date.now()
          })
        }

        // Auto-destroy if configured and empty
        if (
          fullConfig.autoDestroy === 'when-empty' &&
          collective.participants.size === 0
        ) {
          await instance.destroy()
        }

        log.info(`Participant ${participantId} left collective ${collectiveId}`)

        return {
          success: true,
          participants: Array.from(collective.participants.keys())
        }
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    call: async (operation: string, data = {}, options = {}) => {
      try {
        collective.metrics.totalCalls++
        collective.lastActivity = Date.now()

        const result = await cyre.call(`collective://${collectiveId}`, {
          operation,
          data,
          options,
          timestamp: Date.now()
        })

        return {success: true, data: result.payload}
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    broadcast: async (message: any, filter?: (p: Participant) => boolean) => {
      try {
        const participants = Array.from(collective.participants.values())
        const targetParticipants = filter
          ? participants.filter(filter)
          : participants

        const broadcasts = targetParticipants.map(async participant => {
          try {
            return await cyre.call(`participant://${participant.id}`, {
              type: 'collective-broadcast',
              collectiveId,
              message,
              timestamp: Date.now()
            })
          } catch (error) {
            log.warn(`Failed to broadcast to ${participant.id}: ${error}`)
            return null
          }
        })

        const results = await Promise.allSettled(broadcasts)
        const successful = results.filter(r => r.status === 'fulfilled').length

        collective.metrics.messagesExchanged++

        // Store in message history
        if (fullConfig.messageHistory! > 0) {
          collective.messageHistory.push({
            message,
            timestamp: Date.now(),
            recipients: targetParticipants.length,
            delivered: successful
          })

          // Trim history if too long
          if (collective.messageHistory.length > fullConfig.messageHistory!) {
            collective.messageHistory = collective.messageHistory.slice(
              -fullConfig.messageHistory!
            )
          }
        }

        return {
          success: true,
          data: {
            sent: targetParticipants.length,
            delivered: successful
          }
        }
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    // State management
    getState: () => collective,

    updateSharedState: async (key: string, value: any) => {
      try {
        if (fullConfig.sharedState === 'none') {
          return {success: false, error: 'Shared state disabled'}
        }

        if (
          Array.isArray(fullConfig.sharedState) &&
          !fullConfig.sharedState.includes(key)
        ) {
          return {
            success: false,
            error: `Key '${key}' not allowed in shared state`
          }
        }

        // Handle conflict resolution
        if (collective.sharedData[key] !== undefined) {
          switch (fullConfig.conflictResolution) {
            case 'first-write-wins':
              return {
                success: false,
                error: 'Key already exists (first-write-wins)'
              }
            case 'last-write-wins':
              // Continue with update
              break
            case 'merge':
              if (
                typeof collective.sharedData[key] === 'object' &&
                typeof value === 'object'
              ) {
                value = {...collective.sharedData[key], ...value}
              }
              break
            case 'vote':
              // Would trigger voting process
              return await instance.propose({type: 'state-update', key, value})
          }

          collective.metrics.conflictsResolved++
        }

        collective.sharedData[key] = value
        collective.lastActivity = Date.now()

        // Sync to participants if immediate sync
        if (fullConfig.stateSync === 'immediate') {
          await instance.broadcast({
            type: 'state-updated',
            key,
            value,
            timestamp: Date.now()
          })
        }

        return {success: true, data: {key, value}}
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    getSharedState: (key?: string) => {
      if (key) {
        return collective.sharedData[key]
      }
      return collective.sharedData
    },

    // Decision making
    propose: async (proposal: any, options = {}) => {
      try {
        const proposalId = `proposal-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`

        const proposalData = {
          id: proposalId,
          collectiveId,
          proposal,
          options,
          createdAt: Date.now(),
          createdBy: options.proposer || 'system',
          votes: new Map(),
          status: 'active',
          timeout: options.timeout || fullConfig.voting?.timeout || 300000 // 5 minutes default
        }

        activeProposals.set(proposalId, proposalData)

        // Broadcast proposal to all participants
        await instance.broadcast({
          type: 'new-proposal',
          proposalId,
          proposal,
          timeout: proposalData.timeout
        })

        // Set timeout for automatic resolution
        setTimeout(async () => {
          if (activeProposals.has(proposalId)) {
            await instance.getConsensus(proposalId)
          }
        }, proposalData.timeout)

        return {success: true, data: {proposalId, proposal}}
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    vote: async (proposalId: string, vote: any, participantId: string) => {
      try {
        const proposal = activeProposals.get(proposalId)
        if (!proposal) {
          return {success: false, error: 'Proposal not found'}
        }

        const participant = collective.participants.get(participantId)
        if (!participant) {
          return {success: false, error: 'Participant not found'}
        }

        // Check voting permissions
        if (
          fullConfig.writePermission === 'admin' &&
          participant.role !== 'admin'
        ) {
          return {success: false, error: 'Insufficient permissions to vote'}
        }

        // Record vote
        proposal.votes.set(participantId, {
          vote,
          weight: participant.weight || 1,
          timestamp: Date.now()
        })

        return {success: true, data: {proposalId, vote}}
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    getConsensus: async (proposalId: string) => {
      try {
        const proposal = activeProposals.get(proposalId)
        if (!proposal) {
          return {success: false, error: 'Proposal not found'}
        }

        const totalParticipants = collective.participants.size
        const requiredQuorum = fullConfig.voting?.quorum || 0.5
        const votesReceived = proposal.votes.size

        if (votesReceived < totalParticipants * requiredQuorum) {
          return {success: false, error: 'Quorum not reached'}
        }

        // Calculate consensus based on type
        let consensus: any = {achieved: false, result: null}
        const votes = Array.from(proposal.votes.values())

        switch (fullConfig.consensus) {
          case 'majority':
            const voteCount = new Map()
            votes.forEach(v => {
              const count = voteCount.get(v.vote) || 0
              voteCount.set(v.vote, count + 1)
            })

            const maxVotes = Math.max(...Array.from(voteCount.values()))
            if (maxVotes > totalParticipants / 2) {
              const winningVote = Array.from(voteCount.entries()).find(
                ([vote, count]) => count === maxVotes
              )
              consensus = {achieved: true, result: winningVote![0]}
            }
            break

          case 'weighted':
            const weightedVotes = new Map()
            votes.forEach(v => {
              const weight = weightedVotes.get(v.vote) || 0
              weightedVotes.set(v.vote, weight + v.weight)
            })

            const totalWeight = votes.reduce((sum, v) => sum + v.weight, 0)
            const maxWeight = Math.max(...Array.from(weightedVotes.values()))
            if (maxWeight > totalWeight / 2) {
              const winningVote = Array.from(weightedVotes.entries()).find(
                ([vote, weight]) => weight === maxWeight
              )
              consensus = {achieved: true, result: winningVote![0]}
            }
            break

          case 'unanimous':
            const firstVote = votes[0]?.vote
            if (votes.every(v => v.vote === firstVote)) {
              consensus = {achieved: true, result: firstVote}
            }
            break
        }

        if (consensus.achieved) {
          collective.metrics.consensusReached++
          proposal.status = 'resolved'

          // Broadcast consensus result
          await instance.broadcast({
            type: 'consensus-reached',
            proposalId,
            result: consensus.result,
            votes: votes.length
          })
        }

        activeProposals.delete(proposalId)

        return {
          success: true,
          consensus,
          data: {
            proposalId,
            votes: votes.length,
            totalParticipants
          }
        }
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    // Work distribution
    distributeWork: async (
      work: any[],
      strategy = fullConfig.workDistribution
    ) => {
      try {
        const participants = Array.from(
          collective.participants.values()
        ).filter(p => p.status === 'active')

        if (participants.length === 0) {
          return {success: false, error: 'No active participants'}
        }

        const assignments: Record<string, any[]> = {}

        switch (strategy) {
          case 'auto':
          case 'load-based':
            // Distribute evenly
            work.forEach((item, index) => {
              const participant = participants[index % participants.length]
              if (!assignments[participant.id]) assignments[participant.id] = []
              assignments[participant.id].push(item)
            })
            break

          case 'skill-based':
            // Match work to participant capabilities
            work.forEach(item => {
              const suitableParticipant =
                participants.find(p =>
                  item.requiredSkills?.some((skill: string) =>
                    p.capabilities?.includes(skill)
                  )
                ) || participants[0] // Fallback to first participant

              if (!assignments[suitableParticipant.id])
                assignments[suitableParticipant.id] = []
              assignments[suitableParticipant.id].push(item)
            })
            break
        }

        // Assign tasks to participants
        const taskAssignments = await Promise.all(
          Object.entries(assignments).map(async ([participantId, tasks]) => {
            return await instance.assignTask(participantId, tasks)
          })
        )

        return {
          success: true,
          distribution: {
            assigned: assignments,
            completed: 0,
            pending: work.length
          }
        }
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    assignTask: async (participantId: string, task: any) => {
      try {
        const taskId = `task-${Date.now()}-${Math.random()
          .toString(36)
          .substr(2, 9)}`

        activeTasks.set(taskId, {
          id: taskId,
          collectiveId,
          participantId,
          task,
          status: 'assigned',
          assignedAt: Date.now()
        })

        // Notify participant of task assignment
        await cyre.call(`participant://${participantId}`, {
          type: 'task-assigned',
          taskId,
          task,
          collectiveId
        })

        return {success: true, data: {taskId, participantId, task}}
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    completeTask: async (taskId: string, result: any) => {
      try {
        const task = activeTasks.get(taskId)
        if (!task) {
          return {success: false, error: 'Task not found'}
        }

        task.status = 'completed'
        task.result = result
        task.completedAt = Date.now()

        // Broadcast task completion
        await instance.broadcast({
          type: 'task-completed',
          taskId,
          participantId: task.participantId,
          result
        })

        activeTasks.delete(taskId)

        return {success: true, data: {taskId, result}}
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    // Participant management
    getParticipants: () => Array.from(collective.participants.values()),

    getParticipant: (id: string) => collective.participants.get(id),

    updateParticipant: async (id: string, updates: Partial<Participant>) => {
      try {
        const participant = collective.participants.get(id)
        if (!participant) {
          return {success: false, error: 'Participant not found'}
        }

        const updatedParticipant = {
          ...participant,
          ...updates,
          lastActivity: Date.now()
        }
        collective.participants.set(id, updatedParticipant)

        return {success: true, data: updatedParticipant}
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    kickParticipant: async (id: string, reason = 'No reason provided') => {
      try {
        const result = await instance.leave(id)

        if (result.success) {
          // Broadcast kick notification
          await instance.broadcast({
            type: 'participant-kicked',
            participantId: id,
            reason,
            timestamp: Date.now()
          })
        }

        return result
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    // Lifecycle
    pause: async () => {
      collective.status = 'paused'
      await instance.broadcast({type: 'collective-paused'})
      return {success: true}
    },

    resume: async () => {
      collective.status = 'active'
      await instance.broadcast({type: 'collective-resumed'})
      return {success: true}
    },

    destroy: async () => {
      try {
        // Notify all participants
        await instance.broadcast({type: 'collective-destroyed'})

        // Clean up channels
        cyre.forget(`collective://${collectiveId}`)

        // Remove from registry
        collectives.delete(collectiveId)

        // Clean up proposals and tasks
        Array.from(activeProposals.keys())
          .filter(
            key => activeProposals.get(key)?.collectiveId === collectiveId
          )
          .forEach(key => activeProposals.delete(key))

        Array.from(activeTasks.keys())
          .filter(key => activeTasks.get(key)?.collectiveId === collectiveId)
          .forEach(key => activeTasks.delete(key))

        log.info(`Collective destroyed: ${collectiveId}`)

        return {success: true}
      } catch (error) {
        return {success: false, error: String(error)}
      }
    },

    // Metrics & monitoring
    getMetrics: () => ({
      ...collective.metrics,
      uptime: Date.now() - collective.createdAt,
      participants: collective.participants.size,
      sharedDataKeys: Object.keys(collective.sharedData).length,
      messageHistory: collective.messageHistory.length
    }),

    getHealth: () => {
      const issues: string[] = []

      if (collective.participants.size < fullConfig.minParticipants!) {
        issues.push('Below minimum participants')
      }

      if (Date.now() - collective.lastActivity > 300000) {
        // 5 minutes
        issues.push('No recent activity')
      }

      const inactiveParticipants = Array.from(
        collective.participants.values()
      ).filter(p => Date.now() - p.lastActivity > 600000) // 10 minutes

      if (inactiveParticipants.length > 0) {
        issues.push(`${inactiveParticipants.length} inactive participants`)
      }

      return {
        status: issues.length === 0 ? 'healthy' : 'degraded',
        issues
      }
    }
  }

  // Set up auto-destroy timeout if configured
  if (fullConfig.duration) {
    setTimeout(async () => {
      await instance.destroy()
    }, fullConfig.duration)
  }

  return instance
}

/**
 * Handle collective operations
 */
const handleCollectiveOperation = async (collectiveId: string, data: any) => {
  const collective = collectives.get(collectiveId)
  if (!collective) {
    return {error: 'Collective not found'}
  }

  const {operation, data: opData, options} = data

  switch (operation) {
    case 'heartbeat':
      return {
        status: collective.status,
        participants: collective.participants.size
      }

    case 'get-info':
      return {
        id: collective.id,
        participants: collective.participants.size,
        status: collective.status,
        metrics: collective.metrics
      }

    case 'custom':
      // Allow custom operations
      return {operation, data: opData, timestamp: Date.now()}

    default:
      return {error: `Unknown operation: ${operation}`}
  }
}

/**
 * Get all active collectives
 */
export const getCollectives = () => {
  return Array.from(collectives.keys())
}

/**
 * Get collective by ID
 */
export const getCollective = (id: string) => {
  return collectives.get(id)
}

/**
 * Destroy all collectives (cleanup utility)
 */
export const destroyAllCollectives = async () => {
  const destroyPromises = Array.from(collectives.keys()).map(async id => {
    const collective = useCollective(id)
    return await collective.destroy()
  })

  await Promise.all(destroyPromises)
  log.info('All collectives destroyed')
}
