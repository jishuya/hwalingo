import Dexie from 'dexie'
import type { Table } from 'dexie'

export interface ExampleItem {
  id?: number
  createdAt: number
  data: string
}

export class AppDB extends Dexie {
  examples!: Table<ExampleItem, number>

  constructor() {
    super('HwalingoDB')
    this.version(1).stores({
      examples: '++id, createdAt'
    })
  }
}

const db = new AppDB()
export default db
