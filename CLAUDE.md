# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a newly initialized repository named "gitrieve-gleaner". Based on the name, it appears to be intended for a project related to retrieving or gleaning information from git repositories. Currently, the repository only contains a devcontainer configuration.

## Dev Container Configuration

The repository includes a devcontainer configuration (`.devcontainer/devcontainer.json`) that sets up:
- Python 3.12 environment
- Node.js 22
- VS Code extensions for Python development
- Post-create commands to install Claude Code CLI tools globally

## Development Setup

To initialize development:
1. Open in VS Code with Remote Containers extension
2. The devcontainer will automatically provision the environment
3. Post-create commands will install required global packages:
   - `@anthropic-ai/claude-code`
   - `@musistudio/claude-code-router`

## Project Initialization

Since this repository is currently empty, you'll need to:
1. Determine the project purpose based on the "gitrieve-gleaner" name
2. Set up appropriate project structure
3. Initialize version control with meaningful initial commit
4. Add relevant dependencies based on project requirements

## Common Commands

As this is an empty repository, there are currently no established build, lint, or test commands. These will need to be set up based on the chosen technology stack.

## Architecture Considerations

Given the repository name suggests git repository analysis functionality, potential architecture directions might include:
- Git repository parsing and analysis utilities
- Data extraction from git history
- Information retrieval systems for code repositories
- CLI tools for examining git metadata

The devcontainer setup suggests this will primarily be a Python-based project with potential Node.js integration.