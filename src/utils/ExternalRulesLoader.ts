import fs from 'fs-extra';
import path from 'path';
import { EventEmitter } from 'events';
import yaml from 'js-yaml';
import { clineruleTemplates } from './ClineruleTemplates.js';
import os from 'os';
import { ValidationResult } from '../types/index.js';
import { ClineruleBase, MemoryBankConfig } from '../types/rules.js';
import { logger } from './LogManager.js';

/**
 * Class responsible for loading and monitoring external .clinerules files
 */
export class ExternalRulesLoader extends EventEmitter {
  private projectDir: string;
  private rules: Map<string, ClineruleBase> = new Map();
  private watchers: fs.FSWatcher[] = [];
  
  /**
   * Creates a new instance of the external rules loader
   * @param projectDir Project directory (default: current directory)
   */
  constructor(projectDir?: string) {
    super();
    this.projectDir = projectDir || process.cwd();
    logger.debug('ExternalRulesLoader', `Initialized with project directory: ${this.projectDir}`);
  }

  /**
   * Gets a writable directory for storing .clinerules files
   * Uses only the specified project directory without fallbacks
   * @returns A writable directory path
   */
  private async getWritableDirectory(): Promise<string> {
    // Use only the project directory
    const targetDir = this.projectDir;
    
    try {
      await fs.access(targetDir, fs.constants.W_OK);
      return targetDir;
    } catch (error) {
      logger.error('ExternalRulesLoader', `Project directory ${targetDir} is not writable`);
      throw new Error(`Project directory ${targetDir} is not writable`);
    }
  }

  /**
   * Validates that all required .clinerules files exist
   * @returns Validation result with missing and existing files
   */
  async validateRequiredFiles(): Promise<ValidationResult> {
    const modes = ['architect', 'ask', 'code', 'debug', 'test'];
    const missingFiles: string[] = [];
    const existingFiles: string[] = [];
    
    // Get a writable directory for .clinerules files
    const targetDir = await this.getWritableDirectory();
    
    // Check for files in both project directory and fallback directory
    for (const mode of modes) {
      const filename = `.clinerules-${mode}`;
      const projectFilePath = path.join(this.projectDir, filename);
      const fallbackFilePath = path.join(targetDir, filename);
      
      if (await fs.pathExists(projectFilePath) || await fs.pathExists(fallbackFilePath)) {
        existingFiles.push(filename);
      } else {
        missingFiles.push(filename);
      }
    }
    
    // If there are missing files, try to create them
    if (missingFiles.length > 0) {
      logger.warn('ExternalRulesLoader', `Missing .clinerules files: ${missingFiles.join(', ')}`);
      const createdFiles = await this.createMissingClinerules(missingFiles);
      
      // Update the lists
      for (const file of createdFiles) {
        const index = missingFiles.indexOf(file);
        if (index !== -1) {
          missingFiles.splice(index, 1);
          existingFiles.push(file);
        }
      }
    }
    
    return {
      valid: missingFiles.length === 0,
      missingFiles,
      existingFiles
    };
  }

  /**
   * Detects and loads all .clinerules files in the project directory
   */
  async detectAndLoadRules(): Promise<Map<string, ClineruleBase>> {
    const modes = ['architect', 'ask', 'code', 'debug', 'test'];
    
    // Validate required files and create missing ones
    const validation = await this.validateRequiredFiles();
    if (!validation.valid) {
      logger.warn('ExternalRulesLoader', `Warning: Some .clinerules files could not be created: ${validation.missingFiles.join(', ')}`);
    }
    
    // Clear existing watchers
    this.stopWatching();
    
    // Clear existing rules
    this.rules.clear();
    
    // Get the fallback directory
    const fallbackDir = await this.getWritableDirectory();
    
    for (const mode of modes) {
      const filename = `.clinerules-${mode}`;
      const projectFilePath = path.join(this.projectDir, filename);
      const fallbackFilePath = path.join(fallbackDir, filename);
      
      try {
        // First try to load from project directory
        if (await fs.pathExists(projectFilePath)) {
          const content = await fs.readFile(projectFilePath, 'utf8');
          const rule = this.parseRuleContent(content);
          
          if (rule && rule.mode === mode) {
            this.rules.set(mode, rule);
            logger.debug('ExternalRulesLoader', `Loaded ${filename} rules from project directory`);
            
            // Set up watcher for this file
            this.watchRuleFile(projectFilePath, mode);
          } else {
            logger.warn('ExternalRulesLoader', `Invalid rule format in ${filename} (project directory)`);
          }
        } 
        // If not found in project directory, try fallback directory
        else if (await fs.pathExists(fallbackFilePath)) {
          const content = await fs.readFile(fallbackFilePath, 'utf8');
          const rule = this.parseRuleContent(content);
          
          if (rule && rule.mode === mode) {
            this.rules.set(mode, rule);
            logger.debug('ExternalRulesLoader', `Loaded ${filename} rules from fallback directory`);
            
            // Set up watcher for this file
            this.watchRuleFile(fallbackFilePath, mode);
          } else {
            logger.warn('ExternalRulesLoader', `Invalid rule format in ${filename} (fallback directory)`);
          }
        }
      } catch (error) {
        logger.warn('ExternalRulesLoader', `Error loading ${filename}: ${error}`);
      }
    }
    
    return this.rules;
  }
  
  /**
   * Parses the content of a rule file
   * @param content File content
   * @returns Parsed rule object or null if invalid
   */
  private parseRuleContent(content: string): ClineruleBase | null {
    try {
      // First try to parse as JSON
      const rule = JSON.parse(content);
      
      // Basic validation
      if (!rule.mode || !rule.instructions || !Array.isArray(rule.instructions.general)) {
        return null;
      }
      
      return rule;
    } catch (jsonError) {
      // If not valid JSON, try to parse as YAML
      try {
        const rule = yaml.load(content) as ClineruleBase;
        
        // Basic validation
        if (!rule.mode || !rule.instructions || !Array.isArray(rule.instructions.general)) {
          return null;
        }
        
        return rule;
      } catch (yamlError) {
        console.error('Failed to parse rule content as JSON or YAML:', yamlError);
        return null;
      }
    }
  }
  
  /**
   * Sets up a watcher for a rule file
   * @param filePath File path
   * @param mode Mode associated with the file
   */
  private watchRuleFile(filePath: string, mode: string): void {
    const watcher = fs.watch(filePath, async (eventType) => {
      if (eventType === 'change') {
        try {
          const content = await fs.readFile(filePath, 'utf8');
          const rule = this.parseRuleContent(content);
          
          if (rule && rule.mode === mode) {
            this.rules.set(mode, rule);
            this.emit('ruleChanged', mode, rule);
            logger.debug('ExternalRulesLoader', `Updated ${path.basename(filePath)} rules`);
          }
        } catch (error) {
          logger.error('ExternalRulesLoader', `Error updating ${path.basename(filePath)}: ${error}`);
        }
      }
    });
    
    this.watchers.push(watcher);
  }
  
  /**
   * Stops watching all rule files
   */
  stopWatching(): void {
    for (const watcher of this.watchers) {
      watcher.close();
    }
    this.watchers = [];
  }
  
  /**
   * Gets the rules for a specific mode
   * @param mode Mode name
   * @returns Rules for the specified mode or null if not found
   */
  getRulesForMode(mode: string): ClineruleBase | null {
    return this.rules.get(mode) || null;
  }
  
  /**
   * Checks if a specific mode is available
   * @param mode Mode name
   * @returns true if the mode is available, false otherwise
   */
  hasModeRules(mode: string): boolean {
    return this.rules.has(mode);
  }
  
  /**
   * Gets all available modes
   * @returns Array with the names of available modes
   */
  getAvailableModes(): string[] {
    return Array.from(this.rules.keys());
  }
  
  /**
   * Cleans up all resources
   */
  dispose(): void {
    this.stopWatching();
    this.removeAllListeners();
    this.rules.clear();
  }

  /**
   * Creates missing .clinerules files
   * @param missingFiles Array of missing file names
   * @returns Array of created file names
   */
  async createMissingClinerules(missingFiles: string[]): Promise<string[]> {
    const createdFiles: string[] = [];
    
    // Get a writable directory for .clinerules files
    const targetDir = await this.getWritableDirectory();
    
    for (const filename of missingFiles) {
      const mode = filename.replace('.clinerules-', '');
      const template = clineruleTemplates[mode];
      
      if (template) {
        // Use only the path received via argument, without adding a folder
        const filePath = path.join(targetDir, filename);
        
        try {
          await fs.writeFile(filePath, template);
          createdFiles.push(filename);
          logger.debug('ExternalRulesLoader', `Created ${filename} in ${targetDir}`);
        } catch (error) {
          logger.error('ExternalRulesLoader', `Failed to create ${filename}: ${error}`);
        }
      } else {
        logger.warn('ExternalRulesLoader', `No template available for ${filename}`);
      }
    }
    
    return createdFiles;
  }
}