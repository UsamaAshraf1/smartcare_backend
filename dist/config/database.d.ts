declare const pool: import("pg").Pool;
export declare const db: import("drizzle-orm/node-postgres").NodePgDatabase<Record<string, never>> & {
    $client: import("pg").Pool;
};
export { pool };
export declare function testConnection(): Promise<boolean>;
//# sourceMappingURL=database.d.ts.map