import { Project, SourceFile } from 'ts-morph';
import { GraphDatabase } from '../graph/db';
import * as path from 'path';

export class TypeScriptAnalyzer {
    private project: Project;
    private db: GraphDatabase;
    private workspaceRoot: string;

    constructor(workspaceRoot: string, db: GraphDatabase) {
        this.workspaceRoot = workspaceRoot;
        this.db = db;
        
        // Initialize ts-morph project
        this.project = new Project({
            skipAddingFilesFromTsConfig: true
        });
    }

    public async analyze() {
        // Add all ts/tsx files in the workspace
        this.project.addSourceFilesAtPaths(path.join(this.workspaceRoot, '**/*.{ts,tsx}'));
        
        const sourceFiles = this.project.getSourceFiles();

        for (const file of sourceFiles) {
            this.analyzeFile(file);
        }
    }

    private analyzeFile(file: SourceFile) {
        const filePath = file.getFilePath();
        const fileId = `FILE:${filePath}`;
        
        // Add File Node
        this.db.addNode(fileId, 'FILE', path.basename(filePath), filePath);

        // Analyze Imports
        const imports = file.getImportDeclarations();
        for (const imp of imports) {
            const moduleSpecifier = imp.getModuleSpecifierValue();
            const sourceFile = imp.getModuleSpecifierSourceFile();
            
            if (sourceFile) {
                const targetFilePath = sourceFile.getFilePath();
                const targetId = `FILE:${targetFilePath}`;
                
                this.db.addNode(targetId, 'FILE', path.basename(targetFilePath), targetFilePath);
                this.db.addEdge(fileId, targetId, 'IMPORTS');
            } else {
                // External or unresolved import
                const targetId = `PACKAGE:${moduleSpecifier}`;
                this.db.addNode(targetId, 'PACKAGE', moduleSpecifier);
                this.db.addEdge(fileId, targetId, 'IMPORTS');
            }
        }

        // Analyze Exported Functions/Classes (Simplified for MVP)
        const classes = file.getClasses();
        for (const cls of classes) {
            const className = cls.getName();
            if (className) {
                const classId = `CLASS:${filePath}:${className}`;
                this.db.addNode(classId, 'CLASS', className, filePath);
                this.db.addEdge(fileId, classId, 'CONTAINS');
            }
        }
    }
}
