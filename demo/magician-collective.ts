// demo/magician-collective.ts
// Magician Module using useCollective - Mystical Orders and Covens
// Tests Cyre's collective intelligence through magical collaboration

import {cyre, useCollective} from '../src'

/*

      C.Y.R.E - M.A.G.I.C.A.L - C.O.L.L.E.C.T.I.V.E
      
      The Magician Collective demonstrates mystical collaboration:
      - Magical Covens: Groups of magicians working together
      - Spell Circles: Collaborative reality manifestation
      - Mystical Orders: Hierarchical magical organizations
      - Consensus Reality: Collective reality shaping
      - Shared Mystical Knowledge: Distributed magical wisdom
      - Ritual Coordination: Synchronized magical workings

*/

interface MagicalParticipant {
  id: string
  magicalName: string
  discipline:
    | 'transmutation'
    | 'divination'
    | 'illusion'
    | 'necromancy'
    | 'enchantment'
    | 'evocation'
  powerLevel: number
  specialties: string[]
  mysticRank: 'apprentice' | 'adept' | 'master' | 'archmage'
  contribution: number
}

interface MysticalRitual {
  id: string
  name: string
  type:
    | 'group-manifestation'
    | 'reality-weaving'
    | 'dimensional-working'
    | 'temporal-spell'
  requiredParticipants: number
  complexity: number
  powerRequired: number
  duration: number
  success: boolean
  manifestedReality?: any
}

interface CovenMetrics {
  totalPower: number
  consensusStrength: number
  realitiesManifested: number
  successfulRituals: number
  mysticResonance: number
  collectiveWisdom: number
}

export class MagicalCollectiveDemo {
  private activeCovens: Map<string, any> = new Map()
  private mysticalKnowledge: Map<string, any> = new Map()
  private sharedRealities: any[] = []

  /**
   * Create a Magical Coven using useCollective
   */
  async createMagicalCoven(covenName: string): Promise<any> {
    console.log(`🔮 Forming Magical Coven: ${covenName}`)

    const coven = useCollective(covenName, {
      type: 'custom',
      maxParticipants: 13, // Traditional coven size
      minParticipants: 3,
      consensus: 'weighted', // Based on magical power
      voting: {
        type: 'weighted',
        quorum: 0.6, // 60% participation needed
        timeout: 30000 // 30 seconds for magical consensus
      },
      sharedState: 'all', // Share all mystical knowledge
      stateSync: 'immediate', // Instant mystical connection
      conflictResolution: 'vote', // Magical democracy
      workDistribution: 'skill-based', // Match spells to specialties
      loadBalancing: 'weighted', // More powerful magicians handle complex spells
      notifications: 'all' // All magical events shared
    })

    this.activeCovens.set(covenName, coven)

    // Set up coven-specific magical channels
    await this.setupCovenMagic(covenName, coven)

    return coven
  }

  /**
   * Set up magical channels for the coven
   */
  private async setupCovenMagic(covenName: string, coven: any): Promise<void> {
    // Shared mystical knowledge channel
    cyre.action({id: `${covenName}-mystical-knowledge`, payload: {}})
    cyre.on(`${covenName}-mystical-knowledge`, async knowledge => {
      this.mysticalKnowledge.set(knowledge.topic, knowledge)

      // Share with all coven members
      await coven.broadcast({
        type: 'knowledge-shared',
        topic: knowledge.topic,
        wisdom: knowledge.wisdom,
        source: knowledge.contributor
      })

      return {
        stored: true,
        topic: knowledge.topic,
        accessibleTo: 'all-coven-members'
      }
    })

    // Group ritual coordination channel
    cyre.action({id: `${covenName}-ritual-circle`, payload: {}})
    cyre.on(`${covenName}-ritual-circle`, async (ritual: MysticalRitual) => {
      console.log(`  🕯️ Beginning ${ritual.name} ritual...`)

      // Check if enough participants
      const participants = coven.getParticipants()
      if (participants.length < ritual.requiredParticipants) {
        return {
          success: false,
          reason: 'insufficient-participants',
          required: ritual.requiredParticipants,
          available: participants.length
        }
      }

      // Calculate total coven power
      const totalPower = participants.reduce(
        (sum: number, p: any) => sum + (p.metadata?.powerLevel || 10),
        0
      )

      if (totalPower < ritual.powerRequired) {
        return {
          success: false,
          reason: 'insufficient-power',
          required: ritual.powerRequired,
          available: totalPower
        }
      }

      // Distribute ritual work based on specialties
      const workDistribution = await coven.distributeWork(
        [
          {task: 'channel-energy', requiredSkills: ['energy-work']},
          {task: 'maintain-circle', requiredSkills: ['protection']},
          {task: 'focus-intention', requiredSkills: ['concentration']},
          {task: 'manifest-reality', requiredSkills: [ritual.type]}
        ],
        'skill-based'
      )

      // Perform the ritual
      const manifestation = await this.performGroupRitual(ritual, participants)

      return {
        success: manifestation.success,
        manifestation: manifestation.result,
        participantCount: participants.length,
        powerUsed: totalPower,
        workDistribution: workDistribution.distribution,
        duration: ritual.duration
      }
    })

    // Consensus reality channel
    cyre.action({id: `${covenName}-consensus-reality`, payload: {}})
    cyre.on(`${covenName}-consensus-reality`, async realityProposal => {
      console.log(
        `  🌟 Proposing new consensus reality: ${realityProposal.name}`
      )

      // Create a proposal for the coven to vote on
      const proposal = await coven.propose(
        {
          type: 'reality-alteration',
          name: realityProposal.name,
          description: realityProposal.description,
          changes: realityProposal.changes,
          stability: realityProposal.stability || 0.8
        },
        {
          timeout: 45000, // 45 seconds for magical consensus
          proposer: realityProposal.proposer
        }
      )

      return {
        proposed: true,
        proposalId: proposal.data?.proposalId,
        requiresVoting: true,
        votingDeadline: Date.now() + 45000
      }
    })

    // Collective manifestation channel
    cyre.action({id: `${covenName}-collective-manifestation`, payload: {}})
    cyre.on(`${covenName}-collective-manifestation`, async intention => {
      const participants = coven.getParticipants()

      // Each participant contributes their energy
      const individualContributions = participants.map((p: any) => ({
        participantId: p.id,
        energy: (p.metadata?.powerLevel || 10) * Math.random(),
        intention: intention.goal,
        resonance: Math.random() * 0.5 + 0.5
      }))

      // Calculate collective manifestation power
      const totalEnergy = individualContributions.reduce(
        (sum, c) => sum + c.energy,
        0
      )
      const averageResonance =
        individualContributions.reduce((sum, c) => sum + c.resonance, 0) /
        individualContributions.length

      const manifestationPower = totalEnergy * averageResonance
      const success = manifestationPower > (intention.difficulty || 50)

      if (success) {
        const manifestedReality = {
          intention: intention.goal,
          power: manifestationPower,
          stability: averageResonance,
          contributors: individualContributions.length,
          timestamp: Date.now()
        }

        this.sharedRealities.push(manifestedReality)

        // Broadcast success to all participants
        await coven.broadcast({
          type: 'manifestation-success',
          reality: manifestedReality,
          yourContribution: 'significant'
        })
      }

      return {
        success,
        manifestationPower,
        participantCount: participants.length,
        totalEnergy,
        averageResonance,
        difficulty: intention.difficulty || 50
      }
    })
  }

  /**
   * Add a magician to the coven
   */
  async addMagicianToCoven(
    covenName: string,
    magician: MagicalParticipant
  ): Promise<any> {
    const coven = this.activeCovens.get(covenName)
    if (!coven) {
      throw new Error(`Coven ${covenName} does not exist`)
    }

    console.log(
      `  🧙‍♀️ ${magician.magicalName} (${magician.mysticRank}) joins the ${covenName}`
    )

    const result = await coven.join(magician.id, magician.mysticRank, {
      magicalName: magician.magicalName,
      discipline: magician.discipline,
      powerLevel: magician.powerLevel,
      specialties: magician.specialties,
      weight: this.calculateMagicalWeight(magician) // For weighted voting
    })

    if (result.success) {
      // Share initial mystical knowledge
      await cyre.call(`${covenName}-mystical-knowledge`, {
        topic: `${magician.discipline}-mastery`,
        wisdom: `Secrets of ${magician.discipline} magic`,
        contributor: magician.magicalName,
        powerLevel: magician.powerLevel
      })
    }

    return result
  }

  /**
   * Perform a group ritual with multiple magicians
   */
  private async performGroupRitual(
    ritual: MysticalRitual,
    participants: any[]
  ): Promise<{success: boolean; result: any}> {
    const magicalSteps = [
      'cast-circle',
      'invoke-elements',
      'channel-collective-energy',
      'focus-group-intention',
      'manifest-reality',
      'close-circle'
    ]

    let ritualPower = 0
    let stability = 1.0

    for (const step of magicalSteps) {
      // Each participant contributes to this step
      for (const participant of participants) {
        const contribution =
          (participant.metadata?.powerLevel || 10) * Math.random() * 0.8
        ritualPower += contribution

        // Slight stability loss with each step (realistic magical working)
        stability *= 0.95 + Math.random() * 0.05
      }
    }

    const success = ritualPower > ritual.powerRequired && stability > 0.6

    return {
      success,
      result: success
        ? {
            type: ritual.type,
            name: ritual.name,
            manifestedPower: ritualPower,
            finalStability: stability,
            participantCount: participants.length,
            realityAlteration: this.generateRealityAlteration(
              ritual,
              ritualPower
            )
          }
        : {
            failure: 'insufficient-power-or-stability',
            powerAchieved: ritualPower,
            finalStability: stability
          }
    }
  }

  /**
   * Vote on a magical proposal
   */
  async voteOnMagicalProposal(
    covenName: string,
    proposalId: string,
    participantId: string,
    vote: any
  ): Promise<any> {
    const coven = this.activeCovens.get(covenName)
    if (!coven) {
      throw new Error(`Coven ${covenName} does not exist`)
    }

    return await coven.vote(proposalId, vote, participantId)
  }

  /**
   * Get consensus on a magical proposal
   */
  async getMagicalConsensus(
    covenName: string,
    proposalId: string
  ): Promise<any> {
    const coven = this.activeCovens.get(covenName)
    if (!coven) {
      throw new Error(`Coven ${covenName} does not exist`)
    }

    return await coven.getConsensus(proposalId)
  }

  /**
   * Calculate magical weight for voting
   */
  private calculateMagicalWeight(magician: MagicalParticipant): number {
    const rankWeights = {
      apprentice: 1,
      adept: 2,
      master: 4,
      archmage: 8
    }

    const baseWeight = rankWeights[magician.mysticRank] || 1
    const powerModifier = Math.min(magician.powerLevel / 50, 2) // Cap at 2x
    const specialtyBonus = magician.specialties.length * 0.1

    return baseWeight * powerModifier + specialtyBonus
  }

  /**
   * Generate reality alteration based on ritual
   */
  private generateRealityAlteration(
    ritual: MysticalRitual,
    power: number
  ): any {
    const alterations = {
      'group-manifestation': {
        type: 'material-manifestation',
        impact: power > 100 ? 'major' : 'minor',
        description: `Materialized collective intention with ${power.toFixed(
          0
        )} units of power`
      },
      'reality-weaving': {
        type: 'dimensional-shift',
        impact: power > 150 ? 'reality-bending' : 'localized-change',
        description: `Wove new reality patterns affecting ${Math.floor(
          power / 10
        )} probability threads`
      },
      'dimensional-working': {
        type: 'portal-creation',
        impact: power > 200 ? 'permanent-gateway' : 'temporary-bridge',
        description: `Opened pathway between dimensions with ${power.toFixed(
          0
        )} dimensional stability`
      },
      'temporal-spell': {
        type: 'time-alteration',
        impact: power > 175 ? 'timeline-shift' : 'temporal-eddy',
        description: `Altered temporal flow affecting ${Math.floor(
          power / 20
        )} probability chains`
      }
    }

    return (
      alterations[ritual.type] || {
        type: 'unknown-magic',
        impact: 'mysterious',
        description: `Performed unknown magical working with ${power.toFixed(
          0
        )} units of collective power`
      }
    )
  }

  /**
   * Demo: The Council of Archmages
   */
  async demoCouncilOfArchmages(): Promise<void> {
    console.log('\n🏛️ THE COUNCIL OF ARCHMAGES COLLECTIVE DEMO')
    console.log('============================================')

    await cyre.init()

    // Create the Council coven
    const council = await this.createMagicalCoven('council-of-archmages')

    // Create powerful archmages
    const archmages: MagicalParticipant[] = [
      {
        id: 'archmage-1',
        magicalName: 'Zephyr the Reality Bender',
        discipline: 'transmutation',
        powerLevel: 95,
        specialties: [
          'reality-weaving',
          'matter-transformation',
          'energy-work'
        ],
        mysticRank: 'archmage',
        contribution: 0
      },
      {
        id: 'archmage-2',
        magicalName: 'Mystral the Time Weaver',
        discipline: 'divination',
        powerLevel: 88,
        specialties: ['temporal-magic', 'prophecy', 'concentration'],
        mysticRank: 'archmage',
        contribution: 0
      },
      {
        id: 'archmage-3',
        magicalName: 'Shadowmere the Void Walker',
        discipline: 'necromancy',
        powerLevel: 92,
        specialties: ['dimensional-working', 'protection', 'void-magic'],
        mysticRank: 'archmage',
        contribution: 0
      },
      {
        id: 'master-1',
        magicalName: 'Luminara the Light Bearer',
        discipline: 'enchantment',
        powerLevel: 75,
        specialties: ['group-manifestation', 'healing', 'harmony'],
        mysticRank: 'master',
        contribution: 0
      }
    ]

    // Add archmages to the council
    for (const archmage of archmages) {
      await this.addMagicianToCoven('council-of-archmages', archmage)
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    console.log(
      '\n🔮 Council formed! Performing collective magical workings...\n'
    )

    // Test 1: Collective Knowledge Sharing
    console.log('📚 Test 1: Sharing Mystical Knowledge')
    await cyre.call('council-of-archmages-mystical-knowledge', {
      topic: 'collective-manifestation-theory',
      wisdom:
        'When multiple magicians focus intention, reality bends exponentially',
      contributor: 'Zephyr the Reality Bender',
      powerLevel: 95
    })

    // Test 2: Group Ritual - Reality Manifestation
    console.log('\n🕯️ Test 2: Group Reality Manifestation Ritual')
    const grandRitual: MysticalRitual = {
      id: 'grand-manifestation-1',
      name: 'The Great Collective Manifestation',
      type: 'group-manifestation',
      requiredParticipants: 3,
      complexity: 8,
      powerRequired: 200,
      duration: 30000,
      success: false
    }

    const ritualResult = await cyre.call(
      'council-of-archmages-ritual-circle',
      grandRitual
    )
    console.log(
      '   Ritual Result:',
      ritualResult.payload?.success ? '✅ SUCCESS' : '❌ FAILED'
    )
    if (ritualResult.payload?.success) {
      console.log(
        '   Reality Alteration:',
        ritualResult.payload.manifestation.realityAlteration.description
      )
    }

    // Test 3: Consensus Reality Proposal
    console.log('\n🌟 Test 3: Consensus Reality Proposal')
    const realityProposal = {
      name: 'Enhanced Magical Resonance Field',
      description:
        'Increase magical power efficiency by 20% across all dimensions',
      changes: ['boost-magical-efficiency', 'stabilize-reality-matrix'],
      stability: 0.85,
      proposer: 'Mystral the Time Weaver'
    }

    const proposal = await cyre.call(
      'council-of-archmages-consensus-reality',
      realityProposal
    )
    console.log(
      '   Proposal Created:',
      proposal.payload?.proposed ? '✅ SUBMITTED' : '❌ FAILED'
    )

    if (proposal.payload?.proposed) {
      // Archmages vote on the proposal
      console.log('\n🗳️ Archmages voting on reality alteration...')

      const votes = [
        {
          archmage: 'archmage-1',
          vote: 'approve',
          reason: 'beneficial-for-transmutation'
        },
        {
          archmage: 'archmage-2',
          vote: 'approve',
          reason: 'enhances-temporal-magic'
        },
        {
          archmage: 'archmage-3',
          vote: 'approve',
          reason: 'stabilizes-void-workings'
        },
        {
          archmage: 'master-1',
          vote: 'approve',
          reason: 'improves-group-harmony'
        }
      ]

      for (const {archmage, vote, reason} of votes) {
        await this.voteOnMagicalProposal(
          'council-of-archmages',
          proposal.payload.proposalId,
          archmage,
          {
            decision: vote,
            reasoning: reason,
            magicalWeight: this.calculateMagicalWeight(
              archmages.find(a => a.id === archmage)!
            )
          }
        )
        console.log(
          `   ${archmages.find(a => a.id === archmage)?.magicalName}: ${vote}`
        )
      }

      // Get consensus
      const consensus = await this.getMagicalConsensus(
        'council-of-archmages',
        proposal.payload.proposalId
      )
      console.log(
        '\n   Consensus Result:',
        consensus.consensus?.achieved ? '✅ REALITY ALTERED' : '❌ NO CONSENSUS'
      )
    }

    // Test 4: Collective Manifestation
    console.log('\n✨ Test 4: Collective Manifestation Working')
    const manifestationIntent = {
      goal: 'Create a stable portal to the Ethereal Plane',
      difficulty: 180,
      description: 'Open permanent gateway for enhanced magical research'
    }

    const manifestation = await cyre.call(
      'council-of-archmages-collective-manifestation',
      manifestationIntent
    )
    console.log(
      '   Manifestation:',
      manifestation.payload?.success
        ? '✅ PORTAL CREATED'
        : '❌ INSUFFICIENT POWER'
    )
    if (manifestation.payload?.success) {
      console.log(
        `   Manifestation Power: ${manifestation.payload.manifestationPower.toFixed(
          0
        )} units`
      )
      console.log(
        `   Participants: ${manifestation.payload.participantCount} archmages`
      )
    }

    // Final council metrics
    console.log('\n📊 COUNCIL METRICS:')
    const participants = council.getParticipants()
    const metrics = council.getMetrics()

    console.log(`   Active Archmages: ${participants.length}`)
    console.log(
      `   Total Shared Knowledge: ${this.mysticalKnowledge.size} topics`
    )
    console.log(`   Realities Manifested: ${this.sharedRealities.length}`)
    console.log(`   Council Messages: ${metrics.messagesExchanged}`)
    console.log(
      `   Collective Wisdom Level: ${this.calculateCollectiveWisdom()}`
    )

    console.log(
      '\n🏛️ The Council of Archmages has demonstrated the power of magical collaboration!'
    )
    console.log(
      '   Through useCollective, individual magicians become reality-shaping forces!'
    )

    // Cleanup
    await council.destroy()
    cyre.clear()
  }

  /**
   * Calculate collective wisdom based on shared knowledge
   */
  private calculateCollectiveWisdom(): number {
    const knowledgeValue = this.mysticalKnowledge.size * 10
    const realityValue = this.sharedRealities.length * 25
    const experienceValue = this.activeCovens.size * 5

    return knowledgeValue + realityValue + experienceValue
  }

  /**
   * Demo: Battle of the Magical Schools
   */
  async demoBattleOfMagicalSchools(): Promise<void> {
    console.log('\n⚔️ BATTLE OF THE MAGICAL SCHOOLS')
    console.log('================================')

    // Create competing magical schools
    const elementalSchool = await this.createMagicalCoven('elemental-academy')
    const shadowSchool = await this.createMagicalCoven('shadow-consortium')

    // Add students and masters to each school
    const elementalMagicians = [
      {
        id: 'fire-master',
        magicalName: 'Ignis Flameheart',
        discipline: 'evocation' as const,
        powerLevel: 70,
        specialties: ['fire-magic'],
        mysticRank: 'master' as const,
        contribution: 0
      },
      {
        id: 'water-adept',
        magicalName: 'Aqua Tidecaller',
        discipline: 'enchantment' as const,
        powerLevel: 45,
        specialties: ['water-magic'],
        mysticRank: 'adept' as const,
        contribution: 0
      }
    ]

    const shadowMagicians = [
      {
        id: 'void-master',
        magicalName: 'Umbra Voidwhisper',
        discipline: 'necromancy' as const,
        powerLevel: 75,
        specialties: ['shadow-magic'],
        mysticRank: 'master' as const,
        contribution: 0
      },
      {
        id: 'illusion-adept',
        magicalName: 'Mirage Dreamweaver',
        discipline: 'illusion' as const,
        powerLevel: 50,
        specialties: ['illusion-magic'],
        mysticRank: 'adept' as const,
        contribution: 0
      }
    ]

    // Form the schools
    for (const mage of elementalMagicians) {
      await this.addMagicianToCoven('elemental-academy', mage)
    }

    for (const mage of shadowMagicians) {
      await this.addMagicianToCoven('shadow-consortium', mage)
    }

    console.log('\n🔥 Elemental Academy vs 🌑 Shadow Consortium')

    // Competing rituals
    const elementalRitual: MysticalRitual = {
      id: 'elemental-storm',
      name: 'Primal Elemental Storm',
      type: 'group-manifestation',
      requiredParticipants: 2,
      complexity: 6,
      powerRequired: 80,
      duration: 15000,
      success: false
    }

    const shadowRitual: MysticalRitual = {
      id: 'void-gateway',
      name: 'Gateway to the Void',
      type: 'dimensional-working',
      requiredParticipants: 2,
      complexity: 7,
      powerRequired: 90,
      duration: 18000,
      success: false
    }

    // Both schools perform competing rituals
    const [elementalResult, shadowResult] = await Promise.all([
      cyre.call('elemental-academy-ritual-circle', elementalRitual),
      cyre.call('shadow-consortium-ritual-circle', shadowRitual)
    ])

    console.log('\n⚔️ Magical Battle Results:')
    console.log(
      '   Elemental Academy:',
      elementalResult.payload?.success
        ? '✅ STORM SUMMONED'
        : '❌ RITUAL FAILED'
    )
    console.log(
      '   Shadow Consortium:',
      shadowResult.payload?.success ? '✅ VOID OPENED' : '❌ PORTAL COLLAPSED'
    )

    // Determine winner based on successful manifestations
    const elementalPower =
      elementalResult.payload?.manifestation?.manifestedPower || 0
    const shadowPower =
      shadowResult.payload?.manifestation?.manifestedPower || 0

    if (elementalPower > shadowPower) {
      console.log('\n🏆 Elemental Academy WINS the magical duel!')
    } else if (shadowPower > elementalPower) {
      console.log('\n🏆 Shadow Consortium WINS the magical duel!')
    } else {
      console.log('\n🤝 The magical schools reach a mystical stalemate!')
    }

    // Cleanup
    await Promise.all([elementalSchool.destroy(), shadowSchool.destroy()])
  }
}

// Main demo runner
export const runMagicalCollectiveDemo = async () => {
  const demo = new MagicalCollectiveDemo()

  try {
    await demo.demoCouncilOfArchmages()
    await demo.demoBattleOfMagicalSchools()
  } catch (error) {
    console.error('❌ Magical collective demo failed:', error)
  }
}

runMagicalCollectiveDemo().catch(console.error)
