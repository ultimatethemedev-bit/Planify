import mongoose from 'mongoose'
import User from './models/User.js'
import Store from './models/Store.js'

export async function runMigration() {
  // Always try to drop old indexes (idempotent)
  const oldIndexes = {
    plannings: 'userId_1_storeId_1_weekStart_1',
    timesheets: 'userId_1_storeId_1_employeeId_1_weekStart_1',
    employees: 'userId_1_storeId_1_isActive_1',
  }

  for (const [collName, indexName] of Object.entries(oldIndexes)) {
    try {
      await mongoose.connection.collection(collName).dropIndex(indexName)
      console.log(`Dropped old index ${indexName} on ${collName}`)
    } catch (e) {
      // Index doesn't exist, that's fine
    }
  }

  try {
    await mongoose.connection.collection('settings').dropIndex('userId_1')
    console.log('Dropped old index userId_1 on settings')
  } catch (e) {
    // Index doesn't exist
  }

  // Check if migration already fully completed
  const users = await User.find({ stores: { $exists: true, $ne: [] } })
  if (users.length === 0) {
    return
  }

  // Count how many stores SHOULD exist vs how many DO exist
  let totalExpectedStores = 0
  for (const user of users) {
    totalExpectedStores += user.stores.length
  }

  const storeCount = await Store.countDocuments()
  if (storeCount >= totalExpectedStores) {
    // Also check settings have storeId
    const settingsWithoutStoreId = await mongoose.connection.collection('settings').countDocuments({
      storeId: { $exists: false },
    })
    if (settingsWithoutStoreId === 0) {
      return // Migration fully complete
    }
  }

  console.log('Starting multi-user migration...')

  for (const user of users) {
    for (let i = 0; i < user.stores.length; i++) {
      const embeddedStore = user.stores[i]

      // Create Store if it doesn't exist yet
      const existingStore = await Store.findById(embeddedStore._id)
      if (!existingStore) {
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
        console.log(`Created Store: ${embeddedStore.name}`)
      }

      // Migrate Settings: ensure storeId is set
      const settingsWithStoreId = await mongoose.connection.collection('settings').findOne({
        storeId: embeddedStore._id,
      })

      if (!settingsWithStoreId) {
        // Try to find old settings by userId
        const oldSettings = await mongoose.connection.collection('settings').findOne({
          userId: user._id,
          $or: [{ storeId: { $exists: false } }, { storeId: null }],
        })

        if (oldSettings && i === 0) {
          // First store: update existing settings doc
          await mongoose.connection.collection('settings').updateOne(
            { _id: oldSettings._id },
            { $set: { storeId: embeddedStore._id } }
          )
          console.log(`Updated settings for store: ${embeddedStore.name}`)
        } else {
          // Additional stores or no old settings: create new default settings
          await mongoose.connection.collection('settings').insertOne({
            storeId: embeddedStore._id,
            storeHours: {
              monday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
              tuesday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
              wednesday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
              thursday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
              friday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
              saturday: { isOpen: true, openTime: '10:00', closeTime: '21:00' },
              sunday: { isOpen: true, openTime: '10:00', closeTime: '19:00' },
            },
            events: [],
            shiftTemplates: [
              { name: 'Matin', startTime: '10:00', endTime: '15:00' },
              { name: 'Apres-midi', startTime: '13:00', endTime: '21:00' },
              { name: 'Journee', startTime: '10:00', endTime: '21:00' },
            ],
            weekNumberConfig: {
              referenceDate: new Date().toISOString().split('T')[0],
              referenceWeekNumber: 1,
            },
            createdAt: new Date(),
            updatedAt: new Date(),
          })
          console.log(`Created default settings for store: ${embeddedStore.name}`)
        }
      }
    }
  }

  console.log(`Migration completed: ${users.length} user(s) migrated.`)
}
