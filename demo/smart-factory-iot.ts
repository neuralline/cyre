// demo/smart-factory-iot.ts
// Smart Factory IoT System using Cyre hooks family
// Demonstrates: IoT integration, industrial automation, real-time monitoring, predictive maintenance

import {cyre, useCyre, useBranch, useGroup, metrics} from '../src'

/**
 * 🏭 SMART FACTORY IOT SYSTEM
 *
 * Architecture:
 * - Production line monitoring and control
 * - Predictive maintenance systems
 * - Quality control automation
 * - Supply chain integration
 * - Energy management
 * - Safety monitoring systems
 */

// ========================================
// FACTORY INFRASTRUCTURE SETUP
// ========================================

export const createFactoryInfrastructure = () => {
  // Main factory system - name can be descriptive, id is path-safe
  const smartFactory = useBranch({
    id: 'smart-factory',
    name: 'Smart Manufacturing Facility'
  })

  // Production areas - functional approach like React components
  const productionAreas = {
    assembly: useBranch({
      id: 'assembly',
      parent: smartFactory,
      name: 'Assembly Line'
    }),
    machining: useBranch({
      id: 'machining',
      parent: smartFactory,
      name: 'Machining Department'
    }),
    quality: useBranch({
      id: 'quality',
      parent: smartFactory,
      name: 'Quality Control'
    }),
    packaging: useBranch({
      id: 'packaging',
      parent: smartFactory,
      name: 'Packaging & Shipping'
    }),
    warehouse: useBranch({
      id: 'warehouse',
      parent: smartFactory,
      name: 'Automated Warehouse'
    })
  }

  // Support systems - functional approach like React components
  const supportSystems = {
    maintenance: useBranch({
      id: 'maintenance',
      parent: smartFactory,
      name: 'Predictive Maintenance'
    }),
    energy: useBranch({
      id: 'energy',
      parent: smartFactory,
      name: 'Energy Management'
    }),
    safety: useBranch({
      id: 'safety',
      parent: smartFactory,
      name: 'Safety Monitoring'
    }),
    logistics: useBranch({
      id: 'logistics',
      parent: smartFactory,
      name: 'Supply Chain & Logistics'
    })
  }

  return {
    smartFactory,
    productionAreas,
    supportSystems
  }
}

// ========================================
// PRODUCTION LINE MONITORING
// ========================================

export const createProductionLineMonitoring = (infrastructure: any) => {
  const {productionAreas} = infrastructure

  // Assembly line sensors and controls
  const assemblyLineSystems = {
    conveyorControl: useCyre(
      {
        channelId: 'conveyor-control',
        name: 'Conveyor Belt Control System'
      },
      productionAreas.assembly
    ),

    roboticArms: Array.from({length: 4}, (_, i) => {
      const robot = useCyre(
        {
          channelId: `robot-arm-${i}`,
          name: `Robotic Arm ${i + 1}`
        },
        productionAreas.assembly
      )

      robot.on(command => {
        const operationalStatus = Math.random() > 0.05 // 95% uptime
        const currentTask = command.task || 'idle'

        return {
          robotId: i + 1,
          status: operationalStatus ? 'operational' : 'error',
          currentTask,
          position: {
            x: Math.random() * 1000,
            y: Math.random() * 500,
            z: Math.random() * 300
          },
          toolhead: command.toolhead || 'gripper',
          cycleTime: Math.floor(Math.random() * 30) + 45, // 45-75 seconds
          accuracy: Math.random() * 0.05 + 0.95, // 95-100% accuracy
          temperature: Math.random() * 20 + 35, // 35-55°C
          vibration: Math.random() * 5 + 1, // 1-6 Hz
          powerConsumption: Math.random() * 2 + 3, // 3-5 kW
          lastMaintenance: Date.now() - Math.random() * 604800000, // Last week
          timestamp: Date.now()
        }
      })

      return robot
    }),

    qualitySensors: Array.from({length: 6}, (_, i) => {
      const sensor = useCyre(
        {
          channelId: `quality-sensor-${i}`,
          name: `Quality Sensor ${i + 1}`
        },
        productionAreas.assembly
      )

      sensor.on(measurement => {
        return {
          sensorId: i + 1,
          stationPosition: i,
          measurements: {
            dimensions: {
              length: 100 + (Math.random() * 2 - 1), // 99-101mm
              width: 50 + (Math.random() * 1 - 0.5), // 49.5-50.5mm
              height: 25 + (Math.random() * 0.5 - 0.25) // 24.75-25.25mm
            },
            weight: 150 + (Math.random() * 5 - 2.5), // 147.5-152.5g
            surfaceFinish: Math.random() * 0.5 + 0.8, // 0.8-1.3 Ra
            color: {
              r: Math.floor(Math.random() * 10) + 120,
              g: Math.floor(Math.random() * 10) + 120,
              b: Math.floor(Math.random() * 10) + 120
            }
          },
          passed: Math.random() > 0.02, // 98% pass rate
          defectTypes:
            Math.random() < 0.02
              ? [
                  'dimension_variance',
                  'surface_defect',
                  'color_variance'
                ].filter(() => Math.random() > 0.7)
              : [],
          processingTime: Math.floor(Math.random() * 5000) + 1000, // 1-6 seconds
          timestamp: Date.now()
        }
      })

      return sensor
    })
  }

  // Assembly line control logic
  assemblyLineSystems.conveyorControl.on(controlCommand => {
    const speed = controlCommand.speed || 1.0 // m/s
    const direction = controlCommand.direction || 'forward'
    const zones = [
      'input',
      'station1',
      'station2',
      'station3',
      'station4',
      'output'
    ]

    return {
      conveyorStatus: 'running',
      speed,
      direction,
      zoneStatuses: zones.map(zone => ({
        zone,
        occupied: Math.random() > 0.4, // 60% occupation
        sensorStatus: Math.random() > 0.01 ? 'ok' : 'fault', // 99% sensor uptime
        temperature: Math.random() * 15 + 20 // 20-35°C
      })),
      totalThroughput: Math.floor((speed * 3600) / 60), // Units per hour
      powerConsumption: speed * 10 + 5, // kW
      maintenanceStatus: {
        beltWear: Math.random() * 0.3 + 0.1, // 10-40% wear
        motorHealth: Math.random() * 0.2 + 0.8, // 80-100% health
        nextMaintenance: Date.now() + Math.random() * 2592000000 // Next month
      },
      timestamp: Date.now()
    }
  })

  // Machining department systems
  const machiningSystemsBranch = {
    cncMachines: Array.from({length: 8}, (_, i) => {
      const cnc = useCyre(
        {
          channelId: `cnc-machine-${i}`,
          name: `CNC Machine ${i + 1}`
        },
        productionAreas.machining
      )

      cnc.on(command => {
        const isOperational = Math.random() > 0.03 // 97% uptime

        return {
          machineId: i + 1,
          status: isOperational ? 'running' : 'stopped',
          currentProgram:
            command.program || `PART_${Math.floor(Math.random() * 1000)}`,
          spindle: {
            speed: Math.floor(Math.random() * 8000) + 2000, // 2000-10000 RPM
            load: Math.random() * 80 + 10, // 10-90% load
            temperature: Math.random() * 30 + 40 // 40-70°C
          },
          axes: {
            x: Math.random() * 500,
            y: Math.random() * 300,
            z: Math.random() * 200
          },
          toolChanger: {
            currentTool: Math.floor(Math.random() * 20) + 1,
            toolWear: Math.random() * 0.8, // 0-80% wear
            remainingLife: Math.floor(Math.random() * 100) + 50 // 50-150 parts
          },
          coolant: {
            level: Math.random() * 0.3 + 0.7, // 70-100%
            pressure: Math.random() * 2 + 6, // 6-8 bar
            temperature: Math.random() * 10 + 20 // 20-30°C
          },
          partsCompleted: Math.floor(Math.random() * 500) + 100,
          cycleTime: Math.floor(Math.random() * 300) + 180, // 3-8 minutes
          efficiency: Math.random() * 0.15 + 0.85, // 85-100%
          timestamp: Date.now()
        }
      })

      return cnc
    }),

    materialHandling: useCyre(
      {
        channelId: 'material-handling',
        name: 'Automated Material Handling'
      },
      productionAreas.machining
    )
  }

  machiningSystemsBranch.materialHandling.on(request => {
    return {
      system: 'material_handling',
      agvs: Array.from({length: 3}, (_, i) => ({
        agvId: i + 1,
        status: Math.random() > 0.1 ? 'active' : 'charging',
        location: {
          x: Math.random() * 1000,
          y: Math.random() * 500
        },
        battery: Math.random() * 0.4 + 0.6, // 60-100%
        cargo: Math.random() > 0.3 ? 'loaded' : 'empty',
        destination: `Station_${Math.floor(Math.random() * 10) + 1}`
      })),
      inventory: {
        rawMaterials: Math.floor(Math.random() * 1000) + 500,
        finishedParts: Math.floor(Math.random() * 200) + 50,
        toolInventory: Math.floor(Math.random() * 500) + 200
      },
      timestamp: Date.now()
    }
  })

  return {
    assemblyLineSystems,
    machiningSystemsBranch
  }
}

// ========================================
// PREDICTIVE MAINTENANCE SYSTEM
// ========================================

export const createPredictiveMaintenanceSystem = (infrastructure: any) => {
  const {supportSystems} = infrastructure

  // Vibration analysis system
  const vibrationAnalyzer = useCyre(
    {
      channelId: 'vibration-analyzer',
      name: 'Machine Vibration Analysis System'
    },
    supportSystems.maintenance
  )

  // Thermal imaging system
  const thermalImaging = useCyre(
    {
      channelId: 'thermal-imaging',
      name: 'Thermal Imaging Monitoring'
    },
    supportSystems.maintenance
  )

  // Oil analysis system
  const oilAnalysis = useCyre(
    {
      channelId: 'oil-analysis',
      name: 'Lubricant Analysis System'
    },
    supportSystems.maintenance
  )

  // Maintenance scheduler
  const maintenanceScheduler = useCyre(
    {
      channelId: 'maintenance-scheduler',
      name: 'Predictive Maintenance Scheduler'
    },
    supportSystems.maintenance
  )

  vibrationAnalyzer.on(vibrationData => {
    const {machineId, vibrationReadings} = vibrationData

    // Simulate vibration analysis
    const frequency = vibrationReadings?.frequency || Math.random() * 100 + 10 // 10-110 Hz
    const amplitude = vibrationReadings?.amplitude || Math.random() * 5 + 0.5 // 0.5-5.5 mm/s

    // Predictive analysis
    const bearingCondition =
      amplitude < 2 ? 'good' : amplitude < 4 ? 'warning' : 'critical'
    const estimatedLifeRemaining =
      amplitude < 2
        ? Math.floor(Math.random() * 2000) + 1000 // 1000-3000 hours
        : amplitude < 4
        ? Math.floor(Math.random() * 500) + 100 // 100-600 hours
        : Math.floor(Math.random() * 48) + 1 // 1-48 hours

    return {
      machineId,
      analysis: {
        dominantFrequency: frequency,
        rmsVelocity: amplitude,
        peakAmplitude: amplitude * 1.5,
        bearingCondition,
        estimatedLifeRemaining,
        faultFrequencies:
          frequency > 50 ? ['bearing_outer_race', 'unbalance'] : [],
        severity:
          bearingCondition === 'critical'
            ? 'high'
            : bearingCondition === 'warning'
            ? 'medium'
            : 'low'
      },
      recommendations:
        bearingCondition !== 'good'
          ? [
              'Schedule bearing inspection',
              'Increase monitoring frequency',
              'Check lubrication levels',
              'Review operational parameters'
            ]
          : ['Continue normal operation'],
      timestamp: Date.now()
    }
  })

  thermalImaging.on(thermalData => {
    const {equipmentId, zones} = thermalData

    return {
      equipmentId,
      thermalMap: zones.map((zone: any) => ({
        zone: zone.name,
        avgTemperature: Math.random() * 40 + 30, // 30-70°C
        maxTemperature: Math.random() * 20 + 60, // 60-80°C
        hotSpots: Math.random() > 0.8 ? ['bearing', 'motor'] : [],
        temperatureTrend: Math.random() > 0.5 ? 'rising' : 'stable'
      })),
      alerts:
        Math.random() > 0.9 ? ['Overheating detected in motor housing'] : [],
      timestamp: Date.now()
    }
  })

  oilAnalysis.on(sampleData => {
    const {machineId, sampleId} = sampleData

    return {
      machineId,
      sampleId,
      analysis: {
        viscosity: Math.random() * 10 + 40, // 40-50 cSt
        acidity: Math.random() * 2 + 0.5, // 0.5-2.5 mgKOH/g
        waterContent: Math.random() * 500 + 100, // 100-600 ppm
        metalParticles: {
          iron: Math.random() * 20 + 5, // 5-25 ppm
          copper: Math.random() * 10 + 2, // 2-12 ppm
          aluminum: Math.random() * 5 + 1 // 1-6 ppm
        },
        contaminants: Math.random() > 0.7 ? ['dirt', 'fuel'] : []
      },
      condition:
        Math.random() > 0.8 ? 'poor' : Math.random() > 0.6 ? 'fair' : 'good',
      changeRecommended: Math.random() > 0.7,
      timestamp: Date.now()
    }
  })

  maintenanceScheduler.on(scheduleRequest => {
    const {machineIds} = scheduleRequest

    try {
      const maintenanceSchedule = machineIds.map((machineId: string) => {
        const hoursToFailure = Math.floor(Math.random() * 2000) + 100
        const priority =
          hoursToFailure < 48
            ? 'critical'
            : hoursToFailure < 168
            ? 'high'
            : hoursToFailure < 720
            ? 'medium'
            : 'low'

        const urgency =
          priority === 'critical'
            ? 'immediate'
            : priority === 'high'
            ? 'urgent'
            : priority === 'medium'
            ? 'scheduled'
            : 'routine'

        return {
          machineId,
          estimatedHoursToFailure: hoursToFailure,
          priority,
          urgency,
          maintenanceType: urgency === 'immediate' ? 'emergency' : 'preventive',
          requiredParts: ['bearing', 'oil', 'filter'].filter(
            () => Math.random() > 0.5
          ),
          estimatedDuration: Math.floor(Math.random() * 4) + 2, // 2-6 hours
          maintenanceWindow:
            urgency === 'immediate' ? 'anytime' : 'planned_downtime'
        }
      })

      return {
        scheduleGenerated: true,
        totalMachines: machineIds.length,
        criticalMachines: maintenanceSchedule.filter(
          m => m.priority === 'critical'
        ).length,
        immediateActions: maintenanceSchedule.filter(
          m => m.urgency === 'immediate'
        ).length,
        maintenanceSchedule: maintenanceSchedule.sort(
          (a, b) => a.estimatedHoursToFailure - b.estimatedHoursToFailure
        ),
        resourceRequirements: {
          technicians: Math.ceil(
            maintenanceSchedule.filter(m => m.urgency !== 'routine').length / 2
          ),
          estimatedCost: maintenanceSchedule.reduce(
            (sum, m) =>
              sum +
              (m.priority === 'critical'
                ? 5000
                : m.priority === 'high'
                ? 2000
                : 500),
            0
          ),
          totalDowntime: maintenanceSchedule.reduce(
            (sum, m) => sum + m.estimatedDuration,
            0
          )
        },
        timestamp: Date.now()
      }
    } catch (error) {
      return {
        error: 'Maintenance scheduling failed',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })

  return {
    vibrationAnalyzer,
    thermalImaging,
    oilAnalysis,
    maintenanceScheduler
  }
}

// ========================================
// ENERGY MANAGEMENT SYSTEM
// ========================================

export const createEnergyManagementSystem = (infrastructure: any) => {
  const {supportSystems} = infrastructure

  // Smart energy monitoring
  const energyMonitor = useCyre(
    {
      channelId: 'energy-monitor',
      name: 'Factory Energy Monitoring System'
    },
    supportSystems.energy
  )

  // Load balancing controller
  const loadBalancer = useCyre(
    {
      channelId: 'load-balancer',
      name: 'Electrical Load Balancing System'
    },
    supportSystems.energy
  )

  energyMonitor.on(monitoringRequest => {
    const zones = [
      'assembly',
      'machining',
      'quality',
      'packaging',
      'warehouse',
      'hvac',
      'lighting'
    ]

    const energyData = zones.map(zone => {
      const baseLoad =
        {
          assembly: 150, // kW
          machining: 300, // kW
          quality: 50, // kW
          packaging: 100, // kW
          warehouse: 75, // kW
          hvac: 200, // kW
          lighting: 25 // kW
        }[zone] || 50

      const currentLoad = baseLoad * (0.8 + Math.random() * 0.4) // 80-120% of base
      const efficiency = Math.random() * 0.2 + 0.8 // 80-100%

      return {
        zone,
        currentLoad,
        baseLoad,
        efficiency,
        powerFactor: Math.random() * 0.1 + 0.9, // 0.9-1.0
        harmonics: Math.random() * 5 + 1, // 1-6%
        voltage: 400 + (Math.random() * 20 - 10), // 390-410V
        frequency: 50 + (Math.random() * 0.2 - 0.1), // 49.9-50.1 Hz
        timestamp: Date.now()
      }
    })

    const totalConsumption = energyData.reduce(
      (sum, zone) => sum + zone.currentLoad,
      0
    )
    const averageEfficiency =
      energyData.reduce((sum, zone) => sum + zone.efficiency, 0) /
      energyData.length

    return {
      zones: energyData,
      summary: {
        totalConsumption,
        averageEfficiency,
        peakDemand: totalConsumption * 1.2,
        costPerHour: totalConsumption * 0.12, // $0.12/kWh
        carbonFootprint: totalConsumption * 0.5, // 0.5 kg CO2/kWh
        gridStability: Math.random() > 0.05 ? 'stable' : 'fluctuating'
      },
      timestamp: Date.now()
    }
  })

  loadBalancer.on(balanceRequest => {
    const {targetReduction} = balanceRequest

    const actualReduction = Math.min(
      targetReduction || 10,
      Math.random() * 15 + 5
    ) // 5-20%

    return {
      balancing: {
        targetReduction: targetReduction || 10,
        actualReduction,
        affectedZones: ['machining', 'hvac'].filter(() => Math.random() > 0.3),
        loadShiftedMW: actualReduction * 0.9,
        savingsPerHour: actualReduction * 0.9 * 0.12, // $/hour
        durationMinutes: Math.floor(Math.random() * 60) + 30 // 30-90 minutes
      },
      powerQualityImpact: 'minimal',
      operationalImpact: actualReduction > 40 ? 'moderate' : 'low',
      timestamp: Date.now()
    }
  })

  return {
    energyMonitor,
    loadBalancer
  }
}

// ========================================
// FACTORY ORCHESTRATOR
// ========================================

export const createSmartFactoryOrchestrator = () => {
  const infrastructure = createFactoryInfrastructure()
  const productionSystems = createProductionLineMonitoring(infrastructure)
  const maintenanceSystems = createPredictiveMaintenanceSystem(infrastructure)
  const energySystems = createEnergyManagementSystem(infrastructure)

  // Master factory coordinator
  const factoryCoordinator = useCyre(
    {
      channelId: 'factory-coordinator',
      name: 'Smart Factory Master Coordinator'
    },
    infrastructure.smartFactory
  )

  factoryCoordinator.on(async request => {
    try {
      switch (request.type) {
        case 'production_status':
          // Parent → Child communication (like React props)
          // NO sibling communication: assembly can't call quality directly
          // Parent coordinates all cross-branch operations
          const conveyorStatus =
            await productionSystems.assemblyLineSystems.conveyorControl.call({
              speed: 1.2,
              direction: 'forward'
            })

          const robotStatus = await Promise.all(
            productionSystems.assemblyLineSystems.roboticArms.map(robot =>
              robot.call({task: 'assembly', toolhead: 'gripper'})
            )
          )

          const qualityResults = await Promise.all(
            productionSystems.assemblyLineSystems.qualitySensors
              .slice(0, 3)
              .map(sensor => sensor.call({partId: `PART-${Date.now()}`}))
          )

          return {
            type: 'production_status_response',
            conveyor: conveyorStatus.payload,
            robots: robotStatus.map(r => r.payload),
            quality: qualityResults.map(q => q.payload),
            overallEfficiency: Math.random() * 0.1 + 0.85, // 85-95%
            currentShift: 'Day Shift',
            targetProduction: 1000,
            actualProduction: Math.floor(Math.random() * 100) + 850,
            timestamp: Date.now()
          }

        case 'maintenance_overview':
          // Get maintenance predictions and schedule
          const maintenanceSchedule =
            await maintenanceSystems.maintenanceScheduler.call({
              machineIds: [
                'CNC-001',
                'CNC-002',
                'CNC-003',
                'ROBOT-001',
                'ROBOT-002',
                'CONV-001'
              ]
            })

          return {
            type: 'maintenance_overview_response',
            schedule: maintenanceSchedule.payload,
            systemHealth: {
              criticalMachines: maintenanceSchedule.payload.criticalMachines,
              immediateActions: maintenanceSchedule.payload.immediateActions,
              totalDowntime:
                maintenanceSchedule.payload.resourceRequirements.totalDowntime
            },
            timestamp: Date.now()
          }

        case 'energy_optimization':
          // Optimize energy usage
          const energyStatus = await energySystems.energyMonitor.call({})
          const loadBalance = await energySystems.loadBalancer.call({
            targetReduction: 15
          })

          return {
            type: 'energy_optimization_response',
            currentStatus: energyStatus.payload,
            optimization: loadBalance.payload,
            projectedSavings: loadBalance.payload.balancing.savingsPerHour * 24, // Daily savings
            timestamp: Date.now()
          }

        case 'emergency_shutdown':
          // Emergency shutdown procedure
          return {
            type: 'emergency_shutdown_response',
            status: 'initiated',
            shutdownSequence: [
              'Stop all production lines',
              'Safe robotic arm positions',
              'Coolant systems shutdown',
              'Ventilation maintained',
              'Emergency lighting activated'
            ],
            estimatedShutdownTime: '5 minutes',
            safetyStatus: 'all_systems_safe',
            timestamp: Date.now()
          }

        default:
          return {
            type: 'unknown_request',
            message: 'Unknown request type',
            timestamp: Date.now()
          }
      }
    } catch (error) {
      return {
        type: 'error',
        message: error instanceof Error ? error.message : String(error)
      }
    }
  })

  return {
    infrastructure,
    productionSystems,
    maintenanceSystems,
    energySystems,
    factoryCoordinator,

    // Convenience methods
    async getProductionStatus() {
      return await factoryCoordinator.call({type: 'production_status'})
    },

    async getMaintenanceOverview() {
      return await factoryCoordinator.call({type: 'maintenance_overview'})
    },

    async optimizeEnergy() {
      return await factoryCoordinator.call({type: 'energy_optimization'})
    },

    async emergencyShutdown() {
      return await factoryCoordinator.call({type: 'emergency_shutdown'})
    }
  }
}

// ========================================
// USAGE EXAMPLE
// ========================================

export const smartFactoryDemo = async () => {
  console.log('🏭 Initializing Smart Factory IoT System...')

  const factory = createSmartFactoryOrchestrator()

  // ✅ ALLOWED: Parent coordination (React-like data flow)
  console.log('\n📊 Getting production status...')
  const productionStatus = await factory.getProductionStatus()
  console.log('Production Status:', productionStatus)

  console.log('\n🔧 Getting maintenance overview...')
  const maintenanceOverview = await factory.getMaintenanceOverview()
  console.log('Maintenance Overview:', maintenanceOverview)

  console.log('\n⚡ Optimizing energy usage...')
  const energyOptimization = await factory.optimizeEnergy()
  console.log('Energy Optimization:', energyOptimization)

  console.log('\n🚨 Testing emergency shutdown...')
  const emergencyResponse = await factory.emergencyShutdown()
  console.log('Emergency Response:', emergencyResponse)

  // ❌ BLOCKED: These would throw errors due to React-like isolation
  // productionAreas.assembly.call('../quality/inspect', data)  // Sibling access blocked
  // productionAreas.assembly.call('../../maintenance/schedule', data)  // Parent access blocked
  // Only parent → child calls allowed!

  return factory
}

export default smartFactoryDemo()
