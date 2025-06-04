// examples/path-tree-capabilities.ts
// Demonstration of path system for hierarchical data structures

import {cyre} from '../src'

/*

      C.Y.R.E - P.A.T.H - T.R.E.E - C.A.P.A.B.I.L.I.T.I.E.S
      
      Using paths for hierarchical data structures:
      🌳 Tree operations and traversal
      📊 Organizational hierarchies  
      🏢 Building/facility management
      📁 File system-like structures
      🏛️ Government/corporate structures
      🎮 Game world hierarchies

*/

async function pathTreeDemo() {
  console.log('🌳 PATH SYSTEM - TREE & HIERARCHICAL CAPABILITIES')
  console.log('='.repeat(60))

  await cyre.initialize()

  // ===========================================
  // EXAMPLE 1: Corporate Organizational Tree
  // ===========================================

  console.log('\n🏢 EXAMPLE 1: Corporate Organization Tree')

  const orgStructure = [
    // Executive Level
    {
      id: 'ceo',
      path: 'company/executive/ceo',
      payload: {name: 'John Smith', level: 'C-Level', reports: 0}
    },

    // VPs reporting to CEO
    {
      id: 'vp-eng',
      path: 'company/executive/vp-engineering',
      payload: {name: 'Alice Johnson', level: 'VP', reportsTo: 'ceo'}
    },
    {
      id: 'vp-sales',
      path: 'company/executive/vp-sales',
      payload: {name: 'Bob Wilson', level: 'VP', reportsTo: 'ceo'}
    },
    {
      id: 'vp-hr',
      path: 'company/executive/vp-hr',
      payload: {name: 'Carol Davis', level: 'VP', reportsTo: 'ceo'}
    },

    // Engineering Teams
    {
      id: 'dir-frontend',
      path: 'company/engineering/frontend/director',
      payload: {name: 'David Lee', level: 'Director', reportsTo: 'vp-eng'}
    },
    {
      id: 'dir-backend',
      path: 'company/engineering/backend/director',
      payload: {name: 'Eva Chen', level: 'Director', reportsTo: 'vp-eng'}
    },

    // Frontend Teams
    {
      id: 'lead-react',
      path: 'company/engineering/frontend/react-team/lead',
      payload: {name: 'Frank Kim', level: 'Lead', reportsTo: 'dir-frontend'}
    },
    {
      id: 'dev-react-1',
      path: 'company/engineering/frontend/react-team/developer-1',
      payload: {name: 'Grace Liu', level: 'Senior Dev', reportsTo: 'lead-react'}
    },
    {
      id: 'dev-react-2',
      path: 'company/engineering/frontend/react-team/developer-2',
      payload: {name: 'Henry Zhang', level: 'Mid Dev', reportsTo: 'lead-react'}
    },

    // Backend Teams
    {
      id: 'lead-api',
      path: 'company/engineering/backend/api-team/lead',
      payload: {name: 'Iris Wang', level: 'Lead', reportsTo: 'dir-backend'}
    },
    {
      id: 'dev-api-1',
      path: 'company/engineering/backend/api-team/developer-1',
      payload: {name: 'Jack Brown', level: 'Senior Dev', reportsTo: 'lead-api'}
    },
    {
      id: 'dev-db-1',
      path: 'company/engineering/backend/database-team/developer-1',
      payload: {name: 'Kate Wilson', level: 'DBA', reportsTo: 'dir-backend'}
    },

    // Sales Teams
    {
      id: 'dir-enterprise',
      path: 'company/sales/enterprise/director',
      payload: {name: 'Liam Green', level: 'Director', reportsTo: 'vp-sales'}
    },
    {
      id: 'rep-ent-1',
      path: 'company/sales/enterprise/rep-1',
      payload: {
        name: 'Maya Patel',
        level: 'Sr Rep',
        reportsTo: 'dir-enterprise'
      }
    },
    {
      id: 'rep-ent-2',
      path: 'company/sales/enterprise/rep-2',
      payload: {name: 'Noah Davis', level: 'Rep', reportsTo: 'dir-enterprise'}
    }
  ]

  // Register all org structure
  orgStructure.forEach(person => {
    cyre.action(person)
    cyre.on(person.id, (payload: any) => {
      console.log(
        `   👤 ${person.payload.name} (${person.payload.level}) received:`,
        payload
      )
      return {processed: true, employee: person.payload.name}
    })
  })

  console.log(
    `✅ Created organizational tree with ${orgStructure.length} employees`
  )

  // Tree Operations
  console.log('\n🌳 Tree Operations:')

  // 1. Get all VPs (C-level reports)
  const vps = cyre.path.find('company/executive/vp-*')
  console.log(`   VPs: ${vps.length} (${vps.map(v => v.id).join(', ')})`)

  // 2. Get all engineering staff
  const allEngineering = cyre.path.find('company/engineering/**')
  console.log(`   Engineering total: ${allEngineering.length} people`)

  // 3. Get frontend team structure
  const frontendTeam = cyre.path.find('company/engineering/frontend/**')
  console.log(`   Frontend team: ${frontendTeam.length} people`)

  // 4. Get all team leads across company
  const allLeads = cyre.path.find('**/lead')
  console.log(
    `   Team leads: ${allLeads.length} (${allLeads.map(l => l.id).join(', ')})`
  )

  // ===========================================
  // EXAMPLE 2: Smart Building IoT Tree
  // ===========================================

  console.log('\n\n🏢 EXAMPLE 2: Smart Building IoT Hierarchy')

  const buildingStructure = [
    // Building systems
    {
      id: 'hvac-main',
      path: 'building/systems/hvac/main-unit',
      payload: {type: 'HVAC', status: 'online', temperature: 22}
    },
    {
      id: 'hvac-backup',
      path: 'building/systems/hvac/backup-unit',
      payload: {type: 'HVAC', status: 'standby', temperature: 20}
    },

    // Floor 1 - Lobby & Retail
    {
      id: 'temp-lobby',
      path: 'building/floor-1/lobby/sensors/temperature',
      payload: {value: 21.5, unit: '°C', zone: 'public'}
    },
    {
      id: 'light-lobby',
      path: 'building/floor-1/lobby/lighting/main',
      payload: {brightness: 80, mode: 'auto', zone: 'public'}
    },
    {
      id: 'temp-shop-1',
      path: 'building/floor-1/shop-101/sensors/temperature',
      payload: {value: 22.0, unit: '°C', zone: 'retail'}
    },
    {
      id: 'temp-shop-2',
      path: 'building/floor-1/shop-102/sensors/temperature',
      payload: {value: 21.8, unit: '°C', zone: 'retail'}
    },

    // Floor 2 - Offices
    {
      id: 'temp-conf-a',
      path: 'building/floor-2/conference-a/sensors/temperature',
      payload: {value: 20.5, unit: '°C', zone: 'conference'}
    },
    {
      id: 'light-conf-a',
      path: 'building/floor-2/conference-a/lighting/main',
      payload: {brightness: 90, mode: 'meeting', zone: 'conference'}
    },
    {
      id: 'temp-office-201',
      path: 'building/floor-2/office-201/sensors/temperature',
      payload: {value: 22.2, unit: '°C', zone: 'office'}
    },
    {
      id: 'temp-office-202',
      path: 'building/floor-2/office-202/sensors/temperature',
      payload: {value: 21.9, unit: '°C', zone: 'office'}
    },

    // Floor 3 - Executive
    {
      id: 'temp-exec-suite',
      path: 'building/floor-3/executive-suite/sensors/temperature',
      payload: {value: 21.0, unit: '°C', zone: 'executive'}
    },
    {
      id: 'light-exec-suite',
      path: 'building/floor-3/executive-suite/lighting/main',
      payload: {brightness: 75, mode: 'executive', zone: 'executive'}
    },

    // Security systems
    {
      id: 'cam-entrance',
      path: 'building/security/cameras/main-entrance',
      payload: {status: 'recording', resolution: '4K', zone: 'entrance'}
    },
    {
      id: 'cam-lobby',
      path: 'building/security/cameras/lobby',
      payload: {status: 'recording', resolution: '1080p', zone: 'lobby'}
    },
    {
      id: 'access-main',
      path: 'building/security/access-control/main-door',
      payload: {status: 'armed', mode: 'keycard', zone: 'entrance'}
    }
  ]

  // Register building IoT
  buildingStructure.forEach(device => {
    cyre.action(device)
    cyre.on(device.id, (payload: any) => {
      console.log(`   🏢 ${device.id} updated:`, payload)
      return {processed: true, device: device.id, timestamp: Date.now()}
    })
  })

  console.log(
    `✅ Created building IoT tree with ${buildingStructure.length} devices`
  )

  // Building Tree Operations
  console.log('\n🌡️  Building Analytics:')

  // 1. All temperature sensors
  const tempSensors = cyre.path.find('**/sensors/temperature')
  console.log(`   Temperature sensors: ${tempSensors.length} devices`)

  // 2. Floor-specific systems
  const floor2Systems = cyre.path.find('building/floor-2/**')
  console.log(`   Floor 2 systems: ${floor2Systems.length} devices`)

  // 3. All lighting systems
  const lightingSystems = cyre.path.find('**/lighting/*')
  console.log(`   Lighting systems: ${lightingSystems.length} devices`)

  // 4. Security infrastructure
  const securitySystems = cyre.path.find('building/security/**')
  console.log(`   Security systems: ${securitySystems.length} devices`)

  // ===========================================
  // EXAMPLE 3: Tree Data Structure Operations
  // ===========================================

  console.log('\n\n🌳 EXAMPLE 3: Advanced Tree Operations')

  // Build hierarchical tree from paths
  const buildHierarchicalTree = (channels: any[]) => {
    const tree: any = {}

    channels.forEach(channel => {
      const segments = cyre.path.parse(channel.path)
      let current = tree

      segments.forEach((segment, index) => {
        if (!current[segment]) {
          current[segment] = {
            _children: {},
            _data: null,
            _path: segments.slice(0, index + 1).join('/'),
            _depth: index + 1
          }
        }
        current = current[segment]._children
      })

      // Store the actual channel data at the leaf
      const leaf = segments.reduce((curr, seg) => curr[seg]._children, tree)
      const lastSeg = segments[segments.length - 1]
      if (tree[segments[0]]) {
        let target = tree
        segments.forEach(seg => (target = target[seg]._children))
        segments.reduce((curr, seg, idx) => {
          if (idx === segments.length - 1) {
            curr[seg]._data = channel
          }
          return curr[seg]._children
        }, tree)
      }
    })

    return tree
  }

  // Create tree from org data
  const orgTree = buildHierarchicalTree(orgStructure)
  console.log('📊 Organizational tree structure created')

  // Tree traversal functions
  const getTreeDepth = (tree: any, currentDepth = 0): number => {
    let maxDepth = currentDepth
    Object.values(tree).forEach((node: any) => {
      if (node._children && Object.keys(node._children).length > 0) {
        maxDepth = Math.max(
          maxDepth,
          getTreeDepth(node._children, currentDepth + 1)
        )
      }
    })
    return maxDepth
  }

  const countNodesAtDepth = (
    tree: any,
    targetDepth: number,
    currentDepth = 0
  ): number => {
    if (currentDepth === targetDepth) {
      return Object.keys(tree).length
    }

    let count = 0
    Object.values(tree).forEach((node: any) => {
      if (node._children) {
        count += countNodesAtDepth(
          node._children,
          targetDepth,
          currentDepth + 1
        )
      }
    })
    return count
  }

  // Tree analytics
  const maxDepth = getTreeDepth(orgTree)
  console.log(`   Tree depth: ${maxDepth} levels`)

  for (let depth = 1; depth <= maxDepth; depth++) {
    const nodesAtDepth = countNodesAtDepth(orgTree, depth)
    console.log(`   Level ${depth}: ${nodesAtDepth} nodes`)
  }

  // ===========================================
  // EXAMPLE 4: Cascading Tree Operations
  // ===========================================

  console.log('\n\n📢 EXAMPLE 4: Cascading Tree Operations')

  // 1. Department-wide announcement
  console.log('\n📣 Engineering Department Announcement:')
  const engineeringAnnouncement = await cyre.path.bulkCall(
    'company/engineering/**',
    {
      type: 'announcement',
      message: 'Team building event this Friday!',
      from: 'VP Engineering',
      timestamp: Date.now()
    },
    {
      confirmLargeOperation: false
    }
  )
  console.log(
    `   Announcement sent to: ${engineeringAnnouncement.successfulCalls}/${engineeringAnnouncement.matchedChannels} people`
  )

  // 2. Building-wide system update
  console.log('\n🔧 Building Systems Maintenance:')
  const systemMaintenance = await cyre.path.bulkCall(
    'building/systems/**',
    {
      type: 'maintenance',
      action: 'schedule_update',
      scheduledFor: '2025-06-04T02:00:00Z',
      duration: '30 minutes'
    },
    {
      confirmLargeOperation: false
    }
  )
  console.log(
    `   Systems scheduled for maintenance: ${systemMaintenance.successfulCalls}/${systemMaintenance.matchedChannels}`
  )

  // 3. Floor evacuation simulation
  console.log('\n🚨 Floor 2 Evacuation Drill:')
  const evacuationDrill = await cyre.path.bulkCall(
    'building/floor-2/**',
    {
      type: 'emergency_drill',
      action: 'evacuate',
      exit_routes: ['stairwell-a', 'stairwell-b'],
      assembly_point: 'parking-lot-north'
    },
    {
      confirmLargeOperation: false
    }
  )
  console.log(
    `   Evacuation drill sent to: ${evacuationDrill.successfulCalls}/${evacuationDrill.matchedChannels} systems`
  )

  // ===========================================
  // EXAMPLE 5: Tree State Aggregation
  // ===========================================

  console.log('\n\n📊 EXAMPLE 5: Tree State Aggregation & Rollups')

  // Get all temperature readings and aggregate by floor
  const tempReadings = cyre.path.find('**/sensors/temperature')
  const tempByFloor: any = {}

  tempReadings.forEach(sensor => {
    const pathSegments = cyre.path.parse(sensor.path)
    const floorSegment = pathSegments.find(seg => seg.startsWith('floor-'))

    if (floorSegment) {
      if (!tempByFloor[floorSegment]) {
        tempByFloor[floorSegment] = {temps: [], avg: 0, min: 999, max: -999}
      }

      // In real app, you'd get the actual current temperature
      const mockTemp = 20 + Math.random() * 5 // Mock temperature
      tempByFloor[floorSegment].temps.push(mockTemp)
      tempByFloor[floorSegment].min = Math.min(
        tempByFloor[floorSegment].min,
        mockTemp
      )
      tempByFloor[floorSegment].max = Math.max(
        tempByFloor[floorSegment].max,
        mockTemp
      )
    }
  })

  // Calculate averages
  Object.keys(tempByFloor).forEach(floor => {
    const temps = tempByFloor[floor].temps
    tempByFloor[floor].avg =
      temps.reduce((sum, temp) => sum + temp, 0) / temps.length
  })

  console.log('🌡️  Temperature Summary by Floor:')
  Object.entries(tempByFloor).forEach(([floor, data]: [string, any]) => {
    console.log(
      `   ${floor}: Avg ${data.avg.toFixed(1)}°C, Range ${data.min.toFixed(
        1
      )}-${data.max.toFixed(1)}°C (${data.temps.length} sensors)`
    )
  })

  // ===========================================
  // EXAMPLE 6: Tree Navigation & Relationships
  // ===========================================

  console.log('\n\n🧭 EXAMPLE 6: Tree Navigation & Relationships')

  // Parent-child relationship functions
  const getParentPath = (path: string): string | null => {
    const segments = cyre.path.parse(path)
    return segments.length > 1 ? segments.slice(0, -1).join('/') : null
  }

  const getChildren = (parentPath: string) => {
    return cyre.path.find(`${parentPath}/*`)
  }

  const getSiblings = (path: string) => {
    const parent = getParentPath(path)
    if (!parent) return []

    return cyre.path
      .find(`${parent}/*`)
      .filter(sibling => sibling.path !== path)
  }

  const getAncestors = (path: string): string[] => {
    const segments = cyre.path.parse(path)
    const ancestors: string[] = []

    for (let i = 1; i < segments.length; i++) {
      ancestors.push(segments.slice(0, i).join('/'))
    }

    return ancestors
  }

  // Navigation examples
  console.log('\n🔍 Navigation Examples:')

  const examplePath = 'company/engineering/frontend/react-team/developer-1'
  console.log(`   Examining: ${examplePath}`)

  const parent = getParentPath(examplePath)
  console.log(`   Parent: ${parent}`)

  const siblings = getSiblings(examplePath)
  console.log(
    `   Siblings: ${siblings.length} (${siblings.map(s => s.id).join(', ')})`
  )

  const ancestors = getAncestors(examplePath)
  console.log(`   Ancestors: ${ancestors.join(' → ')}`)

  const children = getChildren('company/engineering/frontend')
  console.log(`   Frontend children: ${children.length} teams`)

  // ===========================================
  // Summary & Statistics
  // ===========================================

  console.log('\n\n📈 TREE SYSTEM SUMMARY')
  console.log('='.repeat(50))

  const allChannels = [...orgStructure, ...buildingStructure]
  const allPaths = allChannels.map(ch => ch.path)
  const uniqueSegments = new Set()
  const depthCounts: any = {}

  allPaths.forEach(path => {
    const segments = cyre.path.parse(path)
    const depth = segments.length

    depthCounts[depth] = (depthCounts[depth] || 0) + 1
    segments.forEach(seg => uniqueSegments.add(seg))
  })

  console.log(`📊 Statistics:`)
  console.log(`   Total channels: ${allChannels.length}`)
  console.log(`   Unique path segments: ${uniqueSegments.size}`)
  console.log(
    `   Maximum depth: ${Math.max(...Object.keys(depthCounts).map(Number))}`
  )
  console.log(`   Depth distribution:`)

  Object.entries(depthCounts)
    .sort(([a], [b]) => Number(a) - Number(b))
    .forEach(([depth, count]) => {
      console.log(`     Level ${depth}: ${count} channels`)
    })

  console.log(`\n🌳 Tree Capabilities Demonstrated:`)
  console.log(`   ✅ Organizational hierarchies`)
  console.log(`   ✅ IoT device trees`)
  console.log(`   ✅ Parent-child relationships`)
  console.log(`   ✅ Cascading operations`)
  console.log(`   ✅ State aggregation & rollups`)
  console.log(`   ✅ Tree navigation & traversal`)
  console.log(`   ✅ Depth-based operations`)
  console.log(`   ✅ Sibling relationships`)
  console.log(`   ✅ Ancestor tracking`)

  // Clean up
  console.log('\n🧹 Cleaning up tree structures...')
  let cleaned = 0
  allChannels.forEach(item => {
    if (cyre.forget(item.id)) cleaned++
  })
  console.log(`🧹 Cleaned ${cleaned} tree nodes`)

  console.log(
    '\n🎯 CONCLUSION: Paths create powerful hierarchical data structures!'
  )
  console.log(
    '   Perfect for: Organizations, Buildings, File Systems, Game Worlds, and more!'
  )
}

// Run the tree capabilities demo
pathTreeDemo().catch(console.error)

export {pathTreeDemo}
