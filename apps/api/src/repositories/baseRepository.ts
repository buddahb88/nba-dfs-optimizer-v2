import { PrismaClient } from '@nba-dfs/database';

/**
 * Base repository class providing common CRUD operations
 * All repositories extend this class for consistent data access patterns
 */
export abstract class BaseRepository<T, CreateInput, UpdateInput> {
  constructor(protected prisma: PrismaClient) {}

  /**
   * Get the Prisma model delegate for this repository
   * Must be implemented by subclasses
   */
  protected abstract get model(): any;

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<T | null> {
    return this.model.findUnique({
      where: { id },
    });
  }

  /**
   * Find all records with optional pagination
   */
  async findAll(options?: {
    skip?: number;
    take?: number;
    orderBy?: Record<string, 'asc' | 'desc'>;
  }): Promise<T[]> {
    return this.model.findMany({
      skip: options?.skip,
      take: options?.take,
      orderBy: options?.orderBy,
    });
  }

  /**
   * Create a new record
   */
  async create(data: CreateInput): Promise<T> {
    return this.model.create({ data });
  }

  /**
   * Update an existing record
   */
  async update(id: string, data: UpdateInput): Promise<T> {
    return this.model.update({
      where: { id },
      data,
    });
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<T> {
    return this.model.delete({
      where: { id },
    });
  }

  /**
   * Count records matching optional filter
   */
  async count(where?: Record<string, unknown>): Promise<number> {
    return this.model.count({ where });
  }

  /**
   * Check if a record exists
   */
  async exists(id: string): Promise<boolean> {
    const count = await this.model.count({
      where: { id },
    });
    return count > 0;
  }

  /**
   * Execute operations in a transaction
   */
  async transaction<R>(
    fn: (tx: Omit<PrismaClient, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>) => Promise<R>
  ): Promise<R> {
    return this.prisma.$transaction(fn);
  }
}
