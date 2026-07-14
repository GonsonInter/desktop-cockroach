export class Roster<T> {
  private items = new Map<number, T>()
  private nextId = 0
  constructor(private cap: number) {}

  add(item: T): number | null {
    if (this.items.size >= this.cap) return null
    const id = this.nextId++
    this.items.set(id, item)
    return id
  }

  remove(id: number): void {
    this.items.delete(id)
  }

  get size(): number {
    return this.items.size
  }

  entries(): Array<[number, T]> {
    return [...this.items.entries()]
  }

  clear(): void {
    this.items.clear()
  }
}
