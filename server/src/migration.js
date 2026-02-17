import mongoose from 'mongoose'
import User from './models/User.js'
import Store from './models/Store.js'
import Settings from './models/Settings.js'

export async function runMigration() {
  const storeCount = await Store.countDocuments()
  if (storeCount > 0) {
    return
  }

  console.log('Starting multi-user migration...')

  const users = await User.find({ stores: { $exists: true, $ne: [] } })

  if (users.length === 0) {
    console.log('No users to migrate.')
    return
  }

  for (const user of users) {
    for (let i = 0; i < user.stores.length; i++) {
      const embeddedStore = user.stores[i]

      // Create standalone Store with same _id
      const store = new Store({
        _id: embeddedStore._id,
        name: embeddedStore.name,
        members: [{
          userId: user._id,
          role: 'owner',
          joinedAt: user.createdAt || new Date(),
        }],
      })
      await store.save()

      // Migrate Settings: add storeId
      const existingSettings = await Settings.findOne({ userId: user._id })
      if (existingSettings && i === 0) {
        // First store: update existing settings doc
        await mongoose.connection.collection('settings').updateOne(
          { _id: existingSettings._id },
          { $set: { storeId: embeddedStore._id } }
        )
      } else if (existingSettings && i > 0) {
        // Additional stores: create a copy with default settings
        const settingsCopy = existingSettings.toObject()
        delete settingsCopy._id
        delete settingsCopy.userId
        settingsCopy.storeId = embeddedStore._id
        await mongoose.connection.collection('settings').insertOne(settingsCopy)
      }
    }
  }

  // Drop old indexes that include userId
  const collections = {
    plannings: 'userId_1_storeId_1_weekStart_1',
    timesheets: 'userId_1_storeId_1_employeeId_1_weekStart_1',
    employees: 'userId_1_storeId_1_isActive_1',
  }

  for (const [collName, indexName] of Object.entries(collections)) {
    try {
      await mongoose.connection.collection(collName).dropIndex(indexName)
    } catch (e) {
      // Index may not exist, that's fine
    }
  }

  // Drop old userId unique index on settings
  try {
    await mongoose.connection.collection('settings').dropIndex('userId_1')
  } catch (e) {
    // Index may not exist
  }

  console.log(`Migration completed: ${users.length} user(s) migrated.`)
}
