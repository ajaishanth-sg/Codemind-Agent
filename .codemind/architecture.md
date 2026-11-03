# CodeMind Architecture

## The 7 Intelligence Layers
1. **VS Code UI:** The presentation layer separating symptom vs cause.
2. **Orchestration Layer:** Commands, Agents, Tasks, Permissions.
3. **Reasoning Engine:** Planning, Diagnosis, Prediction.
4. **Context Engine:** Graph + RAG + Symbols + Git + Runtime + Config.
5. **Project Knowledge Graph:** The core moat mapping relationships.
6. **Data Sources:** Code (AST), Git (History), Runtime (Logs), Config (Env/Docker).

## Temporal Project Graph
Instead of just embedding chunks of text, CodeMind maps deterministic relationships.
- File contains Function
- File imports Module
- File uses Environment Variable
- File changed_by Git Commit

By storing timestamp + commit + source, the graph becomes temporal, allowing CodeMind to answer: "What changed between the last working state and the current broken state?"

## Evidence-Based AI
AI answers must have internal evidence chains.
Confidence is calculated from evidence strength (e.g., matching runtime error + matching config + reproducible test = High Confidence).

## Root Cause Engine Workflow
Error → Normalize → Extract Symbols → Find Stack → Map Files → Search Graph → Check Recent Changes → Check Config/Runtime/Dependencies → Generate Hypotheses → Rank Hypotheses → Collect Evidence → Produce Diagnosis.

## Agentic Implementation Flow
User Request → Understand → Plan → Show Plan → User Approval → Execute → Test → Analyze Results → Fix if Needed → Verify → Final Report.
