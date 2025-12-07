# BMAD-CUSTOM Workflows

## Available Workflows in bmad-custom

**quiz-master**
- Path: `.bmad/bmad-custom/workflows/quiz-master/workflow.md`
- Interactive trivia quiz with progressive difficulty and gameshow atmosphere

**wassup**
- Path: `.bmad/bmad-custom/workflows/wassup/workflow.md`
- Will check everything that is local and not committed and tell me about what has been done so far that has not been committed.


## Execution

When running any workflow:
1. LOAD {project-root}/.bmad/core/tasks/workflow.xml
2. Pass the workflow path as 'workflow-config' parameter
3. Follow workflow.xml instructions EXACTLY
4. Save outputs after EACH section

## Modes
- Normal: Full interaction
- #yolo: Skip optional steps
