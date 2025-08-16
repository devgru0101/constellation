/**
 * MongoDB Models for Constellation IDE
 */

const { MongoClient, ObjectId } = require('mongodb');

// MongoDB connection
const MONGODB_URL = process.env.MONGODB_URL || 'mongodb://localhost:27017/constellation-ide';

// Fallback storage (filesystem-based when MongoDB is not available)
const fs = require('fs').promises;
const path = require('path');

class Database {
  constructor() {
    this.client = null;
    this.db = null;
    this.isMongoConnected = false;
    this.fallbackStorage = path.join(__dirname, 'fallback_projects.json');
  }

  async connect() {
    try {
      this.client = new MongoClient(MONGODB_URL, {
        serverSelectionTimeoutMS: 3000, // 3 second timeout
        connectTimeoutMS: 3000,
      });
      
      console.log('🔄 Attempting MongoDB connection...');
      await this.client.connect();
      this.db = this.client.db();
      this.isMongoConnected = true;
      console.log('✅ Connected to MongoDB');
      
      // Create indexes
      await this.createIndexes();
    } catch (error) {
      console.warn('⚠️ MongoDB not available, using fallback storage:', error.message);
      this.isMongoConnected = false;
      
      // Initialize fallback storage
      await this.initializeFallbackStorage();
    }
  }

  async initializeFallbackStorage() {
    try {
      await fs.access(this.fallbackStorage);
    } catch (error) {
      // File doesn't exist, create it
      await fs.writeFile(this.fallbackStorage, JSON.stringify([], null, 2));
    }
    console.log('✅ Fallback storage initialized:', this.fallbackStorage);
  }

  async loadFallbackData() {
    try {
      const data = await fs.readFile(this.fallbackStorage, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      return [];
    }
  }

  async saveFallbackData(data) {
    await fs.writeFile(this.fallbackStorage, JSON.stringify(data, null, 2));
  }

  async createIndexes() {
    try {
      // Projects collection indexes
      await this.db.collection('projects').createIndex({ id: 1 }, { unique: true });
      await this.db.collection('projects').createIndex({ createdAt: -1 });
      await this.db.collection('projects').createIndex({ updatedAt: -1 });
      await this.db.collection('projects').createIndex({ status: 1 });
      
      console.log('✅ Database indexes created');
    } catch (error) {
      console.error('⚠️ Failed to create indexes:', error);
    }
  }

  async close() {
    if (this.client) {
      await this.client.close();
      console.log('📦 MongoDB connection closed');
    }
  }

  getCollection(name) {
    if (!this.db) {
      throw new Error('Database not connected');
    }
    return this.db.collection(name);
  }
}

// Project Model
class Project {
  static collection = null;
  static database = null;

  static init(database) {
    this.database = database;
    if (database.isMongoConnected) {
      this.collection = database.getCollection('projects');
    }
  }

  static async create(projectData) {
    const project = {
      id: projectData.id,
      name: projectData.name,
      description: projectData.description || '',
      type: projectData.type,
      status: projectData.status || 'ready',
      createdAt: projectData.createdAt || new Date(),
      updatedAt: new Date(),
      workspacePath: projectData.workspacePath || `/home/ssitzer/constellation-projects/${projectData.id}`,
      knowledgeBase: projectData.knowledgeBase || {
        requirements: [],
        businessRules: [],
        techStack: [],
        apis: []
      },
      containerConfig: projectData.containerConfig || null,
      metadata: {
        originalFiles: projectData.files || [],
        templateUsed: projectData.template || null,
        lastSync: new Date()
      }
    };

    if (this.database.isMongoConnected) {
      const result = await this.collection.insertOne(project);
      return { ...project, _id: result.insertedId };
    } else {
      // Fallback storage
      const projects = await this.database.loadFallbackData();
      projects.push(project);
      await this.database.saveFallbackData(projects);
      return project;
    }
  }

  static async findAll() {
    if (this.database.isMongoConnected) {
      return await this.collection.find({}).sort({ updatedAt: -1 }).toArray();
    } else {
      const projects = await this.database.loadFallbackData();
      return projects.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    }
  }

  static async findById(projectId) {
    if (this.database.isMongoConnected) {
      return await this.collection.findOne({ id: projectId });
    } else {
      const projects = await this.database.loadFallbackData();
      return projects.find(p => p.id === projectId) || null;
    }
  }

  static async updateById(projectId, updates) {
    const updateData = {
      ...updates,
      updatedAt: new Date()
    };

    if (this.database.isMongoConnected) {
      const result = await this.collection.updateOne(
        { id: projectId },
        { $set: updateData }
      );
      return result.matchedCount > 0;
    } else {
      const projects = await this.database.loadFallbackData();
      const index = projects.findIndex(p => p.id === projectId);
      if (index !== -1) {
        projects[index] = { ...projects[index], ...updateData };
        await this.database.saveFallbackData(projects);
        return true;
      }
      return false;
    }
  }

  static async deleteById(projectId) {
    if (this.database.isMongoConnected) {
      const result = await this.collection.deleteOne({ id: projectId });
      return result.deletedCount > 0;
    } else {
      const projects = await this.database.loadFallbackData();
      const index = projects.findIndex(p => p.id === projectId);
      if (index !== -1) {
        projects.splice(index, 1);
        await this.database.saveFallbackData(projects);
        return true;
      }
      return false;
    }
  }

  static async updateStatus(projectId, status) {
    return await this.updateById(projectId, { status });
  }

  static async updateFiles(projectId, files) {
    return await this.updateById(projectId, {
      'metadata.originalFiles': files,
      'metadata.lastSync': new Date()
    });
  }
}

// Export singleton database instance
const database = new Database();

module.exports = {
  database,
  Project
};