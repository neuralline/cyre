// demo/smart-factory-iot.ts
// Smart Factory IoT System using Cyre hooks family
// Demonstrates: IoT integration, industrial automation, real-time monitoring, predictive maintenance

import {cyre, useBranch, useGroup} from '../src'

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
  // Main factory system - using useBranch with cyre instance
  const smartFactory = useBranch(cyre, {
    id: 'smart-factory',
    name: 'Smart Manufacturing Facility'
  })

  if (!smartFactory) {
    throw new Error('Failed to create smart factory branch')
  }

  // Production areas - creating sub-branches
  const productionAreas = {
    assembly: useBranch(smartFactory, {
      id: 'assembly',
      name: 'Assembly Line'
    }),
    machining: useBranch(smartFactory, {
      id: 'machining',
      name: 'Machining Department'
    }),
    quality: useBranch(smartFactory, {
      id: 'quality',
      name: 'Quality Control'
    }),
    packaging: useBranch(smartFactory, {
      id: 'packaging',
      name: 'Packaging & Shipping'
    }),
    warehouse: useBranch(smartFactory, {
      id: 'warehouse',
      name: 'Automated Warehouse'
    })
  }

  // Validate all production areas
  Object.entries(productionAreas).forEach(([name, branch]) => {
    if (!branch) {
      throw new Error(`Failed to create ${name} production area`)
    }
  })

  // Support systems
  const supportSystems = {
    maintenance: useBranch(smartFactory, {
      id: 'maintenance',
      name: 'Predictive Maintenance'
    }),
    energy: useBranch(smartFactory, {
      id: 'energy',
      name: 'Energy Management'
    }),
    safety: useBranch(smartFactory, {
      id: 'safety',
      name: 'Safety Monitoring'
    }),
    logistics: useBranch(smartFactory, {
      id: 'logistics',
      name: 'Supply Chain & Logistics'
    })
  }

  // Validate all support systems
  Object.entries(supportSystems).forEach(([name, branch]) => {
    if (!branch) {
      throw new Error(`Failed to create ${name} support system`)
    }
  })

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

  // Assembly line systems
  const assemblyLineSystems = {
    // Conveyor control system
    conveyorControl: (() => {
      const result = productionAreas.assembly.action({
        id: 'conveyor-control',
        throttle: 1000, // 1 second minimum between calls
        schema: (data: any) => ({
          ok: true,
          data: {
            speed: data?.speed || 1.0,
            direction: data?.direction || 'forward'
          }
        })
      })

      if (!result.ok) {
        throw new Error(`Failed to create conveyor control: ${result.message}`)
      }

      productionAreas.assembly.on('conveyor-control', (controlCommand: any) => {
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

      return 'conveyor-control'
    })(),

    // Robotic arms array
    roboticArms: Array.from({length: 4}, (_, i) => {
      const robotId = `robot-arm-${i}`

      const result = productionAreas.assembly.action({
        id: robotId,
        throttle: 500, // 0.5 second minimum between calls
        detectChanges: true
      })

      if (!result.ok) {
        throw new Error(`Failed to create robot arm ${i}: ${result.message}`)
      }

      productionAreas.assembly.on(robotId, (command: any) => {
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

      return robotId
    }),

    // Quality sensors
    qualitySensors: Array.from({length: 6}, (_, i) => {
      const sensorId = `quality-sensor-${i}`

      const result = productionAreas.assembly.action({
        id: sensorId,
        throttle: 200, // 0.2 second minimum between calls
        required: false // Measurements can be triggered without payload
      })

      if (!result.ok) {
        throw new Error(
          `Failed to create quality sensor ${i}: ${result.message}`
        )
      }

      productionAreas.assembly.on(sensorId, (measurement: any) => {
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

      return sensorId
    })
  }

  // Machining department systems
  const machiningSystemsBranch = {
    // CNC Machines
    cncMachines: Array.from({length: 8}, (_, i) => {
      const cncId = `cnc-machine-${i}`

      const result = productionAreas.machining.action({
        id: cncId,
        throttle: 2000, // 2 second minimum between calls
        schema: (data: any) => ({
          ok: true,
          data: {
            program: data?.program || `PART_${Math.floor(Math.random() * 1000)}`
          }
        })
      })

      if (!result.ok) {
        throw new Error(`Failed to create CNC machine ${i}: ${result.message}`)
      }

      productionAreas.machining.on(cncId, (command: any) => {
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

      return cncId
    }),

    // Material handling system
    materialHandling: (() => {
      const result = productionAreas.machining.action({
        id: 'material-handling',
        throttle: 1500 // 1.5 second minimum between calls
      })

      if (!result.ok) {
        throw new Error(`Failed to create material handling: ${result.message}`)
      }

      productionAreas.machining.on('material-handling', (request: any) => {
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

      return 'material-handling'
    })()
  }

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
  const vibrationAnalyzer = (() => {
    const result = supportSystems.maintenance.action({
      id: 'vibration-analyzer',
      throttle: 1000,
      required: true // Requires vibration data
    })

    if (!result.ok) {
      throw new Error(`Failed to create vibration analyzer: ${result.message}`)
    }

    supportSystems.maintenance.on(
      'vibration-analyzer',
      (vibrationData: any) => {
        const {machineId, vibrationReadings} = vibrationData

        // Simulate vibration analysis
        const frequency =
          vibrationReadings?.frequency || Math.random() * 100 + 10 // 10-110 Hz
        const amplitude =
          vibrationReadings?.amplitude || Math.random() * 5 + 0.5 // 0.5-5.5 mm/s

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
      }
    )

    return 'vibration-analyzer'
  })()

  // Thermal imaging system
  const thermalImaging = (() => {
    const result = supportSystems.maintenance.action({
      id: 'thermal-imaging',
      throttle: 2000,
      required: true
    })

    if (!result.ok) {
      throw new Error(`Failed to create thermal imaging: ${result.message}`)
    }

    supportSystems.maintenance.on('thermal-imaging', (thermalData: any) => {
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

    return 'thermal-imaging'
  })()

  // Maintenance scheduler
  const maintenanceScheduler = (() => {
    const result = supportSystems.maintenance.action({
      id: 'maintenance-scheduler',
      throttle: 5000, // 5 second minimum between calls
      required: true
    })

    if (!result.ok) {
      throw new Error(
        `Failed to create maintenance scheduler: ${result.message}`
      )
    }

    supportSystems.maintenance.on(
      'maintenance-scheduler',
      (scheduleRequest: any) => {
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
              maintenanceType:
                urgency === 'immediate' ? 'emergency' : 'preventive',
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
                maintenanceSchedule.filter(m => m.urgency !== 'routine')
                  .length / 2
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
      }
    )

    return 'maintenance-scheduler'
  })()

  return {
    vibrationAnalyzer,
    thermalImaging,
    maintenanceScheduler
  }
}

// ========================================
// ENERGY MANAGEMENT SYSTEM
// ========================================

export const createEnergyManagementSystem = (infrastructure: any) => {
  const {supportSystems} = infrastructure

  // Smart energy monitoring
  const energyMonitor = (() => {
    const result = supportSystems.energy.action({
      id: 'energy-monitor',
      throttle: 3000 // 3 second minimum between calls
    })

    if (!result.ok) {
      throw new Error(`Failed to create energy monitor: ${result.message}`)
    }

    supportSystems.energy.on('energy-monitor', (monitoringRequest: any) => {
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

    return 'energy-monitor'
  })()

  // Load balancing controller
  const loadBalancer = (() => {
    const result = supportSystems.energy.action({
      id: 'load-balancer',
      throttle: 2000,
      required: false
    })

    if (!result.ok) {
      throw new Error(`Failed to create load balancer: ${result.message}`)
    }

    supportSystems.energy.on('load-balancer', (balanceRequest: any) => {
      const {targetReduction} = balanceRequest
      const actualReduction = Math.min(
        targetReduction || 10,
        Math.random() * 15 + 5
      ) // 5-20%

      return {
        balancing: {
          targetReduction: targetReduction || 10,
          actualReduction,
          affectedZones: ['machining', 'hvac'].filter(
            () => Math.random() > 0.3
          ),
          loadShiftedMW: actualReduction * 0.9,
          savingsPerHour: actualReduction * 0.9 * 0.12, // $/hour
          durationMinutes: Math.floor(Math.random() * 60) + 30 // 30-90 minutes
        },
        powerQualityImpact: 'minimal',
        operationalImpact: actualReduction > 40 ? 'moderate' : 'low',
        timestamp: Date.now()
      }
    })

    return 'load-balancer'
  })()

  return {
    energyMonitor,
    loadBalancer
  }
}

// ========================================
// FACTORY ORCHESTRATOR
// ========================================

export const createSmartFactoryOrchestrator = async () => {
  // Initialize Cyre first
  const initResult = await cyre.init()
  if (!initResult.ok) {
    throw new Error(`Failed to initialize Cyre: ${initResult.message}`)
  }

  const infrastructure = createFactoryInfrastructure()
  const productionSystems = createProductionLineMonitoring(infrastructure)
  const maintenanceSystems = createPredictiveMaintenanceSystem(infrastructure)
  const energySystems = createEnergyManagementSystem(infrastructure)

  // Master factory coordinator
  const coordinatorResult = infrastructure.smartFactory.action({
    id: 'factory-coordinator',
    throttle: 1000, // 1 second minimum between coordination calls
    required: true
  })

  if (!coordinatorResult.ok) {
    throw new Error(
      `Failed to create factory coordinator: ${coordinatorResult.message}`
    )
  }

  infrastructure.smartFactory.on(
    'factory-coordinator',
    async (request: any) => {
      try {
        switch (request.type) {
          case 'production_status':
            // Parent → Child communication
            const conveyorStatus = await productionAreas.assembly.call(
              'conveyor-control',
              {
                speed: 1.2,
                direction: 'forward'
              }
            )

            const robotStatus = await Promise.all(
              productionSystems.assemblyLineSystems.roboticArms.map(robotId =>
                productionAreas.assembly.call(robotId, {
                  task: 'assembly',
                  toolhead: 'gripper'
                })
              )
            )

            const qualityResults = await Promise.all(
              productionSystems.assemblyLineSystems.qualitySensors
                .slice(0, 3)
                .map(sensorId =>
                  productionAreas.assembly.call(sensorId, {
                    partId: `PART-${Date.now()}`
                  })
                )
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
            const maintenanceSchedule = await supportSystems.maintenance.call(
              'maintenance-scheduler',
              {
                machineIds: [
                  'CNC-001',
                  'CNC-002',
                  'CNC-003',
                  'ROBOT-001',
                  'ROBOT-002',
                  'CONV-001'
                ]
              }
            )

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
            const energyStatus = await supportSystems.energy.call(
              'energy-monitor',
              {}
            )
            const loadBalance = await supportSystems.energy.call(
              'load-balancer',
              {targetReduction: 15}
            )

            return {
              type: 'energy_optimization_response',
              currentStatus: energyStatus.payload,
              optimization: loadBalance.payload,
              projectedSavings:
                loadBalance.payload.balancing.savingsPerHour * 24, // Daily savings
              timestamp: Date.now()
            }

          case 'emergency_shutdown':
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
    }
  )

  const {productionAreas} = infrastructure

  return {
    infrastructure,
    productionSystems,
    maintenanceSystems,
    energySystems,

    // Convenience methods
    async getProductionStatus() {
      return await infrastructure.smartFactory.call('factory-coordinator', {
        type: 'production_status'
      })
    },

    async getMaintenanceOverview() {
      return await infrastructure.smartFactory.call('factory-coordinator', {
        type: 'maintenance_overview'
      })
    },

    async optimizeEnergy() {
      return await infrastructure.smartFactory.call('factory-coordinator', {
        type: 'energy_optimization'
      })
    },

    async emergencyShutdown() {
      return await infrastructure.smartFactory.call('factory-coordinator', {
        type: 'emergency_shutdown'
      })
    }
  }
}

// ========================================
// USAGE EXAMPLE
// ========================================

export const smartFactoryDemo = async () => {
  console.log('🏭 Initializing Smart Factory IoT System...')

  try {
    const factory = await createSmartFactoryOrchestrator()

    console.log('\n📊 Getting production status...')
    const productionStatus = await factory.getProductionStatus()
    console.log('Production Status:', productionStatus.payload)

    console.log('\n🔧 Getting maintenance overview...')
    const maintenanceOverview = await factory.getMaintenanceOverview()
    console.log('Maintenance Overview:', maintenanceOverview.payload)

    console.log('\n⚡ Optimizing energy usage...')
    const energyOptimization = await factory.optimizeEnergy()
    console.log('Energy Optimization:', energyOptimization.payload)

    console.log('\n🚨 Testing emergency shutdown...')
    const emergencyResponse = await factory.emergencyShutdown()
    console.log('Emergency Response:', emergencyResponse.payload)

    // ✅ ALLOWED: Parent coordination (React-like data flow)
    console.log('\n🔍 Direct sensor testing...')

    // Test individual components through parent coordination
    const robotTest =
      await factory.infrastructure.productionAreas.assembly.call(
        'robot-arm-0',
        {
          task: 'pick_and_place',
          toolhead: 'vacuum_gripper'
        }
      )
    console.log('Robot Test:', robotTest.payload)

    const qualityTest =
      await factory.infrastructure.productionAreas.assembly.call(
        'quality-sensor-0',
        {
          partId: 'TEST-PART-001'
        }
      )
    console.log('Quality Test:', qualityTest.payload)

    // Test maintenance systems
    const vibrationTest =
      await factory.infrastructure.supportSystems.maintenance.call(
        'vibration-analyzer',
        {
          machineId: 'CNC-001',
          vibrationReadings: {
            frequency: 45.5,
            amplitude: 2.3
          }
        }
      )
    console.log('Vibration Analysis:', vibrationTest.payload)

    // Test energy monitoring
    const energyTest = await factory.infrastructure.supportSystems.energy.call(
      'energy-monitor',
      {
        includeDetails: true
      }
    )
    console.log('Energy Monitoring:', energyTest.payload)

    console.log('\n📈 System Metrics...')
    const systemMetrics = cyre.getMetrics()
    console.log('Cyre System Metrics:', {
      totalChannels: systemMetrics.stores.channels,
      totalSubscribers: systemMetrics.stores.subscribers,
      systemHealth: systemMetrics.system.health,
      uptime: systemMetrics.system.uptime
    })

    console.log('\n🏭 Smart Factory Demo completed successfully!')
    return factory
  } catch (error) {
    console.error('❌ Smart Factory Demo failed:', error)
    throw error
  }
}

// ========================================
// ADVANCED FEATURES DEMO
// ========================================

export const advancedFactoryFeatures = async () => {
  console.log('🔬 Testing Advanced Factory Features...')

  try {
    const factory = await createSmartFactoryOrchestrator()

    // ========================================
    // 1. GROUP OPERATIONS - Coordinate multiple robots
    // ========================================
    console.log('\n🤖 Testing Robot Group Coordination...')

    const robotGroup = useGroup(
      [
        {
          id: 'robot-arm-0',
          call: payload =>
            factory.infrastructure.productionAreas.assembly.call(
              'robot-arm-0',
              payload
            )
        },
        {
          id: 'robot-arm-1',
          call: payload =>
            factory.infrastructure.productionAreas.assembly.call(
              'robot-arm-1',
              payload
            )
        },
        {
          id: 'robot-arm-2',
          call: payload =>
            factory.infrastructure.productionAreas.assembly.call(
              'robot-arm-2',
              payload
            )
        }
      ],
      {
        strategy: 'parallel',
        errorStrategy: 'continue',
        timeout: 5000
      }
    )

    const robotGroupResult = await robotGroup.call({
      task: 'coordinate_assembly',
      toolhead: 'precision_gripper',
      synchronize: true
    })

    console.log('Robot Group Coordination:', {
      successful: robotGroupResult.metadata?.successful,
      failed: robotGroupResult.metadata?.failed,
      executionTime: robotGroupResult.metadata?.executionTime
    })

    // ========================================
    // 2. QUALITY SENSOR ARRAY - Parallel quality checks
    // ========================================
    console.log('\n🔍 Testing Quality Sensor Array...')

    const qualityGroup = useGroup(
      [
        {
          id: 'quality-sensor-0',
          call: payload =>
            factory.infrastructure.productionAreas.assembly.call(
              'quality-sensor-0',
              payload
            )
        },
        {
          id: 'quality-sensor-1',
          call: payload =>
            factory.infrastructure.productionAreas.assembly.call(
              'quality-sensor-1',
              payload
            )
        },
        {
          id: 'quality-sensor-2',
          call: payload =>
            factory.infrastructure.productionAreas.assembly.call(
              'quality-sensor-2',
              payload
            )
        }
      ],
      {
        strategy: 'parallel',
        errorStrategy: 'fail-fast'
      }
    )

    const qualityResults = await qualityGroup.call({
      batchId: 'BATCH-001',
      qualityStandard: 'ISO-9001'
    })

    console.log('Quality Array Results:', {
      passRate:
        qualityResults.payload?.filter((r: any) => r.payload.passed).length /
        qualityResults.payload?.length,
      defectsDetected: qualityResults.payload?.flatMap(
        (r: any) => r.payload.defectTypes
      ).length
    })

    // ========================================
    // 3. CNC MACHINE FLEET MANAGEMENT
    // ========================================
    console.log('\n⚙️ Testing CNC Fleet Management...')

    const cncFleet = useGroup(
      factory.productionSystems.machiningSystemsBranch.cncMachines.map(
        (cncId: string, index: number) => ({
          id: cncId,
          call: payload =>
            factory.infrastructure.productionAreas.machining.call(
              cncId,
              payload
            )
        })
      ),
      {
        strategy: 'parallel',
        errorStrategy: 'continue',
        timeout: 10000
      }
    )

    const fleetStatus = await cncFleet.call({
      operation: 'status_check',
      includeMetrics: true
    })

    const operationalMachines = fleetStatus.payload?.filter(
      (r: any) => r.payload.status === 'running'
    ).length
    console.log('CNC Fleet Status:', {
      totalMachines:
        factory.productionSystems.machiningSystemsBranch.cncMachines.length,
      operational: operationalMachines,
      efficiency:
        operationalMachines /
        factory.productionSystems.machiningSystemsBranch.cncMachines.length
    })

    // ========================================
    // 4. PREDICTIVE MAINTENANCE COORDINATION
    // ========================================
    console.log('\n🔧 Testing Predictive Maintenance Coordination...')

    // Analyze all critical machines
    const criticalMachines = [
      'CNC-001',
      'CNC-002',
      'CNC-003',
      'ROBOT-001',
      'ROBOT-002',
      'CONVEYOR-001'
    ]

    const maintenanceAnalysis = await Promise.all([
      // Vibration analysis
      factory.infrastructure.supportSystems.maintenance.call(
        'vibration-analyzer',
        {
          machineId: 'CNC-001',
          vibrationReadings: {frequency: 55, amplitude: 3.2}
        }
      ),
      // Thermal analysis
      factory.infrastructure.supportSystems.maintenance.call(
        'thermal-imaging',
        {
          equipmentId: 'CNC-001',
          zones: [
            {name: 'spindle_motor'},
            {name: 'coolant_pump'},
            {name: 'hydraulic_system'}
          ]
        }
      ),
      // Schedule maintenance
      factory.infrastructure.supportSystems.maintenance.call(
        'maintenance-scheduler',
        {
          machineIds: criticalMachines
        }
      )
    ])

    console.log('Maintenance Analysis Complete:', {
      vibrationStatus: maintenanceAnalysis[0].payload.analysis.bearingCondition,
      thermalAlerts: maintenanceAnalysis[1].payload.alerts.length,
      criticalMachines: maintenanceAnalysis[2].payload.criticalMachines,
      immediateActions: maintenanceAnalysis[2].payload.immediateActions
    })

    // ========================================
    // 5. ENERGY OPTIMIZATION CYCLE
    // ========================================
    console.log('\n⚡ Testing Energy Optimization Cycle...')

    // Monitor baseline energy
    const baselineEnergy =
      await factory.infrastructure.supportSystems.energy.call(
        'energy-monitor',
        {}
      )

    // Apply load balancing
    const loadBalancing =
      await factory.infrastructure.supportSystems.energy.call('load-balancer', {
        targetReduction: 20
      })

    // Monitor optimized energy
    await new Promise(resolve => setTimeout(resolve, 1000)) // Simulate time passage
    const optimizedEnergy =
      await factory.infrastructure.supportSystems.energy.call(
        'energy-monitor',
        {}
      )

    console.log('Energy Optimization Results:', {
      baselineConsumption: baselineEnergy.payload.summary.totalConsumption,
      targetReduction: loadBalancing.payload.balancing.targetReduction,
      actualReduction: loadBalancing.payload.balancing.actualReduction,
      projectedSavings: loadBalancing.payload.balancing.savingsPerHour,
      optimizedConsumption: optimizedEnergy.payload.summary.totalConsumption
    })

    // ========================================
    // 6. BRANCH STATISTICS AND MONITORING
    // ========================================
    console.log('\n📊 Branch Statistics and Monitoring...')

    const branchStats = {
      smartFactory: factory.infrastructure.smartFactory.getStats(),
      assembly: factory.infrastructure.productionAreas.assembly.getStats(),
      machining: factory.infrastructure.productionAreas.machining.getStats(),
      maintenance: factory.infrastructure.supportSystems.maintenance.getStats(),
      energy: factory.infrastructure.supportSystems.energy.getStats()
    }

    console.log('Branch Statistics:', {
      totalBranches: Object.keys(branchStats).length,
      totalChannels: Object.values(branchStats).reduce(
        (sum, stat) => sum + stat.channelCount,
        0
      ),
      maxDepth: Math.max(...Object.values(branchStats).map(stat => stat.depth)),
      activeBranches: Object.values(branchStats).filter(stat => stat.isActive)
        .length
    })

    console.log('\n🎉 Advanced Factory Features Demo completed successfully!')
    return {
      factory,
      robotGroup,
      qualityGroup,
      cncFleet,
      maintenanceAnalysis,
      energyOptimization: {
        baseline: baselineEnergy.payload,
        optimization: loadBalancing.payload,
        result: optimizedEnergy.payload
      },
      branchStats
    }
  } catch (error) {
    console.error('❌ Advanced Features Demo failed:', error)
    throw error
  }
}

// ========================================
// REAL-TIME MONITORING DEMO
// ========================================

export const realTimeMonitoringDemo = async () => {
  console.log('📡 Starting Real-Time Factory Monitoring...')

  try {
    const factory = await createSmartFactoryOrchestrator()

    // Set up continuous monitoring with intervals
    const monitoringIntervals = {
      production: setInterval(async () => {
        try {
          const status = await factory.getProductionStatus()
          console.log(`[${new Date().toISOString()}] Production Status:`, {
            efficiency: status.payload.overallEfficiency,
            throughput: status.payload.conveyor.totalThroughput,
            robotsOperational: status.payload.robots.filter(
              (r: any) => r.status === 'operational'
            ).length
          })
        } catch (error) {
          console.error('Production monitoring error:', error)
        }
      }, 5000), // Every 5 seconds

      energy: setInterval(async () => {
        try {
          const energy =
            await factory.infrastructure.supportSystems.energy.call(
              'energy-monitor',
              {}
            )
          console.log(`[${new Date().toISOString()}] Energy Status:`, {
            totalConsumption: energy.payload.summary.totalConsumption,
            efficiency: energy.payload.summary.averageEfficiency,
            costPerHour: energy.payload.summary.costPerHour
          })
        } catch (error) {
          console.error('Energy monitoring error:', error)
        }
      }, 10000), // Every 10 seconds

      maintenance: setInterval(async () => {
        try {
          const maintenance = await factory.getMaintenanceOverview()
          console.log(`[${new Date().toISOString()}] Maintenance Status:`, {
            criticalMachines: maintenance.payload.systemHealth.criticalMachines,
            immediateActions: maintenance.payload.systemHealth.immediateActions,
            totalDowntime: maintenance.payload.systemHealth.totalDowntime
          })
        } catch (error) {
          console.error('Maintenance monitoring error:', error)
        }
      }, 15000) // Every 15 seconds
    }

    console.log('📡 Real-time monitoring started. Press Ctrl+C to stop.')

    // Run for 60 seconds then clean up
    setTimeout(() => {
      console.log('\n🛑 Stopping real-time monitoring...')
      Object.values(monitoringIntervals).forEach(interval =>
        clearInterval(interval)
      )
      console.log('✅ Real-time monitoring stopped.')
    }, 60000)

    return {
      factory,
      monitoringIntervals,
      stop: () => {
        Object.values(monitoringIntervals).forEach(interval =>
          clearInterval(interval)
        )
        console.log('🛑 Manual stop - real-time monitoring stopped.')
      }
    }
  } catch (error) {
    console.error('❌ Real-time monitoring setup failed:', error)
    throw error
  }
}

// Export all demo functions
export default {
  smartFactoryDemo,
  advancedFactoryFeatures,
  realTimeMonitoringDemo
}

smartFactoryDemo(), advancedFactoryFeatures(), realTimeMonitoringDemo()
