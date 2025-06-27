// auth-demo-example.ts
// Terminal demo showing Cyre authentication system

import {cyre} from '../src'

/*

      C.Y.R.E - A.U.T.H - D.E.M.O
      
      Terminal demo showing:
      - User registration and authentication
      - Role-based access control
      - Protected channel interactions
      - Session management
      - Error handling

*/

// Simulated user database
const userDatabase = new Map([
  [
    'admin',
    {
      id: 'admin',
      password: 'admin123',
      roles: ['admin', 'user'],
      permissions: ['read', 'write', 'delete', 'manage-users'],
      email: 'admin@company.com'
    }
  ],
  [
    'john',
    {
      id: 'john',
      password: 'john456',
      roles: ['user'],
      permissions: ['read', 'write'],
      email: 'john@company.com'
    }
  ],
  [
    'guest',
    {
      id: 'guest',
      password: 'guest789',
      roles: ['guest'],
      permissions: ['read'],
      email: 'guest@company.com'
    }
  ]
])

async function runAuthDemo() {
  console.log('🚀 Cyre Authentication Demo')
  console.log('='.repeat(50))

  // Initialize Cyre
  await cyre.init()

  // 1. Register authenticator function
  console.log('\n📋 1. Registering authenticator...')
  cyre.on('auth', async credentials => {
    console.log(
      `   🔍 Validating credentials for: ${credentials.userId || 'token-based'}`
    )

    // JWT token simulation
    if (credentials.token?.startsWith('jwt:')) {
      const userId = credentials.token.split(':')[1]
      const user = userDatabase.get(userId)

      if (user) {
        console.log(`   ✅ JWT token valid for user: ${user.id}`)
        return {
          valid: true,
          user: {
            id: user.id,
            roles: user.roles,
            permissions: user.permissions,
            metadata: {email: user.email}
          }
        }
      }
    }

    // Username/password validation
    if (credentials.userId && credentials.metadata?.password) {
      const user = userDatabase.get(credentials.userId)

      if (user && user.password === credentials.metadata.password) {
        console.log(
          `   ✅ User authenticated: ${user.id} (${user.roles.join(', ')})`
        )
        return {
          valid: true,
          user: {
            id: user.id,
            roles: user.roles,
            permissions: user.permissions,
            metadata: {email: user.email}
          }
        }
      }
    }

    console.log(`   ❌ Authentication failed`)
    return {
      valid: false,
      error: 'Invalid username or password'
    }
  })

  // 2. Create protected channels with different auth requirements
  console.log('\n🔒 2. Creating protected channels...')

  // Admin-only channel
  cyre.action({
    id: 'admin-panel',
    throttle: 100,
    auth: {
      mode: 'group',
      sessionTimeout: 30 * 60 * 1000 // 30 minutes
    }
  })

  cyre.on('admin-panel', payload => {
    if (!cyre.auth.hasRole('admin')) {
      throw new Error('Admin role required')
    }

    return {
      success: true,
      message: `Admin panel accessed by ${cyre.auth.whoami()?.id}`,
      data: {
        users: Array.from(userDatabase.keys()),
        action: payload.action
      }
    }
  })

  // User data channel
  cyre.action({
    id: 'user-data',
    auth: {
      mode: 'session',
      sessionTimeout: 60 * 60 * 1000 // 1 hour
    }
  })

  cyre.on('user-data', payload => {
    const user = cyre.auth.whoami()
    if (!user) {
      throw new Error('Authentication required')
    }

    return {
      success: true,
      message: `User data accessed by ${user.id}`,
      data: {
        profile: {
          id: user.id,
          email: user.metadata?.email,
          roles: user.roles
        },
        requestedData: payload.dataType
      }
    }
  })

  // Public channel (no auth required)
  cyre.action({id: 'public-info'})
  cyre.on('public-info', payload => {
    return {
      success: true,
      message: 'Public information accessed',
      data: {
        serverTime: new Date().toISOString(),
        version: '1.0.0'
      }
    }
  })

  console.log('   ✅ Created channels: admin-panel, user-data, public-info')

  // 3. Test public access (no auth needed)
  console.log('\n🌐 3. Testing public access...')
  try {
    const result = await cyre.call('public-info', {request: 'server-status'})
    console.log(`   ✅ Public call successful: ${result.payload?.message}`)
  } catch (error) {
    console.log(`   ❌ Public call failed: ${error.message}`)
  }

  // 4. Test protected access without auth (should fail)
  console.log('\n🚫 4. Testing protected access without authentication...')
  try {
    const result = await cyre.call('admin-panel', {action: 'get-users'})
    console.log(`   ⚠️  Unexpected success: ${result.message}`)
  } catch (error) {
    console.log(`   ✅ Correctly blocked: ${error.message}`)
  }

  // 5. Login as admin
  console.log('\n👑 5. Admin login...')
  const adminLogin = await cyre.auth.login({
    userId: 'admin',
    metadata: {password: 'admin123'}
  })

  if (adminLogin.ok) {
    console.log(
      `   ✅ Admin logged in successfully (Session: ${adminLogin.sessionId})`
    )
    console.log(`   👤 Current user: ${cyre.auth.whoami()?.id}`)
    console.log(`   🎭 Roles: ${cyre.auth.whoami()?.roles?.join(', ')}`)
    console.log(`   🔑 Has admin role: ${cyre.auth.hasRole('admin')}`)
    console.log(
      `   🔐 Has delete permission: ${cyre.auth.hasPermission('delete')}`
    )

    // Test admin panel access
    console.log('\n🛡️ 6. Testing admin panel access...')
    try {
      const result = await cyre.call('admin-panel', {action: 'list-users'})
      console.log(`   ✅ Admin panel access: ${result.payload?.message}`)
      console.log(
        `   📊 Users in system: ${result.payload?.data.users.join(', ')}`
      )
    } catch (error) {
      console.log(`   ❌ Admin panel failed: ${error.message}`)
    }

    // Test user data access as admin
    console.log('\n📋 7. Testing user data access as admin...')
    try {
      const result = await cyre.call('user-data', {dataType: 'profile'})
      console.log(`   ✅ User data access: ${result.payload?.message}`)
      console.log(`   📧 Email: ${result.payload?.data.profile.email}`)
    } catch (error) {
      console.log(`   ❌ User data failed: ${error.message}`)
    }

    // Logout admin
    console.log('\n🚪 8. Admin logout...')
    const logoutResult = cyre.auth.logout(adminLogin.sessionId)
    console.log(
      `   ${logoutResult ? '✅' : '❌'} Admin logout: ${
        logoutResult ? 'successful' : 'failed'
      }`
    )
    console.log(`   👤 Current user: ${cyre.auth.whoami()?.id || 'none'}`)
  } else {
    console.log(`   ❌ Admin login failed: ${adminLogin.error}`)
  }

  // 9. Login as regular user
  console.log('\n👨‍💼 9. Regular user login...')
  const userLogin = await cyre.auth.login({
    userId: 'john',
    metadata: {password: 'john456'}
  })

  if (userLogin.ok) {
    console.log(
      `   ✅ User logged in successfully (Session: ${userLogin.sessionId})`
    )
    console.log(`   👤 Current user: ${cyre.auth.whoami()?.id}`)
    console.log(`   🎭 Roles: ${cyre.auth.whoami()?.roles?.join(', ')}`)
    console.log(`   🔑 Has admin role: ${cyre.auth.hasRole('admin')}`)
    console.log(
      `   🔐 Has write permission: ${cyre.auth.hasPermission('write')}`
    )

    // Test admin panel access (should fail)
    console.log('\n🚫 10. Testing admin panel access as regular user...')
    try {
      const result = await cyre.call('admin-panel', {action: 'list-users'})
      console.log(`   ⚠️  Unexpected success: ${result.payload?.message}`)
    } catch (error) {
      console.log(`   ✅ Correctly blocked: ${error.message}`)
    }

    // Test user data access (should work)
    console.log('\n📋 11. Testing user data access as regular user...')
    try {
      const result = await cyre.call('user-data', {dataType: 'settings'})
      console.log(`   ✅ User data access: ${result.payload?.message}`)
      console.log(`   📧 Email: ${result.payload?.data.profile.email}`)
    } catch (error) {
      console.log(`   ❌ User data failed: ${error.message}`)
    }

    // Logout user
    console.log('\n🚪 12. User logout...')
    const logoutResult = cyre.auth.logout(userLogin.sessionId)
    console.log(
      `   ${logoutResult ? '✅' : '❌'} User logout: ${
        logoutResult ? 'successful' : 'failed'
      }`
    )
  } else {
    console.log(`   ❌ User login failed: ${userLogin.error}`)
  }

  // 10. Test JWT token authentication
  console.log('\n🎫 13. Testing JWT token authentication...')
  const jwtLogin = await cyre.auth.login({
    token: 'jwt:admin' // Simulated JWT token
  })

  if (jwtLogin.ok) {
    console.log(`   ✅ JWT login successful`)
    console.log(`   👤 Current user: ${cyre.auth.whoami()?.id}`)

    try {
      const result = await cyre.call('admin-panel', {action: 'jwt-test'})
      console.log(`   ✅ JWT admin access: ${result.payload?.message}`)
    } catch (error) {
      console.log(`   ❌ JWT admin access failed: ${error.message}`)
    }

    cyre.auth.logout(jwtLogin.sessionId)
    console.log(`   🚪 JWT session closed`)
  }

  // 11. Test invalid credentials
  console.log('\n❌ 14. Testing invalid credentials...')
  const invalidLogin = await cyre.auth.login({
    userId: 'hacker',
    metadata: {password: 'wrong'}
  })

  console.log(
    `   ${
      invalidLogin.ok ? '⚠️  Unexpected success' : '✅ Correctly rejected'
    }: ${invalidLogin.error || 'Login succeeded'}`
  )

  // 12. Final system status
  console.log('\n📊 15. Final system status...')
  console.log(`   👤 Current user: ${cyre.auth.whoami()?.id || 'none'}`)
  console.log(`   🔒 Auth system: operational`)
  console.log(`   📈 System metrics available`)

  console.log('\n🎉 Authentication demo completed!')
  console.log('='.repeat(50))
}

// Run the demo
runAuthDemo().catch(error => {
  console.error('Demo failed:', error)
  process.exit(1)
})
