import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

export class GraphDatabase {
    private db: Database.Database;

    constructor(workspaceStoragePath: string) {
        if (!fs.existsSync(workspaceStoragePath)) {
            fs.mkdirSync(workspaceStoragePath, { recursive: true });
        }
        
        const dbPath = path.join(workspaceStoragePath, 'codemind_graph.db');
        this.db = new Database(dbPath);
        
        this.initializeSchema();
    }

    private initializeSchema() {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS nodes (
                id TEXT PRIMARY KEY,
                type TEXT NOT NULL,
                name TEXT NOT NULL,
                file_path TEXT,
                metadata TEXT
            );

            CREATE TABLE IF NOT EXISTS edges (
                source_id TEXT,
                target_id TEXT,
                relationship_type TEXT NOT NULL,
                metadata TEXT,
                PRIMARY KEY (source_id, target_id, relationship_type),
                FOREIGN KEY (source_id) REFERENCES nodes(id),
                FOREIGN KEY (target_id) REFERENCES nodes(id)
            );
        `);
    }

    public addNode(id: string, type: string, name: string, filePath?: string, metadata: any = {}) {
        const stmt = this.db.prepare('INSERT OR REPLACE INTO nodes (id, type, name, file_path, metadata) VALUES (?, ?, ?, ?, ?)');
        stmt.run(id, type, name, filePath, JSON.stringify(metadata));
    }

    public addEdge(sourceId: string, targetId: string, relationshipType: string, metadata: any = {}) {
        const stmt = this.db.prepare('INSERT OR IGNORE INTO edges (source_id, target_id, relationship_type, metadata) VALUES (?, ?, ?, ?)');
        stmt.run(sourceId, targetId, relationshipType, JSON.stringify(metadata));
    }

    public getStats(): { nodes: number, edges: number } {
        const nodes = this.db.prepare('SELECT COUNT(*) as count FROM nodes').get() as { count: number };
        const edges = this.db.prepare('SELECT COUNT(*) as count FROM edges').get() as { count: number };
        return {
            nodes: nodes.count,
            edges: edges.count
        };
    }

    public close() {
        this.db.close();
    }
}
